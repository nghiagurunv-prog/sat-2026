'use client';

import { useState, useEffect, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { LoadingState } from './LoadingState';
import { matchesAnswer } from '@/lib/answer-match';
import { BluebookTools } from './BluebookTools';

export interface PracticeQuestion {
  title: string;
  full_passage?: string;
  archaic_words?: { word: string; meaning: string }[];
  practice_question: string;
  choices: string[];
  correct_choice?: string;
  explanation?: string;
  difficulty: string;
  trapRate: number;
  skillId?: string;
  choice_analysis?: { choice_letter: string; is_correct: boolean; analysis: string }[];
  questionId?: string;
  isGridInQuestion?: boolean;
  translation?: string;
}

/**
 * Chuẩn hóa ô nhập SPR (Student-Produced Response — #049) theo chuẩn College Board Bluebook:
 * - Ký tự hợp lệ: 0-9, '.', '/', và '-' ở đầu.
 * - Dấu trừ '-' CHỈ được phép ở vị trí đầu tiên (index 0).
 * - Không cho phép nhiều hơn 1 dấu '/' hoặc nhiều hơn 1 dấu '.'.
 * - Không cho phép kết hợp cả '/' và '.' trong cùng một đáp án (không có hỗn số / phân số thập phân).
 * - Giới hạn độ dài: tối đa 5 ký tự (dương) hoặc 6 ký tự (nếu bắt đầu bằng '-').
 */
export function sanitizeSprInput(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const isNegative = trimmed.startsWith('-');
  const body = isNegative ? trimmed.slice(1) : trimmed;

  // Loại bỏ mọi ký tự không phải số, '/', '.' và loại bỏ dấu trừ ở giữa
  const cleanBody = body.replace(/[^0-9/.]/g, '');

  let filtered = '';
  let hasSlash = false;
  let hasDot = false;

  for (const char of cleanBody) {
    if (char === '/') {
      // Chỉ cho phép 1 dấu '/' và không được có dấu '.'
      if (!hasSlash && !hasDot) {
        hasSlash = true;
        filtered += char;
      }
    } else if (char === '.') {
      // Chỉ cho phép 1 dấu '.' và không được có dấu '/'
      if (!hasDot && !hasSlash) {
        hasDot = true;
        filtered += char;
      }
    } else if (char >= '0' && char <= '9') {
      filtered += char;
    }
  }

  // Tối đa 5 ký tự phần thân (digits + slash/dot)
  const maxBodyLen = 5;
  const truncatedBody = filtered.slice(0, maxBodyLen);
  const result = isNegative ? `-${truncatedBody}` : truncatedBody;

  // Giới hạn tổng thể: 6 ký tự nếu âm, 5 nếu dương
  const maxTotal = result.startsWith('-') ? 6 : 5;
  return result.slice(0, maxTotal);
}

interface CorePracticeUIProps {
  questionData: PracticeQuestion;
  onNext: () => void;
  isLoading?: boolean;
  onAnswer?: (isCorrect: boolean) => void;
  onSubmitted?: () => void;
  /**
   * Chế độ thi cổng: ẩn nút "Câu Hỏi Mới" cho tới khi đã nộp bài, để người thi
   * KHÔNG bỏ qua câu (skip = không trả lời) làm sai số đếm điểm cổng.
   */
  hideNextUntilSubmitted?: boolean;
  /**
   * Giới hạn thời gian (giây). Có → đồng hồ ĐẾM NGƯỢC, hết giờ TỰ NỘP (nếu chưa
   * chọn thì nộp đáp án rỗng → chấm sai + lộ đáp án). Không có → đếm xuôi như cũ.
   */
  timeLimit?: number;
}

export function CorePracticeUI({ questionData, onNext, isLoading, onAnswer, onSubmitted, hideNextUntilSubmitted, timeLimit }: CorePracticeUIProps) {
  const { registerGradedResult, spendCoins, toggleBookmark, bookmarkedQuestions, practiceStreak } = useGamification();
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [revealedCorrectChoice, setRevealedCorrectChoice] = useState<string | null>(null);
  const [rewardData, setRewardData] = useState<{xpGiven: number, coinsGiven: number, comboMultiplier: number} | null>(null);
  // ROOT A: choice_analysis KHÔNG còn trong payload → nhận từ /api/grade sau nộp.
  const [revealedAnalysis, setRevealedAnalysis] = useState<{ choice_letter: string; is_correct: boolean; analysis: string }[] | null>(null);
  // ROOT A: explanation cũng KHÔNG còn trong payload với câu đề thư viện → nhận từ /api/grade sau nộp.
  const [revealedExplanation, setRevealedExplanation] = useState<string | null>(null);

  const [timeElapsed, setTimeElapsed] = useState(0);
  // Đếm ngược (chỉ dùng khi có timeLimit). Khởi tạo = timeLimit, giảm về 0 → tự nộp.
  const [timeLeft, setTimeLeft] = useState(timeLimit ?? 0);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [hintError, setHintError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [persistenceWarning, setPersistenceWarning] = useState("");
  const [hintTrap, setHintTrap] = useState<{ choice_letter: string; analysis: string } | null>(null);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);

  // Điểm 01: Công cụ Highlight 3 màu (Vàng, Xanh, Hồng) trên đoạn văn
  const [activeHighlightColor, setActiveHighlightColor] = useState<'yellow' | 'green' | 'pink'>('yellow');
  const [highlights, setHighlights] = useState<Array<{ id: string; text: string; color: 'yellow' | 'green' | 'pink' }>>([]);

  // Điểm 16 & 26: Lưu từ vựng 1-Click vào Kho Từ Vựng & Phát âm chuẩn Mỹ Web Speech API
  const [savedWords, setSavedWords] = useState<Record<string, boolean>>({});
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [vocabSaveSuccess, setVocabSaveSuccess] = useState<string | null>(null);

  // Điểm 41: Nhập đáp án tự điền SPR (Student-Produced Response)
  const [gridInInput, setGridInInput] = useState("");

  // Điểm 73: Đánh dấu Mức độ Tự tin khi chọn đáp án
  const [confidence, setConfidence] = useState<'confident' | 'guessing'>('confident');

  // Điểm 20: Toggles mở rộng cấu trúc lập luận / dịch ý chính
  const [showPassageGist, setShowPassageGist] = useState(true);

  const isBookmarked = questionData ? bookmarkedQuestions.includes(questionData.practice_question) : false;

  // Nhận diện câu Toán hay R&W
  const isMath = Boolean(
    (questionData.skillId && (questionData.skillId.startsWith('m_') || questionData.skillId.startsWith('math_'))) ||
    questionData.title?.toLowerCase().includes('toán') ||
    questionData.title?.toLowerCase().includes('math') ||
    (!questionData.full_passage && (questionData.practice_question.includes('$') || /[\d+\-*/=√^]/.test(questionData.practice_question)))
  );

  // Nhận diện dạng câu hỏi tự điền SPR (Grid-In)
  const isGridIn = Boolean(
    questionData.isGridInQuestion ||
    (!questionData.choices || questionData.choices.length === 0) ||
    (questionData.choices.length === 1 && (questionData.choices[0] === '' || questionData.choices[0].toLowerCase() === 'spr')) ||
    /student-produced response|grid-in|enter your answer|điền đáp án/i.test(questionData.practice_question)
  );

  // Điểm 12: Pacing Indicator thông minh (R&W chuẩn ~71s, Math chuẩn ~95s)
  const pacingTargetSec = isMath ? 95 : 71;
  const isOverPacing = timeElapsed > pacingTargetSec;
  const isWarningPacing = !isOverPacing && timeElapsed >= Math.floor(pacingTargetSec * 0.75);

  // Điểm 19: Chiến thuật Rhetorical Synthesis (Student Notes)
  const isRhetoricalSynthesis = Boolean(
    questionData.full_passage && (
      questionData.full_passage.toLowerCase().includes('while researching a topic') ||
      questionData.full_passage.toLowerCase().includes('taken the following notes') ||
      (questionData.full_passage.includes('•') && (questionData.full_passage.match(/•/g) || []).length >= 3) ||
      (questionData.full_passage.includes('\n- ') && (questionData.full_passage.match(/\n- /g) || []).length >= 3)
    )
  );

  // Điểm 34: Cảnh báo "Bẫy Câu Hỏi Cuối" (Target Expression)
  const hasTargetTrap = Boolean(
    isMath && (
      /(value of\s+(?:2|3|4|5|[a-z])x|value of\s+[a-z]\s*[+\-*/]|x\s*\+\s*y|x\s*-\s*y|diameter|circumference|perimeter|area|least possible|greatest possible|\bNOT\b|\bcannot\b)/i.test(questionData.practice_question)
    )
  );

  // Điểm 37: Cảnh báo Đơn vị & Đổi Đơn vị (Unit Conversion Trap Detector)
  const hasUnitConversionTrap = Boolean(
    isMath && (
      (/\b(?:minute|minutes)\b/i.test(questionData.practice_question) && /\b(?:hour|hours)\b/i.test(questionData.practice_question)) ||
      (/\b(?:second|seconds)\b/i.test(questionData.practice_question) && /\b(?:minute|minutes)\b/i.test(questionData.practice_question)) ||
      (/\b(?:inch|inches)\b/i.test(questionData.practice_question) && /\b(?:foot|feet)\b/i.test(questionData.practice_question)) ||
      (/\b(?:cent|cents)\b/i.test(questionData.practice_question) && /\b(?:dollar|dollars)\b/i.test(questionData.practice_question)) ||
      (/\b(?:meter|meters)\b/i.test(questionData.practice_question) && /\b(?:kilometer|kilometers)\b/i.test(questionData.practice_question)) ||
      (/\b(?:gram|grams)\b/i.test(questionData.practice_question) && /\b(?:kilogram|kilograms)\b/i.test(questionData.practice_question))
    )
  );

  // Điểm 27: Dấu hiệu Ngữ pháp (Subject-Verb & Punctuation)
  const isGrammarQuestion = Boolean(
    questionData.practice_question.includes('____') ||
    questionData.full_passage?.includes('____') ||
    questionData.practice_question.toLowerCase().includes('conforms to the conventions of standard english') ||
    questionData.practice_question.toLowerCase().includes('standard english') ||
    questionData.title?.toLowerCase().includes('grammar') ||
    questionData.title?.toLowerCase().includes('ngữ pháp')
  );

  // Khôi phục từ vựng đã lưu trong localStorage khi mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sat_vocab_vault') || '[]');
      if (Array.isArray(stored)) {
        const map: Record<string, boolean> = {};
        stored.forEach((item: { word?: string }) => {
          if (item?.word) map[item.word.toLowerCase()] = true;
        });
        setSavedWords(map);
      }
    } catch {}
  }, []);

  // Ref giữ handleSubmit mới nhất để timer tự-nộp không dính stale closure
  const handleSubmitRef = useRef<() => void>(() => {});

  const hasTimeLimit = typeof timeLimit === 'number' && timeLimit > 0;

  // Đồng hồ: đếm ngược (có timeLimit) hoặc đếm xuôi
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isSubmitted && !isLoading) {
      timer = setInterval(() => {
        if (hasTimeLimit) {
          setTimeLeft(prev => Math.max(0, prev - 1));
        } else {
          setTimeElapsed(prev => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSubmitted, isLoading, hasTimeLimit]);

  // HẾT GIỜ → tự nộp
  useEffect(() => {
    if (hasTimeLimit && timeLeft === 0 && !isSubmitted && !isLoading) {
      handleSubmitRef.current();
    }
  }, [hasTimeLimit, timeLeft, isSubmitted, isLoading]);

  // Reset state when new question comes in (#058, #059)
  const questionKey = questionData?.questionId || questionData?.practice_question || '';

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelectedAnswer(null);
    setIsSubmitted(false);
    setIsCorrect(null);
    setRevealedCorrectChoice(null);
    setRewardData(null);
    setRevealedAnalysis(null);
    setRevealedExplanation(null);
    setTimeElapsed(0);
    setTimeLeft(timeLimit ?? 0);
    setHintsRevealed(0);
    setHintError("");
    setSubmitError("");
    setPersistenceWarning("");
    setHintTrap(null);
    setEliminatedIndices([]);
    setHighlights([]);
    setGridInInput("");
    setConfidence('confident');
    setVocabSaveSuccess(null);
    setShowPassageGist(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [questionKey, questionData, timeLimit]);

  const handleSubmit = async () => {
    if (isSubmitted) return;
    const finalAnswer = isGridIn ? gridInInput.trim() : (selectedAnswer ?? '');
    if (!finalAnswer && !hasTimeLimit) return;
    setSubmitError('');
    setPersistenceWarning('');

    let isAnsCorrect = false;
    let correctChoice = '';
    let granted = { coins: 0, xp: 0 };
    let economyState: { coins?: number; xp?: number; lastSpinDate?: string | null } | null = null;
    let explanationForMistake = '';

    if (questionData.questionId) {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: questionData.questionId,
          answer: finalAnswer,
          streak: practiceStreak + 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data?.error ?? 'Không thể chấm câu này. Vui lòng thử lại.');
        return;
      }
      const grade = await res.json();
      isAnsCorrect = grade.correct;
      correctChoice = grade.correctChoice ?? '';
      setRevealedCorrectChoice(grade.correctChoice);
      if (Array.isArray(grade.choice_analysis)) setRevealedAnalysis(grade.choice_analysis);
      if (typeof grade.explanation === 'string' && grade.explanation) {
        explanationForMistake = grade.explanation;
        setRevealedExplanation(grade.explanation);
      }
      granted = grade.granted ?? { coins: 0, xp: 0 };
      economyState = grade.economy ?? null;
      if (typeof grade.persistenceError === 'string' && grade.persistenceError) {
        setPersistenceWarning(grade.persistenceError);
      }
    } else if (questionData.correct_choice) {
      // Fallback chấm câu hỏi trực tiếp nếu không có questionId (sử dụng matchesAnswer - #047)
      isAnsCorrect = matchesAnswer(finalAnswer, questionData.correct_choice);
      correctChoice = questionData.correct_choice;
      setRevealedCorrectChoice(questionData.correct_choice);
      if (questionData.explanation) {
        explanationForMistake = questionData.explanation;
        setRevealedExplanation(questionData.explanation);
      }
      if (questionData.choice_analysis) {
        setRevealedAnalysis(questionData.choice_analysis);
      }
    } else {
      setSubmitError('Câu hỏi thiếu mã chấm. Vui lòng đổi câu khác.');
      return;
    }

    setIsSubmitted(true);
    setIsCorrect(isAnsCorrect);

    const { comboMultiplier } = registerGradedResult(isAnsCorrect, economyState);
    setRewardData({ xpGiven: granted.xp, coinsGiven: granted.coins, comboMultiplier });

    if (onAnswer) onAnswer(isAnsCorrect);
    if (onSubmitted) onSubmitted();

    if (!isAnsCorrect) {
      try {
        await fetch("/api/cau-sai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passage: questionData.full_passage || "",
            question: questionData.practice_question,
            choices: questionData.choices,
            correct_choice: correctChoice,
            user_choice: finalAnswer,
            explanation: explanationForMistake,
            source: "Core Practice (Next.js)",
            skill_id: questionData.skillId ?? null,
          })
        });
      } catch (e) {
        console.error("Failed to save mistake", e);
      }
    }
  };

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  const handleRevealHint = (level: number) => {
    if (level === 1) {
      setHintsRevealed(1);
    } else if (level === 2) {
      if (spendCoins(20)) {
        setHintsRevealed(2);
        if (questionData.questionId) {
          fetch("/api/hint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: questionData.questionId }),
          })
            .then(r => r.ok ? r.json() : null)
            .then(trap => { if (trap?.choice_letter) setHintTrap(trap); })
            .catch(() => {});
        }
      } else {
        setHintError("Bạn không đủ 20 Xu để mở gợi ý Cấp 2! Hãy luyện tập thêm.");
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Điểm 01: Xử lý bôi đen để Highlight
  const handlePassageMouseUp = () => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text && text.length >= 2 && text.length <= 400) {
      if (!highlights.some(h => h.text.toLowerCase() === text.toLowerCase())) {
        setHighlights(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, text, color: activeHighlightColor }]);
      }
    }
  };

  const removeHighlight = (textToRemove: string) => {
    setHighlights(prev => prev.filter(h => h.text.toLowerCase() !== textToRemove.toLowerCase()));
  };

  const renderHighlightedPassage = (rawText: string) => {
    if (!highlights.length) return rawText;
    const sorted = [...highlights].sort((a, b) => b.text.length - a.text.length);
    const escaped = sorted.map(h => h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    try {
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = rawText.split(regex);
      return parts.map((part, i) => {
        const match = sorted.find(h => h.text.toLowerCase() === part.toLowerCase());
        if (match) {
          const colorClass = match.color === 'yellow'
            ? 'bg-yellow-300 text-neutral-950 font-semibold shadow-sm'
            : match.color === 'green'
            ? 'bg-emerald-300 text-neutral-950 font-semibold shadow-sm'
            : 'bg-pink-300 text-neutral-950 font-semibold shadow-sm';
          return (
            <mark key={i} className={`${colorClass} px-1 py-0.5 rounded transition-colors`}>
              {part}
            </mark>
          );
        }
        return part;
      });
    } catch {
      return rawText;
    }
  };

  // Điểm 26: Phát âm chuẩn Mỹ Web Speech API
  const handleSpeakWord = (word: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Điểm 16: Lưu từ vựng 1-Click vào Kho Từ Vựng (/api/vocab + localStorage fallback)
  const handleSaveVocab = async (word: string, meaning: string) => {
    setSavingWord(word);
    const contextSentence = questionData.full_passage || questionData.practice_question;
    try {
      await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          meaning,
          contextSentence,
        }),
      });
      const stored = JSON.parse(localStorage.getItem('sat_vocab_vault') || '[]');
      if (!stored.some((item: { word?: string }) => item?.word?.toLowerCase() === word.toLowerCase())) {
        stored.push({ word, meaning, contextSentence, savedAt: new Date().toISOString() });
        localStorage.setItem('sat_vocab_vault', JSON.stringify(stored));
      }
      setSavedWords(prev => ({ ...prev, [word.toLowerCase()]: true }));
      setVocabSaveSuccess(`Đã lưu "${word}" vào Kho Từ Vựng Leitner!`);
      setTimeout(() => setVocabSaveSuccess(null), 3000);
    } catch {
      try {
        const stored = JSON.parse(localStorage.getItem('sat_vocab_vault') || '[]');
        if (!stored.some((item: { word?: string }) => item?.word?.toLowerCase() === word.toLowerCase())) {
          stored.push({ word, meaning, contextSentence, savedAt: new Date().toISOString() });
          localStorage.setItem('sat_vocab_vault', JSON.stringify(stored));
        }
        setSavedWords(prev => ({ ...prev, [word.toLowerCase()]: true }));
        setVocabSaveSuccess(`Đã lưu "${word}" vào bộ nhớ máy!`);
        setTimeout(() => setVocabSaveSuccess(null), 3000);
      } catch {}
    } finally {
      setSavingWord(null);
    }
  };

  // Điểm 20: Tách cấu trúc lập luận & ý chính đoạn văn
  const passageStructure = (() => {
    if (!questionData.full_passage) return { claim: '', transitions: [] as string[], conclusion: '' };
    const sentences = questionData.full_passage
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    const claim = sentences[0] || '';
    const conclusion = sentences.length > 1 ? sentences[sentences.length - 1] : '';
    const transitionRegex = /\b(However|Therefore|Moreover|Furthermore|In contrast|Consequently|Nevertheless|On the other hand|In addition|Although|While|Specifically|For example|In fact|Thus|Hence)\b/gi;
    const matches = questionData.full_passage.match(transitionRegex) || [];
    const uniqueTransitions = Array.from(new Set(matches.map(m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())));
    return { claim, transitions: uniqueTransitions, conclusion };
  })();

  // Điểm 23: Nhận diện 4 Bẫy Đáp Án Sai Kinh Điển trong R&W
  const getTrapBadge = (analysis: string, choiceText: string, isChoiceCorrect: boolean): { label: string; color: string } | null => {
    if (isChoiceCorrect) return null;
    const combined = `${choiceText} ${analysis}`.toLowerCase();
    if (/always|never|completely|entirely|\bonly\b|\ball\b|solely|tuyệt đối|quá cực đoan|cực đoan|không có ngoại lệ/i.test(combined)) {
      return {
        label: '🚨 Bẫy Quá Cực Đoan (Too Extreme: always/never/completely/all/only)',
        color: 'border-red-500/50 bg-red-950/40 text-red-300',
      };
    }
    if (/out of scope|không đề cập|ngoài phạm vi|không được nhắc|chưa từng nói|unmentioned|not mentioned|irrelevant/i.test(combined)) {
      return {
        label: '🌌 Bẫy Ngoài Phạm Vi (Out of Scope / Không đề cập)',
        color: 'border-purple-500/50 bg-purple-950/40 text-purple-300',
      };
    }
    if (/đúng nửa đầu|nửa sau sai|half-right|partially correct|nửa đúng|sai vế sau|nhưng vế sau sai/i.test(combined)) {
      return {
        label: '🌓 Bẫy Đúng Nửa Đầu - Sai Nửa Sau (Half-Right Half-Wrong)',
        color: 'border-amber-500/50 bg-amber-950/40 text-amber-300',
      };
    }
    if (/ngược|opposite|đảo ngược|reversed|nhân quả ngược|trái ngược hoàn toàn|contradict/i.test(combined)) {
      return {
        label: '🔄 Bẫy Ngược Quan Hệ Nhân Quả / Đối Lập (Opposite / Reversed Causality)',
        color: 'border-blue-500/50 bg-blue-950/40 text-blue-300',
      };
    }
    return null;
  };

  // Điểm 41: Xem trước giá trị thập phân tương đương trong ô nhập SPR
  const decimalPreview = (() => {
    if (!gridInInput || !gridInInput.includes('/')) return null;
    const match = gridInInput.trim().match(/^(-?\d+)\s*\/\s*(\d+)$/);
    if (!match) return null;
    const num = parseFloat(match[1]);
    const den = parseFloat(match[2]);
    if (den === 0 || isNaN(num) || isNaN(den)) return 'Lỗi chia cho 0';
    const val = num / den;
    return Number.isInteger(val) ? val.toString() : val.toFixed(4).replace(/\.?0+$/, '');
  })();

  if (isLoading) {
    return <LoadingState message="Hệ thống đang cấu trúc câu hỏi động..." />;
  }

  const difficultyColor = questionData.difficulty === 'Hard' ? 'text-red-400 border-red-400' : 
                          questionData.difficulty === 'Medium' ? 'text-yellow-400 border-yellow-400' : 
                          'text-green-400 border-green-400';

  return (
    <div className="my-6 animate-in fade-in duration-500">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
        <div>
          <h2 className="text-[20px] font-bold text-white mb-2">{questionData.title}</h2>
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            <span className={`px-2 py-1 rounded border ${difficultyColor} bg-[rgba(0,0,0,0.2)] font-bold`}>
              🔥 Độ khó: {questionData.difficulty}
            </span>
            <span className="px-2 py-1 rounded border border-purple-400 text-purple-400 bg-[rgba(0,0,0,0.2)] font-bold">
              ⚠️ {questionData.trapRate}% học sinh sập bẫy
            </span>
            {hasTimeLimit ? (
              <span className={`px-2 py-1 rounded border bg-[rgba(0,0,0,0.2)] font-bold flex items-center gap-1 ${timeLeft <= 30 ? 'border-red-500 text-red-500 animate-pulse' : 'border-blue-400 text-blue-400'}`}>
                ⏱️ Còn lại: {formatTime(timeLeft)}
              </span>
            ) : (
              <span className="px-2 py-1 rounded border border-blue-400 text-blue-400 bg-[rgba(0,0,0,0.2)] font-bold flex items-center gap-1">
                ⏱️ {formatTime(timeElapsed)}
              </span>
            )}

            {/* Điểm 12: Cảnh báo Tốc độ làm bài (Pacing Indicator) thông minh */}
            <div className={`px-2.5 py-1 rounded border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isOverPacing
                ? 'border-rose-500 bg-rose-950/40 text-rose-300 animate-pulse'
                : isWarningPacing
                ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                : 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
            }`}>
              {isOverPacing ? (
                <span>⚠️ {timeElapsed}s (Chuẩn {pacingTargetSec}s: Trong phòng thi thật nên cắm cờ chuyển câu nếu quá {pacingTargetSec}s)</span>
              ) : (
                <span>⏱️ {timeElapsed}s / chuẩn {pacingTargetSec}s {isMath ? '(Math)' : '(R&W)'}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BluebookTools compact />
          <button
            onClick={() => toggleBookmark(questionData.practice_question)}
            className={`text-sm px-4 py-2 rounded font-bold transition-colors border ${isBookmarked ? 'bg-yellow-500 text-yellow-900 border-yellow-500' : 'bg-transparent text-gray-300 border-gray-600 hover:bg-gray-800'}`}
          >
            {isBookmarked ? "⭐ Đã Lưu" : "⭐ Lưu Câu Này"}
          </button>
          {!(hideNextUntilSubmitted && !isSubmitted) && (
            <button
              onClick={onNext}
              className="text-sm bg-[#3b82f6] hover:bg-[#2563eb] border border-[#3b82f6] px-4 py-2 rounded text-white transition-colors font-bold">
              🔄 Câu Hỏi Mới
            </button>
          )}
        </div>
      </div>

      {/* Điểm 19: Chiến thuật Rhetorical Synthesis (Student Notes) */}
      {isRhetoricalSynthesis && (
        <div className="mb-4 bg-amber-500/10 border-l-4 border-amber-400 p-3.5 rounded-r-lg text-amber-200 text-sm flex items-start gap-2.5 shadow-md">
          <span className="text-xl shrink-0">⚡</span>
          <div>
            <strong className="text-amber-300 font-bold">Mẹo 20 Giây (Rhetorical Synthesis):</strong> Đừng đọc hết các gạch đầu dòng trước! Hãy đọc câu hỏi bên dưới/bên phải trước để xác định đúng yêu cầu (So sánh / Nêu ví dụ / Nguyên nhân), rồi đối chiếu thẳng với 4 đáp án A, B, C, D.
          </div>
        </div>
      )}

      {/* Điểm 34: Cảnh báo "Bẫy Câu Hỏi Cuối" (Target Expression Highlighter cho câu Toán) */}
      {hasTargetTrap && (
        <div className="mb-4 bg-rose-500/10 border-l-4 border-rose-500 p-3.5 rounded-r-lg text-rose-200 text-sm flex items-start gap-2.5 shadow-md">
          <span className="text-xl shrink-0">🎯</span>
          <div>
            <strong className="text-rose-300 font-bold">Chú ý câu hỏi cuối (Target Expression):</strong> Kiểm tra kỹ đề bài hỏi giá trị của <em>x</em> hay biểu thức (2x, x+y, 3x+1)/đường kính/chu vi! Đừng vội vàng giải ra x rồi khoanh ngay.
          </div>
        </div>
      )}

      {/* Điểm 37: Cảnh báo Đơn vị & Đổi Đơn vị (Unit Conversion Trap Detector) */}
      {hasUnitConversionTrap && (
        <div className="mb-4 bg-amber-500/10 border-l-4 border-amber-400 p-3.5 rounded-r-lg text-amber-200 text-sm flex items-start gap-2.5 shadow-md">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <strong className="text-amber-300 font-bold">Cảnh báo Bẫy Đổi Đơn Vị (Unit Conversion):</strong> Đề bài chứa nhiều cấp đơn vị khác nhau (phút/giờ, giây/phút, inches/feet, cents/dollars, m/km). Hãy quy đổi về cùng một đơn vị chuẩn trước khi tính toán!
          </div>
        </div>
      )}
      
      {/* Passage & Highlight Tool (Điểm 01) */}
      {questionData.full_passage && (
        <div className="mb-6">
          {/* Thanh công cụ Highlight 3 màu chuẩn Bluebook */}
          <div className="bg-[#1b2533] px-4 py-2.5 rounded-t border-t border-x border-[#334155] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                🖍️ Chọn màu highlight:
              </span>
              <button
                type="button"
                onClick={() => setActiveHighlightColor('yellow')}
                className={`px-2.5 py-1 rounded font-bold transition-all border ${
                  activeHighlightColor === 'yellow'
                    ? 'bg-yellow-400 text-neutral-900 border-yellow-300 shadow-md scale-105'
                    : 'bg-yellow-950/40 text-yellow-300 border-yellow-700/50 hover:bg-yellow-900/40'
                }`}
              >
                🟡 Vàng
              </button>
              <button
                type="button"
                onClick={() => setActiveHighlightColor('green')}
                className={`px-2.5 py-1 rounded font-bold transition-all border ${
                  activeHighlightColor === 'green'
                    ? 'bg-emerald-400 text-neutral-900 border-emerald-300 shadow-md scale-105'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/40'
                }`}
              >
                🟢 Xanh
              </button>
              <button
                type="button"
                onClick={() => setActiveHighlightColor('pink')}
                className={`px-2.5 py-1 rounded font-bold transition-all border ${
                  activeHighlightColor === 'pink'
                    ? 'bg-pink-400 text-neutral-900 border-pink-300 shadow-md scale-105'
                    : 'bg-pink-950/40 text-pink-300 border-pink-700/50 hover:bg-pink-900/40'
                }`}
              >
                🩷 Hồng
              </button>
              {highlights.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHighlights([])}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                >
                  🧹 Xóa highlight
                </button>
              )}
            </div>
            <span className="text-slate-400 italic hidden sm:inline">
              * Bôi đen từ/câu trong đoạn văn để đánh dấu
            </span>
          </div>

          {/* Nội dung đoạn văn */}
          <div
            onMouseUp={handlePassageMouseUp}
            className="bg-[#0e1117] border-l-4 border-b border-r border-[#3b82f6] text-[#e2e8f0] p-5 rounded-b text-[16px] leading-relaxed whitespace-pre-wrap shadow-inner font-serif select-text cursor-text overflow-x-auto max-w-full break-words"
          >
            {renderHighlightedPassage(questionData.full_passage)}
          </div>

          {/* Danh sách cụm từ đã highlight */}
          {highlights.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-slate-400 font-semibold">Đã highlight:</span>
              {highlights.map((h) => (
                <span
                  key={h.id}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium border ${
                    h.color === 'yellow'
                      ? 'bg-yellow-950/50 border-yellow-600/60 text-yellow-200'
                      : h.color === 'green'
                      ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-200'
                      : 'bg-pink-950/50 border-pink-600/60 text-pink-200'
                  }`}
                >
                  <span className="truncate max-w-[150px]">{h.text}</span>
                  <button
                    type="button"
                    onClick={() => removeHighlight(h.text)}
                    className="hover:text-red-400 font-bold ml-1"
                    title="Xóa highlight cụm từ này"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Điểm 16 & 26: Kho Từ Vựng Trọng Tâm & Phát Âm Chuẩn Mỹ */}
          {questionData.archaic_words && questionData.archaic_words.length > 0 && (
            <div className="mt-4 bg-[#131c2e] p-3.5 rounded-xl border border-blue-500/30">
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>📚 Từ Vựng Học Thuật Trong Bài (1-Click Lưu &amp; Nghe Chuẩn Mỹ):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {questionData.archaic_words.map((item, idx) => {
                  const isSaved = savedWords[item.word.toLowerCase()];
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-[#1e293b] border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
                      <span className="font-bold text-white">{item.word}</span>
                      <span className="text-slate-400">({item.meaning})</span>
                      <button
                        type="button"
                        onClick={() => handleSpeakWord(item.word)}
                        title="Phát âm chuẩn Mỹ (Web Speech API)"
                        className="px-2 py-0.5 rounded bg-blue-600/40 text-blue-300 hover:bg-blue-600/60 transition-colors font-medium text-[11px]"
                      >
                        🔊 Nghe
                      </button>
                      <button
                        type="button"
                        disabled={isSaved || savingWord === item.word}
                        onClick={() => handleSaveVocab(item.word, item.meaning)}
                        title="Lưu 1-Click vào Kho Từ Vựng Leitner"
                        className={`px-2 py-0.5 rounded transition-colors font-medium text-[11px] ${
                          isSaved
                            ? 'bg-emerald-600/40 text-emerald-300 cursor-default'
                            : 'bg-amber-600/30 text-amber-300 hover:bg-amber-600/50'
                        }`}
                      >
                        {isSaved ? '✓ Đã lưu' : '+ Lưu từ'}
                      </button>
                    </div>
                  );
                })}
              </div>
              {vocabSaveSuccess && (
                <div className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1">
                  <span>✓</span> {vocabSaveSuccess}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Question */}
      <div className="text-white text-[18px] mb-6 font-bold whitespace-pre-wrap overflow-x-auto max-w-full break-words">
        {questionData.practice_question}
      </div>
      
      {/* Điểm 41: Nhập đáp án tự điền SPR (Student-Produced Response) cho Toán (#049) */}
      {isGridIn ? (
        <div className="bg-[#1b2533] p-5 rounded-xl border-2 border-[#334155] mb-8 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-300">
              ✍️ Tự điền đáp án số (Student-Produced Response / Grid-In):
            </span>
            <span className="text-xs text-slate-400">
              Chuẩn Bluebook: tối đa 5 ký tự (hoặc 6 nếu âm), chỉ gồm số, dấu '.', '/', '-'
            </span>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              disabled={isSubmitted}
              value={gridInInput}
              maxLength={gridInInput.startsWith('-') ? 6 : 5}
              onChange={(e) => {
                const val = sanitizeSprInput(e.target.value);
                setGridInInput(val);
                setSelectedAnswer(val);
              }}
              placeholder="Nhập đáp án (VD: 7/4 hoặc 1.75)..."
              className={`flex-1 border-2 rounded-xl px-4 py-3 text-lg font-mono outline-none transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                    : 'border-rose-500 bg-rose-950/30 text-rose-300'
                  : 'bg-[#0e1117] border-blue-500/60 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
            {!isSubmitted && (
              <div className="flex gap-1.5">
                {['/', '.', '-'].map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => {
                      let nextVal = gridInInput;
                      if (sym === '-') {
                        nextVal = gridInInput.startsWith('-') ? gridInInput.slice(1) : `-${gridInInput}`;
                      } else {
                        nextVal = gridInInput + sym;
                      }
                      const sanitized = sanitizeSprInput(nextVal);
                      setGridInInput(sanitized);
                      setSelectedAnswer(sanitized);
                    }}
                    className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-lg rounded-xl border border-slate-600 transition-colors"
                  >
                    {sym}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setGridInInput('');
                    setSelectedAnswer(null);
                  }}
                  className="px-3 h-12 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 font-bold text-xs rounded-xl border border-rose-700 transition-colors"
                >
                  Xóa
                </button>
              </div>
            )}
          </div>

          {/* Hiển thị đáp án đúng nếu làm sai câu SPR (#047, #049) */}
          {isSubmitted && !isCorrect && (revealedCorrectChoice || questionData.correct_choice) && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-lg text-sm text-emerald-200 flex items-center justify-between">
              <span>🎯 Đáp án chính xác của College Board:</span>
              <strong className="font-mono text-base text-yellow-300">
                {revealedCorrectChoice ?? questionData.correct_choice}
              </strong>
            </div>
          )}

          {/* Xem trước giá trị thập phân tương đương (Điểm 41) */}
          {decimalPreview && (
            <div className="bg-blue-950/50 border border-blue-500/40 p-2.5 rounded-lg text-xs font-mono text-blue-200 flex items-center justify-between">
              <span>🔄 Giá trị thập phân tương đương:</span>
              <strong className="text-sm text-yellow-300">≈ {decimalPreview}</strong>
            </div>
          )}
        </div>
      ) : (
        /* Choices (Trắc nghiệm 4 đáp án) */
        <div className="space-y-3 mb-8">
          {questionData.choices.map((choice, idx) => {
            const isSelected = selectedAnswer === choice;
            let choiceClass = "bg-[#1b2533] border-[#334155] text-[#e2e8f0]";
            
            if (isSubmitted) {
              const isThisChoiceCorrect = matchesAnswer(choice, revealedCorrectChoice ?? questionData.correct_choice);
              if (isThisChoiceCorrect) {
                choiceClass = "bg-[#064e3b] border-[#10b981] text-[#34d399]";
              } else if (isSelected) {
                choiceClass = "bg-[#7f1d1d] border-[#ef4444] text-[#fca5a5]";
              }
            } else if (isSelected) {
              choiceClass = "bg-[#1e3a8a] border-[#3b82f6] text-white";
            }

            const isEliminated = eliminatedIndices.includes(idx);

            return (
              <div key={idx} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => !isSubmitted && setSelectedAnswer(choice)}
                  disabled={isSubmitted}
                  aria-pressed={isSelected}
                  className={`flex-1 text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.01] disabled:cursor-default overflow-x-auto max-w-full break-words ${!isSubmitted ? 'cursor-pointer' : ''} ${choiceClass} ${!isSubmitted && isEliminated && !isSelected ? 'line-through opacity-40' : ''}`}
                >
                  {choice}
                </button>
                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={() =>
                      setEliminatedIndices((prev) =>
                        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                      )
                    }
                    className={`px-3 rounded-xl border-2 text-xs font-black transition shrink-0 ${
                      isEliminated
                        ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                        : 'border-[#334155] bg-[#1b2533] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                    title={isEliminated ? 'Bỏ gạch đáp án này' : 'Gạch bỏ đáp án nhiễu (Bluebook Option Eliminator)'}
                  >
                    <span className="line-through">ABC</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Smart Hints System */}
      {!isSubmitted && (
        <div className="mb-6 space-y-2">
          {hintsRevealed === 0 && (
            <button onClick={() => handleRevealHint(1)} className="text-sm text-yellow-400 hover:text-yellow-300 underline">
              💡 Cần gợi ý cơ bản? (Miễn phí)
            </button>
          )}
          {hintsRevealed >= 1 && (
            <div className="bg-[#1e293b] p-3 rounded border border-yellow-600/30 text-yellow-100 text-sm mb-2 overflow-x-auto max-w-full break-words">
              <strong>💡 Gợi ý 1: </strong> 
              {questionData.archaic_words && questionData.archaic_words.length > 0 ? (
                <span>Từ khóa quan trọng: {questionData.archaic_words.map(w => `${w.word} (${w.meaning})`).join(", ")}</span>
              ) : (
                <span>Hãy chú ý kỹ vào yêu cầu chính của câu hỏi và loại trừ các đáp án mâu thuẫn.</span>
              )}
            </div>
          )}
          {hintsRevealed === 1 && (
            <div>
              <button onClick={() => handleRevealHint(2)} className="text-sm text-purple-400 hover:text-purple-300 underline font-bold">
                🔮 Loại bớt 1 đáp án sai? (Mất 20 Xu)
              </button>
              {hintError && <p className="text-red-400 text-xs mt-1">{hintError}</p>}
            </div>
          )}
          {hintsRevealed === 2 && (
            <div className="bg-[#2e1065] p-3 rounded border border-purple-500/50 text-purple-200 text-sm overflow-x-auto max-w-full break-words">
              <strong>🔮 Gợi ý loại trừ: </strong>
              {hintTrap ? (
                <span>Có thể loại <b>đáp án {hintTrap.choice_letter}</b> — {hintTrap.analysis} Giờ cân nhắc các đáp án còn lại nhé!</span>
              ) : (
                <span>Rất nhiều học sinh chọn sai vì mắc bẫy phân tâm. Hãy loại các đáp án mâu thuẫn với dữ kiện đề trước, rồi đọc kỹ phần còn lại.</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Điểm 73: Đánh dấu Mức độ Tự tin trước khi nộp bài */}
      {!isSubmitted && (
        <div className="mb-4 bg-[#1b2533] p-3.5 rounded-xl border border-[#334155] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <span>🎯 Mức độ tự tin cho câu này:</span>
          </span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setConfidence('confident')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                confidence === 'confident'
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md scale-105'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              💯 Chắc chắn 100%
            </button>
            <button
              type="button"
              onClick={() => setConfidence('guessing')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                confidence === 'guessing'
                  ? 'bg-amber-600 text-white border-amber-400 shadow-md scale-105'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              🤔 Phân vân 50/50
            </button>
          </div>
        </div>
      )}
      
      {/* Feedback Section */}
      {isSubmitted && (
        <div className="mb-6 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {persistenceWarning && (
            <div className="bg-[#422006] border border-[#f59e0b] text-[#fcd34d] p-4 rounded-xl text-sm">
              ⚠️ {persistenceWarning}
            </div>
          )}
          {isCorrect && rewardData ? (
            <div className="bg-[#022c22] border-2 border-[#10b981] text-[#34d399] p-4 rounded-xl flex items-center gap-4 relative overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              {rewardData.comboMultiplier > 1 && (
                <div className="absolute top-0 right-0 bg-[#facc15] text-[#713f12] text-xs font-bold px-3 py-1 rounded-bl-lg">
                  COMBO x{rewardData.comboMultiplier}!
                </div>
              )}
              <div className="text-4xl">🎉</div>
              <div>
                <div className="font-bold text-lg">CHÍNH XÁC TUYỆT ĐỐI!</div>
                <div className="text-sm mt-1">
                  Nhận thưởng: <b className="text-white">+{rewardData.xpGiven} XP</b> | <b className="text-yellow-400">+{rewardData.coinsGiven} Xu</b> 
                </div>
              </div>
            </div>
          ) : !isCorrect ? (
            <div className="bg-[#450a0a] border-2 border-[#ef4444] text-[#fca5a5] p-4 rounded-xl flex items-center gap-4 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <div className="text-4xl">❌</div>
              <div>
                <div className="font-bold text-lg">SẬP BẪY RỒI CHIẾN BINH!</div>
                <div className="text-sm mt-1">Câu hỏi đã được tự động lưu vào Sổ tay Cải thiện. Đừng nản lòng!</div>
              </div>
            </div>
          ) : null}

          {/* Điểm 73: Thông báo Lucky Guess khi đúng nhưng phân vân 50/50 */}
          {isCorrect && confidence === 'guessing' && (
            <div className="bg-amber-500/15 border-2 border-amber-400/80 text-amber-200 p-4 rounded-xl flex items-center gap-3.5 shadow-md">
              <div className="text-3xl shrink-0">🍀</div>
              <div>
                <div className="font-bold text-base text-amber-300">ĐÚNG NHƯNG ĐANG PHÂN VÂN (LUCKY GUESS)!</div>
                <div className="text-sm mt-0.5 text-amber-100/90 leading-relaxed">
                  Bạn đã chọn đúng trong tâm lý phân vân 50/50. Hãy đọc kỹ phần giải thích chi tiết bên dưới hoặc bấm <strong>⭐ Lưu Câu Này</strong> vào Sổ tay để nắm chắc bản chất 100% nhé.
                </div>
              </div>
            </div>
          )}

          {/* Điểm 20: Cấu trúc lập luận & Ý chính đoạn văn (Claim → Evidence → Conclusion) */}
          {!isMath && questionData.full_passage && (
            <div className="bg-[#0f172a] p-5 rounded-xl border border-indigo-500/40 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-indigo-300 font-bold flex items-center gap-2 text-base">
                  <span>🧭 CẤU TRÚC LẬP LUẬN &amp; Ý CHÍNH ĐOẠN VĂN (Claim → Evidence → Conclusion)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowPassageGist(prev => !prev)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  {showPassageGist ? 'Thu gọn' : 'Mở rộng'}
                </button>
              </div>
              {showPassageGist && (
                <div className="space-y-3 text-sm text-slate-200">
                  {passageStructure.claim && (
                    <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                      <span className="font-bold text-amber-300">📌 Luận điểm mở đầu (Claim / Premise): </span>
                      <span className="italic text-slate-300">{passageStructure.claim}</span>
                    </div>
                  )}
                  {passageStructure.transitions.length > 0 && (
                    <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                      <span className="font-bold text-cyan-300">🔍 Dẫn chứng &amp; Từ chuyển ý then chốt: </span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {passageStructure.transitions.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-200 text-xs font-semibold">
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        * Chú ý hướng lập luận: Các từ nối trên báo hiệu sự đối lập (contrast), bổ sung (addition) hay nguyên nhân - kết quả (cause-effect).
                      </p>
                    </div>
                  )}
                  {passageStructure.conclusion && (
                    <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                      <span className="font-bold text-emerald-300">🎯 Kết luận / Điểm hội tụ (Conclusion / Main Takeaway): </span>
                      <span className="italic text-slate-300">{passageStructure.conclusion}</span>
                    </div>
                  )}
                  {questionData.translation && (
                    <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 mt-2">
                      <span className="font-bold text-purple-300">🇻🇳 Tóm tắt / Bản dịch tiếng Việt: </span>
                      <p className="mt-1 text-slate-300 whitespace-pre-wrap overflow-x-auto max-w-full break-words">{questionData.translation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Điểm 27: Gợi ý phân tích ngữ pháp nhanh cho câu Standard English Conventions */}
          {isGrammarQuestion && (
            <div className="bg-[#1e1b4b] p-5 rounded-xl border border-indigo-500/40 shadow-lg">
              <h4 className="text-indigo-300 font-bold mb-2 flex items-center gap-2 text-base">
                <span>📐 GỢI Ý PHÂN TÍCH NGỮ PHÁP NHANH (Standard English Conventions)</span>
              </h4>
              <div className="space-y-2 text-sm text-indigo-100">
                <div className="bg-indigo-950/60 p-3 rounded-lg border border-indigo-800/50">
                  <strong className="text-amber-300">1. Quy tắc Chủ ngữ - Động từ (Subject-Verb Agreement):</strong>
                  <p className="text-slate-300 mt-1">
                    Gạch bỏ ngay các cụm giới từ phụ nằm kẹp ở giữa (<code className="text-indigo-200 bg-indigo-900/80 px-1 rounded">of...</code>, <code className="text-indigo-200 bg-indigo-900/80 px-1 rounded">in...</code>, <code className="text-indigo-200 bg-indigo-900/80 px-1 rounded">with...</code>, <code className="text-indigo-200 bg-indigo-900/80 px-1 rounded">from...</code>) để tìm đúng <em>Chủ ngữ chính</em>. Xác định Chủ ngữ là số ít hay số nhiều để chia động từ tương ứng.
                  </p>
                </div>
                <div className="bg-indigo-950/60 p-3 rounded-lg border border-indigo-800/50">
                  <strong className="text-cyan-300">2. Quy tắc Dấu câu (Punctuation Clues):</strong>
                  <p className="text-slate-300 mt-1">
                    Kiểm tra xem 2 vế trước và sau chỗ trống có phải 2 mệnh đề độc lập hoàn chỉnh (Independent Clauses) hay không.
                    Nhớ công thức: <span className="font-semibold text-white">Dấu chấm (.) = Dấu chấm phẩy (;) = Dấu phẩy + FANBOYS (, and / , but / , so)</span>. Tuyệt đối không dùng dấu phẩy đơn để nối 2 mệnh đề độc lập (Bẫy Comma Splice).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Điểm 38: Hướng dẫn so sánh 2 cách giải Toán (Giải tay vs. Bấm Desmos 15 giây) */}
          {isMath && (
            <div className="bg-[#082f49] p-5 rounded-xl border border-sky-500/40 shadow-lg">
              <h4 className="text-sky-300 font-bold mb-2 flex items-center gap-2 text-base">
                <span>🧮 GỢI Ý GIẢI NHANH BẰNG DESMOS (15 GIÂY)</span>
                <span className="text-xs bg-sky-950 text-sky-200 px-2 py-0.5 rounded border border-sky-700">Digital SAT Hack</span>
              </h4>
              <div className="space-y-2 text-sm text-sky-100 overflow-x-auto max-w-full break-words">
                <p>• <strong>Bước 1 (Nhập hàm số/phương trình):</strong> Mở Desmos (nút Máy tính trên thanh công cụ) và gõ trực tiếp biểu thức trong đề bài (VD: <code className="bg-sky-950 px-1.5 py-0.5 rounded text-sky-200 font-mono">y = f(x)</code> và <code className="bg-sky-950 px-1.5 py-0.5 rounded text-sky-200 font-mono">y = c</code>).</p>
                <p>• <strong>Bước 2 (Tìm giao điểm / Nghiệm):</strong> Click chuột vào giao điểm màu xám mờ trên đồ thị để đọc ngay toạ độ nghiệm mà không cần giải tay đại số.</p>
                <p>• <strong>Bước 3 (Thử đáp án với Slider):</strong> Nếu bài toán chứa tham số ẩn, gõ biểu thức và nhấn <code className="bg-sky-950 px-1.5 py-0.5 rounded text-sky-200 font-mono">add slider</code> để quét nhanh nghiệm chính xác trong 15 giây.</p>
              </div>
            </div>
          )}

          {/* AI Explanation */}
          {revealedExplanation && (
            <div className="bg-[#0f172a] p-5 rounded-xl border border-[#334155] shadow-lg">
              <h4 className="text-[#fbbf24] font-bold mb-3 flex items-center gap-2">
                <span>🤖 GIA SƯ AI PHÂN TÍCH ĐÁP ÁN:</span>
              </h4>
              <div className="text-[15px] text-[#e2e8f0] leading-relaxed whitespace-pre-wrap overflow-x-auto max-w-full break-words">
                {revealedExplanation}
              </div>
            </div>
          )}

          {/* Điểm 23: Phân tích TỪNG đáp án với 4 Bẫy Đáp Án Sai Kinh Điển */}
          {Array.isArray(revealedAnalysis) && revealedAnalysis.length > 0 && (
            <div className="bg-[#0f172a] p-5 rounded-xl border border-[#334155] shadow-lg">
              <h4 className="text-[#fbbf24] font-bold mb-3 flex items-center gap-2">
                <span>🔍 VÌ SAO CÁC ĐÁP ÁN KIA SAI?</span>
              </h4>
              <div className="space-y-2.5">
                {revealedAnalysis.map((ca, idx) => {
                  const isUserPick = questionData.choices[idx] === selectedAnswer;
                  const rowClass = ca.is_correct
                    ? 'bg-[#064e3b]/40 border-[#10b981]'
                    : isUserPick
                    ? 'bg-[#7f1d1d]/40 border-[#ef4444]'
                    : 'bg-[#1b2533] border-[#334155]';
                  const icon = ca.is_correct ? '✅' : isUserPick ? '❌' : '⚠️';
                  const trapBadge = !ca.is_correct ? getTrapBadge(ca.analysis, questionData.choices[idx] || '', ca.is_correct) : null;

                  return (
                    <div key={idx} className={`p-3.5 rounded-lg border ${rowClass}`}>
                      {trapBadge && (
                        <div className={`inline-block mb-1.5 px-2.5 py-0.5 rounded text-xs font-bold border ${trapBadge.color}`}>
                          {trapBadge.label}
                        </div>
                      )}
                      <div className="text-sm text-[#e2e8f0] leading-relaxed overflow-x-auto max-w-full break-words">
                        <span className="font-bold mr-1">{icon} {ca.choice_letter}.</span>
                        {isUserPick && !ca.is_correct && (
                          <span className="text-[#fca5a5] font-bold mr-1">(Bạn đã chọn)</span>
                        )}
                        {ca.analysis}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {submitError && (
        <div className="mb-4 bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] px-4 py-3 rounded-lg text-sm">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      {!isSubmitted && (
        <button 
          onClick={handleSubmit}
          disabled={!selectedAnswer && !gridInInput && !hasTimeLimit}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
            selectedAnswer || gridInInput || hasTimeLimit
              ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white hover:scale-[1.02]'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}>
          {selectedAnswer || gridInInput ? '🚀 CHỐT ĐÁP ÁN' : hasTimeLimit ? '⏱️ BỎ TRỐNG & NỘP' : '🚀 CHỐT ĐÁP ÁN'}
        </button>
      )}
    </div>
  );
}
