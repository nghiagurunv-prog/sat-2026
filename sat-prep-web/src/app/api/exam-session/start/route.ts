import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateModule } from '@/lib/exam-generator';
import { issueQuestion } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';
import { getMasterySummary } from '@/lib/mastery';
import { loadGates } from '@/lib/gate-store';
import { buildSkillTree } from '@/lib/skill-tree';
import { getUserTier } from '@/lib/subscription-store';
import { isE2E, e2eModule } from '@/lib/e2e';

/**
 * BẮT ĐẦU 1 SECTION THI ADAPTIVE (RW hoặc Math) — sinh Module 1 + phát đề.
 *
 * Kế thừa mô hình bảo mật ROOT A của /api/exams/start:
 *   • Sinh câu bằng AI (generateModule) → mỗi câu issueQuestion (lưu correct_choice
 *     + difficulty THẬT vào bảng issued_questions của user) → trả câu ĐÃ GIẤU đáp án
 *     kèm `questionId`. Client KHÔNG bao giờ thấy đáp án, KHÔNG tự chấm.
 *   • Lúc nộp: client gửi {questionId, answer}[] → /api/exam-session/submit chấm
 *     compare-and-swap + thưởng theo độ khó thật (mỗi câu tính điểm đúng 1 lần).
 *
 * PHÂN TẦNG (giống exams/start):
 *   • mode:'real' (Thi Thật QAS) = Premium+ VÀ tinh thông ≥6 kỹ năng (level≥7),
 *     enforce SERVER-SIDE tại đây.
 *   • mode:'mock' (mặc định) = miễn phí.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`exam-session-start:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const body = await request.json();
    const section = body.section === 'math' ? 'math' : body.section === 'rw' ? 'rw' : null;
    const mode = body.mode === 'real' ? 'real' : 'mock';

    if (!section) {
      return NextResponse.json({ error: 'section phải là "rw" hoặc "math"' }, { status: 400 });
    }

    // E2E: trả module đề TẤT ĐỊNH (bỏ OpenAI + DB) để Playwright chạy offline/nhanh.
    if (isE2E()) {
      const e2eMod = e2eModule(section, 1);
      const cleanQuestions = (e2eMod.questions || []).map((q: any) => {
        const {
          correct_choice: _c,
          correctChoice: _cc,
          correctAnswer: _ca,
          correct_answer: _ca2,
          explanation: _e,
          explanation_vi: _evi,
          explanationVi: _evi2,
          difficulty: _d,
          ...safe
        } = q;
        return safe;
      });
      return NextResponse.json({
        section,
        mode,
        module: { ...e2eMod, questions: cleanQuestions },
      });
    }

    // Thi Thật (QAS): gate tier server-side. Nếu level < 7 thì gắn cờ cảnh báo khuyên dùng
    // (Soft Warning) nhưng KHÔNG khóa cứng học viên đã mua gói Ultimate.
    let levelWarning = false;
    let currentLevel = 1;
    if (mode === 'real') {
      const [tier, summary, gates] = await Promise.all([
        getUserTier(user.id),
        getMasterySummary(user.id),
        loadGates(user.id),
      ]);

      if (tier !== 'ultimate') {
        return NextResponse.json(
          { error: 'Thi Thật QAS là quyền lợi gói Ultimate. Nâng cấp để mở khóa.', reason: 'tier' },
          { status: 403 }
        );
      }

      currentLevel = buildSkillTree(summary, gates).masteredCount + 1;
      levelWarning = currentLevel < 7;
    }

    const origin = request.nextUrl.origin;
    const cookie = request.headers.get('cookie') ?? '';

    const generated = await generateModule(section, 1, origin, cookie);

    if (generated.questions.length === 0) {
      return NextResponse.json(
        { error: 'Không thể sinh câu hỏi. Vui lòng thử lại sau.' },
        { status: 503 }
      );
    }

    // Phát từng câu: lưu đáp án + lời giải + độ khó server-side, trả câu đã giấu đáp án + questionId.
    // Khắc phục triệt để lỗ hổng #016: Xoá sạch mọi trường đáp án & giải thích (correct_choice,
    // correctAnswer, explanation, explanation_vi, v.v.) trước khi trả về client.
    const safeQuestions = await Promise.all(
      generated.questions.map(async (q) => {
        const correctChoice = q.correct_choice ?? (q as any).correctAnswer ?? '';
        const explanation = q.explanation ?? (q as any).explanation_vi ?? (q as any).explanationVi ?? null;
        const questionId = await issueQuestion(user.id, correctChoice, q.skillId, q.difficulty, {
          src: 'exam',
          explanation,
        });
        const {
          correct_choice: _c,
          correctChoice: _cc,
          correctAnswer: _ca,
          correct_answer: _ca2,
          explanation: _e,
          explanation_vi: _evi,
          explanationVi: _evi2,
          difficulty: _d,
          ...safe
        } = q as Record<string, any>;

        if (Array.isArray(safe.choices)) {
          safe.choices = safe.choices.map((choice: any) => {
            if (choice && typeof choice === 'object') {
              const { isCorrect: _ic, is_correct: _ic2, correct: _cor, ...cleanChoice } = choice;
              return cleanChoice;
            }
            return choice;
          });
        }

        return { ...safe, questionId };
      })
    );

    return NextResponse.json({
      section,
      mode,
      ...(mode === 'real' ? { levelWarning, level: currentLevel } : {}),
      module: {
        name: generated.name,
        timeMinutes: generated.timeMinutes,
        moduleNum: generated.moduleNum,
        section: generated.section,
        questions: safeQuestions,
      },
    });
  } catch (error) {
    console.error('exam-session start error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
