'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  Flag,
  Calculator,
  FileText,
  Maximize,
  Minimize,
  Columns,
  ChevronLeft,
  ChevronRight,
  Grid,
  CheckCircle2,
  AlertCircle,
  X,
  Strikethrough,
  Highlighter,
  Timer,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import DesmosCalculator from '@/components/DesmosCalculator';
import FormulaSheetModal from '@/components/FormulaSheetModal';
import ErrorBoundary from '@/components/ErrorBoundary';

// ============================================================================
// TYPES & DATA STRUCTURES (Server-Authoritative — KHÔNG chứa đáp án trước khi nộp #G7)
// ============================================================================

export type SplitRatio = '40/60' | '50/50' | '60/40';
export type NavFilter = 'all' | 'unanswered' | 'flagged';

export interface ExamQuestion {
  id: string;
  questionId: string;
  order: number;
  section: 'rw' | 'math';
  domain: string;
  passage?: string;
  question: string;
  choices: string[];
  isSpr: boolean;
}

interface GradedQuestionResult {
  questionId: string;
  correct: boolean;
  correctChoice: string;
  explanation?: string | null;
}

interface ApiStartQuestion {
  id?: string;
  questionId?: string;
  section?: 'rw' | 'math';
  domain?: string;
  full_passage?: string;
  passage?: string;
  practice_question?: string;
  prompt?: string;
  question?: string;
  choices?: string[];
  type?: 'mcq' | 'spr';
}

interface ApiStartModule {
  id?: string;
  module_id?: string;
  name?: string;
  time_minutes?: number;
  questions?: ApiStartQuestion[];
}

interface ApiStartResponse {
  id?: string;
  title?: string;
  description?: string;
  total_time_minutes?: number;
  modules?: ApiStartModule[];
  error?: string;
}

function normalizeChoices(rawChoices: string[] | undefined): string[] {
  if (!Array.isArray(rawChoices) || rawChoices.length === 0) return [];
  return rawChoices.map((c, i) => {
    const prefix = ['A)', 'B)', 'C)', 'D)'][i] || `${i + 1})`;
    const clean = String(c).replace(/^[A-D]\)\s*/, '').trim();
    return `${prefix} ${clean}`;
  });
}

function parseServerModules(data: ApiStartResponse): ExamQuestion[] {
  const list: ExamQuestion[] = [];
  let order = 1;
  (data.modules || []).forEach((mod) => {
    const modName = (mod.name || '').toLowerCase();
    const isMath = modName.includes('math') || (mod.module_id || '').startsWith('math');
    const defaultSection: 'rw' | 'math' = isMath ? 'math' : 'rw';

    (mod.questions || []).forEach((q) => {
      const qSection: 'rw' | 'math' =
        q.section === 'math' ? 'math' : q.section === 'rw' ? 'rw' : defaultSection;
      const choices = normalizeChoices(q.choices);
      const qid = q.questionId || q.id || `m_${order}`;
      list.push({
        id: q.id || qid,
        questionId: qid,
        order: order++,
        section: qSection,
        domain: q.domain || (qSection === 'math' ? 'Advanced Math' : 'Information and Ideas'),
        passage:
          q.full_passage && q.full_passage.trim().length > 0
            ? q.full_passage
            : q.passage || undefined,
        question: q.practice_question || q.prompt || q.question || '',
        choices,
        isSpr: q.type === 'spr' || choices.length === 0,
      });
    });
  });
  return list;
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = (params?.id as string) || 'sat-mock-01';

  // Dữ liệu đề thi nạp từ server (/api/exams/start) — không nhúng mock_exams.json 1.1MB vào client bundle
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [examTitle, setExamTitle] = useState<string>(`Digital SAT Practice Test (${examId.toUpperCase()})`);
  const [isLoadingExam, setIsLoadingExam] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // State câu hỏi & điều hướng
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [sprAnswers, setSprAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  // #C011: Tỷ lệ Split-Pane (40/60, 50/50, 60/40)
  const [splitRatio, setSplitRatio] = useState<SplitRatio>('50/50');

  // #C012 & #C013: Topic Note & Gạch bỏ phương án (Eliminated Options)
  const [passageNotes, setPassageNotes] = useState<Record<string, string>>({});
  const [eliminatedOptions, setEliminatedOptions] = useState<Record<string, number[]>>({});
  const [eliminationMode, setEliminationMode] = useState<boolean>(false);

  // #C014 & #C015: Modals Desmos & Formula Sheet
  const [isDesmosOpen, setIsDesmosOpen] = useState<boolean>(false);
  const [isFormulaOpen, setIsFormulaOpen] = useState<boolean>(false);

  // #C016: Smart Pacing tracker
  const [timeSpentPerQuestion, setTimeSpentPerQuestion] = useState<Record<string, number>>({});
  const [isPacingAlertDismissed, setIsPacingAlertDismissed] = useState<Record<string, boolean>>({});

  // #C018: Navigation drawer & Filter
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  const [navFilter, setNavFilter] = useState<NavFilter>('all');

  // #C019: Fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // #C020: Nộp bài & Chấm điểm server-authoritative
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [gradedResults, setGradedResults] = useState<Record<string, GradedQuestionResult>>({});
  const [serverCorrectCount, setServerCorrectCount] = useState<number>(0);
  const [zaloCopied, setZaloCopied] = useState<boolean>(false);
  const [totalRemainingSeconds, setTotalRemainingSeconds] = useState<number>(32 * 60);
  const [isTimerHidden, setIsTimerHidden] = useState<boolean>(false);

  // Nạp đề đã strip đáp án từ /api/exams/start
  useEffect(() => {
    let cancelled = false;
    async function fetchExam() {
      setIsLoadingExam(true);
      setLoadError(null);
      setCurrentIndex(0);
      setAnswers({});
      setSprAnswers({});
      setFlagged({});
      setTimeSpentPerQuestion({});
      setIsPacingAlertDismissed({});
      setEliminatedOptions({});
      setPassageNotes({});
      setIsSubmitted(false);
      setGradedResults({});
      setServerCorrectCount(0);
      setZaloCopied(false);

      try {
        const res = await fetch('/api/exams/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examId, mode: 'mock' }),
        });
        const data: ApiStartResponse = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Không thể tải đề thi từ máy chủ.');
        }
        if (cancelled) return;

        const parsed = parseServerModules(data);
        if (parsed.length === 0) {
          throw new Error('Đề thi chưa có câu hỏi. Vui lòng chọn đề khác.');
        }
        const mins =
          typeof data.total_time_minutes === 'number' && data.total_time_minutes > 0
            ? data.total_time_minutes
            : examId.includes('diagnostic')
            ? 15
            : 32;

        setQuestions(parsed);
        setExamTitle(data.title || `Digital SAT Practice Test (${examId.toUpperCase()})`);
        setTotalRemainingSeconds(mins * 60);
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ khi tải đề thi.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingExam(false);
        }
      }
    }

    fetchExam();
    return () => {
      cancelled = true;
    };
  }, [examId, reloadNonce]);

  const currentQ = questions[currentIndex] || questions[0];

  // --------------------------------------------------------------------------
  // TIMER & PACING MONITOR (#C016)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isSubmitted || isLoadingExam || !currentQ) return;
    const interval = setInterval(() => {
      setTotalRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setTimeSpentPerQuestion((prev) => {
        const qid = currentQ.id;
        return {
          ...prev,
          [qid]: (prev[qid] || 0) + 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQ, isSubmitted, isLoadingExam]);

  const currentQuestionTime = currentQ ? timeSpentPerQuestion[currentQ.id] || 0 : 0;
  const isStuckWarning = !!currentQ && currentQuestionTime >= 90 && !isPacingAlertDismissed[currentQ.id];

  // --------------------------------------------------------------------------
  // HOTKEYS (#C017)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!currentQ) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.altKey) {
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          setFlagged((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setIsDesmosOpen((prev) => !prev);
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          setIsFormulaOpen((prev) => !prev);
        } else if (e.key.toLowerCase() === 'x') {
          e.preventDefault();
          setEliminationMode((prev) => !prev);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQ, currentIndex, questions.length]);

  // --------------------------------------------------------------------------
  // FULLSCREEN TOGGLE (#C019)
  // --------------------------------------------------------------------------
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // --------------------------------------------------------------------------
  // ELIMINATION TOGGLE (#C013)
  // --------------------------------------------------------------------------
  const handleToggleEliminate = (choiceIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentQ) return;
    const qid = currentQ.id;
    const currentList = eliminatedOptions[qid] || [];
    if (currentList.includes(choiceIdx)) {
      setEliminatedOptions({
        ...eliminatedOptions,
        [qid]: currentList.filter((idx) => idx !== choiceIdx),
      });
    } else {
      setEliminatedOptions({
        ...eliminatedOptions,
        [qid]: [...currentList, choiceIdx],
      });
      if (answers[qid] === choiceIdx) {
        const nextAnswers = { ...answers };
        delete nextAnswers[qid];
        setAnswers(nextAnswers);
      }
    }
  };

  const handleSelectAnswer = (choiceIdx: number) => {
    if (!currentQ) return;
    const qid = currentQ.id;
    const eliminated = eliminatedOptions[qid] || [];
    if (eliminated.includes(choiceIdx)) {
      setEliminatedOptions({
        ...eliminatedOptions,
        [qid]: eliminated.filter((idx) => idx !== choiceIdx),
      });
    }
    setAnswers({ ...answers, [qid]: choiceIdx });
  };

  const isQuestionAnswered = useCallback(
    (q: ExamQuestion): boolean => {
      if (q.isSpr) return Boolean((sprAnswers[q.id] || '').trim());
      return answers[q.id] !== undefined;
    },
    [answers, sprAnswers]
  );

  const getUserAnswerText = useCallback(
    (q: ExamQuestion): string => {
      if (q.isSpr) return (sprAnswers[q.id] || '').trim();
      const idx = answers[q.id];
      return idx !== undefined ? q.choices[idx] || '' : '';
    },
    [answers, sprAnswers]
  );

  // --------------------------------------------------------------------------
  // SPLIT RATIO STYLES (#C011)
  // --------------------------------------------------------------------------
  const leftPaneClass = useMemo(() => {
    if (splitRatio === '40/60') return 'w-full md:w-[40%]';
    if (splitRatio === '60/40') return 'w-full md:w-[60%]';
    return 'w-full md:w-[50%]';
  }, [splitRatio]);

  const rightPaneClass = useMemo(() => {
    if (splitRatio === '40/60') return 'w-full md:w-[60%]';
    if (splitRatio === '60/40') return 'w-full md:w-[40%]';
    return 'w-full md:w-[50%]';
  }, [splitRatio]);

  // --------------------------------------------------------------------------
  // SUBMISSION & SERVER-AUTHORITATIVE GRADING (#G7, #C020)
  // --------------------------------------------------------------------------
  const handleSubmitExam = async () => {
    if (isSubmitting || isSubmitted || questions.length === 0) return;
    setIsSubmitting(true);
    try {
      const payloadAnswers = questions.map((q) => ({
        questionId: q.questionId,
        answer: getUserAnswerText(q),
      }));

      const res = await fetch('/api/exams/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, answers: payloadAnswers }),
      });

      const data = await res.json();
      const resultMap: Record<string, GradedQuestionResult> = {};
      if (Array.isArray(data?.results)) {
        for (const r of data.results as GradedQuestionResult[]) {
          resultMap[r.questionId] = r;
        }
      }
      const correctCount = typeof data?.correct === 'number' ? data.correct : 0;
      setGradedResults(resultMap);
      setServerCorrectCount(correctCount);
      setIsSubmitted(true);

      // Đồng bộ lịch sử bài thi & Sổ tay câu sai SAU KHI server chấm
      if (typeof window !== 'undefined') {
        try {
          let totalSec = 0;
          questions.forEach((q) => {
            totalSec += timeSpentPerQuestion[q.id] || 0;
          });
          const ratio = questions.length > 0 ? correctCount / questions.length : 0;
          const estimatedTotal = Math.round((400 + ratio * 1200) / 10) * 10;
          const rwScore = Math.round(estimatedTotal / 2 / 10) * 10;
          const mathScore = estimatedTotal - rwScore;

          const rawHist = window.localStorage.getItem('sat_exam_history_v1');
          const histList = rawHist ? JSON.parse(rawHist) : [];
          const attemptRecord = {
            id: `${examId}_${Date.now()}`,
            examId,
            examTitle,
            totalScore: estimatedTotal,
            rwScore,
            mathScore,
            correctCount,
            totalCount: questions.length,
            totalTimeSec: totalSec,
            completedAt: new Date().toISOString(),
          };
          if (Array.isArray(histList)) {
            const deduped = histList.filter((item: { examId?: string }) => item?.examId !== examId);
            window.localStorage.setItem(
              'sat_exam_history_v1',
              JSON.stringify([attemptRecord, ...deduped].slice(0, 30))
            );
          }

          const rawMistakes = window.localStorage.getItem('sat_mistake_bank_v1');
          const mistakeList = rawMistakes ? JSON.parse(rawMistakes) : [];
          const existingMistakes = Array.isArray(mistakeList) ? mistakeList : [];
          const existingIds = new Set(
            existingMistakes.map((m: { id?: string; questionId?: string }) => m.id || m.questionId)
          );
          const newMistakes = questions
            .filter((q) => !resultMap[q.questionId]?.correct && !existingIds.has(q.id))
            .map((q) => {
              const graded = resultMap[q.questionId];
              return {
                id: q.id,
                questionId: q.id,
                subject: q.section === 'math' ? 'Math' : 'Reading & Writing',
                domain: q.domain,
                skill: q.domain,
                stem: q.question,
                passage: q.passage,
                options: q.choices,
                selectedAnswer: getUserAnswerText(q) || 'Chưa chọn',
                correctAnswer: graded?.correctChoice || '',
                explanationVi:
                  graded?.explanation ||
                  `Câu hỏi thuộc đề ${examTitle} (${q.domain}). Đáp án chuẩn: ${graded?.correctChoice || ''}.`,
                rootCause: (timeSpentPerQuestion[q.id] || 0) > 90 ? 'Time Pressure' : 'Concept Gap',
                mastered: false,
                createdAt: new Date().toISOString(),
              };
            });
          if (newMistakes.length > 0) {
            window.localStorage.setItem(
              'sat_mistake_bank_v1',
              JSON.stringify([...newMistakes, ...existingMistakes].slice(0, 200))
            );
          }
        } catch {
          // Safe localStorage fallback
        }
      }
    } catch (err) {
      console.error('Submit exam error:', err);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const paceSummary = useMemo(() => {
    let totalSec = 0;
    let totalEliminated = 0;
    let answeredCount = 0;

    questions.forEach((q) => {
      totalSec += timeSpentPerQuestion[q.id] || 0;
      totalEliminated += (eliminatedOptions[q.id] || []).length;
      if (isQuestionAnswered(q)) answeredCount++;
    });

    const avgSecPerQuestion = questions.length > 0 ? Math.round(totalSec / questions.length) : 0;

    return {
      totalTimeSec: totalSec,
      avgSecPerQuestion,
      answeredCount,
      totalCount: questions.length,
      correctCount: serverCorrectCount,
      totalEliminated,
      flaggedCount: Object.values(flagged).filter(Boolean).length,
    };
  }, [questions, timeSpentPerQuestion, eliminatedOptions, flagged, isQuestionAnswered, serverCorrectCount]);

  // Format mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyZaloReport = () => {
    const ratio = paceSummary.totalCount > 0 ? paceSummary.correctCount / paceSummary.totalCount : 0;
    const estimatedTotal = Math.round((400 + ratio * 1200) / 10) * 10;
    const msg = [
      `📊 BÁO CÁO KẾT QUẢ THI THỬ DIGITAL SAT — SAT.GURU`,
      `• Đề thi: ${examTitle}`,
      `• Điểm quy đổi dự kiến: ${estimatedTotal} / 1600 (${paceSummary.correctCount}/${paceSummary.totalCount} câu đúng)`,
      `• Tốc độ trung bình: ${paceSummary.avgSecPerQuestion}s/câu | Tổng thời gian: ${formatTime(paceSummary.totalTimeSec)}`,
      `• Cố vấn học thuật Thầy Nghĩa Guru (SAT.Guru) — Hotline/Zalo: 0986.722.324`,
    ].join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(msg).catch(() => {});
    }
    setZaloCopied(true);
    setTimeout(() => setZaloCopied(false), 3000);
  };

  if (isLoadingExam) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-slate-200 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium">Đang tải đề thi chuẩn Bluebook từ máy chủ bảo mật...</p>
      </div>
    );
  }

  if (loadError || !currentQ) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-slate-200 gap-4 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-amber-400" />
        <div className="space-y-1 max-w-md">
          <h2 className="text-base font-bold text-white">Không thể khởi tạo phòng thi</h2>
          <p className="text-xs text-slate-400">{loadError || 'Vui lòng thử lại hoặc chọn đề khác trong kho đề.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử tải lại</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/exams')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Về kho đề thi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none overflow-hidden font-sans">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER (Bluebook Authentic Bar)                               */}
      {/* ==================================================================== */}
      <header className="h-14 px-3 sm:px-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/exams')}
            title="Quay lại danh mục đề thi"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/60"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kho đề</span>
          </button>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white truncate max-w-[180px] sm:max-w-[320px]">
                {examTitle}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium shrink-0">
                {currentQ.section === 'rw' ? 'RW' : 'Math'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Câu {currentIndex + 1} / {questions.length} • {currentQ.domain}
            </div>
          </div>
        </div>

        {/* Center: Timer (#C020 countdown) */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-sm font-bold tracking-wider text-emerald-400">
            {isTimerHidden ? '--:--' : formatTime(totalRemainingSeconds)}
          </span>
          <button
            type="button"
            onClick={() => setIsTimerHidden(!isTimerHidden)}
            title={isTimerHidden ? 'Hiện thời gian' : 'Ẩn thời gian'}
            className="text-slate-400 hover:text-white p-0.5"
          >
            {isTimerHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Right Toolbar: Tools & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* #C011: Chọn tỷ lệ Split-Pane */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            <Columns className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            {(['40/60', '50/50', '60/40'] as SplitRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setSplitRatio(ratio)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  splitRatio === ratio
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Tỷ lệ chia màn hình: ${ratio}`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* #C014: Desmos Calculator */}
          <button
            type="button"
            onClick={() => setIsDesmosOpen(!isDesmosOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isDesmosOpen
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Mở máy tính Desmos (Alt+C)"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Desmos</span>
          </button>

          {/* #C015: Formula Reference Sheet */}
          <button
            type="button"
            onClick={() => setIsFormulaOpen(!isFormulaOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isFormulaOpen
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Mở bảng công thức (Alt+R)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Công thức</span>
          </button>

          {/* #C019: Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors"
            title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. SUB-HEADER TOOLBAR (Review Flag & Tools)                          */}
      {/* ==================================================================== */}
      <div className="h-10 px-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFlagged({ ...flagged, [currentQ.id]: !flagged[currentQ.id] })}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              flagged[currentQ.id]
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
            title="Đánh dấu xem lại câu này (Alt+F)"
          >
            <Flag className={`w-3.5 h-3.5 ${flagged[currentQ.id] ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{flagged[currentQ.id] ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại (Alt+F)'}</span>
          </button>

          {!currentQ.isSpr && (
            <button
              type="button"
              onClick={() => setEliminationMode(!eliminationMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
                eliminationMode
                  ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              title="Chế độ gạch bỏ phương án sai (Alt+X)"
            >
              <Strikethrough className="w-3.5 h-3.5" />
              <span>Gạch bỏ đáp án (Alt+X)</span>
            </button>
          )}
        </div>

        {/* #C016: Smart Pacing Alert Pill */}
        {isStuckWarning && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-[11px] animate-pulse">
            <Timer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Đã dừng ở câu này {currentQuestionTime}s. Cân nhắc gắn cờ rồi làm tiếp!</span>
            <button
              type="button"
              onClick={() =>
                setIsPacingAlertDismissed({ ...isPacingAlertDismissed, [currentQ.id]: true })
              }
              className="hover:text-amber-900 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">
            Thời gian câu này: <strong>{currentQuestionTime}s</strong>
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. SPLIT-PANE MAIN STAGE (#C011, #G2)                                */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LEFT PANE: Passage & Notes (#C012) */}
        <div
          className={`${leftPaneClass} border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-slate-900/50`}
        >
          {currentQ.passage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Đoạn văn đọc hiểu (Reading Passage)
                </span>
                <span className="text-[11px] text-slate-400">SAT Standard Text</span>
              </div>

              <div className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200 font-serif selection:bg-yellow-200 dark:selection:bg-yellow-900">
                {currentQ.passage}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Highlighter className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Ghi chú câu chủ đề / Luận điểm chính (Topic Note):</span>
                </div>
                <textarea
                  value={passageNotes[currentQ.id] || ''}
                  onChange={(e) =>
                    setPassageNotes({ ...passageNotes, [currentQ.id]: e.target.value })
                  }
                  placeholder="Ghi chú nhanh từ khóa hoặc ý chính đoạn văn để dễ đối chiếu..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Calculator className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                Câu hỏi Toán không kèm đoạn văn dài
              </div>
              <p className="text-xs max-w-sm mt-1 text-slate-500">
                Sử dụng giấy nháp hoặc bấm nút <strong>Desmos (Alt+C)</strong> / <strong>Công thức (Alt+R)</strong> phía trên để hỗ trợ tính toán.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT PANE: Question & Options (#C013) */}
        <div
          className={`${rightPaneClass} flex flex-col h-full overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-slate-950`}
        >
          <div className="space-y-6 max-w-2xl mx-auto w-full">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  Câu hỏi {currentIndex + 1}
                </span>
                {!currentQ.isSpr && eliminationMode && (
                  <span className="text-[11px] text-red-600 font-semibold bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200">
                    Bấm vào dấu gạch (/) để loại phương án
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 leading-snug">
                {currentQ.question}
              </h2>
            </div>

            {currentQ.isSpr ? (
              <div className="space-y-3 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <label
                  htmlFor="spr-input"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Câu hỏi tự điền số (Student-Produced Response — tối đa 5 ký tự dương / 6 ký tự âm, hỗ trợ phân số a/b hoặc số thập phân):
                </label>
                <input
                  id="spr-input"
                  type="text"
                  maxLength={6}
                  value={sprAnswers[currentQ.id] || ''}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9./-]/g, '');
                    setSprAnswers({ ...sprAnswers, [currentQ.id]: cleaned });
                  }}
                  placeholder="Nhập đáp án (vd: 12, 3/4, -2.5)"
                  className="w-full max-w-xs px-3.5 py-2.5 rounded-lg border-2 border-indigo-300 dark:border-indigo-700 bg-slate-50 dark:bg-slate-800 font-mono text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ) : (
              <div className="space-y-3">
                {currentQ.choices.map((choice, cIdx) => {
                  const isSelected = answers[currentQ.id] === cIdx;
                  const isEliminated = (eliminatedOptions[currentQ.id] || []).includes(cIdx);

                  return (
                    <div
                      key={cIdx}
                      onClick={() => !isEliminated && handleSelectAnswer(cIdx)}
                      className={`group relative flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                        isEliminated
                          ? 'opacity-40 bg-slate-100 dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-800'
                          : isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div
                        className={`text-sm sm:text-base flex-1 leading-relaxed ${
                          isEliminated ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {choice}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleToggleEliminate(cIdx, e)}
                        title={isEliminated ? 'Khôi phục phương án này' : 'Gạch bỏ phương án sai này'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isEliminated
                            ? 'text-red-600 bg-red-50 dark:bg-red-950/60'
                            : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-60 group-hover:opacity-100'
                        }`}
                      >
                        <Strikethrough className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. BOTTOM FOOTER BAR (Bluebook Navigation)                           */}
      {/* ==================================================================== */}
      <footer className="h-16 px-4 bg-slate-900 text-white flex items-center justify-between border-t border-slate-800 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNavOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
          >
            <Grid className="w-4 h-4 text-indigo-400" />
            <span>
              Câu hỏi: {currentIndex + 1} / {questions.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => currentIndex > 0 && setCurrentIndex((prev) => prev - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Câu trước</span>
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
            >
              <span>Câu sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitExam}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold shadow transition-colors"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{isSubmitting ? 'Đang chấm điểm...' : 'Nộp bài thi'}</span>
            </button>
          )}
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* 5. MODAL: QUESTION NAVIGATOR DRAWER (#C018)                          */}
      {/* ==================================================================== */}
      {isNavOpen && (
        <div
          role="presentation"
          onClick={() => setIsNavOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        >
          <div
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-4 bg-slate-100 dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Grid className="w-4 h-4 text-indigo-500" />
                <span>Bảng điều hướng câu hỏi (Bluebook Review)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNavOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2 gap-2 text-xs">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'unanswered', label: 'Chưa làm' },
                  { id: 'flagged', label: 'Đã gắn cờ' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNavFilter(tab.id)}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    navFilter === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5 max-h-72 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-5 gap-3">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = isQuestionAnswered(q);
                  const isFlag = !!flagged[q.id];

                  if (navFilter === 'unanswered' && isAnswered) return null;
                  if (navFilter === 'flagged' && !isFlag) return null;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsNavOpen(false);
                      }}
                      className={`relative flex flex-col items-center justify-center h-12 rounded-xl font-bold text-xs border-2 transition-all ${
                        isCurrent
                          ? 'border-indigo-600 ring-2 ring-indigo-400 ring-offset-1'
                          : 'border-slate-200 dark:border-slate-700'
                      } ${
                        isAnswered
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isFlag && (
                        <Flag className="w-3 h-3 fill-amber-400 text-amber-400 absolute -top-1.5 -right-1.5 drop-shadow" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500">
              <span>Đã làm: {paceSummary.answeredCount}/{questions.length}</span>
              <span>Gắn cờ: {paceSummary.flaggedCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODAL: SUBMISSION & PACE SUMMARY (#C020)                          */}
      {/* ==================================================================== */}
      {isSubmitted && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Hoàn thành bài thi: {examTitle}
              </h2>
              <p className="text-xs text-slate-500">
                Mã đề: {examId.toUpperCase()} • Kết quả chấm bảo mật từ máy chủ chuẩn College Board
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Tổng thời gian</div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {formatTime(paceSummary.totalTimeSec)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Nhịp độ trung bình</div>
                <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                  {paceSummary.avgSecPerQuestion}s / câu
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Số câu gạch bỏ</div>
                <div className="text-base font-bold text-red-600 dark:text-red-400">
                  {paceSummary.totalEliminated} lượt
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Kết quả chấm</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {paceSummary.correctCount} / {paceSummary.totalCount}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phân bổ thời gian &amp; đáp án từng câu:
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar text-xs">
                {questions.map((q, idx) => {
                  const sec = timeSpentPerQuestion[q.id] || 0;
                  const graded = gradedResults[q.questionId];
                  const isRight = !!graded?.correct;
                  return (
                    <div
                      key={q.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Câu {idx + 1}
                        </span>
                        <span className="text-[10px] text-slate-400">({q.domain})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-600 dark:text-slate-400">{sec}s</span>
                        {isRight ? (
                          <span className="text-emerald-600 font-semibold">Đúng (+1)</span>
                        ) : (
                          <span className="text-red-500 font-semibold">
                            Chưa đúng{graded?.correctChoice ? ` (ĐA: ${graded.correctChoice})` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCopyZaloReport}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                {zaloCopied ? '✅ Đã sao chép báo cáo Zalo!' : '📲 Sao Chép Báo Cáo Gửi Phụ Huynh (Zalo)'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/mistakes')}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
              >
                📓 Ôn Câu Sai Vừa Làm
              </button>
              <button
                type="button"
                onClick={() => setIsSubmitted(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Xem lại bài thi
              </button>
              <button
                type="button"
                onClick={() => router.push('/exams')}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md"
              >
                Về danh mục đề thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. INTEGRATED POPUPS: DESMOS & FORMULA SHEET (ErrorBoundary #G2)     */}
      {/* ==================================================================== */}
      <ErrorBoundary label="Máy tính Desmos">
        <DesmosCalculator isOpen={isDesmosOpen} onClose={() => setIsDesmosOpen(false)} />
      </ErrorBoundary>
      <ErrorBoundary label="Bảng công thức">
        <FormulaSheetModal isOpen={isFormulaOpen} onClose={() => setIsFormulaOpen(false)} />
      </ErrorBoundary>
    </div>
  );
}
