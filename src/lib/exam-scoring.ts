/**
 * Digital SAT Scoring Curve — mô phỏng cách College Board quy đổi raw → scaled.
 *
 * Hard path (Module 2 khó): raw 0→200, raw max→800
 * Easy path (Module 2 dễ): raw 0→200, raw max→650 (trần bị cap)
 * Phi tuyến: sai ít ở đỉnh mất nhiều điểm/câu hơn sai nhiều ở đáy.
 */

import { matchesAnswer } from '@/lib/answer-match';
import { calibrateQuestionIrt, estimateThetaEAP, thetaToSatScore, type IRTItemResponse } from '@/lib/irt';

export type AdaptivePath = 'hard' | 'easy';

export interface SectionScore {
  raw: number;
  total: number;
  scaled: number;
  path: AdaptivePath;
  /** Tham số IRT 2PL EAP (Mục #10) khi câu hỏi có metadata độ khó / (a, b) */
  theta?: number;
  se?: number;
  scoringMethod?: 'irt-2pl' | 'curve';
}

export interface ExamScoreResult {
  rw: SectionScore;
  math: SectionScore;
  total: number;
}

const SECTION_MIN = 200;
const HARD_MAX = 800;
const EASY_MAX = 650;

/**
 * Phi tuyến curve: dùng power function để mô phỏng hiệu ứng "sai 1 câu ở top
 * mất nhiều hơn sai 1 câu ở bottom". Exponent < 1 tạo curve lõm (concave up)
 * — tăng nhanh ở đầu, chậm lại ở cuối → sai ít ở trần mất ~30 điểm/câu.
 */
function curvedScale(ratio: number, min: number, max: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  // exponent 0.85: ratio 0.96 (sai 1/27) → ~0.966 scaled → mất ~20 điểm
  // ratio 0.5 → ~0.54 scaled → khoảng giữa
  const curved = Math.pow(clamped, 0.85);
  const raw = min + curved * (max - min);
  return Math.round(raw / 10) * 10;
}

export function rawToScaled(rawCorrect: number, totalQuestions: number, path: AdaptivePath): number {
  if (totalQuestions === 0) return SECTION_MIN;
  const ratio = rawCorrect / totalQuestions;
  const max = path === 'hard' ? HARD_MAX : EASY_MAX;
  return curvedScale(ratio, SECTION_MIN, max);
}

export interface AnswerSet {
  answers: Record<string, string>;
  correctAnswers: Record<string, string>;
  /** Metadata độ khó tùy chọn để kích hoạt IRT 2PL EAP Pattern-Scoring (Mục #10) */
  difficulties?: Record<string, string>;
  /** Tham số IRT 2PL (a, b) tường minh nếu kho đề có sẵn */
  irtParams?: Record<string, { a: number; b: number }>;
}

/**
 * Chấm điểm phần thi bằng mô hình IRT 2PL EAP khi có metadata (a, b) hoặc difficulty;
 * fallback 100% tương thích ngược về `rawToScaled` nếu không có metadata IRT.
 */
export function computeSectionScore(
  sets: AnswerSet[],
  path: AdaptivePath
): SectionScore {
  let raw = 0;
  let total = 0;
  const irtResponses: IRTItemResponse[] = [];
  let hasIrtMetadata = false;

  for (const set of sets) {
    for (const [qId, correct] of Object.entries(set.correctAnswers)) {
      total++;
      const userAns = set.answers[qId];
      const isCorrect = matchesAnswer(userAns, correct);
      if (isCorrect) raw++;

      const explicit = set.irtParams?.[qId];
      const diff = set.difficulties?.[qId];
      if (explicit || diff) {
        hasIrtMetadata = true;
      }
      const { a, b } = explicit ?? calibrateQuestionIrt(diff ?? 'Medium');
      irtResponses.push({ a, b, correct: isCorrect });
    }
  }

  if (total === 0) {
    return { raw: 0, total: 0, scaled: SECTION_MIN, path, scoringMethod: 'curve' };
  }

  const maxCap = path === 'hard' ? HARD_MAX : EASY_MAX;

  if (hasIrtMetadata && irtResponses.length === total) {
    // Ước lượng theta bằng EAP (tránh phạt kép nhánh Easy: chỉ áp trần cap maxCap = 650)
    const prior = path === 'hard' ? 0.25 : -0.15;
    const eap = estimateThetaEAP(irtResponses, prior);
    let scaled: number;
    if (raw === 0) {
      scaled = SECTION_MIN;
    } else if (raw === total) {
      scaled = maxCap;
    } else {
      const irtSat = thetaToSatScore(eap.theta);
      scaled = Math.max(SECTION_MIN, Math.min(maxCap, irtSat));
    }
    return {
      raw,
      total,
      scaled,
      path,
      theta: eap.theta,
      se: eap.se,
      scoringMethod: 'irt-2pl',
    };
  }

  return {
    raw,
    total,
    scaled: rawToScaled(raw, total, path),
    path,
    scoringMethod: 'curve',
  };
}

export function computeExamScore(
  rwM1: AnswerSet,
  rwM2: AnswerSet,
  mathM1: AnswerSet,
  mathM2: AnswerSet,
  rwPath: AdaptivePath,
  mathPath: AdaptivePath
): ExamScoreResult {
  const rw = computeSectionScore([rwM1, rwM2], rwPath);
  const math = computeSectionScore([mathM1, mathM2], mathPath);

  return {
    rw,
    math,
    total: rw.scaled + math.scaled,
  };
}

/**
 * Adaptive cutoff: Module 1 đạt NGƯỠNG TỈ LỆ → Module 2 Hard; else Easy.
 *
 * ⚠️ Trước đây dùng ngưỡng TUYỆT ĐỐI (18/27, 15/22). Khi Module 1 sinh THIẾU câu
 * (OpenAI chặn/timeout → generateOneQuestion trả null → module ngắn hơn 27/22),
 * học sinh đúng 100% vẫn không chạm số tuyệt đối → bị ép easy path (trần 650) dù
 * rõ ràng ở trình hard. Đổi sang TỈ LỆ trên SỐ CÂU THỰC TẾ của module → route
 * đúng bất kể module dài ngắn.
 *
 * Ngưỡng tỉ lệ GIỮ NGUYÊN điểm gãy cũ ở module đầy đủ: 18/27 ≈ 0.667 (RW),
 * 15/22 ≈ 0.682 (Math) — module đầy đủ hành vi y hệt trước.
 */
export const RW_M1_CUTOFF = 18;   // tham chiếu: 18/27 ở module đầy đủ
export const MATH_M1_CUTOFF = 15; // tham chiếu: 15/22 ở module đầy đủ
export const RW_M1_CUTOFF_RATIO = 18 / 27;
export const MATH_M1_CUTOFF_RATIO = 15 / 22;

/**
 * @param correctCount  số câu ĐÚNG (server-graded, tamper-proof).
 * @param totalCount    TỔNG số câu M1 server thực sự chấm (đếm từ câu SỞ HỮU đã
 *                       verify — KHÔNG lấy answers.length client gửi, tránh client
 *                       bỏ bớt câu sai để thổi tỉ lệ ép hard path).
 * totalCount <= 0 (không chấm được câu nào) → 'easy' (mặc định an toàn, trần thấp).
 */
export function determineAdaptivePath(
  correctCount: number,
  totalCount: number,
  section: 'rw' | 'math'
): AdaptivePath {
  if (totalCount <= 0) return 'easy';
  const ratio = correctCount / totalCount;
  const cutoffRatio = section === 'rw' ? RW_M1_CUTOFF_RATIO : MATH_M1_CUTOFF_RATIO;
  return ratio >= cutoffRatio ? 'hard' : 'easy';
}
