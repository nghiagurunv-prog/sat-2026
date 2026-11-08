import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getHintTrap } from '@/lib/issued-questions';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

/**
 * HINT API (ROOT A) — gợi ý cấp 2 "loại trừ" mà KHÔNG lộ đáp án đúng.
 *
 * Trước đây client đọc choice_analysis thẳng từ payload generate-practice (chứa
 * is_correct → lộ đáp án). Nay choice_analysis lưu server-side; endpoint này trả
 * về ĐÚNG 1 đáp án SAI + phân tích bẫy của nó (không kèm đáp án đúng). Verify
 * quyền sở hữu + câu chưa nộp (getHintTrap). Không có analysis → 404 → client
 * fallback text chung. Việc TRỪ 20 xu do client làm (spendCoins, đã server-auth).
 */

/**
 * Hậu xử lý xoá mọi cụm từ lộ trực tiếp đáp án đúng kiểu "Đáp án đúng là A/B/C/D"
 * đối với các gợi ý Tier 1 và Tier 2 để giữ trọn tính sư phạm Socratic.
 */
function stripDirectAnswerDisclosure(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/(?:đáp án đúng|câu trả lời đúng|phương án đúng|chính xác là|đáp án chính xác)\s*(?:là\s*)?([A-D])/gi, 'đáp án cần tìm')
    .replace(/(?:the\s+correct\s+answer\s+is|correct\s+choice\s+is)\s*([A-D])/gi, 'the correct choice');
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    // Rate-limit qua getRateLimitKey chuẩn hóa
    const rateLimitKey = getRateLimitKey(req, 'hint', user?.id);
    const rl = rateLimit(rateLimitKey, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    // Giới hạn kích thước input chống payload phình to
    const rawBody = await req.json().catch(() => ({}));
    const questionId = typeof rawBody?.questionId === 'string' ? rawBody.questionId.slice(0, 200).trim() : '';
    const tier = typeof rawBody?.tier === 'number' ? rawBody.tier : (typeof rawBody?.tier === 'string' ? parseInt(rawBody.tier, 10) : 1);

    if (!questionId) {
      return NextResponse.json({ error: 'questionId bắt buộc' }, { status: 400 });
    }

    const trap = await getHintTrap(questionId, user.id);
    if (!trap) {
      return NextResponse.json({ error: 'Không có gợi ý cho câu này' }, { status: 404 });
    }

    // Ở gợi ý Tier 1 và Tier 2, tuyệt đối KHÔNG trả về correctAnswer / correct_choice
    // và hậu xử lý xoá mọi cụm lộ trực tiếp kiểu "Đáp án đúng là A/B/C/D".
    // Chỉ cho phép giải thích hoàn toàn ở Tier 3.
    const result: Record<string, unknown> = { ...trap };
    if (tier < 3) {
      delete result.correctAnswer;
      delete result.correct_choice;
      delete result.correct_answer;

      for (const [k, v] of Object.entries(result)) {
        if (typeof v === 'string') {
          result[k] = stripDirectAnswerDisclosure(v);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Hint error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
