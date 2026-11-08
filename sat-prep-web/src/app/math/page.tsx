'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { SKILL_TREE } from '@/lib/skill-taxonomy';
import { LoadingState } from '@/components/LoadingState';
import { matchesAnswer } from '@/lib/answer-match';
import * as BluebookToolsModule from '@/components/BluebookTools';
import { 
  parseSprInput, 
  extractTargetExpressionTrap, 
  detectUnitConversionTrap 
} from '@/lib/sat-tactical-helpers';

// Hỗ trợ dynamic / named export an toàn cho BluebookTools
const BluebookTools = ((BluebookToolsModule as Record<string, unknown>).BluebookTools || 
  (BluebookToolsModule as Record<string, unknown>).default || 
  BluebookToolsModule) as React.ComponentType<{ compact?: boolean }>;

// 4 domain Toán + skill con, lấy thẳng từ skill-taxonomy (single source of truth).
// Mỗi skill con map đúng 1 skillId → mastery phủ đủ 13 skill Toán (nền cho Skill Tree).
const MATH_DOMAINS = SKILL_TREE.filter((d) => d.subject === 'math');

interface MathLesson {
  concept_name: string;
  theory: string;
  sample_example: string;
  practice_question: string;
  choices: string[];
  correct_choice?: string;
  explanation: string;
  difficulty: string;
  trapRate: number;
  skillId?: string;
  choice_analysis?: { choice_letter: string; is_correct: boolean; analysis: string }[];
  questionId?: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

type DifficultyLevel = 'all' | 'foundation' | 'medium' | 'hard';

interface DesmosCalcInstance {
  setExpression: (expr: { id: string; latex: string; color?: string; sliderBounds?: { min: number; max: number; step?: number } }) => void;
  removeExpression: (expr: { id: string }) => void;
  setBlank: () => void;
  destroy: () => void;
}

export default function MathPage() {
  const { userStats, inventory, spendCoins, registerGradedResult, practiceStreak } = useGamification();
  const { showToast } = useToast();
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [currentSkillId, setCurrentSkillId] = useState<string | null>(null);
  const [lessonData, setLessonData] = useState<MathLesson | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Bộ lọc độ khó Toán
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel>('all');

  // Chế độ Luyện Riêng Câu Tự Luận Điền Đáp Án (SPR / Grid-in Mode)
  const [isSprMode, setIsSprMode] = useState(false);
  const [sprAnswer, setSprAnswer] = useState("");
  const [showChoicesInSpr, setShowChoicesInSpr] = useState(false);

  // Desmos API Native Integration State
  const [isDesmosReady, setIsDesmosReady] = useState(false);
  const [isDesmosOffline, setIsDesmosOffline] = useState(false);
  const desmosCalcRef = useRef<DesmosCalcInstance | null>(null);
  const desmosContainerRef = useRef<HTMLDivElement | null>(null);
  const desmosDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const desmosScrollTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  // Boss / Gamification States
  const [isBossEncounter, setIsBossEncounter] = useState(false);
  const [bossHp, setBossHp] = useState(100);
  const [playerHearts, setPlayerHearts] = useState(3);
  const [activeSkills, setActiveSkills] = useState<{desmos: boolean, focus: boolean}>({desmos: false, focus: false});
  
  // Practice States
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [revealedCorrectChoice, setRevealedCorrectChoice] = useState<string | null>(null);
  const [revealedAnalysis, setRevealedAnalysis] = useState<{ choice_letter: string; is_correct: boolean; analysis: string }[] | null>(null);

  // Chat States
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prefetchedRef = useRef<{ topic: string; difficulty: string; promise: Promise<MathLesson | null> } | null>(null);

  // Khởi tạo Desmos API v1.9 Native
  useEffect(() => {
    let isMounted = true;

    const initDesmos = () => {
      if (window.Desmos && desmosContainerRef.current) {
        try {
          if (!desmosCalcRef.current) {
            desmosCalcRef.current = window.Desmos.GraphingCalculator(desmosContainerRef.current, {
              keypad: true,
              expressions: true,
              settingsMenu: true,
              zoomButtons: true,
              border: false,
              fontSize: 13,
            });
          }
          if (isMounted) {
            setIsDesmosReady(true);
            setIsDesmosOffline(false);
          }
        } catch (e) {
          console.warn("Desmos initialization failed, using iframe fallback:", e);
          if (isMounted) setIsDesmosOffline(true);
        }
      }
    };

    if (window.Desmos) {
      initDesmos();
      return;
    }

    const scriptSrc = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
    const existing = document.querySelector(`script[src*="calculator.js"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        if (isMounted) initDesmos();
      });
      existing.addEventListener('error', () => {
        if (isMounted) setIsDesmosOffline(true);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => {
      if (isMounted) initDesmos();
    };
    script.onerror = () => {
      console.warn("Không tải được Desmos API SDK v1.9, chuyển sang iframe.");
      if (isMounted) setIsDesmosOffline(true);
    };
    document.head.appendChild(script);

    return () => {
      isMounted = false;
      if (desmosCalcRef.current) {
        try {
          desmosCalcRef.current.destroy();
        } catch {
          // ignore
        }
        desmosCalcRef.current = null;
      }
    };
  }, []);

  const attachDesmosContainer = useCallback((node: HTMLDivElement | null) => {
    desmosContainerRef.current = node;
    if (node && window.Desmos && !desmosCalcRef.current) {
      try {
        desmosCalcRef.current = window.Desmos.GraphingCalculator(node, {
          keypad: true,
          expressions: true,
          settingsMenu: true,
          zoomButtons: true,
          border: false,
          fontSize: 13,
        });
        setIsDesmosReady(true);
      } catch (e) {
        console.warn("Desmos mount error:", e);
        setIsDesmosOffline(true);
      }
    }
  }, []);

  // Trích xuất phương trình toán học từ đề bài
  const extractMathEquations = (text: string): string[] => {
    if (!text) return [];
    const results: string[] = [];

    // Tìm các phương trình LaTeX trong \( ... \) hoặc $ ... $
    const latexMatches = text.match(/\$([^$]+)\$|\\\((.*?)\\\)/g);
    if (latexMatches) {
      latexMatches.forEach(m => {
        const cleaned = m.replace(/^\$|^\\\(|\$$|\\\)$/g, '').trim();
        if (/[=<>~]/.test(cleaned) && cleaned.length >= 3) {
          results.push(cleaned);
        }
      });
    }

    // Tách theo câu và biểu thức có dấu = hoặc bất đẳng thức
    const chunks = text.split(/[\n,;.]|\band\b|\bvà\b|\bwhere\b/i);
    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      const match = trimmed.match(/([a-zA-Z0-9_\(\)\^\+\-\*\/\s]+\s*(?:=|<=|>=|<|>|~)\s*[-+]?[a-zA-Z0-9_\(\)\^\+\-\*\/\s]+)/);
      if (match) {
        const cand = match[1].trim();
        if (
          /[xyzabckmfg]/i.test(cand) && 
          cand.length >= 3 && 
          cand.length <= 60 &&
          !/^(what|find|if|calculate|determine|solve|cho|biết|tính|tìm)/i.test(cand)
        ) {
          results.push(cand);
        }
      }
    }

    // Làm sạch và lọc trùng lặp
    const unique = Array.from(new Set(results)).map(eq => 
      eq.replace(/^(equation|function|hàm số|phương trình)\s*/i, '').trim()
    ).filter(eq => eq.length >= 3);

    return unique;
  };

  // 1-Click Bắn Phương Trình Sang Máy Tính Desmos
  const handleSendEquationsToDesmos = () => {
    if (!lessonData) return;

    let equations = extractMathEquations(lessonData.practice_question);
    if (equations.length === 0) {
      equations = extractMathEquations(lessonData.sample_example);
    }

    // Tự động mở khung Desmos nếu đang đóng
    if (desmosDetailsRef.current) {
      desmosDetailsRef.current.open = true;
    }

    if (equations.length === 0) {
      showToast("⚠️ Không phát hiện phương trình rõ ràng trong đề. Đã mở máy tính Desmos để bạn nhập tay!", 'info');
      desmosDetailsRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (desmosCalcRef.current) {
      desmosCalcRef.current.setBlank();
      equations.forEach((eq, idx) => {
        const colors = ['#2563eb', '#dc2626', '#10b981', '#a855f7', '#f59e0b'];
        desmosCalcRef.current?.setExpression({
          id: `eq_${idx + 1}`,
          latex: eq,
          color: colors[idx % colors.length],
        });
      });
      showToast(`📈 Đã bắn ${equations.length} phương trình vào Desmos: ${equations.join(' | ')}`, 'success');
    } else {
      // Fallback copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(equations.join('\n'));
        showToast(`📋 Đã sao chép phương trình: ${equations.join(' | ')} (Dán vào Desmos bằng Ctrl+V)`, 'info');
      }
    }

    // Cuộn mượt đến khung Desmos
    setTimeout(() => {
      desmosDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const hasItem = (itemId: string) => inventory.some(i => (typeof i === 'string' ? i === itemId : (i as { itemId?: string }).itemId === itemId));
  const removeConsumable = (_itemId: string) => {
    // Note: Simulated usage.
  };

  // Phân tích SPR Input chuẩn từ @/lib/sat-tactical-helpers (bắt trọn bẫy hỗn số 3 1/2)
  const sprAnalysis = parseSprInput(sprAnswer);

  // Quét bẫy câu hỏi cuối & bẫy đổi đơn vị từ @/lib/sat-tactical-helpers
  const targetTrapResult = lessonData ? extractTargetExpressionTrap(lessonData.practice_question) : null;
  const unitTrapResult = lessonData ? detectUnitConversionTrap(lessonData.practice_question) : null;

  const hasFinalTrap = Boolean(
    targetTrapResult && (
      (targetTrapResult as { hasFinalTrap?: boolean; hasTrap?: boolean; detected?: boolean }).hasFinalTrap || 
      (targetTrapResult as { hasFinalTrap?: boolean; hasTrap?: boolean; detected?: boolean }).hasTrap || 
      (targetTrapResult as { hasFinalTrap?: boolean; hasTrap?: boolean; detected?: boolean }).detected
    )
  );
  const finalTrapMsg = 
    (targetTrapResult as { finalTrapMsg?: string; message?: string; warning?: string })?.finalTrapMsg || 
    (targetTrapResult as { finalTrapMsg?: string; message?: string; warning?: string })?.message || 
    (targetTrapResult as { finalTrapMsg?: string; message?: string; warning?: string })?.warning || 
    '';

  const hasUnitTrap = Boolean(
    unitTrapResult && (
      (unitTrapResult as { hasUnitTrap?: boolean; hasTrap?: boolean; detected?: boolean }).hasUnitTrap || 
      (unitTrapResult as { hasUnitTrap?: boolean; hasTrap?: boolean; detected?: boolean }).hasTrap || 
      (unitTrapResult as { hasUnitTrap?: boolean; hasTrap?: boolean; detected?: boolean }).detected
    )
  );
  const unitTrapMsg = 
    (unitTrapResult as { unitTrapMsg?: string; message?: string; warning?: string })?.unitTrapMsg || 
    (unitTrapResult as { unitTrapMsg?: string; message?: string; warning?: string })?.message || 
    (unitTrapResult as { unitTrapMsg?: string; message?: string; warning?: string })?.warning || 
    '';

  // Kiểm tra cảnh báo hỗn số đặc thù của College Board
  const isMixedNumberPattern = /\b\d+\s+\d+\/\d+\b/.test(sprAnswer.trim());

  // Fetch thuần — truyền độ khó nếu được chọn
  const fetchLesson = async (topic: string, skillId?: string, diff?: DifficultyLevel): Promise<MathLesson | null> => {
    try {
      const selectedDiff = (diff ?? difficultyFilter);
      const effectiveDifficulty = selectedDiff !== 'all' ? selectedDiff : undefined;
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          moduleType: 'math', 
          topic, 
          skillId, 
          difficulty: effectiveDifficulty 
        })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const prefetchNext = (topic: string, skillId?: string, diff?: DifficultyLevel) => {
    if (prefetchedRef.current) return;
    const curDiff = diff ?? difficultyFilter;
    prefetchedRef.current = { 
      topic, 
      difficulty: curDiff,
      promise: fetchLesson(topic, skillId, curDiff) 
    };
  };

  const handleGenerateLesson = async (topic: string, skillId?: string, diff?: DifficultyLevel) => {
    setCurrentTopic(topic);
    if (skillId !== undefined) setCurrentSkillId(skillId);
    const effectiveSkillId = skillId ?? currentSkillId ?? undefined;
    const curDiff = diff ?? difficultyFilter;
    
    setIsLoading(true);
    setLessonData(null);
    setLoadError(false);
    setIsSubmitted(false);
    setSelectedAnswer(null);
    setSprAnswer("");
    setShowChoicesInSpr(false);
    setRevealedCorrectChoice(null);
    setRevealedAnalysis(null);
    setChatHistory([]);
    setActiveSkills({desmos: false, focus: false});

    // 15% chance of Boss Encounter
    // eslint-disable-next-line react-hooks/purity
    const isBoss = Math.random() < 0.15;
    setIsBossEncounter(isBoss);
    if (isBoss) {
      setBossHp(userStats.level * 50 + 100);
      setPlayerHearts(3);
    }

    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    const data = prefetched && prefetched.topic === topic && prefetched.difficulty === curDiff
      ? await prefetched.promise
      : await fetchLesson(topic, effectiveSkillId, curDiff);

    if (data) {
      setLessonData(data);
    } else {
      setLoadError(true);
      showToast("Lỗi khi sinh bài giảng. Vui lòng thử lại.", 'error');
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (isSubmitted) return;
    
    // Quyết định đáp án nộp: Nếu trong SPR Mode và có gõ chữ thì ưu tiên sprAnswer
    const answerToSubmit = (isSprMode && sprAnswer.trim()) 
      ? sprAnswer.trim() 
      : selectedAnswer;

    if (!answerToSubmit || !lessonData) return;
    setIsSubmitted(true);
    if (isSprMode && sprAnswer.trim() && !selectedAnswer) {
      setSelectedAnswer(sprAnswer.trim());
    }

    let isAnsCorrect = false;
    let economyState: { coins?: number; xp?: number; lastSpinDate?: string | null } | null = null;
    let gradeCorrectChoice: string | null = null;
    let gradeExplanation: string | null = null;

    if (lessonData.questionId) {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: lessonData.questionId,
          answer: answerToSubmit,
          streak: practiceStreak + 1,
        }),
      });
      if (res.ok) {
        const grade = await res.json();
        isAnsCorrect = grade.correct;
        gradeCorrectChoice = grade.correctChoice ?? null;
        gradeExplanation = grade.explanation ?? null;
        setRevealedCorrectChoice(grade.correctChoice);
        if (Array.isArray(grade.choice_analysis)) setRevealedAnalysis(grade.choice_analysis);
        economyState = grade.economy ?? null;
      }
    } else {
      isAnsCorrect = matchesAnswer(answerToSubmit, lessonData.correct_choice);
    }
    setIsCorrect(isAnsCorrect);

    if (!isAnsCorrect && lessonData.questionId) {
      try {
        await fetch("/api/cau-sai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: lessonData.practice_question,
            choices: lessonData.choices,
            correct_choice: gradeCorrectChoice,
            user_choice: answerToSubmit,
            explanation: gradeExplanation,
            source: "Math (Next.js)",
            skill_id: currentSkillId,
          }),
        });
      } catch (e) {
        console.error("Failed to save mistake", e);
      }
    }

    registerGradedResult(isAnsCorrect, economyState);

    if (isBossEncounter) {
      if (isAnsCorrect) {
        let damage = Math.floor(userStats.maxPower * 0.5);
        if (activeSkills.focus) {
          damage *= 2;
          showToast("💥 ĐÒN ĐÁNH CHÍ MẠNG! Nhân đôi sát thương!", 'info');
        }
        const newHp = Math.max(0, bossHp - damage);
        setBossHp(newHp);
      } else {
        setPlayerHearts(prev => prev - 1);
      }
    }

    if (currentTopic) prefetchNext(currentTopic, currentSkillId ?? undefined, difficultyFilter);
  };

  const handleUseHeal = () => {
    if (hasItem("sinh_menh_dan")) {
      removeConsumable("sinh_menh_dan");
      setPlayerHearts(prev => Math.min(3, prev + 1));
      showToast("💊 Đã sử dụng Sinh Mệnh Đan! (+1 ❤️)", 'success');
    } else if (spendCoins(100)) {
      setPlayerHearts(prev => Math.min(3, prev + 1));
      showToast("💸 Đã mua và sử dụng Sinh Mệnh Đan! (-100 Xu, +1 ❤️)", 'success');
    } else {
      showToast("❌ Không đủ Xu để mua Sinh Mệnh Đan!", 'error');
    }
  };

  const handleUseSkip = () => {
    if (hasItem("ve_skip_cau")) {
      removeConsumable("ve_skip_cau");
      showToast("🎫 Đã sử dụng Vé Skip! Bạn đã vượt qua câu hỏi này một cách an toàn.", 'success');
      handleGenerateLesson(currentTopic!);
    } else if (spendCoins(150)) {
      showToast("💸 Đã mua và sử dụng Vé Skip! (-150 Xu)", 'success');
      handleGenerateLesson(currentTopic!);
    } else {
      showToast("❌ Không đủ Xu để mua Vé Skip!", 'error');
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !lessonData) return;
    
    const newMessage: ChatMessage = { role: 'user', text: chatInput };
    const newHistory = [...chatHistory, newMessage];
    setChatHistory(newHistory);
    setChatInput("");
    setIsChatting(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: lessonData.practice_question,
          correctAnswer: lessonData.correct_choice,
          selectedAnswer: selectedAnswer || sprAnswer,
          explanation: lessonData.explanation,
          history: chatHistory,
          userMessage: chatInput
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatHistory([...newHistory, { role: 'ai', text: data.reply }]);
      } else {
        const errorData = await res.json();
        setChatHistory([...newHistory, { role: 'ai', text: `⚠️ Lỗi: ${errorData.error || "Không thể kết nối"}` }]);
      }
    } catch (e) {
      console.error(e);
      setChatHistory([...newHistory, { role: 'ai', text: "⚠️ Lỗi kết nối máy chủ." }]);
    }
    setIsChatting(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const renderChoices = () => {
    let choicesToShow = lessonData!.choices;
    
    if (activeSkills.desmos && !isSubmitted) {
      const cc = revealedCorrectChoice ?? lessonData!.correct_choice ?? '';
      const wrongIndices = choicesToShow.map((c, i) => !matchesAnswer(c, cc) ? i : -1).filter(i => i !== -1);
      if (wrongIndices.length > 0) {
        const newChoices = [...choicesToShow];
        newChoices[wrongIndices[0]] = "❌ [Bị triệt tiêu bởi Nhãn Thuật]";
        choicesToShow = newChoices;
      }
    }

    return choicesToShow.map((choice, idx) => {
      const isSelected = selectedAnswer === choice;
      const isEliminated = choice.includes("[Bị triệt tiêu");
      
      let choiceClass = "bg-[#1b2533] border-[#334155] text-[#e2e8f0]";
      if (isEliminated) choiceClass = "bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed opacity-50";
      else if (isSubmitted) {
        const isThisChoiceCorrect = matchesAnswer(choice, revealedCorrectChoice ?? lessonData!.correct_choice);
        if (isThisChoiceCorrect) choiceClass = "bg-[#064e3b] border-[#10b981] text-[#34d399]";
        else if (isSelected) choiceClass = "bg-[#7f1d1d] border-[#ef4444] text-[#fca5a5]";
      } else if (isSelected) {
        choiceClass = "bg-[#1e3a8a] border-[#3b82f6] text-white";
      }

      return (
        <div 
          key={idx} 
          onClick={() => {
            if (!isSubmitted && !isEliminated) {
              setSelectedAnswer(choice);
              if (isSprMode) setSprAnswer(choice.replace(/^[A-D]\.\s*/, ''));
            }
          }}
          className={`p-4 rounded-xl border-2 transition-all ${isEliminated ? '' : 'cursor-pointer hover:scale-[1.01]'} ${choiceClass}`}
        >
          {choice}
        </div>
      );
    });
  };

  const getDifficultyBadge = () => {
    if (difficultyFilter === 'hard' || lessonData?.difficulty?.toLowerCase().includes('hard')) {
      return { text: "🔥 Hard 750–800+ (Mục tiêu 800)", style: "bg-red-950 text-red-300 border-red-700" };
    }
    if (difficultyFilter === 'foundation' || lessonData?.difficulty?.toLowerCase().includes('easy')) {
      return { text: "🌱 Foundation (500–620)", style: "bg-emerald-950 text-emerald-300 border-emerald-700" };
    }
    return { text: "⚡ Medium (630–730)", style: "bg-amber-950 text-amber-300 border-amber-700" };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)", padding: "2rem", borderRadius: "1rem" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-5xl">📐</div>
            <div>
              <h1 className="text-3xl font-black" style={{ background: "linear-gradient(to right, #60a5fa, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                CHINH PHỤC TOÁN HỌC (SAT BLUEBOOK 2026)
              </h1>
              <p className="text-blue-200">Nền tảng tư duy Toán học đỉnh cao & Tích hợp Desmos API 1-Click — Không gì là không thể!</p>
            </div>
          </div>

          {currentTopic && (
            <div className="bg-[#0f172a]/90 border border-blue-500/40 rounded-xl p-2 shadow-lg backdrop-blur self-start md:self-auto">
              <BluebookTools compact />
            </div>
          )}
        </div>
      </div>
      
      {!currentTopic ? (
        <div className="bg-[#1b2533] border border-[#3b82f6] rounded-xl p-6 shadow-[0_0_15px_rgba(59,130,246,0.1)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262730] pb-4">
            <div>
              <h2 className="text-2xl font-bold text-[#60a5fa] mb-1">1. Lựa Chọn Chủ Đề Toán Học</h2>
              <p className="text-gray-400 text-sm">Chọn đúng dạng bài bạn muốn luyện — hệ thống ghi nhận mức thành thạo riêng cho từng kỹ năng.</p>
            </div>
            
            <div className="bg-[#0e1117] p-2 rounded-xl border border-[#334155] flex flex-col gap-1.5 min-w-[280px]">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
                <span>🎯</span> Mức Độ Khó Mục Tiêu:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'all', label: '🎯 Adaptive (Tất cả)', color: 'border-blue-500 text-blue-300' },
                  { id: 'foundation', label: '🌱 Foundation (500–620)', color: 'border-emerald-500 text-emerald-300' },
                  { id: 'medium', label: '⚡ Medium (630–730)', color: 'border-amber-500 text-amber-300' },
                  { id: 'hard', label: '🔥 Hard 750–800+', color: 'border-red-500 text-red-300' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDifficultyFilter(item.id as DifficultyLevel)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all text-left ${
                      difficultyFilter === item.id 
                        ? `bg-blue-600/30 ${item.color} shadow-[0_0_8px_rgba(59,130,246,0.3)]` 
                        : 'bg-[#1b2533] border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {MATH_DOMAINS.map((domain) => (
              <div key={domain.id}>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#3b82f6] rounded-full inline-block" />
                  {domain.label}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {domain.skills.map((skill) => (
                    <div
                      key={skill.id}
                      onClick={() => handleGenerateLesson(skill.label, skill.id)}
                      className="bg-[#0e1117] border border-[#262730] p-4 rounded-xl hover:border-[#3b82f6] hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] cursor-pointer transition-all group"
                    >
                      <h4 className="text-base font-bold text-gray-100 group-hover:text-[#60a5fa]">{skill.label}</h4>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#1b2533] p-4 rounded-xl border border-[#262730] gap-4">
            <div>
              <span className="text-gray-400 text-sm">Chủ đề hiện tại:</span>
              <h2 className="text-xl font-bold text-[#60a5fa]">{currentTopic}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-[#0e1117] px-2 py-1 rounded-lg border border-[#334155]">
                <span className="text-xs text-gray-400 mr-1">Độ khó:</span>
                {(['all', 'foundation', 'medium', 'hard'] as DifficultyLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setDifficultyFilter(lvl);
                      handleGenerateLesson(currentTopic, currentSkillId ?? undefined, lvl);
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                      difficultyFilter === lvl 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {lvl === 'all' ? 'Adaptive' : lvl === 'foundation' ? '🌱 500-620' : lvl === 'medium' ? '⚡ 630-730' : '🔥 750-800+'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setIsSprMode(prev => !prev);
                  setShowChoicesInSpr(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  isSprMode 
                    ? 'bg-purple-900/60 border-purple-500 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.3)]' 
                    : 'bg-[#0e1117] border-gray-700 text-gray-400 hover:text-white'
                }`}
                title="Bật chế độ tự điền đáp án, ẩn 4 lựa chọn A/B/C/D"
              >
                <span>🔢</span>
                <span>{isSprMode ? 'Chế độ SPR: BẬT' : 'Bật SPR Mode'}</span>
              </button>

              <button
                onClick={() => { setCurrentTopic(null); setCurrentSkillId(null); setLessonData(null); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
              >
                ⬅️ Quay lại danh mục
              </button>
            </div>
          </div>

          {isLoading && (
            <LoadingState message="Gia sư AI đang biên soạn bài giảng riêng cho chiến binh..." />
          )}

          {loadError && !isLoading && !lessonData && (
            <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/40 flex flex-col items-center text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-white mb-1">Không sinh được bài giảng</h3>
              <p className="text-gray-400 text-sm mb-4">Gia sư AI tạm thời chưa phản hồi. Kiểm tra kết nối rồi thử lại.</p>
              <button
                onClick={() => handleGenerateLesson(currentTopic!, currentSkillId ?? undefined)}
                className="text-sm font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2 rounded-lg hover:opacity-90"
              >
                🔄 Thử lại
              </button>
            </div>
          )}

          {lessonData && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {isBossEncounter ? <span className="text-red-500 animate-pulse">⚔️ [BOSS ĐỘT KÍCH]</span> : <span>✏️</span>} 
                  {lessonData.concept_name}
                </h2>
                
                <span className={`text-xs px-3 py-1 rounded-full border font-bold ${getDifficultyBadge().style}`}>
                  {getDifficultyBadge().text}
                </span>
              </div>

              {/* 1. LÝ THUYẾT */}
              <details className="bg-[#1e293b] border border-[#334155] rounded-xl group" open>
                <summary className="p-4 font-bold text-[#60a5fa] cursor-pointer list-none flex justify-between">
                  📚 1. LÝ THUYẾT CỐT LÕI
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-4 border-t border-[#334155] text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {lessonData.theory}
                </div>
              </details>

              {/* 2. VÍ DỤ MẪU */}
              <details className="bg-[#1e293b] border border-[#334155] rounded-xl group" open>
                <summary className="p-4 font-bold text-[#fbbf24] cursor-pointer list-none flex justify-between">
                  💡 2. VÍ DỤ MẪU TIÊU BIỂU
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-4 border-t border-[#334155] text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {lessonData.sample_example}
                </div>
              </details>

              {/* MÁY TÍNH DESMOS INTERACTIVE API v1.9 KÈM 1-CLICK BẮN PHƯƠNG TRÌNH */}
              <details 
                ref={desmosDetailsRef}
                className="bg-[#0f172a] border border-[#1e3a8a] rounded-xl group shadow-[0_0_20px_rgba(30,58,138,0.35)]" 
                open
              >
                <summary className="p-4 font-bold text-green-400 cursor-pointer list-none flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>🧮 MÁY TÍNH DESMOS INTERACTIVE (API v1.9 NATIVE)</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                      SAT Bluebook Ready
                    </span>
                  </div>
                  <span className="group-open:rotate-180 transition-transform text-gray-400">▼</span>
                </summary>
                
                <div className="p-3 border-t border-[#1e3a8a] space-y-3">
                  {/* Toolbar Desmos Action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1b2533] p-2.5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSendEquationsToDesmos}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition-all shadow flex items-center gap-1.5 active:scale-95"
                        title="Tự động trích xuất các phương trình trong câu hỏi và vẽ đồ thị"
                      >
                        <span>📈</span>
                        <span>Bắn Phương Trình Từ Đề Bài (1-Click)</span>
                      </button>
                      <button
                        onClick={() => {
                          if (desmosCalcRef.current) {
                            desmosCalcRef.current.setBlank();
                            showToast("🧹 Đã làm sạch máy tính Desmos!", 'info');
                          }
                        }}
                        className="px-2.5 py-1.5 bg-[#0e1117] hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-lg border border-gray-700 transition-colors"
                      >
                        🧹 Xóa Trắng
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (desmosCalcRef.current) {
                            desmosCalcRef.current.setExpression({ id: 'k_slider', latex: 'k = 1', sliderBounds: { min: -10, max: 10, step: 0.1 } });
                            showToast("🎚️ Đã thêm thanh trượt k!", 'success');
                          }
                        }}
                        className="px-2 py-1 bg-purple-900/70 hover:bg-purple-800 text-purple-200 text-xs rounded border border-purple-700"
                        title="Thêm Slider k"
                      >
                        🎚️ Slider k
                      </button>
                      <button
                        onClick={() => {
                          if (desmosCalcRef.current) {
                            desmosCalcRef.current.setExpression({ id: 'reg_demo', latex: 'y_1\\sim mx_1+b' });
                            showToast("📊 Đã nạp cú pháp hồi quy ~", 'success');
                          }
                        }}
                        className="px-2 py-1 bg-purple-900/70 hover:bg-purple-800 text-purple-200 text-xs rounded border border-purple-700"
                        title="Nạp cú pháp hồi quy"
                      >
                        📊 y₁ ~ mx₁ + b
                      </button>
                    </div>
                  </div>

                  {/* Render Khung Desmos Native hoặc Iframe Fallback */}
                  <div className="w-full h-[500px] rounded-lg overflow-hidden bg-white relative border border-gray-700">
                    {!isDesmosOffline ? (
                      <div ref={attachDesmosContainer} className="w-full h-full" />
                    ) : (
                      <iframe 
                        src="https://www.desmos.com/calculator" 
                        width="100%" 
                        height="100%" 
                        style={{ border: 0 }}
                        title="Desmos Graphing Calculator"
                      />
                    )}
                  </div>
                </div>
              </details>

              {/* 3. BÀI TẬP THỰC HÀNH TẠI CHỖ */}
              <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>🎯</span> 3. BÀI TẬP THỰC HÀNH TẠI CHỖ (Practice Check)
                  </h3>

                  <div className="flex items-center gap-2">
                    {/* NÚT BẮN PHƯƠNG TRÌNH SANG DESMOS (1-CLICK) TRỰC TIẾP TẠI BÀI TẬP */}
                    <button
                      onClick={handleSendEquationsToDesmos}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                      title="Trích xuất phương trình trong bài tập và nạp thẳng vào máy tính Desmos"
                    >
                      <span>📈</span>
                      <span>Bắn Phương Trình Sang Máy Tính Desmos (1-Click)</span>
                    </button>

                    {isSprMode && (
                      <span className="text-xs bg-purple-900/80 text-purple-200 border border-purple-600 px-2.5 py-1 rounded-full font-bold">
                        🔢 Chế độ Tự Điền (SPR)
                      </span>
                    )}
                  </div>
                </div>

                {/* Cảnh báo Bẫy Câu Hỏi Cuối và Bẫy Đổi Đơn Vị (từ @/lib/sat-tactical-helpers) */}
                {(hasFinalTrap || hasUnitTrap) && (
                  <div className="space-y-2 mb-4">
                    {hasFinalTrap && (
                      <div className="p-3 bg-amber-950/60 border border-amber-600/80 rounded-lg text-amber-200 text-sm flex items-start gap-2 shadow-md">
                        <span className="text-lg">⚠️</span>
                        <div>
                          <span className="font-bold text-amber-300">CẢNH BÁO BẪY CÂU HỎI CUỐI: </span>
                          <span>{finalTrapMsg}</span>
                        </div>
                      </div>
                    )}
                    {hasUnitTrap && (
                      <div className="p-3 bg-red-950/60 border border-red-600/80 rounded-lg text-red-200 text-sm flex items-start gap-2 shadow-md">
                        <span className="text-lg">🚨</span>
                        <div>
                          <span className="font-bold text-red-300">CẢNH BÁO BẪY ĐỔI ĐƠN VỊ ĐO: </span>
                          <span>{unitTrapMsg}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-white text-[18px] mb-6 font-bold whitespace-pre-wrap font-serif bg-[#0e1117] p-5 rounded-lg border-l-4 border-[#3b82f6]">
                  {lessonData.practice_question}
                </div>

                {/* Boss Encounter Banner */}
                {isBossEncounter && (
                  <div className="bg-[#450a0a] border border-red-500 p-4 rounded-lg mb-6 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-red-400">👾 ÁC MỘNG TOÁN HỌC</div>
                      <div className="text-sm text-red-200">Sát thương của bạn: {activeSkills.focus ? userStats.maxPower : Math.floor(userStats.maxPower * 0.5)} HP/hit</div>
                      <div className="w-48 h-3 bg-red-900 mt-2 rounded-full overflow-hidden border border-red-700">
                        <div className="bg-red-500 h-full transition-all" style={{width: `${(bossHp / (userStats.level * 50 + 100)) * 100}%`}}></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">❤️ Sinh Mệnh: {Array(playerHearts).fill('❤️').join('')}{Array(3 - playerHearts).fill('🖤').join('')}</div>
                      {playerHearts <= 0 && <div className="text-red-500 font-bold mt-1 text-sm animate-bounce">💀 GAME OVER!</div>}
                    </div>
                  </div>
                )}

                {/* Items & Skills */}
                {!isSubmitted && (
                  <div className="flex flex-wrap gap-3 mb-6">
                    <button onClick={handleUseHeal} className="px-3 py-1 bg-[#064e3b] text-[#34d399] border border-[#10b981] rounded-full text-sm font-bold hover:bg-[#047857]">
                      💊 {hasItem("sinh_menh_dan") ? "Dùng" : "Mua"} Sinh Mệnh Đan (+1 ❤️)
                    </button>
                    <button onClick={handleUseSkip} className="px-3 py-1 bg-[#1e3a8a] text-[#93c5fd] border border-[#3b82f6] rounded-full text-sm font-bold hover:bg-[#1d4ed8]">
                      🎫 {hasItem("ve_skip_cau") ? "Dùng" : "Mua"} Vé Skip Câu
                    </button>
                    <button onClick={() => setActiveSkills(p => ({...p, desmos: true}))} disabled={activeSkills.desmos} className="px-3 py-1 bg-purple-900 text-purple-300 border border-purple-500 rounded-full text-sm font-bold hover:bg-purple-800 disabled:opacity-50">
                      👁️ Nhãn Thuật Desmos (-1 Sai)
                    </button>
                    {isBossEncounter && (
                      <button onClick={() => setActiveSkills(p => ({...p, focus: true}))} disabled={activeSkills.focus} className="px-3 py-1 bg-yellow-900 text-yellow-300 border border-yellow-500 rounded-full text-sm font-bold hover:bg-yellow-800 disabled:opacity-50">
                        🔥 Tập Trung Cao Độ (X2 ST)
                      </button>
                    )}
                  </div>
                )}

                {/* KHU VỰC ĐIỀN ĐÁP ÁN TỰ LUẬN (SPR MODE) */}
                {isSprMode ? (
                  <div className="space-y-4 mb-8 bg-[#0e1117] p-5 rounded-xl border border-purple-800/60 shadow-inner">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                        <span>🔢</span> Nhập Đáp Án Tự Luận (Grid-in Input):
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowChoicesInSpr(prev => !prev)}
                        className="text-xs text-blue-400 hover:text-blue-300 underline font-semibold"
                      >
                        {showChoicesInSpr ? '🙈 Ẩn 4 lựa chọn A/B/C/D' : '👁️ Hiện 4 lựa chọn A/B/C/D (Xem gợi ý)'}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <input
                        type="text"
                        value={sprAnswer}
                        onChange={(e) => setSprAnswer(e.target.value)}
                        disabled={isSubmitted}
                        placeholder="Ví dụ: 3/4 hoặc 0.75 hoặc -5/8"
                        className="bg-[#1b2533] border-2 border-purple-500/70 focus:border-purple-400 rounded-xl px-4 py-3 text-xl font-mono font-bold text-amber-300 focus:outline-none flex-1 tracking-wider"
                      />

                      {/* Phím tắt ký hiệu toán */}
                      {!isSubmitted && (
                        <div className="flex gap-1.5">
                          {['/', '.', '-', 'C'].map((char) => (
                            <button
                              key={char}
                              type="button"
                              onClick={() => {
                                if (char === 'C') setSprAnswer('');
                                else setSprAnswer(prev => prev + char);
                              }}
                              className="px-3 py-2 bg-[#1e293b] hover:bg-[#334155] active:scale-95 text-amber-300 font-mono font-bold rounded-lg border border-gray-600 text-base transition-transform"
                              title={`Thêm ký tự ${char}`}
                            >
                              {char}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phân tích SPR, bắt bẫy hỗn số 3 1/2 */}
                    <div className="space-y-2">
                      {sprAnalysis.numericValue !== null && (
                        <div className="text-sm font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800">
                          <span>≈ Giá trị thập phân tương đương:</span>
                          <span className="font-bold underline text-emerald-300">{Number(sprAnalysis.numericValue.toFixed(4))}</span>
                        </div>
                      )}

                      {/* Cảnh báo Bẫy Hỗn Số (College Board hiểu 3 1/2 là 31/2) */}
                      {isMixedNumberPattern && (
                        <div className="text-xs font-bold text-amber-300 bg-amber-950/70 p-2.5 rounded-lg border border-amber-600 flex items-start gap-2 shadow-md">
                          <span className="text-base">⚠️</span>
                          <div>
                            <span className="font-bold text-amber-200">CẢNH BÁO BẪY HỖN SỐ BLUEBOOK: </span>
                            Bạn đang nhập dạng hỗn số &apos;{sprAnswer.trim()}&apos;. Hệ thống chấm thi SAT College Board không hỗ trợ dấu cách và sẽ hiểu là &apos;{(sprAnswer.trim()).replace(/\s+/, '')}&apos; (tương đương {parseFloat((sprAnswer.trim()).replace(/\s+/, '').split('/')[0]) / parseFloat((sprAnswer.trim()).replace(/\s+/, '').split('/')[1] || '1')}) chứ KHÔNG PHẢI hỗn số! Hãy nhập dạng phân số tối giản (ví dụ: 7/2) hoặc số thập phân (3.5)!
                          </div>
                        </div>
                      )}

                      {sprAnalysis.warning && (
                        <div className="text-xs text-red-400 font-semibold bg-red-950/40 px-3 py-1.5 rounded-lg border border-red-800">
                          {sprAnalysis.warning}
                        </div>
                      )}

                      <p className="text-[11px] text-gray-400">
                        * Quy chuẩn Bluebook: Tối đa 5 ký tự đối với số dương (ví dụ: <code className="text-amber-300">12345</code> hoặc <code className="text-amber-300">3/4</code>), tối đa 6 ký tự đối với số âm. Tuyệt đối không nhập hỗn số!
                      </p>
                    </div>

                    {/* Hiển thị 4 lựa chọn nếu mở gợi ý */}
                    {showChoicesInSpr && (
                      <div className="pt-3 border-t border-gray-800 space-y-3">
                        <span className="text-xs text-gray-400 italic">Gợi ý 4 lựa chọn A/B/C/D từ đề bài:</span>
                        {renderChoices()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 mb-8">
                    {renderChoices()}
                  </div>
                )}

                {!isSubmitted ? (
                  <button 
                    onClick={handleSubmit}
                    disabled={
                      (!selectedAnswer && (!isSprMode || !sprAnswer.trim())) || 
                      (isBossEncounter && playerHearts <= 0)
                    }
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
                      (selectedAnswer || (isSprMode && sprAnswer.trim())) && !(isBossEncounter && playerHearts <= 0) 
                        ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white' 
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}>
                    🚀 CHỐT ĐÁP ÁN {isBossEncounter && '& TẤN CÔNG BOSS'}
                  </button>
                ) : (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    {/* Result Banner */}
                    <div className={`p-4 rounded-xl border-2 flex items-center gap-4 ${isCorrect ? 'bg-[#022c22] border-[#10b981] text-[#34d399]' : 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]'}`}>
                      <div className="text-4xl">{isCorrect ? '🎉' : '❌'}</div>
                      <div>
                        <div className="font-bold text-lg">{isCorrect ? 'CHÍNH XÁC TUYỆT ĐỐI!' : 'SẬP BẪY RỒI CHIẾN BINH!'}</div>
                        {isSprMode && (
                          <div className="text-sm mt-0.5 text-gray-300">
                            Đáp án bạn điền: <span className="font-mono font-bold text-amber-300">{sprAnswer || selectedAnswer}</span>
                            {revealedCorrectChoice && (
                              <span className="ml-3">| Đáp án đúng: <span className="font-mono font-bold text-emerald-400">{revealedCorrectChoice}</span></span>
                            )}
                          </div>
                        )}
                        {isBossEncounter && isCorrect && bossHp === 0 && <div className="text-yellow-400 font-bold mt-1">Boss đã bị tiêu diệt! Nhận phần thưởng đặc biệt!</div>}
                        {isBossEncounter && !isCorrect && <div className="text-red-400 mt-1">Boss phản công! Bạn mất 1 ❤️.</div>}
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="bg-[#0f172a] p-5 rounded-xl border border-[#334155] shadow-lg">
                      <h4 className="text-[#fbbf24] font-bold mb-3 flex items-center gap-2">🤖 GIA SƯ AI PHÂN TÍCH ĐÁP ÁN:</h4>
                      <div className="text-[15px] text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{lessonData.explanation}</div>
                    </div>

                    {/* Phân tích TỪNG đáp án */}
                    {Array.isArray(revealedAnalysis) && revealedAnalysis.length > 0 && (
                      <div className="bg-[#0f172a] p-5 rounded-xl border border-[#334155] shadow-lg">
                        <h4 className="text-[#fbbf24] font-bold mb-3 flex items-center gap-2">🔍 VÌ SAO CÁC ĐÁP ÁN KIA SAI?</h4>
                        <div className="space-y-2">
                          {revealedAnalysis.map((ca, idx) => {
                            const isUserPick = lessonData.choices[idx] === selectedAnswer;
                            const rowClass = ca.is_correct
                              ? 'bg-[#064e3b]/40 border-[#10b981]'
                              : isUserPick
                              ? 'bg-[#7f1d1d]/40 border-[#ef4444]'
                              : 'bg-[#1b2533] border-[#334155]';
                            const icon = ca.is_correct ? '✅' : isUserPick ? '❌' : '⚠️';
                            return (
                              <div key={idx} className={`p-3 rounded-lg border ${rowClass}`}>
                                <div className="text-sm text-[#e2e8f0] leading-relaxed">
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

                    <button onClick={() => handleGenerateLesson(currentTopic, currentSkillId ?? undefined, difficultyFilter)} className="w-full py-3 bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 rounded-xl font-bold text-[#78350f] transition-colors">
                      🔄 Tải Bài Giảng Tiếp Theo
                    </button>
                  </div>
                )}
              </div>

              {/* Interactive AI Chat */}
              {isSubmitted && (
                <div className="bg-[#0e1117] border border-[#262730] rounded-xl overflow-hidden mt-8 shadow-2xl">
                  <div className="bg-[#1e293b] p-4 border-b border-[#334155]">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      💬 Hỏi đáp sâu với Gia sư AI
                    </h3>
                    <p className="text-xs text-gray-400">Không hiểu tại sao câu {selectedAnswer ? selectedAnswer[0] : (sprAnswer || 'đó')} sai? Hãy hỏi AI ngay!</p>
                  </div>
                  
                  <div className="h-64 overflow-y-auto p-4 space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="text-center text-gray-500 mt-10">Gửi câu hỏi để bắt đầu thảo luận với Gia sư.</div>
                    )}
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-[#3b82f6] text-white rounded-br-none' : 'bg-[#1e293b] text-gray-200 border border-[#334155] rounded-bl-none whitespace-pre-wrap'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatting && (
                      <div className="flex justify-start">
                        <div className="bg-[#1e293b] text-gray-400 border border-[#334155] p-3 rounded-lg rounded-bl-none animate-pulse">
                          Gia sư đang suy nghĩ...
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 bg-[#1b2533] border-t border-[#334155] flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="Nhập thắc mắc của bạn..."
                      aria-label="Nhập thắc mắc gửi gia sư AI"
                      className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={isChatting || !chatInput.trim()}
                      className="bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-[#78350f] px-6 py-2 rounded-lg font-bold transition-colors">
                      Gửi
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
