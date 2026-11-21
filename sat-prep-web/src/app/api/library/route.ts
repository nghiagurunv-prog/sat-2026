import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { getUserTier } from '@/lib/subscription-store';
import { listExamsPublic, getExamById, getExamQuestionMap } from '@/lib/exams';
import { issueQuestion } from '@/lib/issued-questions';

/**
 * LIBRARY — Thư viện đề thực chiến (làm bài THẬT có tính giờ).
 *
 * Nguồn câu hỏi: mock_exams.json (qua src/lib/exams.ts) — câu hỏi có sẵn đoạn
 * văn + 4 đáp án + đáp án đúng + lời giải tĩnh. Server LUÔN biết đáp án.
 *
 * GET          → danh sách thẻ câu (đã GIẤU đáp án) cho tìm kiếm/lọc.
 * POST {id}    → issueQuestion (lưu correct_choice + explanation server-side) →
 *                trả câu ĐÃ GIẤU đáp án + questionId + timeLimit. Client render
 *                qua CorePracticeUI → submit tự chấm qua /api/grade (server-auth).
 *
 * ID định dạng "<examId>::<questionId>" để tra ngược đúng câu trong đề.
 */

const SEP = '::';

/** Suy môn học từ tên module ("Reading & Writing (Module 1)" / "Math (Module 1)"). */
function subjectFromModule(name: string): 'Reading & Writing' | 'Math' {
  return /math|toán/i.test(name) ? 'Math' : 'Reading & Writing';
}

/** Cắt gọn câu hỏi để hiển thị preview trên thẻ. */
function preview(text: string, max = 90): string {
  const t = text.trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

function isFreeAccessibleExam(examId: string): boolean {
  return examId === 'mock_sat_1' || examId.startsWith('diagnostic');
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để mở thư viện đề.' }, { status: 401 });
  }

  const tier = await getUserTier(user.id);
  const isPaid = tier !== 'free';

  const cards: Array<{
    id: string;
    tag: string;
    text: string;
    source: string;
    subject: 'Reading & Writing' | 'Math';
    difficulty: string;
    isLocked: boolean;
  }> = [];

  for (const exam of listExamsPublic()) {
    const isLocked = !isPaid && !isFreeAccessibleExam(exam.id);
    for (const mod of exam.modules) {
      const subject = subjectFromModule(mod.name);
      for (const q of mod.questions) {
        cards.push({
          id: `${exam.id}${SEP}${q.id}`,
          tag: mod.name,
          text: preview(q.practice_question),
          source: exam.title,
          subject,
          difficulty: q.difficulty,
          isLocked,
        });
      }
    }
  }

  // Hỗ trợ phân trang optional (?page=&limit=), mặc định trả toàn bộ để tương thích ngược
  let pagedCards = cards;
  let total = cards.length;
  let page = 1;
  let limit = cards.length;
  if (req?.url) {
    try {
      const { searchParams } = new URL(req.url);
      const limitParam = searchParams.get('limit');
      const pageParam = searchParams.get('page');
      if (limitParam) {
        const parsedLimit = Math.min(200, Math.max(1, parseInt(limitParam, 10) || 50));
        const parsedPage = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        limit = parsedLimit;
        page = parsedPage;
        const start = (page - 1) * limit;
        pagedCards = cards.slice(start, start + limit);
      }
    } catch {
      // Bỏ qua nếu URL không hợp lệ trong unit test
    }
  }

  return NextResponse.json({ questions: pagedCards, total, page, limit, tier });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để luyện đề trong thư viện.' }, { status: 401 });
  }

  const rl = rateLimit(getRateLimitKey(req, 'library', user.id), 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const compositeId = body?.id;
  if (typeof compositeId !== 'string' || !compositeId.includes(SEP)) {
    return NextResponse.json({ error: 'id không hợp lệ' }, { status: 400 });
  }

  const [examId, questionRawId] = compositeId.split(SEP);
  const exam = getExamById(examId);
  if (!exam) {
    return NextResponse.json({ error: 'Không tìm thấy đề' }, { status: 404 });
  }

  // Tier Gating: Free chỉ mở được đề thử nghiệm miễn phí (mock_sat_1 / diagnostic)
  if (!isFreeAccessibleExam(examId)) {
    const tier = await getUserTier(user.id);
    if (tier === 'free') {
      return NextResponse.json(
        {
          error: 'Đề thi thực chiến nâng cao dành cho thành viên Pro/Premium/Ultimate. Vui lòng nâng cấp để mở khóa trọn bộ.',
          code: 'PRO_EXAM_REQUIRED',
        },
        { status: 403 }
      );
    }
  }

  // Tìm câu + module chứa nó (để suy timeLimit theo thời gian module / số câu).
  const qMap = getExamQuestionMap(exam);
  const q = qMap.get(questionRawId);
  if (!q) {
    return NextResponse.json({ error: 'Không tìm thấy câu hỏi' }, { status: 404 });
  }
  const mod = exam.modules.find((m) => m.questions.some((x) => x.id === questionRawId));

  // timeLimit (giây): thời gian module chia đều số câu, fallback 90s, kẹp [30, 300].
  let timeLimit = 90;
  if (mod && mod.questions.length > 0 && mod.time_minutes > 0) {
    timeLimit = Math.round((mod.time_minutes * 60) / mod.questions.length);
  }
  timeLimit = Math.min(300, Math.max(30, timeLimit));

  // Phát câu server-side: lưu đáp án đúng + lời giải trong context (GIẤU khỏi client).
  const questionId = await issueQuestion(user.id, q.correct_choice, undefined, q.difficulty, {
    src: 'library',
    explanation: q.explanation,
  });
  if (!questionId) {
    return NextResponse.json({ error: 'Không thể chuẩn bị câu hỏi. Vui lòng thử lại.' }, { status: 503 });
  }

  // Payload cho CorePracticeUI (PracticeQuestion) — KHÔNG kèm correct_choice/explanation.
  const question = {
    title: mod ? `${subjectFromModule(mod.name)} · ${exam.title}` : exam.title,
    full_passage: q.full_passage,
    practice_question: q.practice_question,
    choices: q.choices,
    explanation: '', // lộ SAU khi nộp qua /api/grade (revealedExplanation)
    difficulty: q.difficulty,
    trapRate: q.trapRate ?? 40,
    questionId,
  };

  return NextResponse.json({ question, questionId, timeLimit });
}
