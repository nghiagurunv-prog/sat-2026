import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSkillMastery } from '@/lib/mastery';
import { getSkill } from '@/lib/skill-taxonomy';
import { selectDifficulty } from '@/lib/adaptive';
import { buildVariantRequest } from '@/lib/mistake-variant';
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/gi,
  /system\s+prompt/gi,
  /<\/?system>/gi,
  /<\/?instructions>/gi,
  /override\s+(?:all\s+)?instructions/gi,
  /disregard\s+(?:all\s+)?(?:previous\s+)?instructions/gi,
];

/**
 * Sanitize đầu vào từ người dùng (lỗ hổng #013)
 */
function sanitizeInput(val: unknown, maxLength: number): string {
  if (typeof val !== 'string') return '';
  let cleaned = val.trim();
  let prev = '';
  let passes = 0;
  while (cleaned !== prev && passes < 3) {
    prev = cleaned;
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
    passes++;
  }
  return cleaned.slice(0, maxLength).trim();
}

/**
 * Kiểm định schema chặt chẽ cho từng câu hỏi do AI sinh ra (lỗ hổng #015)
 */
function validateQuestionSchema(data: unknown): { valid: boolean; reason?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'Dữ liệu câu hỏi không phải là đối tượng hợp lệ' };
  }

  const q = data as Record<string, unknown>;

  // 1. Phải có stem / practice_question không rỗng
  const stem =
    typeof q.stem === 'string' && q.stem.trim().length > 0
      ? q.stem.trim()
      : typeof q.practice_question === 'string' && q.practice_question.trim().length > 0
      ? q.practice_question.trim()
      : '';
  if (!stem) {
    return { valid: false, reason: 'Phải có stem (câu hỏi) không rỗng' };
  }

  // Đồng bộ cả 2 trường để tương thích client
  if (!q.stem) q.stem = stem;
  if (!q.practice_question) q.practice_question = stem;

  // 2. Phải có explanation không rỗng
  if (typeof q.explanation !== 'string' || q.explanation.trim().length === 0) {
    return { valid: false, reason: 'Phải có explanation không rỗng' };
  }

  // 3. Nếu là trắc nghiệm (choices có mặt), kiểm tra 4 đáp án và correct_choice
  if (q.choices !== undefined && q.choices !== null) {
    let choiceTexts: string[] = [];

    if (Array.isArray(q.choices)) {
      if (q.choices.length !== 4) {
        return { valid: false, reason: `Số lượng choices phải đủ 4 (hiện có ${q.choices.length})` };
      }
      for (let i = 0; i < 4; i++) {
        const item = q.choices[i];
        if (typeof item !== 'string' || item.trim().length === 0) {
          return { valid: false, reason: `Đáp án ${i + 1} bị rỗng` };
        }
        choiceTexts.push(item.trim());
      }
    } else if (typeof q.choices === 'object') {
      const choiceObj = q.choices as Record<string, unknown>;
      const keys = ['A', 'B', 'C', 'D'];
      for (const k of keys) {
        const val = choiceObj[k];
        if (typeof val !== 'string' || val.trim().length === 0) {
          return { valid: false, reason: `Đáp án ${k} bị rỗng hoặc thiếu` };
        }
        choiceTexts.push(val.trim());
      }
    } else {
      return { valid: false, reason: 'Trường choices không đúng định dạng mảng hoặc object' };
    }

    // 4 nội dung đáp án phải phân biệt nhau (không trùng lặp text)
    const distinctNormalized = new Set(choiceTexts.map((c) => c.toLowerCase()));
    if (distinctNormalized.size !== 4) {
      return { valid: false, reason: '4 nội dung đáp án trắc nghiệm phải phân biệt nhau (không trùng lặp)' };
    }

    // correct_choice phải thuộc ['A', 'B', 'C', 'D']
    const cc = typeof q.correct_choice === 'string' ? q.correct_choice.trim().toUpperCase() : '';
    if (!['A', 'B', 'C', 'D'].includes(cc)) {
      return { valid: false, reason: 'correct_choice phải thuộc [A, B, C, D]' };
    }
    q.correct_choice = cc;
  }

  return { valid: true };
}

/**
 * MISTAKE VARIANT API — sinh câu BIẾN THỂ để ôn câu sai (Nhóm 7 #6).
 *
 * GET ?skillId=algebra.linear_eq → chọn độ khó theo mastery THẬT của skill đó
 * (ZPD), rồi sinh câu CÙNG skill khác số liệu qua /api/generate-practice. Câu
 * trả về mang skillId THẬT → khi làm lại, CorePracticeUI ghi mastery đúng chỗ
 * (active recall trên biến thể là tín hiệu SRS mạnh hơn tự đánh giá).
 *
 * Vì sao server-side: client KHÔNG tự chọn skill/độ khó (chống chơi xấu) và
 * mastery chỉ đọc ở server (§9.1). Mirror pattern /api/tower/question.
 *
 * skillId không hợp lệ (câu sai cũ chưa gắn skill_id) → 400 để client ẩn nút.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  // Rate-limit chống spam AI generation (lỗ hổng #012)
  const rlKey = getRateLimitKey(request, 'ai-gen', user?.id);
  const rl = checkRateLimit(rlKey, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bạn tạo câu biến thể quá nhanh. Vui lòng thử lại sau.' },
      { status: 429 }
    );
  }

  const skillIdRaw = request.nextUrl.searchParams.get('skillId') ?? '';
  const skillId = sanitizeInput(skillIdRaw, 500);
  const skill = getSkill(skillId);
  if (!skill) {
    return NextResponse.json(
      { error: 'Câu sai này chưa gắn kỹ năng nên không tạo được biến thể.' },
      { status: 400 }
    );
  }

  // Độ khó ZPD theo mastery THẬT của skill (getSkillMastery trả rỗng nếu chưa làm).
  const mastery = await getSkillMastery(user.id, skillId).catch(() => null);
  const difficulty = selectDifficulty(mastery?.score ?? 0);
  const req = buildVariantRequest(skill, difficulty)!;

  try {
    const res = await fetch(new URL('/api/generate-practice', request.nextUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: JSON.stringify({
        moduleType: req.moduleType,
        topic: req.topic,
        skillId: req.skillId,
        difficulty: req.difficulty,
      }),
    });

    if (!res.ok) {
      // Chuyển nguyên trạng thái lỗi (quota 429 / budget 503 / cấu hình 500) để
      // client hiển thị đúng thông điệp thay vì nuốt mất.
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Không sinh được câu biến thể.' },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Kiểm định schema chặt chẽ cho câu hỏi biến thể trước khi trả về client (lỗ hổng #015)
    const validation = validateQuestionSchema(data);
    if (!validation.valid) {
      console.error('Variant question failed schema validation:', validation.reason);
      return NextResponse.json(
        { error: 'Câu biến thể không đạt chuẩn cấu trúc SAT. Vui lòng thử lại.' },
        { status: 502 }
      );
    }

    // Gắn kèm difficulty + skillId đã chọn (đảm bảo client/Mastery dùng đúng mức,
    // không phụ thuộc field difficulty do AI tự ghi).
    return NextResponse.json({ ...data, difficulty: req.difficulty, skillId: req.skillId });
  } catch (e) {
    console.error('Mistake variant: lỗi sinh câu hỏi', e);
    return NextResponse.json({ error: 'Lỗi sinh câu biến thể.' }, { status: 503 });
  }
}
