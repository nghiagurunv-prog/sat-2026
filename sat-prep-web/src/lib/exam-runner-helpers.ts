/**
 * MODULAR HELPERS TÁCH TỪ ExamRunner.tsx (Mục #12, #15, #16, #26).
 * Thuần TypeScript — chạy test siêu tốc < 5ms, giữ 100% tương thích ngược với ExamRunner.
 */

export interface PassageHighlightRange {
  id: string;
  text: string;
  color: 'yellow' | 'green' | 'pink';
  startOffset?: number;
  endOffset?: number;
  note?: string;
}

export interface SprValidationResult {
  isValid: boolean;
  error?: string;
  errorMessage?: string;
  numericValue?: number;
  preview?: string;
  normalizedValue?: string;
}

/**
 * Mục #12: Real-time In-Exam Pacing Radar & Soft Time-Trap Nudge
 * - R&W chuẩn Bluebook ~71s/câu: >75s cảnh báo mềm, >110s time-trap.
 * - Math chuẩn Bluebook ~95s/câu: >100s cảnh báo mềm, >140s time-trap.
 */
export interface PacingRadarState {
  level: 'normal' | 'nudge' | 'trap';
  thresholdSec: number;
  message: string | null;
}

export function evaluateInExamPacing(
  elapsedSec: number,
  section: 'rw' | 'math'
): PacingRadarState {
  const safeSec = Math.max(0, Number(elapsedSec) || 0);
  const nudgeAt = section === 'rw' ? 75 : 100;
  const trapAt = section === 'rw' ? 110 : 140;

  if (safeSec >= trapAt) {
    return {
      level: 'trap',
      thresholdSec: trapAt,
      message: `Đã quá ${Math.floor(safeSec)}s — Nguy cơ sa lầy Time-Trap! Hãy gắn cờ (Flag) và chuyển câu ngay.`,
    };
  }
  if (safeSec >= nudgeAt) {
    return {
      level: 'nudge',
      thresholdSec: nudgeAt,
      message: `Đã quá ${nudgeAt}s — Cân nhắc gắn cờ (Flag) để quay lại kiểm tra sau.`,
    };
  }
  return { level: 'normal', thresholdSec: nudgeAt, message: null };
}

/**
 * Mục #16: Robust Text-Range Highlighting Offset
 * Tìm khoảng [startOffset, endOffset) chính xác chưa bị tô trùng trong full_passage.
 */
export function computeHighlightOffsets(
  passage: string,
  selectedText: string,
  existing: PassageHighlightRange[]
): { startOffset: number; endOffset: number } | null {
  if (!passage || !selectedText) return null;
  const usedStarts = new Set(
    existing
      .map((h) => h.startOffset)
      .filter((s): s is number => typeof s === 'number' && s >= 0)
  );

  let fromIdx = 0;
  while (fromIdx < passage.length) {
    const idx = passage.indexOf(selectedText, fromIdx);
    if (idx === -1) break;
    if (!usedStarts.has(idx)) {
      return { startOffset: idx, endOffset: idx + selectedText.length };
    }
    fromIdx = idx + 1;
  }

  const fallbackIdx = passage.indexOf(selectedText);
  if (fallbackIdx !== -1) {
    return { startOffset: fallbackIdx, endOffset: fallbackIdx + selectedText.length };
  }
  return null;
}

export interface PassageSlice {
  text: string;
  highlight?: PassageHighlightRange;
}

/**
 * Cắt đoạn văn thành các đoạn tĩnh dựa theo offset ký tự (tránh tô nhầm mọi từ lặp lại).
 */
export function slicePassageByHighlights(
  passage: string,
  highlights: PassageHighlightRange[]
): PassageSlice[] {
  if (!passage) return [];
  const validRanges = highlights
    .filter(
      (h): h is PassageHighlightRange & { startOffset: number; endOffset: number } =>
        typeof h.startOffset === 'number' &&
        typeof h.endOffset === 'number' &&
        h.startOffset >= 0 &&
        h.endOffset > h.startOffset &&
        h.endOffset <= passage.length
    )
    .sort((a, b) => a.startOffset - b.startOffset);

  if (validRanges.length === 0) {
    return [{ text: passage }];
  }

  const slices: PassageSlice[] = [];
  let cursor = 0;
  for (const h of validRanges) {
    if (h.startOffset < cursor) continue; // Tránh chồng lấn
    if (h.startOffset > cursor) {
      slices.push({ text: passage.slice(cursor, h.startOffset) });
    }
    slices.push({ text: passage.slice(h.startOffset, h.endOffset), highlight: h });
    cursor = h.endOffset;
  }
  if (cursor < passage.length) {
    slices.push({ text: passage.slice(cursor) });
  }
  return slices;
}

/**
 * Mục #15: Đánh giá trạng thái câu trên Pre-Submission Review Matrix (phân biệt SPR [123] & lỗi cú pháp).
 */
export function inspectReviewQuestionStatus(
  answer: string | undefined,
  isSpr: boolean,
  validateSpr: (raw: string) => SprValidationResult
): {
  isAnswered: boolean;
  isSpr: boolean;
  hasSprSyntaxError: boolean;
  sprError?: string;
} {
  const trimmed = (answer ?? '').trim();
  const isAnswered = trimmed.length > 0;
  if (!isSpr || !isAnswered) {
    return { isAnswered, isSpr, hasSprSyntaxError: false };
  }
  const check = validateSpr(trimmed);
  return {
    isAnswered,
    isSpr: true,
    hasSprSyntaxError: !check.isValid,
    sprError: check.errorMessage || check.error,
  };
}

export type HeuristicRootCause = 'Careless / Rushed' | 'Trap / Time-Trap' | 'Conceptual Gap';

/**
 * Mục #13: Heuristic Root-Cause Auto-Tagging cho Sổ Lỗi Sai
 * - < 30s  → 'Careless / Rushed'
 * - > 90s  → 'Trap / Time-Trap'
 * - Khác   → 'Conceptual Gap'
 */
export function classifyRootCause(
  timeSpentSec?: number | null,
  explicit?: string
): HeuristicRootCause {
  if (explicit && ['Careless / Rushed', 'Trap / Time-Trap', 'Conceptual Gap'].includes(explicit)) {
    return explicit as HeuristicRootCause;
  }
  if (typeof timeSpentSec === 'number' && Number.isFinite(timeSpentSec) && timeSpentSec > 0) {
    if (timeSpentSec < 30) return 'Careless / Rushed';
    if (timeSpentSec > 90) return 'Trap / Time-Trap';
  }
  return 'Conceptual Gap';
}
