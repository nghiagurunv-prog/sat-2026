/**
 * Point 100: SAT Tactical Helpers — Core Pure Logic for 100 SAT Improvements
 * Provides pure functions for SPR fraction/decimal parsing, Target Expression extraction,
 * Unit Conversion Trap detection, Leitner SRS scheduling, and Score Gap / Study Plan projection.
 */

export interface SprParseResult {
  isValid: boolean;
  numericValue: number | null;
  formattedPreview: string;
  warning?: string;
}

export interface SprValidationResult {
  valid: boolean;
  value?: number;
  error?: string;
  warning?: string;
}

/**
 * Parses a Student-Produced Response (SPR / Grid-in) input string according to College Board Bluebook rules.
 * Max 5 characters (6 if negative sign included). Supports integers, decimals, and simple fractions (a/b).
 * Mixed fractions like "3 1/2" are invalid in Bluebook (would be read as 31/2).
 */
export function parseSprInput(raw: string): SprParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { isValid: false, numericValue: null, formattedPreview: '' };
  }

  // Detect mixed number trap (e.g., "3 1/2")
  if (/^-?\d+\s+\d+\/\d+$/.test(trimmed)) {
    return {
      isValid: false,
      numericValue: null,
      formattedPreview: 'Lỗi: Hỗn số (Mixed Number)',
      warning: 'Bluebook KHÔNG chấp nhận hỗn số (ví dụ 3 1/2 sẽ bị tính nhầm là 31/2). Hãy đổi thành phân số tối giản (7/2) hoặc số thập phân (3.5).',
    };
  }

  const maxChars = trimmed.startsWith('-') ? 6 : 5;
  const charWarning =
    trimmed.length > maxChars
      ? `Vượt quá giới hạn ký tự Bluebook (${trimmed.length}/${maxChars} ký tự). Hãy rút gọn phân số hoặc làm tròn số thập phân.`
      : undefined;

  // Cảnh báo khi học sinh nhập số thập phân lặp bị cắt ngắn chưa đủ độ chính xác (ví dụ .66, 0.66, .33, 0.33)
  const isTruncatedRepeating = /^-?(?:0?\.(?:33|66))$/.test(trimmed);
  const repeatingWarning = isTruncatedRepeating
    ? 'Lưu ý: Với số thập phân vô hạn tuần hoàn (như 2/3), hãy nhập phân số 2/3 hoặc làm tròn đủ 4 chữ số (.666 hoặc .667).'
    : undefined;

  const effectiveWarning = charWarning || repeatingWarning;

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { isValid: false, numericValue: null, formattedPreview: 'Phân số chưa hoàn chỉnh', warning: charWarning };
    }
    // Mẫu số âm (ví dụ 3/-5)
    if (parts[1].includes('-') || Number(parts[1]) < 0) {
      return {
        isValid: false,
        numericValue: null,
        formattedPreview: 'Lỗi: Mẫu số âm',
        warning: 'Dấu trừ phải đặt ở đầu phân số (ví dụ: -3/5), không đặt dưới mẫu số.',
      };
    }
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return {
        isValid: false,
        numericValue: null,
        formattedPreview: den === 0 ? 'Lỗi: Mẫu số bằng 0' : 'Phân số không hợp lệ',
        warning: charWarning,
      };
    }
    const val = num / den;
    const rounded = Math.round(val * 10000) / 10000;
    return {
      isValid: !charWarning,
      numericValue: val,
      formattedPreview: `≈ ${rounded}`,
      warning: effectiveWarning,
    };
  }

  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { isValid: false, numericValue: null, formattedPreview: 'Giá trị không hợp lệ', warning: charWarning };
  }

  return {
    isValid: !charWarning,
    numericValue: num,
    formattedPreview: `${num}`,
    warning: effectiveWarning,
  };
}

/**
 * Validates SPR input returning a unified format for BluebookTools and test runners.
 */
export function validateSprInput(raw: string): SprValidationResult {
  const parsed = parseSprInput(raw);
  if (!parsed.isValid) {
    return {
      valid: false,
      value: parsed.numericValue ?? undefined,
      error: parsed.warning || (parsed.formattedPreview.startsWith('Lỗi') ? parsed.formattedPreview : 'Giá trị không hợp lệ'),
      warning: undefined,
    };
  }
  return {
    valid: true,
    value: parsed.numericValue ?? undefined,
    warning: parsed.warning,
  };
}

/**
 * Extracts the target expression trap at the end of a SAT Math stem (e.g., "what is the value of 2x + 5?").
 */
export function extractTargetExpressionTrap(questionStem: string): string | null {
  if (!questionStem) return null;
  const match = questionStem.match(
    /(?:what is the value of|find the value of|what is)\s+([^?.!]+?)\s*[?.!]*$/i
  );
  if (!match || !match[1]) return null;
  const target = match[1].trim();
  // Only flag if it's more than a single bare variable like "x" or "y"
  if (/^[a-zA-Z]$/.test(target)) return null;
  return target;
}

/**
 * Detects conflicting measurement units in a SAT Math stem (e.g., hours vs minutes, feet vs inches).
 */
export function detectUnitConversionTrap(questionStem: string): string[] {
  if (!questionStem) return [];
  const lower = questionStem.toLowerCase();
  const pairs: Array<[RegExp, RegExp, string]> = [
    [/\bhours?\b/, /\bminutes?\b/, 'hours ↔ minutes (×60)'],
    [/\bminutes?\b/, /\bseconds?\b/, 'minutes ↔ seconds (×60)'],
    [/\bfeet\b|\bfoot\b/, /\binch(?:es)?\b/, 'feet ↔ inches (×12)'],
    [/\byards?\b/, /\bfeet\b|\bfoot\b/, 'yards ↔ feet (×3)'],
    [/\bmiles?\b/, /\bkilometers?\b/, 'miles ↔ kilometers'],
    [/\bmeters?\b/, /\bcentimeters?\b/, 'meters ↔ centimeters (×100)'],
    [/\bkilograms?\b/, /\bgrams?\b/, 'kilograms ↔ grams (×1000)'],
  ];

  const detected: string[] = [];
  for (const [unitA, unitB, label] of pairs) {
    if (unitA.test(lower) && unitB.test(lower)) {
      detected.push(label);
    }
  }
  return detected;
}

/**
 * Computes human-readable countdown text for a Leitner SRS nextReviewAt timestamp.
 */
export function formatLeitnerNextReview(nextReviewAt: string | number | Date, nowMs: number = Date.now()): {
  isDue: boolean;
  label: string;
} {
  const targetMs = new Date(nextReviewAt).getTime();
  if (!Number.isFinite(targetMs)) {
    return { isDue: true, label: 'Cần ôn ngay hôm nay' };
  }
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return { isDue: true, label: 'Cần ôn ngay hôm nay' };
  }
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return { isDue: false, label: `Ôn sau ${diffHours} giờ` };
  }
  const diffDays = Math.ceil(diffHours / 24);
  return { isDue: false, label: `Ôn sau ${diffDays} ngày` };
}

/**
 * Projects daily question target based on current SAT score, target SAT score, and days until exam.
 */
export function calculateDailyStudyTarget(
  currentScore: number,
  targetScore: number,
  daysRemaining: number
): {
  scoreGap: number;
  dailyQuestions: number;
  weeklyMockExams: number;
  intensityLabel: 'Nhẹ nhàng' | 'Tiêu chuẩn' | 'Tăng tốc' | 'Nước rút';
} {
  const scoreGap = Math.max(0, targetScore - currentScore);
  const safeDays = Math.max(1, daysRemaining);
  // Roughly 3.5 practice questions per 1 point of score gain, clamped between 10 and 60 per day
  const rawDaily = Math.ceil((scoreGap * 3.5) / safeDays);
  const dailyQuestions = scoreGap === 0 ? 10 : Math.min(60, Math.max(12, rawDaily));

  let intensityLabel: 'Nhẹ nhàng' | 'Tiêu chuẩn' | 'Tăng tốc' | 'Nước rút' = 'Tiêu chuẩn';
  let weeklyMockExams = 1;
  if (dailyQuestions <= 15) {
    intensityLabel = 'Nhẹ nhàng';
    weeklyMockExams = 1;
  } else if (dailyQuestions <= 30) {
    intensityLabel = 'Tiêu chuẩn';
    weeklyMockExams = 1;
  } else if (dailyQuestions <= 45) {
    intensityLabel = 'Tăng tốc';
    weeklyMockExams = 2;
  } else {
    intensityLabel = 'Nước rút';
    weeklyMockExams = 3;
  }

  return {
    scoreGap,
    dailyQuestions,
    weeklyMockExams,
    intensityLabel,
  };
}

