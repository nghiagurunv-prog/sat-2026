'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { rawToScaled, type AdaptivePath } from '@/lib/exam-scoring';
import { BluebookTools } from './BluebookTools';

// Câu thi ĐÃ GIẤU đáp án (ROOT A): chỉ có questionId để nộp lên server chấm.
interface ExamQuestion {
  id: string;
  questionId?: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
}

interface ModuleData {
  name: string;
  timeMinutes: number;
  moduleNum: 1 | 2;
  section: 'rw' | 'math';
  questions: ExamQuestion[];
}

type Phase = 'lobby' | 'loading' | 'in-module' | 'between-modules' | 'break' | 'finished' | 'submit-error';

// Kiểu dữ liệu Highlight đoạn văn (Điểm 01)
interface PassageHighlight {
  id: string;
  text: string;
  color: 'yellow' | 'green' | 'pink';
}

// Kiểu dữ liệu Lịch sử bài thi (Điểm 70 & Đồng bộ 2 khóa sat_exam_history_v1 / sat_exam_history_log_v1)
export interface ExamHistoryEntry {
  id: string;
  examId: string;
  testId?: string;
  examTitle: string;
  totalScore: number;
  score?: number;
  rwScore: number;
  mathScore: number;
  accuracy?: number;
  avgSecondsPerQuestion?: number;
  date: string;
  timestamp?: number;
  sectionMode: 'full' | 'rw_only' | 'math_only';
  durationUsedSeconds: number;
}

// Kết quả kiểm tra đáp án điền số SPR (Student-Produced Response)
export interface SprValidationResult {
  isValid: boolean;
  error?: string;
  errorMessage?: string;
  numericValue?: number;
  preview?: string;
  normalizedValue?: string;
}

/**
 * Bộ kiểm tra quy tắc nhập đáp án số SPR chuẩn College Board Digital SAT:
 * - Tối đa 5 ký tự (số dương) hoặc 6 ký tự (số âm, có dấu trừ ở đầu)
 * - Chấp nhận số nguyên, số thập phân (.), phân số (/)
 * - Không cho phép hỗn số (e.g. 3 1/2) hoặc mẫu số bằng 0
 * - Hiển thị giá trị tính toán xem trước (preview)
 */
export function validateSprInput(raw: string): SprValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Vui lòng nhập đáp án', errorMessage: 'Vui lòng nhập đáp án' };
  }

  // Ký tự hợp lệ chỉ gồm 0-9, ., /, -
  if (!/^[-0-9./]+$/.test(trimmed)) {
    const msg = 'Chỉ chấp nhận số 0-9, dấu chấm (.), gạch phân số (/), dấu âm (-)';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  // Dấu trừ chỉ được phép ở đầu tiên
  if (trimmed.includes('-') && (trimmed.indexOf('-') !== 0 || trimmed.slice(1).includes('-'))) {
    const msg = 'Dấu trừ (-) chỉ được đặt ở đầu số âm';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  // Giới hạn độ dài chuẩn College Board: tối đa 5 ký tự dương hoặc 6 ký tự âm
  const maxChars = trimmed.startsWith('-') ? 6 : 5;
  if (trimmed.length > maxChars) {
    const msg = `Vượt quá giới hạn College Board (tối đa ${maxChars} ký tự bao gồm cả dấu)`;
    return {
      isValid: false,
      error: msg,
      errorMessage: msg,
    };
  }

  // Không được chứa khoảng trắng (hỗn số)
  if (/\s/.test(raw)) {
    const msg = 'Không nhập hỗn số (ví dụ 3 1/2 phải đổi thành 7/2 hoặc 3.5)';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  // Phân số
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length > 2) {
      const msg = 'Chỉ được chứa tối đa 1 dấu gạch chéo phân số (/)';
      return { isValid: false, error: msg, errorMessage: msg };
    }
    const [numStr, denStr] = parts;
    if (!numStr || !denStr) {
      const msg = 'Phân số chưa hoàn chỉnh';
      return { isValid: false, error: msg, errorMessage: msg };
    }
    if (numStr.includes('.') || denStr.includes('.')) {
      const msg = 'Tử số và mẫu số phân số phải là số nguyên';
      return { isValid: false, error: msg, errorMessage: msg };
    }
    const num = Number(numStr);
    const den = Number(denStr);
    if (isNaN(num) || isNaN(den)) {
      const msg = 'Tử số hoặc mẫu số không hợp lệ';
      return { isValid: false, error: msg, errorMessage: msg };
    }
    if (den === 0) {
      const msg = 'Mẫu số không thể bằng 0';
      return { isValid: false, error: msg, errorMessage: msg };
    }
    const val = num / den;
    return {
      isValid: true,
      numericValue: val,
      preview: `${trimmed} ≈ ${Number(val.toFixed(4))}`,
      normalizedValue: trimmed,
    };
  }

  // Số thập phân
  if (trimmed.includes('.')) {
    const dotCount = (trimmed.match(/\./g) || []).length;
    if (dotCount > 1) {
      const msg = 'Chỉ được chứa tối đa 1 dấu chấm thập phân (.)';
      return { isValid: false, error: msg, errorMessage: msg };
    }
  }

  const numVal = Number(trimmed);
  if (isNaN(numVal)) {
    const msg = 'Giá trị số không hợp lệ';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  return {
    isValid: true,
    numericValue: numVal,
    preview: `${trimmed}`,
    normalizedValue: trimmed,
  };
}

// Phân loại nhịp độ Pacing theo 4 mức chuẩn
export type PacingTier = 'fast_correct' | 'on_pace' | 'slow_correct' | 'time_trap' | 'fast_wrong';

export function getPacingTier(timeSpent: number, isCorrect: boolean): {
  tier: PacingTier;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  borderClass: string;
  desc: string;
} {
  if (timeSpent > 90) {
    if (!isCorrect) {
      return {
        tier: 'time_trap',
        label: '🚨 Bẫy Thời Gian (>90s mà Sai - Cần khắc phục gấp)',
        shortLabel: '🚨 Bẫy Thời Gian (>90s & Sai)',
        icon: '🚨',
        badgeClass: 'bg-rose-950/80 border-rose-500 text-rose-200 ring-1 ring-rose-500/60 animate-pulse',
        borderClass: 'border-rose-500',
        desc: 'Mất nhiều thời gian đào sâu nhưng vẫn sai. Đây là bẫy thời gian làm tụt điểm nghiêm trọng!',
      };
    } else {
      return {
        tier: 'slow_correct',
        label: '⚠️ Tốn giờ (>90s nhưng Đúng)',
        shortLabel: '⚠️ Tốn giờ (>90s Đúng)',
        icon: '⚠️',
        badgeClass: 'bg-amber-950/60 border-amber-500/60 text-amber-300',
        borderClass: 'border-amber-500',
        desc: 'Đúng đáp án nhưng tiêu tốn quá nhiều quỹ thời gian, có nguy cơ thiếu giờ cho các câu sau.',
      };
    }
  } else if (timeSpent >= 60 && timeSpent <= 90) {
    return {
      tier: 'on_pace',
      label: '✅ Chuẩn nhịp (60-90s)',
      shortLabel: '✅ Chuẩn nhịp (60-90s)',
      icon: '✅',
      badgeClass: 'bg-blue-950/60 border-blue-500/60 text-blue-300',
      borderClass: 'border-blue-500',
      desc: 'Nhịp độ lý tưởng chuẩn Digital SAT (RW ~71s / Math ~95s), giữ được sự tỉnh táo và chính xác.',
    };
  } else {
    // timeSpent < 60
    if (isCorrect) {
      return {
        tier: 'fast_correct',
        label: '⚡ Nhanh & Đúng (<60s)',
        shortLabel: '⚡ Nhanh & Đúng (<60s)',
        icon: '⚡',
        badgeClass: 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300',
        borderClass: 'border-emerald-500',
        desc: 'Giải quyết siêu tốc và chính xác tuyệt đối, tích lũy thêm quỹ thời gian quý báu.',
      };
    } else {
      return {
        tier: 'fast_wrong',
        label: '⚡ Sai vội vàng (<60s)',
        shortLabel: '⚡ Sai vội vàng (<60s)',
        icon: '⚡❌',
        badgeClass: 'bg-purple-950/60 border-purple-500/60 text-purple-300',
        borderClass: 'border-purple-500',
        desc: 'Làm quá vội vàng dẫn đến sai sót đáng tiếc do bẫy đọc lướt hoặc tính toán ẩu.',
      };
    }
  }
}

// Nộp module có RETRY lỗi tạm thời (blip mạng / 429 / 5xx)
async function postSubmitWithRetry(payload: unknown, maxRetries = 2, timeoutMs = 20_000): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch('/api/exam-session/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
    }
  }
  throw lastErr ?? new Error('Nộp module thất bại');
}

interface SectionAcc {
  raw: number;
  total: number;
  path: AdaptivePath | null;
}

interface ExamReviewItem {
  questionId: string;
  moduleName: string;
  section: 'rw' | 'math';
  questionNumber: number;
  passage?: string;
  question: string;
  choices: string[];
  userAnswer: string;
  correct: boolean;
  correctChoice: string;
  explanation: string | null;
  skillId: string | null;
  timeSpent?: number;
}

interface ExamRunnerProps {
  title: string;
  subtitle: string;
  mode?: 'mock' | 'real';
  examType?: 'mock' | 'real';
  examId?: string;
  headerGradient?: string;
  titleGradient?: string;
  accentColor?: string;
}

// Header tách ra module-scope
function ExamHeader({
  title,
  subtitle,
  headerGradient,
  titleGradient,
  extraRight,
}: {
  title: string;
  subtitle: string;
  headerGradient: string;
  titleGradient: string;
  extraRight?: React.ReactNode;
}) {
  return (
    <div className="math-academy-header" style={{ background: headerGradient }}>
      <div className="math-title-container flex justify-between items-center w-full">
        <div className="flex items-center gap-3">
          <div className="math-icon">🏆</div>
          <div>
            <h1 className="math-title" style={{ background: titleGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{title}</h1>
            <p className="math-subtitle">{subtitle}</p>
          </div>
        </div>
        {extraRight && <div className="shrink-0">{extraRight}</div>}
      </div>
    </div>
  );
}

export default function ExamRunner({
  title,
  subtitle,
  mode,
  examType,
  examId,
  headerGradient = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  titleGradient = 'linear-gradient(to right, #fbbf24, #f59e0b)',
  accentColor = '#3b82f6',
}: ExamRunnerProps) {
  const effectiveMode: 'mock' | 'real' = examType || mode || 'mock';
  const effectiveExamId = examId || 'sat-mock-default';
  const { syncServerEconomy, updateQuestProgress } = useGamification();

  // Điểm 05: Chế độ Thi Từng Phần ('full' | 'rw_only' | 'math_only')
  const [sectionMode, setSectionMode] = useState<'full' | 'rw_only' | 'math_only'>('full');

  const [phase, setPhase] = useState<Phase>('lobby');
  const [currentSection, setCurrentSection] = useState<'rw' | 'math'>('rw');
  const [currentModule, setCurrentModule] = useState<ModuleData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // key = questionId
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [eliminatedChoices, setEliminatedChoices] = useState<Record<string, number[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [rwPath, setRwPath] = useState<AdaptivePath | null>(null);

  // Điểm 01: Highlight & Annotate
  const [highlights, setHighlights] = useState<Record<string, PassageHighlight[]>>({});
  const [passageNotes, setPassageNotes] = useState<Record<string, string>>({});
  const [activeHighlightColor, setActiveHighlightColor] = useState<'yellow' | 'green' | 'pink' | null>(null);
  const [showPassageNote, setShowPassageNote] = useState(false);

  // Điểm 02: Đồng hồ & Ẩn giờ / Cảnh báo <= 5 phút
  const [hideTimer, setHideTimer] = useState(false);

  // Điểm 03: Check Your Work - Rà soát Module
  const [showModuleReviewGrid, setShowModuleReviewGrid] = useState(false);
  const [moduleReviewFilter, setModuleReviewFilter] = useState<'all' | 'unanswered' | 'flagged'>('all');

  // Điểm 04: Crash Recovery
  interface SavedSessionData {
    examId?: string;
    title?: string;
    mode?: string;
    phase?: Phase;
    sectionMode?: 'full' | 'rw_only' | 'math_only';
    currentSection?: 'rw' | 'math';
    currentModule?: ModuleData;
    currentQuestionIndex?: number;
    answers?: Record<string, string>;
    flaggedQuestions?: Record<string, boolean>;
    eliminatedChoices?: Record<string, number[]>;
    timeLeft?: number;
    questionTimes?: Record<string, number>;
    passageNotes?: Record<string, string>;
    highlights?: Record<string, PassageHighlight[]>;
    rwPath?: AdaptivePath | null;
    accData?: { rw: SectionAcc; math: SectionAcc };
    reviewItems?: ExamReviewItem[];
    updatedAt?: number;
  }
  const [savedSession, setSavedSession] = useState<SavedSessionData | null>(null);

  // Điểm 06: Màn hình Nghỉ Giải Lao 10 Phút
  const [breakTimeLeft, setBreakTimeLeft] = useState(600);

  // Điểm 08: Chế độ Gạch bỏ đáp án (ABC Eliminator Mode)
  const [strikethroughMode, setStrikethroughMode] = useState(false);

  // Điểm SPR: Student-Produced Response (Ô nhập đáp án số tự điền Math)
  const [sprModeMap, setSprModeMap] = useState<Record<string, boolean>>({});
  const [showSprRulesModal, setShowSprRulesModal] = useState(false);

  // Điểm 09: Tỷ lệ chia cột đoạn văn (40/60, 50/50, 60/40)
  const [columnSplit, setColumnSplit] = useState<'40/60' | '50/50' | '60/40'>('50/50');

  // Điểm 10: Text Zoom (A-, A, A+)
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');

  // Điểm 11: Đo thời gian thực tế trên từng câu hỏi
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});

  // Điểm 15: Toàn màn hình Focus Mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Điểm 70: Lịch sử thi (Lobby Log)
  const [examHistory, setExamHistory] = useState<ExamHistoryEntry[]>([]);

  // Tích luỹ điểm mỗi section từ SERVER
  const accRef = useRef<{ rw: SectionAcc; math: SectionAcc }>({
    rw: { raw: 0, total: 0, path: null },
    math: { raw: 0, total: 0, path: null },
  });

  // #036: Wall-Clock Delta Timer chống đóng băng đồng hồ khi ẩn Tab
  const lastTickRef = useRef<number>(Date.now());
  // #038: Double-Submit Guard chống nộp bài kép (hết giờ + bấm nộp cùng lúc)
  const isSubmittingRef = useRef<boolean>(false);

  const [displayScore, setDisplayScore] = useState<{
    rw: number;
    math: number;
    total: number;
    rwRaw: number;
    rwTotal: number;
    rwPathResult: AdaptivePath;
    mathRaw: number;
    mathTotal: number;
    mathPathResult: AdaptivePath;
  } | null>(null);
  const [reviewItems, setReviewItems] = useState<ExamReviewItem[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'correct'>('wrong');
  const [savingMistakes, setSavingMistakes] = useState(false);
  const [mistakesSavedCount, setMistakesSavedCount] = useState<number | null>(null);
  const [pacingHeatmapFilter, setPacingHeatmapFilter] = useState<'all' | 'time_trap' | 'slow_correct' | 'on_pace' | 'fast_correct'>('all');

  // Khởi tạo & Đọc Lịch sử thi + Bản nháp dở dang từ localStorage (Đồng bộ 2 khóa: sat_exam_history_log_v1 & sat_exam_history_v1)
  useEffect(() => {
    try {
      // 1. Kiểm tra bản nháp đang thi dở
      const activeSessionRaw = localStorage.getItem(`sat_active_exam_session_${effectiveMode}`);
      if (activeSessionRaw) {
        const parsed: SavedSessionData = JSON.parse(activeSessionRaw);
        if (parsed && parsed.currentModule && parsed.answers) {
          setSavedSession(parsed);
        }
      }

      // 2. Tải lịch sử thi (hợp nhất đồng bộ từ cả sat_exam_history_log_v1 và sat_exam_history_v1)
      const historyRaw = localStorage.getItem('sat_exam_history_log_v1');
      const historyV1Raw = localStorage.getItem('sat_exam_history_v1');
      let combinedEntries: ExamHistoryEntry[] = [];

      if (historyRaw) {
        try {
          const parsed = JSON.parse(historyRaw);
          if (Array.isArray(parsed)) combinedEntries = parsed;
        } catch {}
      }

      // Fallback hoặc gộp nếu sat_exam_history_log_v1 chưa có hoặc ít hơn
      if (historyV1Raw) {
        try {
          const parsedV1 = JSON.parse(historyV1Raw);
          const v1List: any[] = Array.isArray(parsedV1)
            ? parsedV1
            : typeof parsedV1 === 'object' && parsedV1 !== null
            ? Object.values(parsedV1).flat()
            : [];

          const existingIds = new Set(combinedEntries.map((e) => e.id));
          v1List.forEach((item) => {
            if (!item) return;
            const entryId = String(item.id || `${item.timestamp || Date.now()}`);
            if (!existingIds.has(entryId)) {
              combinedEntries.push({
                id: entryId,
                examId: String(item.examId || item.testId || effectiveExamId),
                testId: String(item.testId || item.examId || effectiveExamId),
                examTitle: String(item.examTitle || item.title || 'Digital SAT Exam'),
                totalScore: Number(item.totalScore ?? item.score ?? 0),
                score: Number(item.score ?? item.totalScore ?? 0),
                rwScore: Number(item.rwScore ?? 0),
                mathScore: Number(item.mathScore ?? 0),
                accuracy: typeof item.accuracy === 'number' ? item.accuracy : undefined,
                avgSecondsPerQuestion: typeof item.avgSecondsPerQuestion === 'number' ? item.avgSecondsPerQuestion : undefined,
                date: String(item.date || new Date(item.timestamp || Date.now()).toISOString()),
                timestamp: Number(item.timestamp || Date.now()),
                sectionMode: item.sectionMode || 'full',
                durationUsedSeconds: Number(item.durationUsedSeconds ?? 0),
              });
              existingIds.add(entryId);
            }
          });
        } catch {}
      }

      setExamHistory(combinedEntries.slice(0, 50));
    } catch (e) {
      console.warn('Lỗi đọc localStorage:', e);
    }
  }, [effectiveMode, effectiveExamId]);

  // Toàn màn hình change listener (Điểm 15)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch (e) {
      console.warn('Toàn màn hình không khả dụng:', e);
    }
  };

  // #040: Cảnh báo beforeunload khi đang làm bài thi để ngăn học sinh vô tình đóng tab/F5
  useEffect(() => {
    if (phase !== 'in-module' && phase !== 'between-modules' && phase !== 'break') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [phase]);

  // #036: Timer đếm ngược module với Wall-Clock Delta chống đóng băng khi ẩn Tab
  useEffect(() => {
    if (phase !== 'in-module') return;
    lastTickRef.current = Date.now();

    const tick = () => {
      const now = Date.now();
      const deltaSec = Math.floor((now - lastTickRef.current) / 1000);
      if (deltaSec >= 1) {
        lastTickRef.current = now;
        setTimeLeft((prev) => Math.max(0, prev - deltaSec));
      }
    };

    const timer = setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [phase]);

  // Điểm 02: Tự động bật lại đồng hồ cảnh báo đỏ khi còn <= 5 phút (300s)
  useEffect(() => {
    if (phase === 'in-module' && timeLeft <= 300 && timeLeft > 0 && hideTimer) {
      setHideTimer(false);
    }
  }, [phase, timeLeft, hideTimer]);

  // Điểm 06: Đếm ngược 10 phút nghỉ giải lao giữa R&W và Math
  useEffect(() => {
    if (phase !== 'break') return;
    const timer = setInterval(() => {
      setBreakTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Điểm 11: Đo thời gian thực tế học sinh dừng lại ở câu hỏi hiện tại
  useEffect(() => {
    if (phase !== 'in-module' || !currentModule) return;
    const currentQ = currentModule.questions[currentQuestionIndex];
    if (!currentQ) return;
    const qKey = currentQ.questionId ?? currentQ.id;

    const timer = setInterval(() => {
      setQuestionTimes((prev) => ({
        ...prev,
        [qKey]: (prev[qKey] || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, currentModule, currentQuestionIndex]);

  // Điểm 04: Auto-Save định kỳ 5 giây và khi đổi câu/chọn đáp án
  useEffect(() => {
    if (phase !== 'in-module' && phase !== 'break') return;
    if (!currentModule) return;

    const saveInterval = setInterval(() => {
      try {
        const sessionPayload = {
          examId: effectiveExamId,
          title,
          mode: effectiveMode,
          phase,
          sectionMode,
          currentSection,
          currentModule,
          currentQuestionIndex,
          answers,
          flaggedQuestions,
          eliminatedChoices,
          timeLeft,
          questionTimes,
          passageNotes,
          highlights,
          rwPath,
          accData: accRef.current,
          reviewItems,
          updatedAt: Date.now(),
        };
        localStorage.setItem(`sat_active_exam_session_${effectiveMode}`, JSON.stringify(sessionPayload));
      } catch (e) {
        console.warn('Lỗi tự động lưu phiên thi:', e);
      }
    }, 5000);

    return () => clearInterval(saveInterval);
  }, [
    phase,
    currentModule,
    effectiveExamId,
    title,
    effectiveMode,
    sectionMode,
    currentSection,
    currentQuestionIndex,
    answers,
    flaggedQuestions,
    eliminatedChoices,
    timeLeft,
    questionTimes,
    passageNotes,
    highlights,
    rwPath,
    reviewItems,
  ]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const buildSubmittedAnswers = useCallback(() => {
    if (!currentModule) return [];
    const out: { questionId: string; answer: string }[] = [];
    for (const q of currentModule.questions) {
      const qId = q.questionId || q.id;
      if (qId) {
        out.push({ questionId: qId, answer: answers[qId] ?? '' });
      }
    }
    return out;
  }, [currentModule, answers]);

  const startSection = useCallback(async (section: 'rw' | 'math') => {
    setPhase('loading');
    setCurrentSection(section);
    setErrorMsg('');
    setLoadingMessage(`AI đang sinh đề ${section === 'rw' ? 'Reading & Writing' : 'Math'} Module 1...`);
    setLoadingProgress(10);

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + 5, 90));
    }, 2000);

    const ctrl = new AbortController();
    const startTimer = setTimeout(() => ctrl.abort(), 60_000);

    try {
      const res = await fetch('/api/exam-session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, mode: effectiveMode, examId: effectiveExamId }),
        signal: ctrl.signal,
      });
      clearTimeout(startTimer);
      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403 && err.reason === 'tier') {
          setErrorMsg('Thi Thật QAS là quyền lợi gói Ultimate. Đang chuyển tới trang nâng cấp...');
          setTimeout(() => { window.location.href = '/upgrade'; }, 1500);
          setPhase('lobby');
          return;
        }
        if (res.status === 403 && err.reason === 'capability') {
          setErrorMsg(err.error || 'Cần tinh thông đủ kỹ năng để mở khóa đề thi thật.');
          setPhase('lobby');
          return;
        }
        throw new Error(err.error || 'Không thể bắt đầu bài thi');
      }

      const data = await res.json();
      setLoadingProgress(100);
      setCurrentModule(data.module);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setFlaggedQuestions({});
      setEliminatedChoices({});
      setTimeLeft(data.module.timeMinutes * 60);
      lastTickRef.current = Date.now();
      setPhase('in-module');
    } catch (error) {
      clearTimeout(startTimer);
      clearInterval(progressInterval);
      console.error('Start section error:', error);
      setErrorMsg((error as Error)?.message || 'Không thể sinh đề thi. Vui lòng thử lại.');
      setPhase('lobby');
    }
  }, [effectiveMode, effectiveExamId]);

  // Hoàn thành bài thi và ghi nhận lịch sử (Điểm 70)
  const finishExam = useCallback(() => {
    const rw = accRef.current.rw;
    const math = accRef.current.math;
    const rwPathResult = rw.path ?? 'easy';
    const mathPathResult = math.path ?? 'easy';
    const rwScaled = rawToScaled(rw.raw, rw.total || 1, rwPathResult);
    const mathScaled = rawToScaled(math.raw, math.total || 1, mathPathResult);

    let totalScore = rwScaled + mathScaled;
    if (sectionMode === 'rw_only') totalScore = rwScaled;
    if (sectionMode === 'math_only') totalScore = mathScaled;

    const finalScoreBreakdown = {
      rw: rwScaled,
      math: mathScaled,
      total: totalScore,
      rwRaw: rw.raw,
      rwTotal: rw.total,
      rwPathResult,
      mathRaw: math.raw,
      mathTotal: math.total,
      mathPathResult,
    };

    setDisplayScore(finalScoreBreakdown);
    updateQuestProgress('exam', 1);

    // Xoá bản nháp active session khi đã nộp hoàn tất (Điểm 04)
    try {
      localStorage.removeItem(`sat_active_exam_session_${effectiveMode}`);
      setSavedSession(null);
    } catch (e) {}

    // Lưu Lịch sử làm bài vào CẢ 2 KHÓA (Điểm 70: sat_exam_history_log_v1 & sat_exam_history_v1)
    try {
      const totalSecondsUsed = Object.values(questionTimes).reduce((a, b) => a + b, 0);
      const totalQuestionsCount = Math.max(1, rw.total + math.total);
      const totalCorrectCount = rw.raw + math.raw;
      const accuracy = Math.round((totalCorrectCount / totalQuestionsCount) * 100);
      const avgSecondsPerQuestion = reviewItems.length > 0
        ? Math.round(totalSecondsUsed / reviewItems.length)
        : Math.round(totalSecondsUsed / totalQuestionsCount);

      const newEntry: ExamHistoryEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        examId: effectiveExamId,
        testId: effectiveExamId,
        examTitle: title,
        totalScore,
        score: totalScore,
        rwScore: rwScaled,
        mathScore: mathScaled,
        accuracy,
        avgSecondsPerQuestion,
        date: new Date().toISOString(),
        timestamp: Date.now(),
        sectionMode,
        durationUsedSeconds: totalSecondsUsed,
      };

      // 1. Ghi vào sat_exam_history_log_v1 (mảng chuẩn ExamRunner)
      const rawLog = localStorage.getItem('sat_exam_history_log_v1');
      const histLog: ExamHistoryEntry[] = rawLog ? JSON.parse(rawLog) : [];
      const updatedLog = [newEntry, ...(Array.isArray(histLog) ? histLog : [])].slice(0, 50);
      localStorage.setItem('sat_exam_history_log_v1', JSON.stringify(updatedLog));
      setExamHistory(updatedLog);

      // 2. Ghi đồng bộ vào sat_exam_history_v1 (để mock-exams/page.tsx và real-exams/page.tsx đọc)
      const rawV1 = localStorage.getItem('sat_exam_history_v1');
      let histV1List: any[] = [];
      if (rawV1) {
        try {
          const parsedV1 = JSON.parse(rawV1);
          if (Array.isArray(parsedV1)) {
            histV1List = parsedV1;
          } else if (typeof parsedV1 === 'object' && parsedV1 !== null) {
            histV1List = Object.values(parsedV1).flat();
          }
        } catch {}
      }
      const updatedV1 = [newEntry, ...histV1List].slice(0, 50);
      localStorage.setItem('sat_exam_history_v1', JSON.stringify(updatedV1));
    } catch (e) {
      console.warn('Lỗi ghi lịch sử thi vào localStorage:', e);
    }

    setPhase('finished');
  }, [updateQuestProgress, effectiveMode, sectionMode, effectiveExamId, title, questionTimes, reviewItems]);

  const submitModule = useCallback(async () => {
    // #038: Double-Submit Guard chống nộp bài kép (hết giờ + bấm nộp cùng lúc)
    if (!currentModule || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const section = currentModule.section;
    const moduleNum = currentModule.moduleNum;
    const submitted = buildSubmittedAnswers();

    setShowModuleReviewGrid(false);

    if (moduleNum === 1) {
      setPhase('between-modules');
      setLoadingMessage(`AI đang phân tích kết quả và sinh ${section === 'rw' ? 'Reading & Writing' : 'Math'} Module 2...`);
      setLoadingProgress(10);
    } else {
      setPhase('loading');
      setLoadingMessage('Đang chấm điểm...');
      setLoadingProgress(40);
    }

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + 5, 90));
    }, 2000);

    try {
      const res = await postSubmitWithRetry({ section, moduleNum, mode: effectiveMode, examId: effectiveExamId, answers: submitted });
      clearInterval(progressInterval);

      if (!res.ok) throw new Error('Không thể nộp module');

      const data = await res.json();
      syncServerEconomy(data.economy);

      if (Array.isArray(data.gradedItems)) {
        const gradedMap = new Map<
          string,
          { correct: boolean; correctChoice: string; explanation: string | null; skillId: string | null }
        >();
        for (const g of data.gradedItems) {
          if (g && typeof g.questionId === 'string') {
            gradedMap.set(g.questionId, g);
          }
        }
        const moduleReview: ExamReviewItem[] = currentModule.questions.map((q, idx) => {
          const qId = q.questionId ?? q.id;
          const graded = gradedMap.get(qId);
          return {
            questionId: qId,
            moduleName: currentModule.name,
            section: currentModule.section,
            questionNumber: idx + 1,
            passage: q.full_passage,
            question: q.practice_question,
            choices: q.choices,
            userAnswer: answers[qId] ?? '',
            correct: graded?.correct ?? false,
            correctChoice: graded?.correctChoice ?? '',
            explanation: graded?.explanation ?? null,
            skillId: graded?.skillId ?? null,
            timeSpent: questionTimes[qId] || 0,
          };
        });
        setReviewItems((prev) => {
          const existingIds = new Set(moduleReview.map((m) => m.questionId));
          return [...prev.filter((p) => !existingIds.has(p.questionId)), ...moduleReview];
        });
      }

      const acc = accRef.current[section];
      acc.raw += data.moduleResult?.correct ?? 0;
      acc.total += data.moduleResult?.total ?? 0;

      if (moduleNum === 1 && !data.module) {
        acc.path = data.adaptivePath;
        if (section === 'rw') {
          setRwPath(data.adaptivePath);
          if (sectionMode === 'rw_only') {
            finishExam();
          } else {
            setBreakTimeLeft(600);
            setPhase('break');
          }
        } else {
          finishExam();
        }
      } else if (moduleNum === 1) {
        acc.path = data.adaptivePath;
        if (section === 'rw') setRwPath(data.adaptivePath);
        setLoadingProgress(100);
        setCurrentModule(data.module);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setFlaggedQuestions({});
        setEliminatedChoices({});
        setTimeLeft(data.module.timeMinutes * 60);
        lastTickRef.current = Date.now();
        setPhase('in-module');
      } else {
        // Module 2 xong
        if (section === 'rw') {
          if (sectionMode === 'rw_only') {
            finishExam();
          } else {
            // Điểm 06: Vào nghỉ giải lao 10 phút trước khi vào Math
            setBreakTimeLeft(600);
            setPhase('break');
          }
        } else {
          finishExam();
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Submit module error:', error);
      setErrorMsg('Không nộp được module (mạng chập chờn). Bài làm của bạn vẫn được giữ an toàn — hãy thử nộp lại.');
      setPhase('submit-error');
    } finally {
      isSubmittingRef.current = false;
    }
  }, [currentModule, buildSubmittedAnswers, effectiveMode, effectiveExamId, syncServerEconomy, answers, questionTimes, sectionMode, finishExam]);

  // Auto-nộp khi hết giờ (#038: có Double-Submit Guard)
  useEffect(() => {
    if (phase === 'in-module' && timeLeft === 0 && currentModule && !isSubmittingRef.current) {
      void submitModule();
    }
  }, [timeLeft, phase, currentModule, submitModule]);

  // Phục hồi bài thi đang làm dở (Điểm 04)
  const resumeSavedSession = () => {
    if (!savedSession) return;
    try {
      if (savedSession.currentSection) setCurrentSection(savedSession.currentSection);
      if (savedSession.currentModule) setCurrentModule(savedSession.currentModule);
      if (typeof savedSession.currentQuestionIndex === 'number') setCurrentQuestionIndex(savedSession.currentQuestionIndex);
      if (savedSession.answers) setAnswers(savedSession.answers);
      if (savedSession.flaggedQuestions) setFlaggedQuestions(savedSession.flaggedQuestions);
      if (savedSession.eliminatedChoices) setEliminatedChoices(savedSession.eliminatedChoices);
      if (typeof savedSession.timeLeft === 'number') {
        setTimeLeft(savedSession.timeLeft);
        lastTickRef.current = Date.now();
      }
      if (savedSession.questionTimes) setQuestionTimes(savedSession.questionTimes);
      if (savedSession.passageNotes) setPassageNotes(savedSession.passageNotes);
      if (savedSession.highlights) setHighlights(savedSession.highlights);
      if (savedSession.sectionMode) setSectionMode(savedSession.sectionMode);
      if (savedSession.rwPath) setRwPath(savedSession.rwPath);
      if (savedSession.accData) accRef.current = savedSession.accData;
      if (savedSession.reviewItems) setReviewItems(savedSession.reviewItems);

      setPhase(savedSession.phase === 'break' ? 'break' : 'in-module');
      setSavedSession(null);
    } catch (err) {
      console.error('Lỗi khôi phục phiên thi:', err);
      setErrorMsg('Không thể phục hồi phiên thi. Đã bắt đầu lại từ Lobby.');
      setPhase('lobby');
    }
  };

  const discardSavedSession = () => {
    try {
      localStorage.removeItem(`sat_active_exam_session_${effectiveMode}`);
    } catch (e) {}
    setSavedSession(null);
  };

  const resetToLobby = () => {
    accRef.current = { rw: { raw: 0, total: 0, path: null }, math: { raw: 0, total: 0, path: null } };
    setRwPath(null);
    setDisplayScore(null);
    setReviewItems([]);
    setReviewFilter('wrong');
    setMistakesSavedCount(null);
    setCurrentModule(null);
    setAnswers({});
    setShowModuleReviewGrid(false);
    setPhase('lobby');
  };

  // Điểm 55: 1-Click Lưu Tất Cả N Câu Sai Vào Sổ Tay Cải Thiện
  const saveAllWrongToNotebook = async () => {
    const wrongItems = reviewItems.filter((item) => !item.correct);
    if (wrongItems.length === 0 || savingMistakes) return;
    setSavingMistakes(true);
    let saved = 0;
    try {
      for (const item of wrongItems) {
        const res = await fetch('/api/cau-sai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passage: item.passage || '',
            question: item.question,
            choices: item.choices,
            correct_choice: item.correctChoice || 'Xem lời giải',
            user_choice: item.userAnswer || '(Bỏ trống)',
            explanation: item.explanation || 'Hãy ôn lại dạng bài này trong lộ trình kỹ năng.',
            source: effectiveMode === 'real' ? `Thi Thật QAS - ${item.moduleName}` : `Thi Thử SAT - ${item.moduleName}`,
            skill_id: item.skillId,
          }),
        });
        if (res.ok) saved++;
      }
      setMistakesSavedCount(saved);
    } catch (e) {
      console.error('Lỗi lưu câu sai:', e);
    } finally {
      setSavingMistakes(false);
    }
  };

  const currentQuestion = currentModule?.questions[currentQuestionIndex];
  const qKey = currentQuestion ? (currentQuestion.questionId ?? currentQuestion.id) : '';
  const isFlagged = Boolean(flaggedQuestions[qKey]);
  const eliminatedForCurrent = eliminatedChoices[qKey] ?? [];

  const isSprQuestion = Boolean(
    currentQuestion && (
      (!currentQuestion.choices || currentQuestion.choices.length < 2) ||
      (currentModule?.section === 'math' && sprModeMap[qKey])
    )
  );

  const toggleFlagCurrent = useCallback(() => {
    if (!qKey) return;
    setFlaggedQuestions((prev) => ({ ...prev, [qKey]: !prev[qKey] }));
  }, [qKey]);

  const toggleEliminateChoice = (choiceIdx: number) => {
    if (!qKey) return;
    setEliminatedChoices((prev) => {
      const curr = prev[qKey] ?? [];
      const next = curr.includes(choiceIdx)
        ? curr.filter((i) => i !== choiceIdx)
        : [...curr, choiceIdx];
      return { ...prev, [qKey]: next };
    });
  };

  // Điểm 01: Áp dụng Highlight 3 màu trên đoạn văn
  const applyHighlight = (color: 'yellow' | 'green' | 'pink') => {
    if (!qKey) return;
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length > 0 && selectedText.length <= 600) {
      const newH: PassageHighlight = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: selectedText,
        color,
      };
      setHighlights((prev) => ({
        ...prev,
        [qKey]: [...(prev[qKey] || []), newH],
      }));
      selection?.removeAllRanges();
      setActiveHighlightColor(null);
    } else {
      setActiveHighlightColor((prev) => (prev === color ? null : color));
    }
  };

  const handlePassageMouseUp = () => {
    if (!activeHighlightColor || !qKey) return;
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && selectedText.length > 0 && selectedText.length <= 600) {
      const newH: PassageHighlight = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: selectedText,
        color: activeHighlightColor,
      };
      setHighlights((prev) => ({
        ...prev,
        [qKey]: [...(prev[qKey] || []), newH],
      }));
      selection?.removeAllRanges();
    }
  };

  const clearHighlights = () => {
    if (!qKey) return;
    setHighlights((prev) => ({ ...prev, [qKey]: [] }));
  };

  const removeHighlight = (hId: string) => {
    if (!qKey) return;
    setHighlights((prev) => ({
      ...prev,
      [qKey]: (prev[qKey] || []).filter((h) => h.id !== hId),
    }));
  };

  // Hàm wrap chữ highlight trong đoạn văn
  const highlightTextNode = (text: string, hList: PassageHighlight[]) => {
    if (!hList || hList.length === 0 || !text) return text;
    const sortedH = [...hList].sort((a, b) => b.text.length - a.text.length);
    const escaped = sortedH.map((h) => h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);
    if (parts.length <= 1) return text;

    return parts.map((part, pIdx) => {
      const matched = sortedH.find((h) => h.text.toLowerCase() === part.toLowerCase());
      if (matched) {
        let colorClass = 'bg-yellow-400/40 text-yellow-100 px-1 py-0.5 rounded border-b-2 border-yellow-400 font-medium';
        if (matched.color === 'green') {
          colorClass = 'bg-emerald-400/40 text-emerald-100 px-1 py-0.5 rounded border-b-2 border-emerald-400 font-medium';
        } else if (matched.color === 'pink') {
          colorClass = 'bg-pink-400/40 text-pink-100 px-1 py-0.5 rounded border-b-2 border-pink-400 font-medium';
        }
        return (
          <mark key={pIdx} className={colorClass}>
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Điểm 07: Hệ thống Phím tắt Bàn phím (Keyboard Shortcuts)
  useEffect(() => {
    if (phase !== 'in-module' || !currentModule || !currentQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
        return;
      }

      // Alt+F hoặc phím F: Cắm cờ / bỏ cờ Review
      if ((e.altKey && (e.key === 'f' || e.key === 'F')) || (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'f' || e.key === 'F'))) {
        e.preventDefault();
        toggleFlagCurrent();
        return;
      }

      // Alt+E hoặc phím E: Bật/tắt chế độ gạch loại trừ
      if ((e.altKey && (e.key === 'e' || e.key === 'E')) || (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'e' || e.key === 'E'))) {
        e.preventDefault();
        setStrikethroughMode((prev) => !prev);
        return;
      }

      // Mũi tên Trái / Phải: Chuyển câu
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentQuestionIndex((prev) => Math.min(currentModule.questions.length - 1, prev + 1));
        return;
      }

      // 1-4 hoặc A-D: Chọn đáp án
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        let choiceIdx = -1;
        const k = e.key.toLowerCase();
        if (k === '1' || k === 'a') choiceIdx = 0;
        else if (k === '2' || k === 'b') choiceIdx = 1;
        else if (k === '3' || k === 'c') choiceIdx = 2;
        else if (k === '4' || k === 'd') choiceIdx = 3;

        if (!isSprQuestion && choiceIdx >= 0 && currentQuestion?.choices && currentQuestion.choices[choiceIdx]) {
          e.preventDefault();
          const targetChoice = currentQuestion.choices[choiceIdx];
          const currKey = currentQuestion.questionId ?? currentQuestion.id;
          if (strikethroughMode) {
            // Khi đang bật mode gạch loại trừ, phím tắt gạch bỏ đáp án
            toggleEliminateChoice(choiceIdx);
          } else {
            setAnswers((prev) => ({ ...prev, [currKey]: targetChoice }));
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, currentModule, currentQuestion, strikethroughMode, toggleFlagCurrent]);

  // Cỡ chữ Text Zoom (Điểm 10)
  const getPassageFontSize = () => {
    switch (textSize) {
      case 'sm': return 'text-[15px] leading-relaxed';
      case 'lg': return 'text-[19px] leading-loose';
      case 'xl': return 'text-[21px] leading-loose';
      default: return 'text-[17px] leading-relaxed';
    }
  };

  const getQuestionFontSize = () => {
    switch (textSize) {
      case 'sm': return 'text-base';
      case 'lg': return 'text-xl';
      case 'xl': return 'text-2xl';
      default: return 'text-lg';
    }
  };

  // Chia cột Passage / Question (Điểm 09)
  const getColSplitClasses = () => {
    if (!currentQuestion?.full_passage) {
      return { passage: 'hidden', question: 'w-full' };
    }
    switch (columnSplit) {
      case '40/60':
        return { passage: 'w-full md:w-[40%] pr-4 md:border-r border-[#334155]', question: 'w-full md:w-[60%] pl-0 md:pl-4' };
      case '60/40':
        return { passage: 'w-full md:w-[60%] pr-4 md:border-r border-[#334155]', question: 'w-full md:w-[40%] pl-0 md:pl-4' };
      default:
        return { passage: 'w-full md:w-1/2 pr-6 md:border-r border-[#334155]', question: 'w-full md:w-1/2 pl-0 md:pl-6' };
    }
  };

  const currentHighlights = qKey ? (highlights[qKey] || []) : [];

  const header = (
    <ExamHeader
      title={title}
      subtitle={subtitle}
      headerGradient={headerGradient}
      titleGradient={titleGradient}
      extraRight={
        phase === 'in-module' ? (
          <div className="flex items-center gap-2">
            {/* Điểm 10: Nút Zoom chữ */}
            <div className="flex items-center bg-[#0b0f17] border border-[#334155] rounded-lg p-0.5 text-xs text-slate-300">
              <button
                type="button"
                onClick={() => setTextSize((prev) => (prev === 'xl' ? 'lg' : prev === 'lg' ? 'base' : 'sm'))}
                className="px-2 py-1 hover:text-white font-bold"
                title="Giảm cỡ chữ (A-)"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setTextSize('base')}
                className={`px-2 py-1 font-bold ${textSize === 'base' ? 'text-blue-400' : 'hover:text-white'}`}
                title="Cỡ chữ mặc định"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setTextSize((prev) => (prev === 'sm' ? 'base' : prev === 'base' ? 'lg' : 'xl'))}
                className="px-2 py-1 hover:text-white font-bold"
                title="Tăng cỡ chữ (A+)"
              >
                A+
              </button>
            </div>

            {/* Điểm 15: Nút Toàn màn hình Focus */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#0b0f17] border border-[#334155] text-slate-300 hover:text-white hover:border-slate-500 transition"
              title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Bật chế độ Toàn màn hình tập trung'}
            >
              {isFullscreen ? '⛷️ Thu nhỏ' : '⛶ Toàn màn hình'}
            </button>
          </div>
        ) : undefined
      }
    />
  );

  // --- RENDER PHASES ---

  // MÀN HÌNH LOBBY (Điểm 04, Điểm 05, Điểm 70)
  if (phase === 'lobby') {
    const matchingHistory = examHistory.filter(
      (h) => h.examId === effectiveExamId || h.examTitle === title
    );
    const maxScore = matchingHistory.length > 0 ? Math.max(...matchingHistory.map((h) => h.totalScore)) : null;
    const latestAttempt = matchingHistory[0] ?? null;
    const prevAttempt = matchingHistory[1] ?? null;
    const scoreDiff = latestAttempt && prevAttempt ? latestAttempt.totalScore - prevAttempt.totalScore : null;

    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        <div className="max-w-3xl mx-auto">
          {errorMsg && (
            <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-4 rounded-lg mb-4 text-sm">{errorMsg}</div>
          )}

          {/* Điểm 04: Banner Phát hiện bài thi đang làm dở */}
          {savedSession && (
            <div className="bg-gradient-to-r from-blue-950/90 via-indigo-950/80 to-slate-900 border-2 border-blue-500/60 rounded-xl p-5 mb-6 shadow-2xl animate-in slide-in-from-top duration-500">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl animate-spin">🔄</span>
                    <h3 className="font-black text-white text-base">Phát hiện bài thi đang làm dở!</h3>
                  </div>
                  <p className="text-xs text-blue-200 mt-1">
                    Đề: <strong className="text-white">{savedSession.title || title}</strong> • Phần:{' '}
                    <strong className="text-amber-300">{savedSession.currentModule?.name || savedSession.currentSection}</strong> • Đang dừng ở{' '}
                    <strong>Câu {(savedSession.currentQuestionIndex ?? 0) + 1}</strong> • Lưu lúc:{' '}
                    {savedSession.updatedAt ? new Date(savedSession.updatedAt).toLocaleTimeString() : 'Gần đây'}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={resumeSavedSession}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg hover:scale-105 transition"
                  >
                    ⚡ Tiếp tục làm bài ngay
                  </button>
                  <button
                    type="button"
                    onClick={discardSavedSession}
                    className="px-3.5 py-2.5 bg-[#161f2e] hover:bg-rose-950/50 border border-[#334155] hover:border-rose-500 text-slate-300 hover:text-rose-200 text-xs font-bold rounded-lg transition"
                    title="Xoá bản nháp và thi mới từ đầu"
                  >
                    🗑️ Xoá bản nháp
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-8 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold text-white">SAT Practice Test (Bản Chuẩn Digital SAT)</h2>
              {/* Điểm 70: Huy hiệu Lịch sử thành tích trên Lobby */}
              {maxScore !== null && (
                <div className="flex items-center gap-2 text-xs font-bold bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full text-amber-300">
                  <span>🏆 Kỷ lục: {maxScore}đ</span>
                  {scoreDiff !== null && (
                    <span className={scoreDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      ({scoreDiff >= 0 ? `+${scoreDiff}` : scoreDiff}đ)
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-gray-400 mb-6 text-sm">
              Mô phỏng 100% môi trường phòng thi Bluebook College Board: 4 module adaptive, phân tích IRT, đồng hồ thi và công cụ tính toán.
            </p>

            {/* Điểm 05: Bộ chọn Chế độ Thi Từng Phần (Section-Only Mock Mode) */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                🎯 Lựa chọn hình thức thi:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSectionMode('full')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    sectionMode === 'full'
                      ? 'bg-blue-600/20 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                      : 'bg-[#0f172a] border-[#334155] hover:border-slate-500 opacity-75'
                  }`}
                >
                  <div className="font-bold text-white text-sm flex items-center gap-1.5">
                    <span>🎯</span> Full Digital SAT
                  </div>
                  <div className="text-xs text-blue-300 mt-1">4 Modules • 134 phút</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">R&W (64p) + Math (70p)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSectionMode('rw_only')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    sectionMode === 'rw_only'
                      ? 'bg-blue-600/20 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                      : 'bg-[#0f172a] border-[#334155] hover:border-slate-500 opacity-75'
                  }`}
                >
                  <div className="font-bold text-white text-sm flex items-center gap-1.5">
                    <span>📖</span> Chỉ thi R&W
                  </div>
                  <div className="text-xs text-emerald-300 mt-1">2 Modules • 64 phút</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Thang điểm 800 R&W</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSectionMode('math_only')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    sectionMode === 'math_only'
                      ? 'bg-blue-600/20 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                      : 'bg-[#0f172a] border-[#334155] hover:border-slate-500 opacity-75'
                  }`}
                >
                  <div className="font-bold text-white text-sm flex items-center gap-1.5">
                    <span>📐</span> Chỉ thi Math
                  </div>
                  <div className="text-xs text-amber-300 mt-1">2 Modules • 70 phút</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Thang điểm 800 Math</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`p-4 rounded-lg border ${sectionMode === 'math_only' ? 'opacity-40 bg-[#0f172a] border-[#334155]' : 'bg-[#0f172a] border-[#334155]'}`}>
                <div className="text-sm text-gray-400 mb-1">Reading & Writing</div>
                <div className="text-white font-bold">2 Modules × 27 câu</div>
                <div className="text-xs text-gray-500 mt-1">32 phút / module</div>
              </div>
              <div className={`p-4 rounded-lg border ${sectionMode === 'rw_only' ? 'opacity-40 bg-[#0f172a] border-[#334155]' : 'bg-[#0f172a] border-[#334155]'}`}>
                <div className="text-sm text-gray-400 mb-1">Math</div>
                <div className="text-white font-bold">2 Modules × 22 câu</div>
                <div className="text-xs text-gray-500 mt-1">35 phút / module</div>
              </div>
            </div>

            <div className="bg-[#0c1322] border border-[#1e3a5f] rounded-lg p-4 mb-6">
              <h3 className="text-sm font-bold text-blue-300 mb-2">Cơ chế Adaptive chuẩn College Board</h3>
              <p className="text-xs text-gray-400">
                Module 2 tự điều chỉnh độ khó theo kết quả Module 1. Làm tốt M1 → M2 vào nhánh Khó (trần điểm 800). Làm chưa tốt → M2 vào nhánh Cơ bản (trần điểm giới hạn).
              </p>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="text-sm text-gray-400">
                <span className="text-[#fbbf24]">
                  ⏱️ {sectionMode === 'full' ? '134 Phút' : sectionMode === 'rw_only' ? '64 Phút' : '70 Phút'}
                </span>
                <span className="mx-2">|</span>
                <span className="text-[#34d399]">
                  {sectionMode === 'full' ? '98 Câu' : sectionMode === 'rw_only' ? '54 Câu' : '44 Câu'}
                </span>
                <span className="mx-2">|</span>
                <span className="text-[#f472b6]">💎 Thưởng theo độ khó</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (sectionMode === 'math_only') {
                    void startSection('math');
                  } else {
                    void startSection('rw');
                  }
                }}
                className="px-8 py-3.5 font-black text-white rounded-xl transition-all hover:scale-105 shadow-xl text-base tracking-wider"
                style={{ background: accentColor }}
              >
                BẮT ĐẦU THI NGAY 🚀
              </button>
            </div>

            {/* Điểm 70: Bảng tóm tắt Lịch sử các lần thi gần đây */}
            {matchingHistory.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[#334155]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📜</span> Lịch sử các lần thi gần đây ({matchingHistory.length} lần)
                  </h4>
                  {latestAttempt && (
                    <span className="text-xs text-slate-400">
                      Gần nhất: {new Date(latestAttempt.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#0f172a] text-slate-400 font-bold border-b border-[#334155]">
                      <tr>
                        <th className="py-2.5 px-3">Thời gian</th>
                        <th className="py-2.5 px-3">Hình thức</th>
                        <th className="py-2.5 px-3">R&W</th>
                        <th className="py-2.5 px-3">Math</th>
                        <th className="py-2.5 px-3">Tổng điểm</th>
                        <th className="py-2.5 px-3">Thời lượng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#263248]">
                      {matchingHistory.slice(0, 5).map((item) => (
                        <tr key={item.id} className="hover:bg-[#161f2e]">
                          <td className="py-2.5 px-3 text-slate-400">{new Date(item.date).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 font-semibold">
                            {item.sectionMode === 'full' ? 'Full SAT' : item.sectionMode === 'rw_only' ? 'Chỉ R&W' : 'Chỉ Math'}
                          </td>
                          <td className="py-2.5 px-3 text-blue-300 font-bold">{item.rwScore}</td>
                          <td className="py-2.5 px-3 text-emerald-300 font-bold">{item.mathScore}</td>
                          <td className="py-2.5 px-3 font-black text-amber-400">{item.totalScore}</td>
                          <td className="py-2.5 px-3 text-slate-400">{formatTime(item.durationUsedSeconds || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MÀN HÌNH LOADING
  if (phase === 'loading' || phase === 'between-modules') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-12 shadow-lg">
            <div className="text-5xl mb-6 animate-bounce">🧠</div>
            <h2 className="text-xl font-bold text-white mb-4">{loadingMessage}</h2>
            <div className="w-full bg-[#0f172a] rounded-full h-3 mb-4">
              <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${loadingProgress}%`, background: accentColor }} />
            </div>
            <p className="text-gray-400 text-sm">Câu hỏi được AI sinh theo chuẩn Digital SAT, đa dạng kỹ năng và độ khó...</p>
            {phase === 'between-modules' && rwPath && currentSection === 'rw' && (
              <div className="mt-6 p-4 rounded-lg border" style={{ borderColor: accentColor, background: 'rgba(59,130,246,0.1)' }}>
                <p className="text-sm font-bold text-white">
                  Nhánh Module 2: {rwPath === 'hard' ? '🔥 KHÓ (trần 800)' : '📘 CƠ BẢN (trần 650)'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Điểm 06: MÀN HÌNH NGHỈ GIẢI LAO 10 PHÚT CHUẨN BLUEBOOK
  if (phase === 'break') {
    const breakPercent = Math.max(0, Math.min(100, ((600 - breakTimeLeft) / 600) * 100));

    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        <div className="max-w-xl mx-auto text-center">
          <div className="bg-[#1b2533] border border-[#262730] rounded-2xl p-8 md:p-10 shadow-2xl space-y-6">
            <div className="text-6xl animate-pulse">☕</div>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                10-Minute Scheduled Break
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                Hoàn thành phần Reading & Writing!
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Theo quy chế thi Digital SAT thật, bạn có 10 phút nghỉ giải lao trước khi bước vào phần Math.
              </p>
            </div>

            {/* Đồng hồ đếm ngược 10 phút */}
            <div className="bg-[#0f172a] border border-[#334155] rounded-xl p-6">
              <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">
                Thời gian giải lao còn lại:
              </div>
              <div className="text-5xl font-black text-[#fbbf24] tracking-tight font-mono">
                {formatTime(breakTimeLeft)}
              </div>
              <div className="w-full bg-[#1b2533] rounded-full h-2 mt-4 overflow-hidden border border-[#334155]">
                <div
                  className="bg-amber-400 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${breakPercent}%` }}
                />
              </div>
            </div>

            {/* Lời khuyên giữ sức khỏe & quy chế */}
            <div className="text-left bg-[#0c1322] border border-[#1e3a5f] rounded-xl p-4 text-xs text-slate-300 space-y-2">
              <div className="font-bold text-blue-300 flex items-center gap-1.5">
                <span>📋</span> Lời khuyên phòng thi:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Đứng dậy, vươn vai, uống nước và thư giãn mắt.</li>
                <li>Không mở tài liệu, không sử dụng điện thoại hay trao đổi bài.</li>
                <li>Chuẩn bị sẵn nháp và kiểm tra máy tính Casio/Desmos cho phần Toán.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => void startSection('math')}
                className="w-full py-4 font-black text-white text-base rounded-xl transition-all hover:scale-[1.02] shadow-xl tracking-wider"
                style={{ background: accentColor }}
              >
                BỎ QUA NGHỈ GIẢI LAO, VÀO THI TOÁN NGAY →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MÀN HÌNH LỖI NỘP BÀI
  if (phase === 'submit-error') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-[#1b2533] border border-red-500/40 rounded-xl p-12 shadow-lg">
            <div className="text-5xl mb-6">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Chưa nộp được module</h2>
            <p className="text-gray-400 mb-6">{errorMsg}</p>
            <button
              onClick={() => void submitModule()}
              className="px-8 py-3 font-bold text-white rounded-lg transition-all hover:scale-105 shadow-lg"
              style={{ background: accentColor }}
            >
              🔄 Thử nộp lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MÀN HÌNH KẾT QUẢ THI (Điểm 11, Điểm 55, Điểm 70)
  if (phase === 'finished') {
    const wrongCount = reviewItems.filter((i) => !i.correct).length;
    const correctCount = reviewItems.filter((i) => i.correct).length;
    const overTimeCount = reviewItems.filter((i) => (i.timeSpent || 0) > 120).length;
    const totalTimeSpent = reviewItems.reduce((acc, i) => acc + (i.timeSpent || 0), 0);
    const avgTimeSpent = reviewItems.length > 0 ? Math.round(totalTimeSpent / reviewItems.length) : 0;

    const filteredReview = reviewItems.filter((item) => {
      if (reviewFilter === 'wrong') return !item.correct;
      if (reviewFilter === 'correct') return item.correct;
      return true;
    });

    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        {displayScore && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-[#0f172a] border rounded-xl p-8 text-center shadow-lg" style={{ borderColor: accentColor }}>
              <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 bg-[#1e293b] text-slate-300 border border-[#334155]">
                {sectionMode === 'full' ? '🎯 Full Digital SAT' : sectionMode === 'rw_only' ? '📖 Reading & Writing Section' : '📐 Math Section'}
              </div>
              <h2 className="text-3xl font-black text-white mb-4">KẾT QUẢ THI DIGITAL SAT</h2>
              <div className="text-[60px] font-black text-[#fbbf24] mb-2 drop-shadow-lg leading-none">
                {displayScore.total}{' '}
                <span className="text-2xl text-gray-400">
                  / {sectionMode === 'full' ? '1600' : '800'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8 mt-6">
                <div className={`p-5 rounded-lg border ${sectionMode === 'math_only' ? 'opacity-40 bg-[#1b2533] border-[#334155]' : 'bg-[#1b2533] border-[#334155]'}`}>
                  <div className="text-sm text-gray-400 mb-1">Reading & Writing</div>
                  <div className="text-3xl font-black text-[#60a5fa]">{displayScore.rw}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {displayScore.rwRaw}/{displayScore.rwTotal} câu đúng • {displayScore.rwPathResult === 'hard' ? '🔥 Hard' : '📘 Easy'} path
                  </div>
                </div>
                <div className={`p-5 rounded-lg border ${sectionMode === 'rw_only' ? 'opacity-40 bg-[#1b2533] border-[#334155]' : 'bg-[#1b2533] border-[#334155]'}`}>
                  <div className="text-sm text-gray-400 mb-1">Math</div>
                  <div className="text-3xl font-black text-[#34d399]">{displayScore.math}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {displayScore.mathRaw}/{displayScore.mathTotal} câu đúng • {displayScore.mathPathResult === 'hard' ? '🔥 Hard' : '📘 Easy'} path
                  </div>
                </div>
              </div>

              {/* Điểm 11: Thống kê thời gian trên trang kết quả */}
              <div className="bg-[#161f2e] border border-[#263248] rounded-lg p-3 text-xs text-slate-300 flex flex-wrap items-center justify-around gap-3 mb-6">
                <div>⏱️ Tổng thời gian: <strong>{formatTime(totalTimeSpent)}</strong></div>
                <div>⚡ Trung bình: <strong>~{avgTimeSpent}s / câu</strong></div>
                <div>
                  {overTimeCount > 0 ? (
                    <span className="text-amber-400 font-bold">
                      ⚠️ {overTimeCount} câu ngâm quá lâu (&gt;120s)
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold">✅ Quản lý thời gian tốt (&lt;120s/câu)</span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-6">💰 Xu & XP đã được cộng theo độ khó thật của từng câu đúng (chấm trên máy chủ).</p>

              {/* Điểm 55: Nút "📥 Lưu Tất Cả N Câu Sai Vào Sổ Tay" 1-Click */}
              <div className="flex flex-wrap justify-center gap-3">
                {wrongCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void saveAllWrongToNotebook()}
                    disabled={savingMistakes || mistakesSavedCount !== null}
                    className="px-6 py-3 font-bold text-amber-950 bg-gradient-to-r from-amber-300 to-yellow-500 hover:from-amber-200 hover:to-yellow-400 disabled:opacity-60 rounded-xl transition-all shadow-lg flex items-center gap-2"
                  >
                    <span>📥</span>
                    <span>
                      {mistakesSavedCount !== null
                        ? `✅ Đã lưu thành công ${mistakesSavedCount}/${wrongCount} câu sai vào Sổ tay`
                        : savingMistakes
                        ? '⏳ Đang lưu tất cả câu sai vào Sổ tay...'
                        : `Lưu Tất Cả ${wrongCount} Câu Sai Vào Sổ Tay Cải Thiện (1-Click SRS)`}
                    </span>
                  </button>
                )}
                <button
                  onClick={resetToLobby}
                  className="px-8 py-3 font-bold text-white rounded-xl transition-colors shadow-lg"
                  style={{ background: accentColor }}
                >
                  Quay lại Đấu Trường
                </button>
              </div>
            </div>

            {/* BẢN ĐỒ NHIỆT PHÂN BỔ THỜI GIAN TỪNG CÂU (QUESTION PACING HEATMAP - Digital SAT Benchmark) */}
            {reviewItems.length > 0 && (() => {
              const totalItems = reviewItems.length;
              const fastCorrect = reviewItems.filter((i) => (i.timeSpent || 0) < 60 && i.correct);
              const onPace = reviewItems.filter((i) => (i.timeSpent || 0) >= 60 && (i.timeSpent || 0) <= 90);
              const slowCorrect = reviewItems.filter((i) => (i.timeSpent || 0) > 90 && i.correct);
              const timeTraps = reviewItems.filter((i) => (i.timeSpent || 0) > 90 && !i.correct);

              const rwItems = reviewItems.filter((i) => i.section === 'rw');
              const mathItems = reviewItems.filter((i) => i.section === 'math');
              const rwAvg = rwItems.length > 0 ? Math.round(rwItems.reduce((a, b) => a + (b.timeSpent || 0), 0) / rwItems.length) : null;
              const mathAvg = mathItems.length > 0 ? Math.round(mathItems.reduce((a, b) => a + (b.timeSpent || 0), 0) / mathItems.length) : null;

              const filteredHeatmapItems = reviewItems.filter((item) => {
                const t = getPacingTier(item.timeSpent || 0, item.correct).tier;
                if (pacingHeatmapFilter === 'time_trap') return t === 'time_trap';
                if (pacingHeatmapFilter === 'slow_correct') return t === 'slow_correct';
                if (pacingHeatmapFilter === 'on_pace') return t === 'on_pace';
                if (pacingHeatmapFilter === 'fast_correct') return t === 'fast_correct';
                return true;
              });

              return (
                <div className="bg-[#131b2e] border-2 border-indigo-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs font-bold mb-2">
                        <span>⚡ BLUEBOOK PACING ANALYTICS</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                        <span>⏱️ Bản Đồ Nhiệt Phân Bổ Thời Gian (Question Pacing Heatmap)</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1">
                        Đối chiếu tốc độ phản xạ với Chuẩn nhịp độ College Board (Reading &amp; Writing: <strong>~71s/câu</strong> • Math: <strong>~95s/câu</strong>).
                      </p>
                    </div>

                    {/* So sánh với chuẩn College Board */}
                    <div className="flex items-center gap-3 shrink-0">
                      {rwAvg !== null && (
                        <div className="bg-[#1e293b] border border-slate-700 rounded-xl px-3.5 py-2 text-center">
                          <span className="block text-[10px] uppercase font-bold text-slate-400">RW Chuẩn ~71s</span>
                          <span className={`text-base font-black ${rwAvg <= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {rwAvg}s <span className="text-[10px] font-normal text-slate-400">/câu</span>
                          </span>
                        </div>
                      )}
                      {mathAvg !== null && (
                        <div className="bg-[#1e293b] border border-slate-700 rounded-xl px-3.5 py-2 text-center">
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Math Chuẩn ~95s</span>
                          <span className={`text-base font-black ${mathAvg <= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {mathAvg}s <span className="text-[10px] font-normal text-slate-400">/câu</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4 THẺ TỔNG KẾT THEO 4 MỨC PACING CHUẨN COLLEGE BOARD */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    {/* Mức 1: Nhanh & Đúng */}
                    <button
                      type="button"
                      onClick={() => setPacingHeatmapFilter(pacingHeatmapFilter === 'fast_correct' ? 'all' : 'fast_correct')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        pacingHeatmapFilter === 'fast_correct'
                          ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-400'
                          : 'bg-[#182338] border-emerald-500/30 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">⚡</span>
                        <span className="text-xs font-mono font-bold text-emerald-300">
                          {totalItems > 0 ? Math.round((fastCorrect.length / totalItems) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-emerald-200 uppercase tracking-wider">Nhanh &amp; Đúng</div>
                      <div className="text-2xl font-black text-emerald-400 mt-1">
                        {fastCorrect.length} <span className="text-xs font-normal text-slate-400">câu</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">&lt;60s &amp; giải quyết chuẩn xác</div>
                    </button>

                    {/* Mức 2: Chuẩn nhịp */}
                    <button
                      type="button"
                      onClick={() => setPacingHeatmapFilter(pacingHeatmapFilter === 'on_pace' ? 'all' : 'on_pace')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        pacingHeatmapFilter === 'on_pace'
                          ? 'bg-blue-950/80 border-blue-400 ring-2 ring-blue-400'
                          : 'bg-[#182338] border-blue-500/30 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">✅</span>
                        <span className="text-xs font-mono font-bold text-blue-300">
                          {totalItems > 0 ? Math.round((onPace.length / totalItems) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-blue-200 uppercase tracking-wider">Chuẩn Nhịp</div>
                      <div className="text-2xl font-black text-blue-400 mt-1">
                        {onPace.length} <span className="text-xs font-normal text-slate-400">câu</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">60 - 90s, nhịp độ thi tối ưu</div>
                    </button>

                    {/* Mức 3: Tốn giờ nhưng đúng */}
                    <button
                      type="button"
                      onClick={() => setPacingHeatmapFilter(pacingHeatmapFilter === 'slow_correct' ? 'all' : 'slow_correct')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        pacingHeatmapFilter === 'slow_correct'
                          ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-400'
                          : 'bg-[#182338] border-amber-500/30 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">⚠️</span>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {totalItems > 0 ? Math.round((slowCorrect.length / totalItems) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-amber-200 uppercase tracking-wider">Tốn Giờ (Đúng)</div>
                      <div className="text-2xl font-black text-amber-400 mt-1">
                        {slowCorrect.length} <span className="text-xs font-normal text-slate-400">câu</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">&gt;90s nhưng kịp tìm ra đáp án</div>
                    </button>

                    {/* Mức 4: Bẫy Thời Gian (>90s Sai) */}
                    <button
                      type="button"
                      onClick={() => setPacingHeatmapFilter(pacingHeatmapFilter === 'time_trap' ? 'all' : 'time_trap')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        pacingHeatmapFilter === 'time_trap'
                          ? 'bg-rose-950/80 border-rose-400 ring-2 ring-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                          : 'bg-[#182338] border-rose-500/40 hover:border-rose-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">🚨</span>
                        <span className="text-xs font-mono font-bold text-rose-300">
                          {totalItems > 0 ? Math.round((timeTraps.length / totalItems) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-rose-200 uppercase tracking-wider">Bẫy Thời Gian</div>
                      <div className="text-2xl font-black text-rose-400 mt-1">
                        {timeTraps.length} <span className="text-xs font-normal text-slate-400">câu</span>
                      </div>
                      <div className="text-[11px] text-rose-300/80 mt-1">&gt;90s mà vẫn sai - Cần khắc phục gấp!</div>
                    </button>
                  </div>

                  {/* LƯỚI TỪNG CÂU HỎI HEATMAP (Interactive Matrix) */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        🗺️ Lưới câu hỏi nhịp độ (Bấm câu bất kỳ để xem giải thích &amp; đáp án chi tiết):
                      </span>
                      <div className="flex items-center gap-2">
                        {pacingHeatmapFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setPacingHeatmapFilter('all')}
                            className="text-xs font-bold px-2.5 py-1 rounded bg-slate-800 text-blue-300 hover:text-white border border-slate-700 transition"
                          >
                            Hiển thị tất cả ({totalItems})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2">
                      {filteredHeatmapItems.map((item) => {
                        const time = item.timeSpent || 0;
                        const pInfo = getPacingTier(time, item.correct);
                        return (
                          <button
                            key={item.questionId}
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`review-question-${item.questionId}`);
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all hover:scale-105 active:scale-95 ${pInfo.badgeClass}`}
                            title={`${item.moduleName} - Câu ${item.questionNumber}: ${time}s • ${pInfo.label}`}
                          >
                            <span className="text-[11px] font-black">{item.questionNumber}</span>
                            <span className="text-[10px] font-mono mt-0.5">{time}s</span>
                            <span className="text-[11px] mt-0.5">{item.correct ? '✓' : '✗'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* XEM LẠI CHI TIẾT BÀI LÀM & LỜI GIẢI */}
            {reviewItems.length > 0 && (
              <div className="bg-[#1b2533] border border-[#334155] rounded-xl p-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#334155] pb-4 mb-6">
                  <div>
                    <h3 className="text-xl font-black text-white">🔍 Xem lại chi tiết bài làm & Lời giải AI</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Phân tích từng câu hỏi bạn vừa hoàn thành, kèm thời gian thực tế đã bỏ ra cho mỗi câu.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewFilter('wrong')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                        reviewFilter === 'wrong'
                          ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                          : 'bg-[#0f172a] border-[#334155] text-slate-400 hover:text-white'
                      }`}
                    >
                      ❌ Câu sai ({wrongCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewFilter('correct')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                        reviewFilter === 'correct'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-[#0f172a] border-[#334155] text-slate-400 hover:text-white'
                      }`}
                    >
                      ✅ Câu đúng ({correctCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewFilter('all')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                        reviewFilter === 'all'
                          ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                          : 'bg-[#0f172a] border-[#334155] text-slate-400 hover:text-white'
                      }`}
                    >
                      📋 Tất cả ({reviewItems.length})
                    </button>
                  </div>
                </div>

                {filteredReview.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    {reviewFilter === 'wrong'
                      ? '🎉 Xuất sắc! Bạn không làm sai câu nào trong bài thi này.'
                      : 'Không có câu hỏi nào trong bộ lọc này.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredReview.map((item) => {
                      const itemTime = item.timeSpent || 0;
                      const isOverTime = itemTime > 120;
                      const pTier = getPacingTier(itemTime, item.correct);

                      return (
                        <div
                          key={item.questionId}
                          id={`review-question-${item.questionId}`}
                          className={`rounded-xl border p-5 bg-[#0f172a] transition-all ${
                            item.correct ? 'border-emerald-500/30' : 'border-rose-500/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#1e293b] text-slate-300 border border-[#334155]">
                                {item.moduleName} • Câu {item.questionNumber}
                              </span>
                              {/* Điểm 11: Nhãn thời gian và cảnh báo ngâm quá lâu */}
                              <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-[#161f2e] border border-[#263248]">
                                ⏱️ {itemTime}s
                              </span>
                              {/* Pacing Tier Badge */}
                              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${pTier.badgeClass}`} title={pTier.desc}>
                                {pTier.shortLabel}
                              </span>
                              {isOverTime && (
                                <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded">
                                  ⚠️ Ngâm quá lâu (&gt;120s)
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs font-black px-2.5 py-1 rounded ${
                                item.correct
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {item.correct ? '✅ Chính xác' : '❌ Chưa chính xác'}
                            </span>
                          </div>

                          {item.passage && (
                            <div className="mb-3 p-3.5 rounded-lg bg-[#161f2e] border border-[#263248] text-slate-300 text-sm font-serif leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {item.passage}
                              </ReactMarkdown>
                            </div>
                          )}

                          <div className="font-bold text-white text-base mb-3">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {item.question}
                            </ReactMarkdown>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                            <div
                              className={`p-3 rounded-lg border ${
                                item.correct
                                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                              }`}
                            >
                              <div className="text-[11px] uppercase font-bold opacity-75 mb-1">Bạn đã chọn:</div>
                              <div className="font-semibold">
                                {item.userAnswer ? (
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {item.userAnswer}
                                  </ReactMarkdown>
                                ) : (
                                  <span className="italic text-rose-300">(Bỏ trống — Chưa chọn đáp án)</span>
                                )}
                              </div>
                            </div>

                            <div className="p-3 rounded-lg border bg-emerald-950/30 border-emerald-500/40 text-emerald-200">
                              <div className="text-[11px] uppercase font-bold opacity-75 mb-1">Đáp án đúng:</div>
                              <div className="font-semibold">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {item.correctChoice || 'Đang cập nhật'}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>

                          {item.explanation && (
                            <div className="mt-3 p-4 rounded-lg bg-blue-950/30 border border-blue-500/30 text-slate-200 text-sm leading-relaxed">
                              <div className="text-xs font-black text-blue-300 uppercase tracking-wider mb-1">
                                💡 Giải thích chi tiết:
                              </div>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {item.explanation}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // PHASE === 'in-module'
  if (!currentModule || !currentQuestion) return null;

  const colClasses = getColSplitClasses();

  return (
    <div className="space-y-0 animate-in fade-in duration-700 pb-20">
      {header}

      {/* MODAL QUY TẮC ĐIỀN SỐ SPR THEO CHUẨN COLLEGE BOARD BLUEBOOK */}
      {showSprRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div className="bg-[#1b2533] border-2 border-indigo-500/50 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#334155] pb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔢</span>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white">
                    Quy tắc điền số SPR (Student-Produced Response)
                  </h3>
                  <p className="text-xs text-indigo-300">Chuẩn chính thức College Board Bluebook Digital SAT</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSprRulesModal(false)}
                className="text-slate-400 hover:text-white text-2xl font-bold px-2"
                title="Đóng bảng hướng dẫn"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 text-sm text-slate-200 pr-1">
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="text-emerald-400">1. Độ dài tối đa &amp; Ký tự cho phép:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  • Tối đa <strong>5 ký tự</strong> cho số dương (ví dụ: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">12345</code>, <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">17/25</code>, <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">3.141</code>).<br />
                  • Tối đa <strong>6 ký tự</strong> nếu là số âm có dấu trừ ở đầu (ví dụ: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">-12/3</code>, <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">-0.75</code>).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="text-blue-400">2. Phân số &amp; Hỗn số:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  • Phân số được nhập bằng dấu gạch chéo <code className="bg-slate-800 px-1 rounded text-cyan-300">/</code> (ví dụ: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">7/2</code> hoặc <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">3.5</code>).<br />
                  • ⚠️ <strong>TUYỆT ĐỐI KHÔNG NHẬP HỖN SỐ:</strong> Không nhập <code className="bg-rose-950/60 px-1.5 py-0.5 rounded text-rose-300">3 1/2</code> vì hệ thống sẽ hiểu là <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">31/2</code> (tức 15.5). Hãy đổi thành phân số bất khả quy <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-emerald-300">7/2</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="text-amber-400">3. Số thập phân vô hạn tuần hoàn:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  • Nếu đáp án là số thập phân vô hạn, bạn <strong>phải điền kín tất cả các ô thập phân</strong> được cho phép. Ví dụ với <code className="bg-slate-800 px-1 rounded text-cyan-300">2/3</code>: chấp nhận <code className="bg-emerald-950/60 px-1 rounded text-emerald-300">.666</code>, <code className="bg-emerald-950/60 px-1 rounded text-emerald-300">.667</code>, <code className="bg-emerald-950/60 px-1 rounded text-emerald-300">0.666</code>, hoặc <code className="bg-emerald-950/60 px-1 rounded text-emerald-300">0.667</code>.<br />
                  • ⚠️ Điền thiếu như <code className="bg-rose-950/60 px-1 rounded text-rose-300">.66</code> hoặc <code className="bg-rose-950/60 px-1 rounded text-rose-300">.67</code> sẽ bị coi là SAI.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="text-purple-400">4. Ký hiệu bị cấm:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  • Không nhập ký hiệu đơn vị: <code className="bg-rose-950/60 px-1 rounded text-rose-300">$</code>, <code className="bg-rose-950/60 px-1 rounded text-rose-300">%</code>, <code className="bg-rose-950/60 px-1 rounded text-rose-300">°</code>, <code className="bg-rose-950/60 px-1 rounded text-rose-300">cm</code>...<br />
                  • Không sử dụng dấu phẩy phân tách hàng nghìn: Viết <code className="bg-emerald-950/60 px-1 rounded text-emerald-300">1200</code> thay vì <code className="bg-rose-950/60 px-1 rounded text-rose-300">1,200</code>.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#334155] flex justify-end">
              <button
                type="button"
                onClick={() => setShowSprRulesModal(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition shadow-lg"
              >
                Đã hiểu, quay lại làm bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Điểm 03: MODAL "CHECK YOUR WORK" RÀ SOÁT MODULE TRƯỚC KHI NỘP */}
      {showModuleReviewGrid && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div className="bg-[#1b2533] border-2 border-blue-500/50 rounded-2xl max-w-4xl w-full p-6 md:p-8 shadow-2xl space-y-6 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#334155] pb-4">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-[#0f172a] text-blue-300 border border-blue-500/30">
                  {currentModule.name}
                </span>
                <h3 className="text-xl md:text-2xl font-black text-white mt-1.5">
                  📋 Check Your Work — Kiểm tra lại bài trước khi nộp Module
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModuleReviewGrid(false)}
                className="text-slate-400 hover:text-white text-2xl font-bold px-2"
                title="Đóng bảng rà soát"
              >
                ✕
              </button>
            </div>

            {/* Thống kê nhanh Answered / Unanswered / Flagged */}
            {(() => {
              const totalQ = currentModule.questions.length;
              const answeredQ = currentModule.questions.filter((q) => Boolean(answers[q.questionId ?? q.id])).length;
              const unansweredQ = totalQ - answeredQ;
              const flaggedQ = currentModule.questions.filter((q) => Boolean(flaggedQuestions[q.questionId ?? q.id])).length;

              const filteredQList = currentModule.questions.map((q, idx) => ({ q, idx })).filter(({ q }) => {
                const k = q.questionId ?? q.id;
                if (moduleReviewFilter === 'unanswered') return !answers[k];
                if (moduleReviewFilter === 'flagged') return Boolean(flaggedQuestions[k]);
                return true;
              });

              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setModuleReviewFilter('all')}
                      className={`p-3 rounded-xl border text-center transition ${
                        moduleReviewFilter === 'all'
                          ? 'bg-blue-600/20 border-blue-400 ring-1 ring-blue-400'
                          : 'bg-[#0f172a] border-[#334155]'
                      }`}
                    >
                      <div className="text-xs text-slate-400">Đã trả lời</div>
                      <div className="text-xl font-black text-emerald-400">
                        {answeredQ} / {totalQ}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModuleReviewFilter('unanswered')}
                      className={`p-3 rounded-xl border text-center transition ${
                        moduleReviewFilter === 'unanswered'
                          ? 'bg-rose-600/20 border-rose-400 ring-1 ring-rose-400'
                          : 'bg-[#0f172a] border-[#334155]'
                      }`}
                    >
                      <div className="text-xs text-slate-400">Chưa làm</div>
                      <div className="text-xl font-black text-rose-400">{unansweredQ}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModuleReviewFilter('flagged')}
                      className={`p-3 rounded-xl border text-center transition ${
                        moduleReviewFilter === 'flagged'
                          ? 'bg-amber-600/20 border-amber-400 ring-1 ring-amber-400'
                          : 'bg-[#0f172a] border-[#334155]'
                      }`}
                    >
                      <div className="text-xs text-slate-400">Đã cắm cờ</div>
                      <div className="text-xl font-black text-amber-400">🚩 {flaggedQ}</div>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Bấm vào ô số thứ tự để quay lại câu hỏi đó kiểm tra:</span>
                    {unansweredQ > 0 && (
                      <span className="text-rose-400 font-bold">
                        ⚠️ Còn {unansweredQ} câu chưa chọn đáp án
                      </span>
                    )}
                  </div>

                  {/* Lưới các ô số thứ tự câu hỏi */}
                  <div className="overflow-y-auto max-h-[300px] p-3 bg-[#0f172a] rounded-xl border border-[#334155]">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2">
                      {filteredQList.map(({ q, idx }) => {
                        const itemK = q.questionId ?? q.id;
                        const answered = Boolean(answers[itemK]);
                        const flagged = Boolean(flaggedQuestions[itemK]);
                        const isCurrent = idx === currentQuestionIndex;

                        return (
                          <button
                            key={itemK}
                            type="button"
                            onClick={() => {
                              setCurrentQuestionIndex(idx);
                              setShowModuleReviewGrid(false);
                            }}
                            className={`p-2 rounded-lg border text-xs font-bold transition flex flex-col items-center justify-center relative ${
                              isCurrent
                                ? 'bg-blue-600 border-white text-white shadow-md'
                                : answered
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                                : 'bg-[#161f2e] border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                            }`}
                          >
                            <span>Câu {idx + 1}</span>
                            <span className="text-[10px] mt-0.5 opacity-80">
                              {answered ? 'Đã chọn' : 'Trống'}
                            </span>
                            {flagged && (
                              <span className="absolute -top-1.5 -right-1 text-xs">🚩</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nút hành động */}
                  <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-[#334155]">
                    <button
                      type="button"
                      onClick={() => setShowModuleReviewGrid(false)}
                      className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      ← Quay lại làm bài (Câu {currentQuestionIndex + 1})
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitModule()}
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black transition shadow-lg flex items-center gap-2"
                    >
                      <span>Nộp Module & Chuyển sang phần tiếp theo</span>
                      <span>🚀</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* KHUNG THI CHÍNH */}
      <div className="bg-[#1b2533] rounded-xl border border-[#262730] shadow-xl overflow-hidden flex flex-col min-h-[620px]">
        {/* HEADER PHÒNG THI */}
        <div className="bg-[#0e1117] p-3.5 flex flex-wrap justify-between items-center gap-3 border-b border-[#262730]">
          <div className="font-bold text-white flex items-center gap-3 text-sm">
            <span className="px-2.5 py-1 rounded bg-[#1e293b] text-blue-300 border border-[#334155]">
              {currentModule.name}
            </span>
            <span className="text-gray-400 font-normal">
              Câu {currentQuestionIndex + 1} / {currentModule.questions.length}
            </span>
            {/* Phím tắt gợi ý */}
            <span className="hidden lg:inline text-[11px] text-slate-500">
              (⌨️ 1-4: Chọn | ← →: Đổi câu | F: Cắm cờ | E: Gạch)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tỷ lệ chia cột cho câu có passage (Điểm 09) */}
            {currentQuestion.full_passage && (
              <div className="hidden sm:flex items-center bg-[#0b0f17] border border-[#334155] rounded-lg p-0.5 text-xs text-slate-300">
                <span className="px-2 text-[10px] uppercase font-bold text-slate-500">Cột:</span>
                <button
                  type="button"
                  onClick={() => setColumnSplit('40/60')}
                  className={`px-1.5 py-0.5 rounded font-bold ${columnSplit === '40/60' ? 'bg-blue-600 text-white' : 'hover:text-white'}`}
                >
                  40/60
                </button>
                <button
                  type="button"
                  onClick={() => setColumnSplit('50/50')}
                  className={`px-1.5 py-0.5 rounded font-bold ${columnSplit === '50/50' ? 'bg-blue-600 text-white' : 'hover:text-white'}`}
                >
                  50/50
                </button>
                <button
                  type="button"
                  onClick={() => setColumnSplit('60/40')}
                  className={`px-1.5 py-0.5 rounded font-bold ${columnSplit === '60/40' ? 'bg-blue-600 text-white' : 'hover:text-white'}`}
                >
                  60/40
                </button>
              </div>
            )}

            {/* Bluebook Calculators / Tools */}
            <BluebookTools compact />

            {/* Điểm 02: Đồng hồ & Ẩn giờ / Cảnh báo <= 5 phút */}
            <div className="flex items-center gap-2 bg-[#0b0f17] px-3 py-1.5 rounded-lg border border-[#334155]">
              <div
                className={`font-black text-lg flex items-center gap-1.5 ${
                  timeLeft <= 300 ? 'text-red-400 animate-pulse' : 'text-white'
                }`}
              >
                <span>⏱️</span>
                <span>{hideTimer ? 'Đã ẩn giờ' : formatTime(timeLeft)}</span>
              </div>
              {timeLeft <= 300 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500 animate-bounce">
                  ⚠️ Còn ≤ 5 phút!
                </span>
              )}
              <button
                type="button"
                onClick={() => setHideTimer(!hideTimer)}
                disabled={timeLeft <= 300}
                className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#161f2e] border border-[#334155] disabled:opacity-40 transition"
                title={timeLeft <= 300 ? 'Không thể ẩn giờ khi còn dưới 5 phút' : hideTimer ? 'Hiện đồng hồ' : 'Ẩn đồng hồ'}
              >
                {hideTimer ? '👁️ Hiện' : '🙈 Ẩn'}
              </button>
            </div>
          </div>
        </div>

        {/* NỘI DUNG CÂU HỎI & ĐOẠN VĂN */}
        <div className="flex-1 p-6 flex flex-col md:flex-row gap-6">
          {/* CỘT TRÁI: ĐOẠN VĂN & HIGHLIGHT & GHI CHÚ (Điểm 01) */}
          {currentQuestion.full_passage && (
            <div className={colClasses.passage}>
              {/* THANH CÔNG CỤ HIGHLIGHT & GHI CHÚ */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-2 bg-[#0b0f17] rounded-lg border border-[#334155] text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-400">🖍️ Highlight:</span>
                  <button
                    type="button"
                    onClick={() => applyHighlight('yellow')}
                    className={`px-2 py-1 rounded font-bold border transition ${
                      activeHighlightColor === 'yellow'
                        ? 'bg-yellow-500/40 border-yellow-400 text-yellow-200 ring-2 ring-yellow-400/50'
                        : 'bg-yellow-950/40 border-yellow-700/60 text-yellow-300 hover:bg-yellow-900/60'
                    }`}
                    title="Bôi đen đoạn văn rồi bấm, hoặc bấm nút để bật chế độ highlight Vàng"
                  >
                    🟡 Vàng
                  </button>
                  <button
                    type="button"
                    onClick={() => applyHighlight('green')}
                    className={`px-2 py-1 rounded font-bold border transition ${
                      activeHighlightColor === 'green'
                        ? 'bg-emerald-500/40 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/50'
                        : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
                    }`}
                    title="Highlight Xanh lá"
                  >
                    🟢 Xanh
                  </button>
                  <button
                    type="button"
                    onClick={() => applyHighlight('pink')}
                    className={`px-2 py-1 rounded font-bold border transition ${
                      activeHighlightColor === 'pink'
                        ? 'bg-pink-500/40 border-pink-400 text-pink-200 ring-2 ring-pink-400/50'
                        : 'bg-pink-950/40 border-pink-700/60 text-pink-300 hover:bg-pink-900/60'
                    }`}
                    title="Highlight Hồng"
                  >
                    🩷 Hồng
                  </button>
                  {currentHighlights.length > 0 && (
                    <button
                      type="button"
                      onClick={clearHighlights}
                      className="px-2 py-1 rounded bg-[#1e293b] border border-slate-700 text-slate-300 hover:text-rose-300 hover:border-rose-500/50 transition"
                      title="Xoá tất cả highlight ở câu này"
                    >
                      🗑️ Xoá ({currentHighlights.length})
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowPassageNote((prev) => !prev)}
                  className={`px-2.5 py-1 rounded font-bold border transition flex items-center gap-1 ${
                    showPassageNote || passageNotes[qKey]
                      ? 'bg-blue-600/30 border-blue-400 text-blue-200'
                      : 'bg-[#1e293b] border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Ghi chú phân tích đoạn văn"
                >
                  📝 Ghi chú {passageNotes[qKey] ? '•' : ''}
                </button>
              </div>

              {/* KHUNG ĐOẠN VĂN */}
              <div
                onMouseUp={handlePassageMouseUp}
                className={`prose prose-invert max-w-none text-[#e2e8f0] font-serif ${getPassageFontSize()} select-text`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => {
                      const processed = Array.isArray(children)
                        ? children.map((c, i) => (typeof c === 'string' ? highlightTextNode(c, currentHighlights) : c))
                        : typeof children === 'string'
                        ? highlightTextNode(children, currentHighlights)
                        : children;
                      return <p className="mb-4">{processed}</p>;
                    },
                    li: ({ children }) => {
                      const processed = Array.isArray(children)
                        ? children.map((c, i) => (typeof c === 'string' ? highlightTextNode(c, currentHighlights) : c))
                        : typeof children === 'string'
                        ? highlightTextNode(children, currentHighlights)
                        : children;
                      return <li>{processed}</li>;
                    },
                  }}
                >
                  {currentQuestion.full_passage}
                </ReactMarkdown>
              </div>

              {/* Danh sách chip highlight đã lưu */}
              {currentHighlights.length > 0 && (
                <div className="mt-3 pt-2 border-t border-[#334155]/60 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Đã highlight:</span>
                  {currentHighlights.map((h) => (
                    <span
                      key={h.id}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                        h.color === 'yellow'
                          ? 'bg-yellow-950/40 border-yellow-600/60 text-yellow-200'
                          : h.color === 'green'
                          ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                          : 'bg-pink-950/40 border-pink-600/60 text-pink-200'
                      }`}
                    >
                      <span className="max-w-[130px] truncate">&quot;{h.text}&quot;</span>
                      <button
                        type="button"
                        onClick={() => removeHighlight(h.id)}
                        className="hover:text-white font-bold ml-0.5"
                        title="Xoá highlight này"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Ô Ghi chú đoạn văn (Annotate) */}
              {(showPassageNote || passageNotes[qKey]) && (
                <div className="mt-4 p-3 rounded-xl bg-[#0f172a] border border-[#334155] animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1.5">
                    <span>📝 Ghi chú câu {currentQuestionIndex + 1} (Annotate):</span>
                    {passageNotes[qKey] && <span className="text-[10px] text-emerald-400">Đã lưu tự động</span>}
                  </div>
                  <textarea
                    value={passageNotes[qKey] || ''}
                    onChange={(e) => setPassageNotes((prev) => ({ ...prev, [qKey]: e.target.value }))}
                    placeholder="Ghi chú nhanh ý chính của đoạn văn, từ vựng hoặc gợi ý phân tích..."
                    rows={2}
                    className="w-full bg-[#1b2533] border border-[#334155] rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>
              )}
            </div>
          )}

          {/* CỘT PHẢI: CÂU HỎI & CÁC LỰA CHỌN TRẢ LỜI */}
          <div className={colClasses.question}>
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#334155] pb-2">
              <span className="inline-flex items-center gap-1.5 rounded bg-[#0f172a] px-2.5 py-1 text-xs font-bold text-slate-300 border border-[#334155]">
                Câu {currentQuestionIndex + 1}
              </span>

              <div className="flex items-center gap-2">
                {/* Chuyển chế độ Điền số SPR / Trắc nghiệm (chỉ cho phần Math) */}
                {currentModule.section === 'math' && (
                  <button
                    type="button"
                    onClick={() => setSprModeMap((prev) => ({ ...prev, [qKey]: !isSprQuestion }))}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                      isSprQuestion
                        ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                        : 'border-[#334155] bg-[#0f172a] text-slate-400 hover:border-indigo-500/40 hover:text-indigo-200'
                    }`}
                    title="Chuyển chế độ: Điền số SPR Grid-in hoặc Chọn trắc nghiệm A-D"
                  >
                    <span>🔢</span>
                    <span>{isSprQuestion ? 'Chế độ: SPR' : 'Chế độ: Trắc nghiệm'}</span>
                  </button>
                )}

                {/* Điểm 08: Nút bật/tắt chế độ gạch đáp án (chỉ khi có trắc nghiệm) */}
                {!isSprQuestion && (
                  <button
                    type="button"
                    onClick={() => setStrikethroughMode((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                      strikethroughMode
                        ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                        : 'border-[#334155] bg-[#0f172a] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                    title="Bật/tắt chế độ gạch loại trừ đáp án (Phím tắt: Alt+E hoặc E)"
                  >
                    <span className="line-through">ABC</span>
                    <span>{strikethroughMode ? 'Gạch trừ: BẬT' : 'Gạch trừ: TẮT'}</span>
                  </button>
                )}

                {/* Nút Cắm cờ Review */}
                <button
                  type="button"
                  onClick={toggleFlagCurrent}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                    isFlagged
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-[#334155] bg-[#0f172a] text-slate-400 hover:border-amber-500/40 hover:text-amber-200'
                  }`}
                  title="Đánh dấu câu hỏi để xem lại trước khi nộp module (Phím tắt: Alt+F hoặc F)"
                >
                  <span>{isFlagged ? '🚩' : '🏳️'}</span>
                  <span>{isFlagged ? 'Đã cắm cờ' : 'Cắm cờ'}</span>
                </button>
              </div>
            </div>

            {/* Đề bài câu hỏi */}
            <div className={`font-bold text-white mb-6 ${getQuestionFontSize()}`}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {currentQuestion.practice_question}
              </ReactMarkdown>
            </div>

            {/* DANH SÁCH ĐÁP ÁN: TRẮC NGHIỆM A-D HOẶC Ô ĐIỀN SỐ SPR GRID-IN */}
            {isSprQuestion ? (
              <div className="p-5 rounded-2xl bg-[#0f172a] border-2 border-indigo-500/40 shadow-xl space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30">
                      Bluebook SPR Grid-in
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      Student-Produced Response (Tự điền số)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSprRulesModal(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold flex items-center gap-1"
                  >
                    <span>ℹ️ Quy tắc College Board</span>
                  </button>
                </div>

                {/* Ô nhập số lớn chuẩn Bluebook */}
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      value={answers[qKey] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9./-]/g, '').slice(0, 6);
                        setAnswers((prev) => ({ ...prev, [qKey]: val }));
                      }}
                      placeholder="Nhập đáp án (VD: 3/4, 0.75, -5)"
                      className="w-full text-center text-3xl font-mono font-black tracking-widest px-4 py-3 bg-[#1b2533] border-2 border-blue-500/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/40"
                      maxLength={6}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {answers[qKey] && (
                      <button
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [qKey]: '' }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-700/60 hover:bg-slate-600 text-slate-300 flex items-center justify-center text-sm font-bold transition"
                        title="Xóa trắng"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Live Validation & Feedback */}
                  {(() => {
                    const rawVal = answers[qKey] || '';
                    if (!rawVal) {
                      return (
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                          <span>💡</span>
                          <span>Chấp nhận: số nguyên dương/âm, phân số tối giản (vd: 7/2), hoặc số thập phân (vd: .75 hoặc 0.75).</span>
                        </div>
                      );
                    }
                    const res = validateSprInput(rawVal);
                    if (!res.isValid) {
                      return (
                        <div className="mt-2 p-2 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-1.5 font-medium">
                          <span>⚠️</span>
                          <span>{res.errorMessage || 'Đáp án chưa hợp lệ theo chuẩn Bluebook'}</span>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between font-medium">
                        <span className="flex items-center gap-1.5">
                          <span>✅</span>
                          <span>Đáp án hợp lệ: <strong className="font-mono text-white text-sm">{res.normalizedValue}</strong></span>
                        </span>
                        {res.numericValue !== undefined && res.normalizedValue?.includes('/') && (
                          <span className="text-[11px] text-emerald-400 font-mono">
                            (≈ {Number(res.numericValue.toFixed(4))})
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Bàn phím số ảo nhanh Bluebook */}
                <div className="pt-2 border-t border-[#334155]/60">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Bàn phím nhập nhanh (Quick Keypad):
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', '/', '+/-', '⌫'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const curr = answers[qKey] || '';
                          if (key === '⌫') {
                            setAnswers((prev) => ({ ...prev, [qKey]: curr.slice(0, -1) }));
                          } else if (key === '+/-') {
                            if (curr.startsWith('-')) {
                              setAnswers((prev) => ({ ...prev, [qKey]: curr.slice(1) }));
                            } else if (curr.length < 6) {
                              setAnswers((prev) => ({ ...prev, [qKey]: '-' + curr }));
                            }
                          } else {
                            if (curr.length < 6) {
                              setAnswers((prev) => ({ ...prev, [qKey]: curr + key }));
                            }
                          }
                        }}
                        className="py-2 rounded-lg bg-[#1e293b] hover:bg-blue-600 border border-[#334155] hover:border-blue-400 text-white font-mono font-bold text-sm transition active:scale-95 text-center"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentQuestion.choices && currentQuestion.choices.map((choice: string, idx: number) => {
                  const choiceLetter = String.fromCharCode(65 + idx);
                  const isSelected = answers[qKey] === choice;
                  const isEliminated = eliminatedForCurrent.includes(idx);

                  return (
                    <div key={idx} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (strikethroughMode) {
                            toggleEliminateChoice(idx);
                          } else {
                            setAnswers((prev) => ({ ...prev, [qKey]: choice }));
                          }
                        }}
                        className={`flex-1 text-left p-4 rounded-xl border transition-all text-[#e2e8f0] font-medium flex items-start gap-3 ${
                          isSelected
                            ? 'bg-[#1e3a8a] border-[#3b82f6] shadow-[0_0_12px_rgba(59,130,246,0.5)] ring-1 ring-blue-400'
                            : 'bg-[#0f172a] border-[#334155] hover:border-[#64748b]'
                        } ${isEliminated && !isSelected ? 'line-through opacity-40' : ''}`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 border ${
                          isSelected ? 'bg-blue-600 text-white border-blue-400' : 'bg-[#161f2e] text-slate-300 border-[#334155]'
                        }`}>
                          {choiceLetter}
                        </span>
                        <div className="flex-1">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {choice}
                          </ReactMarkdown>
                        </div>
                      </button>

                      {/* Điểm 08: Nút gạch bỏ đáp án ABC trực tiếp */}
                      <button
                        type="button"
                        onClick={() => toggleEliminateChoice(idx)}
                        className={`px-3 rounded-xl border text-xs font-black transition shrink-0 ${
                          isEliminated
                            ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                            : 'border-[#334155] bg-[#0f172a] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                        title={isEliminated ? 'Bỏ gạch đáp án này' : 'Gạch bỏ đáp án nhiễu (Bluebook Option Eliminator)'}
                      >
                        <span className="line-through">ABC</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* BLUEBOOK QUESTION NAVIGATOR STRIP */}
        <div className="bg-[#0b0f17] px-4 py-2.5 border-t border-[#262730] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2">
              Bản đồ câu hỏi:
            </span>
            {currentModule.questions.map((qItem, idx) => {
              const itemKey = qItem.questionId ?? qItem.id;
              const answered = Boolean(answers[itemKey]);
              const flagged = Boolean(flaggedQuestions[itemKey]);
              const isCurrent = idx === currentQuestionIndex;

              return (
                <button
                  key={itemKey}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`relative h-7 min-w-[28px] px-1.5 rounded text-xs font-bold border transition ${
                    isCurrent
                      ? 'border-white bg-blue-600 text-white shadow-sm ring-1 ring-white'
                      : answered
                      ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                      : 'border-[#334155] bg-[#161f2e] text-slate-400 hover:border-slate-500'
                  }`}
                  title={`Câu ${idx + 1}${answered ? ' (Đã chọn)' : ' (Chưa làm)'}${flagged ? ' • Đã cắm cờ xem lại' : ''}`}
                >
                  {idx + 1}
                  {flagged && (
                    <span className="absolute -top-1.5 -right-1 text-[10px]">🚩</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Điểm 03: Nút mở Check Your Work bất cứ lúc nào */}
          <button
            type="button"
            onClick={() => setShowModuleReviewGrid(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#161f2e] border border-[#334155] hover:border-blue-400 text-slate-300 hover:text-white transition flex items-center gap-1.5"
            title="Mở màn hình Check Your Work để rà soát toàn bộ câu hỏi trong Module"
          >
            <span>📋</span>
            <span>Rà soát Module</span>
          </button>
        </div>

        {/* FOOTER ĐIỀU HƯỚNG CÂU HỎI & NỘP MODULE */}
        <div className="bg-[#0e1117] p-4 border-t border-[#262730] flex justify-between items-center">
          <button
            type="button"
            onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-2 bg-gray-800 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition"
          >
            ⬅️ Câu trước
          </button>

          <div className="text-xs text-gray-400 font-medium">
            {currentSection === 'rw' ? 'Reading & Writing' : 'Math'} • Module {currentModule.moduleNum}
          </div>

          <div className="flex gap-2">
            {currentQuestionIndex < currentModule.questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                className="px-6 py-2 text-white rounded-lg font-bold hover:opacity-90 text-sm shadow-md transition"
                style={{ background: accentColor }}
              >
                Câu tiếp ➡️
              </button>
            ) : (
              // Ở câu cuối cùng, mở Check Your Work để rà soát trước khi nộp
              <button
                type="button"
                onClick={() => setShowModuleReviewGrid(true)}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-black text-sm shadow-lg transition flex items-center gap-1.5"
              >
                <span>Rà soát & Nộp Module</span>
                <span>📋</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
