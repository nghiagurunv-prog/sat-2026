'use client';

import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { LoadingState } from './LoadingState';

/**
 * Render an toàn biểu thức toán học và markdown inline:
 * Hỗ trợ \frac{a}{b}, \sqrt{x}, ^2, \pm, \le, \ge, \neq, \pi, \Delta, in đậm **...**, code `...`
 */
function renderInlineMathAndMarkdown(text: string): ReactNode {
  if (!text) return null;

  // 1. Chuyển đổi các ký hiệu LaTeX phổ biến sang ký tự chuẩn
  let s = text
    .replace(/\\pm/g, '±')
    .replace(/\\(leq|le)\b/g, '≤')
    .replace(/\\(geq|ge)\b/g, '≥')
    .replace(/\\(neq|ne)\b/g, '≠')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\delta\b/g, 'δ')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\degree|\^\\circ/g, '°');

  // Bỏ dấu $ bao ngoài công thức nếu có ($...$)
  s = s.replace(/\$([^\$]+)\$/g, '$1');

  // Tokenize: \frac{num}{den}, \sqrt{rad}, **bold**, `code`, ^{sup} hoặc ^(\d+)
  const regex = /(\\frac\{([^{}]+)\}\{([^{}]+)\})|(\\sqrt\{([^{}]+)\})|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\^\{([^{}]+)\}|\^([0-9a-zA-Z+-]+))/g;

  const nodes: ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(s)) !== null) {
    if (m.index > lastIdx) {
      nodes.push(s.substring(lastIdx, m.index));
    }

    if (m[1]) {
      // \frac{num}{den}
      nodes.push(
        <span key={`frac-${m.index}`} className="inline-flex flex-col text-center align-middle mx-1 font-mono text-[0.88em] leading-tight text-amber-200">
          <span className="border-b border-amber-300/60 pb-0.5 px-1">{m[2]}</span>
          <span className="pt-0.5 px-1">{m[3]}</span>
        </span>
      );
    } else if (m[4]) {
      // \sqrt{rad}
      nodes.push(
        <span key={`sqrt-${m.index}`} className="font-mono mx-1 inline-flex items-center text-cyan-200">
          <span className="text-amber-400 font-bold mr-0.5 text-base leading-none">√</span>
          <span className="border-t border-cyan-300/60 pt-0.5 px-0.5">{m[5]}</span>
        </span>
      );
    } else if (m[6]) {
      // **bold**
      nodes.push(
        <strong key={`b-${m.index}`} className="font-bold text-white tracking-wide">
          {m[7]}
        </strong>
      );
    } else if (m[8]) {
      // `code`
      nodes.push(
        <code key={`code-${m.index}`} className="bg-[#0b0f17] text-amber-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-700">
          {m[9]}
        </code>
      );
    } else if (m[10]) {
      // ^{sup} hoặc ^n
      const supText = m[11] || m[12];
      nodes.push(
        <sup key={`sup-${m.index}`} className="text-[0.78em] font-mono font-bold text-cyan-300">
          {supText}
        </sup>
      );
    }

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < s.length) {
    nodes.push(s.substring(lastIdx));
  }

  return nodes.length > 0 ? nodes : s;
}

/**
 * Formatter thông minh hiển thị tin nhắn của AI Tutor:
 * Render công thức toán học LaTeX trần, in đậm, và làm nổi bật 3 cấu trúc Socratic:
 * 1. 💡 Điểm mấu chốt / Gợi mở Socratic
 * 2. 🪤 Giải phẫu bẫy College Board
 * 3. ⚡ Bí kíp thực chiến 15 giây / Mẹo Desmos
 */
export function renderFormattedTutorMessage(text: string): ReactNode {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-2 leading-relaxed text-[14px]">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }

        // 1. 💡 Điểm mấu chốt / Gợi mở Socratic
        if (line.includes('💡') || line.toLowerCase().includes('điểm mấu chốt') || line.toLowerCase().includes('gợi mở socratic')) {
          return (
            <div key={idx} className="bg-amber-500/10 border-l-4 border-amber-400 px-3 py-2 rounded-r-lg my-2 text-amber-100 font-medium">
              {renderInlineMathAndMarkdown(line)}
            </div>
          );
        }

        // 2. 🪤 Giải phẫu bẫy College Board
        if (line.includes('🪤') || line.toLowerCase().includes('giải phẫu bẫy') || line.toLowerCase().includes('bẫy college board')) {
          return (
            <div key={idx} className="bg-rose-500/10 border-l-4 border-rose-400 px-3 py-2 rounded-r-lg my-2 text-rose-100 font-medium">
              {renderInlineMathAndMarkdown(line)}
            </div>
          );
        }

        // 3. ⚡ Bí kíp thực chiến 15 giây / Mẹo Desmos
        if (line.includes('⚡') || line.toLowerCase().includes('bí kíp thực chiến') || line.toLowerCase().includes('mẹo desmos')) {
          return (
            <div key={idx} className="bg-emerald-500/10 border-l-4 border-emerald-400 px-3 py-2 rounded-r-lg my-2 text-emerald-100 font-medium">
              {renderInlineMathAndMarkdown(line)}
            </div>
          );
        }

        // Gạch đầu dòng
        if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-amber-400 mt-1 text-xs">●</span>
              <div className="flex-1">{renderInlineMathAndMarkdown(line.slice(2))}</div>
            </div>
          );
        }

        return <div key={idx}>{renderInlineMathAndMarkdown(line)}</div>;
      })}
    </div>
  );
}

/**
 * Thẻ Mở Khóa Pro Teaser cực cuốn hút khi hết hạn mức Free (429)
 */
function ProUnlockTeaserCard() {
  return (
    <div className="mt-4 p-5 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-[#1a1333] via-[#111827] to-[#2d1238] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="text-3xl p-3 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black rounded-2xl shadow-lg flex items-center justify-center">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-[16px] font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 uppercase tracking-wide">
                Nâng Cấp Pro / Ultimate — Gia Sư AI Thầy Nghĩa Guru
              </h4>
              <span className="text-[10px] uppercase font-bold bg-rose-500/20 border border-rose-500 text-rose-300 px-2 py-0.5 rounded-full">
                Hết hạn mức Free
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Bạn đã dùng hết 5 lượt hỏi miễn phí hôm nay. Đừng để đà ôn luyện bị gián đoạn, hãy mở khóa sức mạnh gia sư tối thượng!
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Không giới hạn</strong> lượt hỏi &amp; đàm thoại 24/7</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Mô hình <strong>GPT-4o Siêu Trí Tuệ</strong> phân tích đa tầng</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Giải phẫu bẫy College Board</strong> chuyên sâu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Tạo câu hỏi <strong>song sinh tương tự</strong> vô hạn</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-auto flex flex-col items-center md:items-end gap-2 flex-shrink-0">
          <a
            href="/pricing"
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-extrabold text-sm px-5 py-2.5 rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>🚀 Mở Khóa Pro Ngay</span>
            <span className="text-xs font-semibold bg-slate-950/20 px-1.5 py-0.5 rounded">Từ 49k/th</span>
          </a>
          <span className="text-[11px] text-amber-200/80 font-medium">Bảo đảm tiến bộ 150+ điểm SAT</span>
        </div>
      </div>
    </div>
  );
}

interface QuestionData {
  id?: number;
  type?: string;
  passage?: string;
  question: string;
  choices: string[];
  correct?: string; // ROOT A: server GIẤU đáp án — không còn gửi về client
  explanation: string;
  translation?: string;
  questionId?: string;
}

export function AITutoring() {
  const { registerGradedResult, practiceStreak, questionKey, incrementQuestionKey } = useGamification();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [revealedCorrect, setRevealedCorrect] = useState<string | null>(null); // ROOT A: đáp án đúng do /api/grade trả sau khi nộp
  const [revealedExplanation, setRevealedExplanation] = useState<string | null>(null); // ROOT A: lời giải do /api/grade trả sau khi nộp
  const [rewardData, setRewardData] = useState<{xpGiven: number, coinsGiven: number, comboMultiplier: number} | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  // Quota AI server trả kèm mỗi reply (route.ts). remaining:Infinity được JSON
  // serialize thành null → check `limit < 0 || remaining == null` để in "không
  // giới hạn" cho premium/ultimate, KHÔNG check === Infinity (luôn false ở client).
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number | null } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch question on mount and when questionKey changes
  useEffect(() => {
    // Hủy request AI đang chạy (nếu có) khi chuyển câu hỏi mới
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const fetchQuestion = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/questions');
        if (!res.ok) {
          setLoadError('Không tải được câu hỏi mới. Vui lòng thử lại.');
          setCurrentQuestion(null);
          return;
        }
        const data = await res.json();
        if (!data?.question || !Array.isArray(data?.choices)) {
          setLoadError('Câu hỏi trả về không hợp lệ. Vui lòng đổi câu khác.');
          setCurrentQuestion(null);
          return;
        }
        setCurrentQuestion(data);
        setLoadError(null);
      } catch (e) {
        console.error("Failed to fetch question:", e);
        setLoadError('Không tải được câu hỏi mới. Kiểm tra kết nối rồi thử lại.');
        setCurrentQuestion(null);
      }
      setIsLoading(false);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setIsCorrect(null);
      setRevealedCorrect(null);
      setRevealedExplanation(null);
      setChatMessages([]);
      setIsTyping(false);
      setIsQuotaExceeded(false);
      setSubmitError(null);
    };
    
    fetchQuestion();

    return () => {
      // Hủy request AI khi unmount hoặc questionKey thay đổi
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [questionKey]);

  const handleSendChat = async (overrideText?: string) => {
    const textToSend = (overrideText ?? chatInput).trim();
    if (!textToSend || !currentQuestion || isTyping) return;
    
    // Hủy request AI cũ nếu còn đang chạy dở trước khi tạo request mới
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage = { role: 'user' as const, text: textToSend };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsTyping(true);

    // KHÔNG dùng localStorage cache ở client: cache chia sẻ nằm ở SERVER
    // (Supabase ai_chat_cache, hash đầy đủ gồm model — xem chat-cache-store.ts).
    // Cache client cũ dựa 30 ký tự đầu câu hỏi dễ trả stale/sai; bỏ để mọi câu
    // đều qua server (cache hit server KHÔNG tốn token/quota, vẫn nhanh).

    try {
      // Server-authoritative: chỉ gửi DỮ LIỆU NGỮ CẢNH; prompt/model dựng ở server (§9.2).
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: currentQuestion.question,
          correctAnswer: revealedCorrect ?? '',
          selectedAnswer: selectedAnswer,
          explanation: revealedExplanation ?? currentQuestion.explanation ?? '',
          history: chatMessages,
          userMessage: userMessage.text,
          targetScore: 1500,
          skillId: currentQuestion.questionId || undefined,
          questionType: currentQuestion.type || 'SAT Mixed',
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Hết quota (429) → kích hoạt Thẻ Mở Khóa Pro Teaser và hiển thị thông báo.
        setIsTyping(false);
        if (response.status === 429 || data?.quotaExceeded) {
          setIsQuotaExceeded(true);
          setQuota({ used: data?.used ?? 5, limit: data?.limit ?? 5, remaining: 0 });
          setChatMessages(prev => [...prev, {
            role: 'ai',
            text: data?.error || "Bạn đã dùng hết 5 lượt hỏi Gia sư AI miễn phí hôm nay. Hãy nâng cấp Pro để hỏi không giới hạn 24/7!"
          }]);
        } else {
          setChatMessages(prev => [...prev, {
            role: 'ai',
            text: data?.error || "Lỗi: Không thể kết nối với server. Có thể bạn chưa thiết lập OPENAI_API_KEY trong file .env.local."
          }]);
        }
        return;
      }

      const aiText = data.reply || "";
      setQuota(data?.quota ?? null);

      setIsTyping(false);
      setChatMessages(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch (err: unknown) {
      // Bỏ qua lỗi AbortError khi unmount, đổi câu hoặc hủy request cũ để không hiện thông báo lỗi giả
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      setIsTyping(false);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Lỗi: Không thể kết nối với server. Có thể bạn chưa thiết lập OPENAI_API_KEY trong file .env.local." }]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedAnswer || !currentQuestion) return;
    setSubmitError(null);

    // 🔴 ROOT A: chấm + thưởng qua /api/grade (đáp án lưu server). correct đã bị
    // GIẤU → grade lỗi/thiếu questionId → không khóa câu, cho user thử lại.
    let correct = false;
    let correctChoice = '';
    let granted = { coins: 0, xp: 0 };
    let economyState: { coins?: number; xp?: number; lastSpinDate?: string | null } | null = null;

    if (!currentQuestion.questionId) {
      setSubmitError('Câu hỏi này thiếu mã chấm điểm. Vui lòng đổi câu khác.');
      return;
    }

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.questionId,
          answer: selectedAnswer,
          streak: practiceStreak + 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data?.error || 'Không chấm được câu hỏi lúc này. Vui lòng thử lại.');
        return;
      }
      const grade = await res.json();
      correct = grade.correct;
      correctChoice = grade.correctChoice ?? '';
      setRevealedCorrect(grade.correctChoice ?? null);
      if (typeof grade.explanation === 'string' && grade.explanation) {
        setRevealedExplanation(grade.explanation);
      }
      granted = grade.granted ?? { coins: 0, xp: 0 };
      economyState = grade.economy ?? null;
    } catch {
      setSubmitError('Không kết nối được server chấm điểm. Vui lòng thử lại.');
      return;
    }

    setIsSubmitted(true);
    setIsCorrect(correct);
    const { comboMultiplier } = registerGradedResult(correct, economyState);
    setRewardData({ xpGiven: granted.xp, coinsGiven: granted.coins, comboMultiplier });

    if (!correct) {
      try {
        await fetch("/api/cau-sai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passage: currentQuestion.passage || "",
            question: currentQuestion.question,
            choices: currentQuestion.choices,
            correct_choice: correctChoice,
            user_choice: selectedAnswer,
            explanation: revealedExplanation ?? '',
            source: "Luyện AI (Next.js)"
          })
        });
      } catch (e) {
        console.error("Failed to save mistake", e);
      }
    }
  };

  const handleNext = () => {
    incrementQuestionKey();
  };

  if (isLoading) {
    return <LoadingState message="Gia sư AI đang soạn câu hỏi mới..." />;
  }

  if (!currentQuestion) {
    return (
      <div className="my-6 bg-[#1b2533] border border-[#334155] rounded-xl p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">Chưa tải được câu hỏi</h2>
        <p className="text-[#94a3b8] mb-4">{loadError || 'Không có câu hỏi để luyện lúc này.'}</p>
        <button
          onClick={incrementQuestionKey}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium px-4 py-2 rounded transition-colors"
        >
          🔄 Thử tải câu khác
        </button>
      </div>
    );
  }

  return (
    <div className="my-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <h2 className="text-[24px] font-bold text-white">
          📝 Đang luyện tập phần: {currentQuestion.type || 'Hỗn hợp'}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={handleNext}
            className="text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] px-4 py-1.5 rounded text-white transition-colors">
            🔄 Đổi câu hỏi khác
          </button>
          <button
            type="button"
            disabled
            title="Tính năng lưu vào thư viện sẽ được mở trong bản sau."
            className="text-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] px-4 py-1.5 rounded text-gray-500 cursor-not-allowed"
          >
            💾 Lưu vào thư viện (sắp có)
          </button>
        </div>
      </div>
      
      <hr className="border-[#262730] my-4" />
      
      <h3 className="text-[18px] font-bold text-white mb-4">Question:</h3>
      
      {/* Passage */}
      {currentQuestion.passage && (
        <div className="bg-[#1b2533] border-l-4 border-[#3b82f6] text-[#e2e8f0] p-4 rounded mb-6 text-[15px] leading-relaxed whitespace-pre-wrap">
          {currentQuestion.passage}
        </div>
      )}
      
      {/* Question */}
      <div className="text-white text-[16px] mb-6 font-bold whitespace-pre-wrap">
        {currentQuestion.question}
      </div>
      
      {/* Choices */}
      <div className="space-y-2 mb-8">
        <div className="text-[14px] text-white mb-2">Chọn đáp án đúng nhất:</div>
        
        {currentQuestion.choices.map((choice, idx) => (
          <label key={idx} className="flex items-start gap-3 cursor-pointer group p-2 hover:bg-[rgba(255,255,255,0.02)] rounded">
            <input 
              type="radio" 
              name="question_choice" 
              disabled={isSubmitted}
              checked={selectedAnswer === choice}
              onChange={() => setSelectedAnswer(choice)}
              className="mt-1 w-4 h-4 text-red-500 bg-gray-800 border-gray-600 focus:ring-red-500" 
            />
            <span className="text-[15px] text-[#e2e8f0]">{choice}</span>
          </label>
        ))}
      </div>
      
      {/* Submit error */}
      {submitError && (
        <div className="mb-4 bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-3 rounded text-sm">
          {submitError}
        </div>
      )}

      {/* Feedback Section */}
      {isSubmitted && (
        <div className="mb-6 space-y-6 animate-in fade-in zoom-in duration-500">
          {isCorrect && rewardData ? (
            <div className="bg-[#022c22] border border-[#10b981] text-[#34d399] p-4 rounded flex items-center gap-3 relative overflow-hidden">
              {rewardData.comboMultiplier > 1 && (
                <div className="absolute top-0 right-0 bg-[#facc15] text-[#713f12] text-xs font-bold px-2 py-1 rounded-bl">
                  COMBO x{rewardData.comboMultiplier}!
                </div>
              )}
              <span className="text-2xl">🎉</span>
              <div>
                <div className="font-bold">TUYỆT VỜI! Bạn đã trả lời chính xác!</div>
                <div className="text-sm">
                  Nhận được: <b>+{rewardData.xpGiven} XP</b> | 💰 <b>+{rewardData.coinsGiven} Xu</b> 
                  {practiceStreak > 1 && <span className="text-yellow-400 ml-2"> (Chuỗi đúng: {practiceStreak}🔥)</span>}
                </div>
              </div>
            </div>
          ) : !isCorrect ? (
            <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-4 rounded flex items-center gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <div className="font-bold">Chưa đúng rồi Chiến binh ơi!</div>
                <div className="text-sm">Đáp án đúng là: {revealedCorrect ?? '—'}. Câu này đã được lưu vào sổ tay ôn lỗi sai.</div>
              </div>
            </div>
          ) : null}

          {/* AI Explanation & Speech */}
          <div className="bg-[#1e293b] p-4 rounded border border-[#334155]">
            <h4 className="text-[#fbbf24] font-bold mb-2 flex justify-between items-center">
              <span>🤖 BÀI GIẢNG CHI TIẾT TỪ GIA SƯ AI</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
                    utterance.lang = "en-US";
                    window.speechSynthesis.speak(utterance);
                  }}
                  className="text-xs bg-[#262730] hover:bg-[#333] border border-[#404353] px-2 py-1 rounded text-white transition-colors"
                >
                  🔊 Đọc đề (Tiếng Anh)
                </button>
                <button
                  onClick={() => {
                    if (!revealedExplanation) return;
                    const utterance = new SpeechSynthesisUtterance(revealedExplanation);
                    utterance.lang = "vi-VN";
                    window.speechSynthesis.speak(utterance);
                  }}
                  disabled={!revealedExplanation}
                  className="text-xs bg-[#262730] hover:bg-[#333] disabled:opacity-50 border border-[#404353] px-2 py-1 rounded text-white transition-colors"
                >
                  🔊 Nghe giảng (Tiếng Việt)
                </button>
              </div>
            </h4>
            <div className="text-sm text-[#e2e8f0] leading-relaxed">
              {revealedExplanation ? renderFormattedTutorMessage(revealedExplanation) : 'Lời giải sẽ hiển thị sau khi bạn nộp bài.'}
            </div>
          </div>

          {/* Interactive Chat */}
          <div className="bg-[#1b2533] p-4 rounded border border-[#262730]">
            <h4 className="text-[14px] font-bold text-white mb-1">💬 Hỏi đáp sâu với Gia sư AI về câu hỏi này:</h4>
            {quota && (
              <div className="text-[11px] mb-3">
                <span className={`px-2 py-0.5 rounded-full border ${
                  quota.limit < 0 || quota.remaining == null
                    ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                    : (quota.remaining ?? 0) <= 1
                      ? 'text-red-300 border-red-500/40 bg-red-500/10'
                      : 'text-[#94a3b8] border-[#334155] bg-[#0f172a]'
                }`}>
                  {quota.limit < 0 || quota.remaining == null
                    ? '🤖 Gia sư AI: không giới hạn'
                    : `🤖 Còn ${quota.remaining}/${quota.limit} lượt hỏi hôm nay`}
                </span>
              </div>
            )}
            {/* 1-Click Prompt Chips (Điểm 74) */}
            <div className="mb-3">
              <div className="text-[12px] font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
                <span>⚡ Gợi ý câu hỏi nhanh (1-Click Prompt):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '🇻🇳 Dịch sát nghĩa câu khó nhất trong bài', text: 'Hãy dịch sát nghĩa và phân tích ngữ pháp câu khó nhất trong đoạn văn/đề bài này giúp em.' },
                  { label: '🧮 Chỉ em cách bấm Desmos câu này trong 15s', text: 'Chỉ em từng bước bấm Desmos để giải nhanh câu này trong 15 giây (cách đặt hàm, tìm giao điểm).' },
                  { label: '🪤 Vì sao đáp án em chọn là bẫy?', text: 'Vì sao đáp án em chọn lại là bẫy? Thuộc dạng bẫy kinh điển nào (Out of Scope / Extreme / Half-Right / Reversed)?' },
                  { label: '🔑 Tóm tắt công thức / quy tắc cốt lõi', text: 'Tóm tắt ngắn gọn 1-2 công thức Toán hoặc quy tắc ngữ pháp cốt lõi để làm dạng bài này.' },
                  { label: '📝 Cho em 1 câu tương tự để làm thử', text: 'Hãy tạo cho em 1 câu hỏi tương tự cùng dạng bài này (có 4 đáp án A, B, C, D) để em luyện tập ngay!' },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isTyping}
                    onClick={() => handleSendChat(chip.text)}
                    className="text-xs bg-[#0f172a] hover:bg-[#1e293b] border border-[#334155] hover:border-amber-400/50 text-[#cbd5e1] hover:text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 text-left font-medium shadow-sm flex items-center gap-1"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {chatMessages.length === 0 && !isTyping ? (
                <div className="bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] p-3 rounded text-sm text-[#e2e8f0]">
                  Hãy nhập câu hỏi nếu bạn chưa hiểu rõ phần giải thích nhé!
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className={`p-3 rounded text-sm ${msg.role === 'user' ? 'bg-[#2563eb] text-white ml-8' : 'bg-[#334155] text-[#e2e8f0] mr-8'}`}>
                    <div className="font-bold text-xs mb-1 opacity-90">{msg.role === 'user' ? '👤 Bạn' : '🤖 Gia sư AI (Thầy Nghĩa Guru)'}:</div>
                    {msg.role === 'ai' ? renderFormattedTutorMessage(msg.text) : <div className="whitespace-pre-wrap">{msg.text}</div>}
                  </div>
                ))
              )}
              {isTyping && (
                <div className="p-3 rounded text-sm bg-[#334155] text-[#94a3b8] mr-8 flex items-center gap-2">
                  <strong>Gia sư AI:</strong> Đang suy nghĩ...
                  <span className="animate-pulse">⏳</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isTyping && chatInput.trim()) {
                    handleSendChat();
                  }
                }}
                disabled={isTyping}
                placeholder="Ví dụ: Tại sao đáp án A lại sai?"
                className="flex-1 bg-[#0e1117] border border-[#334155] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6] disabled:opacity-50"
              />
              <button 
                type="button"
                onClick={() => handleSendChat()}
                disabled={isTyping || !chatInput.trim()}
                className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Gửi câu hỏi
              </button>
            </div>

            {/* 4 Chế độ Socratic 1-Chạm (Ngay dưới khung chat) */}
            <div className="mt-3 pt-3 border-t border-[#334155]/60">
              <div className="text-[12px] font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                <span>🧭 Chế độ Socratic 1-Chạm (Thầy Nghĩa Guru):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    icon: '🧭',
                    label: 'Gợi ý bước 1 (Không lộ đáp án)',
                    prompt: '🧭 Thầy ơi, hãy cho em gợi ý bước 1 để tự tư duy câu này theo phương pháp Socratic, tuyệt đối không lộ đáp án nhé!',
                    color: 'border-sky-500/30 hover:border-sky-400 bg-sky-950/40 hover:bg-sky-900/50 text-sky-200',
                  },
                  {
                    icon: '🪤',
                    label: 'Chỉ rõ bẫy đáp án tôi vừa chọn',
                    prompt: `🪤 Thầy ơi, hãy chỉ rõ bẫy College Board ở phương án em vừa chọn${selectedAnswer ? ` (Đáp án ${selectedAnswer})` : ''}, tại sao học sinh lại dễ bị lừa ở đây?`,
                    color: 'border-rose-500/30 hover:border-rose-400 bg-rose-950/40 hover:bg-rose-900/50 text-rose-200',
                  },
                  {
                    icon: '⚡',
                    label: 'Mẹo giải nhanh câu này trong 15 giây',
                    prompt: '⚡ Thầy ơi, hãy chỉ em bí kíp thực chiến hoặc mẹo bấm Desmos trong 15 giây để xử lý câu này nhanh nhất!',
                    color: 'border-amber-500/30 hover:border-amber-400 bg-amber-950/40 hover:bg-amber-900/50 text-amber-200',
                  },
                  {
                    icon: '🔁',
                    label: 'Tạo 1 câu mini tương tự để kiểm tra',
                    prompt: '🔁 Thầy ơi, hãy tạo 1 câu mini tương tự (có 4 đáp án A, B, C, D) cùng dạng bài này để em kiểm tra phản xạ ngay nhé!',
                    color: 'border-emerald-500/30 hover:border-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200',
                  },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isTyping}
                    onClick={() => handleSendChat(btn.prompt)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all active:scale-95 disabled:opacity-50 text-left ${btn.color}`}
                  >
                    <span className="text-base">{btn.icon}</span>
                    <span className="truncate">{btn.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Thẻ Mở Khóa Pro Teaser khi hết hạn mức Free (429) */}
            {(isQuotaExceeded || (quota && quota.limit > 0 && (quota.remaining ?? 0) <= 0)) && (
              <ProUnlockTeaserCard />
            )}
          </div>
        </div>
      )}

      {/* Submit button */}
      {!isSubmitted && (
        <button 
          onClick={handleSubmit}
          className="bg-[#ff4b4b] hover:bg-[#ff3333] text-white font-medium px-4 py-2 rounded shadow-sm transition-colors text-[15px]">
          🚀 Nộp bài &amp; Nghe chấm điểm
        </button>
      )}

    </div>
  );
}
