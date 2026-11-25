import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getHintTrap } from '@/lib/issued-questions';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';
import localBankJson from '../../../../data/question_bank.json';
import mockExams from '@/data/mock_exams.json';
import diagnosticQuestions from '@/data/diagnostic_questions.json';

/**
 * HINT API (ROOT A) — gợi ý cấp 2 "loại trừ" mà KHÔNG lộ đáp án đúng.
 *
 * Trước đây client đọc choice_analysis thẳng từ payload generate-practice (chứa
 * is_correct → lộ đáp án). Nay choice_analysis lưu server-side; endpoint này trả
 * về ĐÚNG 1 đáp án SAI + phân tích bẫy của nó (không kèm đáp án đúng). Verify
 * quyền sở hữu + câu chưa nộp (getHintTrap). Không có analysis → 404 → client
 * fallback text chung. Việc TRỪ 20 xu do client làm (spendCoins, đã server-auth).
 *
 * 🛡️ NÂNG CẤP ĐỢT 13 (Socratic 3-Tier Fallback & Guest-Trial Safe):
 *  - Tier 1: getHintTrap() từ bảng issued_questions (Server-authoritative).
 *  - Tier 2: Static Bank / Mock Exams / Diagnostic lookup (tổng hợp trap analysis không lộ đáp án đúng).
 *  - Tier 3: Deterministic Socratic Heuristic (Phương pháp Socratic Thầy Nghĩa Guru).
 *  - An toàn Guest/Offline: Không bao giờ trả 401/404/500 khi questionId hợp lệ.
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

/**
 * Lấy toàn bộ danh sách đề thi từ mock_exams.json để phục vụ tra cứu tĩnh Tier 2.
 */
function getAllExams(): any[] {
  return Array.isArray((mockExams as any)?.exams) ? (mockExams as any).exams : [];
}

/**
 * Tra cứu câu hỏi trong kho tĩnh (Diagnostic, Question Bank, Mock Exams) theo questionId.
 */
function getQuestionById(questionId: string): any | null {
  const targetId = questionId.trim();
  if (!targetId) return null;

  // 1. Diagnostic questions
  if (Array.isArray(diagnosticQuestions)) {
    const diag = diagnosticQuestions.find(
      (q: any) => q?.id === targetId || targetId.endsWith(`_${q?.id}`) || targetId.includes(q?.id)
    );
    if (diag) return diag;
  }

  // 2. Local question bank
  const bankItems = Array.isArray((localBankJson as any)?.questions) ? (localBankJson as any).questions : [];
  for (const item of bankItems) {
    const qData = item?.data || item;
    if (item?.id === targetId || qData?.id === targetId || targetId.includes(item?.id)) {
      return {
        ...qData,
        id: item?.id || qData?.id,
        topic: item?.topic || qData?.topic,
        moduleType: item?.moduleType || qData?.moduleType,
      };
    }
  }

  // 3. Across all exams
  const exams = getAllExams();
  for (const exam of exams) {
    if (!Array.isArray(exam?.modules)) continue;
    for (const mod of exam.modules) {
      if (!Array.isArray(mod?.questions)) continue;
      for (const q of mod.questions) {
        if (
          q?.id === targetId ||
          targetId === `${exam.id}_${q?.id}` ||
          targetId.endsWith(`_${q?.id}`) ||
          targetId.includes(q?.id)
        ) {
          return {
            ...q,
            topic: q?.domain || mod?.name || exam?.title,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Xây dựng gợi ý loại trừ Socratic Tier 2 từ câu hỏi tĩnh mà không lộ đáp án đúng.
 */
function buildTier2SocraticHint(q: any): { choice_letter: string; analysis: string; isFallback: boolean } | null {
  if (!q || typeof q !== 'object') return null;

  // Nếu câu hỏi đã có sẵn choice_analysis chứa ít nhất 1 phương án sai (bẫy)
  if (Array.isArray(q.choice_analysis) && q.choice_analysis.length > 0) {
    const trap = q.choice_analysis.find((c: any) => c && c.is_correct === false);
    if (trap && trap.analysis) {
      return {
        choice_letter: trap.choice_letter || 'Bẫy gợi ý',
        analysis: stripDirectAnswerDisclosure(trap.analysis),
        isFallback: false,
      };
    }
  }

  // Nếu câu hỏi có mảng choices và đáp án đúng
  const choices: string[] = Array.isArray(q.choices) ? q.choices : [];
  const correctChoice: string = typeof q.correct_choice === 'string'
    ? q.correct_choice
    : (typeof q.correctAnswer === 'string' ? q.correctAnswer : '');

  let choiceLetter = 'Bẫy gợi ý';
  if (choices.length > 0) {
    // Tìm một phương án sai để hướng dẫn học sinh loại trừ
    const incorrectChoice = choices.find((c: string) => {
      if (!correctChoice) return true;
      if (typeof c !== 'string') return false;
      const trimmed = c.trim();
      if (trimmed === correctChoice.trim()) return false;
      if (trimmed.startsWith(correctChoice) || correctChoice.startsWith(trimmed)) return false;
      const letterMatch = trimmed.match(/^([A-D])\)/i);
      if (letterMatch && correctChoice.trim().toUpperCase().startsWith(letterMatch[1].toUpperCase())) return false;
      return true;
    }) || choices[0];

    if (incorrectChoice && typeof incorrectChoice === 'string') {
      const match = incorrectChoice.match(/^([A-D])\)/i);
      if (match) {
        choiceLetter = match[1].toUpperCase();
      } else {
        const idx = choices.indexOf(incorrectChoice);
        if (idx >= 0 && idx < 26) {
          choiceLetter = String.fromCharCode(65 + idx);
        }
      }
    }
  }

  const topicStr = q.topic || q.domain || q.concept_name || 'dạng bài này';
  let contextHint = '';
  const rawExplanation = q.explanation_vi || q.explanation || '';
  if (typeof rawExplanation === 'string' && rawExplanation.trim()) {
    const expClean = stripDirectAnswerDisclosure(rawExplanation);
    const sentences = expClean
      .split(/(?<=[.?!])\s+/)
      .filter((s) => !/(?:đáp án|phương án|chọn\s+[A-D]|câu\s+[A-D])/i.test(s));
    if (sentences.length > 0) {
      contextHint = ` Gợi ý tư duy: ${sentences.slice(0, 2).join(' ')}`;
    }
  }

  const analysis = stripDirectAnswerDisclosure(
    `💡 Phân tích bẫy loại trừ (${topicStr}): Phương án ${choiceLetter} thường là bẫy nhiễu do nhầm lẫn điều kiện biên, suy diễn vượt quá ngữ cảnh bài đọc hoặc tính nhầm dấu.${contextHint} Hãy loại phương án này và cân nhắc các lựa chọn còn lại.`
  );

  return {
    choice_letter: choiceLetter,
    analysis,
    isFallback: false,
  };
}

/**
 * Gợi ý Socratic mang tính phương pháp luận cốt lõi Thầy Nghĩa Guru (Tier 3 Heuristic Fallback).
 */
function generateSocraticLocalHint(_questionId?: string): { choice_letter: string; analysis: string; isFallback: boolean } {
  return {
    choice_letter: 'Gợi ý Socratic',
    analysis: stripDirectAnswerDisclosure(
      '💡 Phương pháp Socratic Thầy Nghĩa Guru: (1) Xác định từ khóa giới hạn (mốc thời gian, đại lượng cực trị hoặc từ nối tương phản). (2) Loại trừ ngay các phương án chứa từ ngữ tuyệt đối hóa (always, never, completely) hoặc lệch phạm vi câu hỏi.'
    ),
    isFallback: true,
  };
}

export async function POST(req: Request) {
  let questionId = '';
  let tier = 1;

  try {
    // 1. Guest-Trial safe auth: Không bao giờ crash khi chưa đăng nhập
    let userId = 'local-default-user';
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        userId = user.id;
      }
    } catch (authErr) {
      console.warn('Hint auth lookup fallback:', authErr);
      userId = 'local-default-user';
    }

    // Rate-limit qua getRateLimitKey chuẩn hóa
    const rateLimitKey = getRateLimitKey(req, 'hint', userId);
    const rl = rateLimit(rateLimitKey, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    // Giới hạn kích thước input chống payload phình to
    const rawBody = await req.json().catch(() => ({}));
    questionId = typeof rawBody?.questionId === 'string' ? rawBody.questionId.slice(0, 200).trim() : '';
    tier = typeof rawBody?.tier === 'number' ? rawBody.tier : (typeof rawBody?.tier === 'string' ? parseInt(rawBody.tier, 10) : 1);

    if (!questionId) {
      return NextResponse.json({ error: 'questionId bắt buộc' }, { status: 400 });
    }

    // 2. 3-Tier Socratic Fallback
    // Tier 1: Thử lấy trap từ issued_questions
    let hintResult: { choice_letter: string; analysis: string; isFallback?: boolean } | null = null;
    try {
      const trap = await getHintTrap(questionId, userId);
      if (trap?.choice_letter && trap?.analysis) {
        hintResult = {
          choice_letter: trap.choice_letter,
          analysis: trap.analysis,
          isFallback: false,
        };
      }
    } catch (t1Err) {
      console.warn('Tier 1 getHintTrap error, falling back:', t1Err);
      hintResult = null;
    }

    // Tier 2: Tra cứu ngân hàng đề tĩnh (question bank, diagnostic, exams)
    if (!hintResult) {
      try {
        const question = getQuestionById(questionId);
        if (question) {
          hintResult = buildTier2SocraticHint(question);
        }
      } catch (t2Err) {
        console.warn('Tier 2 getQuestionById error, falling back:', t2Err);
        hintResult = null;
      }
    }

    // Tier 3: Deterministic Socratic Heuristic Thầy Nghĩa Guru
    if (!hintResult) {
      hintResult = generateSocraticLocalHint(questionId);
    }

    // 🔒 BẢO MẬT (#G7): LUÔN loại bỏ correctAnswer/correct_choice và hậu xử lý
    // stripDirectAnswerDisclosure ở MỌI tier (không cho client gửi tier=3 để bypass
    // lộ đáp án trước khi nộp bài).
    const requestedTier = Number.isFinite(tier) ? Math.min(Math.max(tier, 1), 3) : 1;
    const result: Record<string, unknown> = {
      tier: requestedTier,
      choice_letter: hintResult.choice_letter,
      analysis: hintResult.analysis,
      isFallback: !!hintResult.isFallback,
      hint: {
        choice_letter: hintResult.choice_letter,
        analysis: hintResult.analysis,
        isFallback: !!hintResult.isFallback,
      },
    };

    delete result.correctAnswer;
    delete result.correct_choice;
    delete result.correct_answer;

    for (const [k, v] of Object.entries(result)) {
      if (typeof v === 'string') {
        result[k] = stripDirectAnswerDisclosure(v);
      }
    }

    if (result.hint && typeof result.hint === 'object') {
      const hintObj = result.hint as Record<string, unknown>;
      delete hintObj.correctAnswer;
      delete hintObj.correct_choice;
      delete hintObj.correct_answer;
      for (const [k, v] of Object.entries(hintObj)) {
        if (typeof v === 'string') {
          hintObj[k] = stripDirectAnswerDisclosure(v);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Hint error:', error);
    // Luôn trả HTTP 200 { hint } khi questionId hợp lệ để Guest/offline users không bao giờ gặp 404/500
    if (questionId) {
      const fallback = generateSocraticLocalHint(questionId);
      return NextResponse.json({
        choice_letter: fallback.choice_letter,
        analysis: fallback.analysis,
        isFallback: true,
        hint: fallback,
      });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
