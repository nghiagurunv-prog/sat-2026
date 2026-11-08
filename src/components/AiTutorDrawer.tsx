'use client';

import React, { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';

/**
 * ============================================================================
 *  AI TUTOR DRAWER - GIA SƯ SOCRATIC THẦY NGHĨA GURU (SQUAD 4 - #W031 - #W040)
 * ============================================================================
 *  Tính năng cốt lõi:
 *    • #C031: Thang gợi ý Socratic 3 bước (Bước 1: Từ khóa -> Bước 2: Bẫy nhiễu -> Bước 3: Quy tắc 15s)
 *    • #C036: Nút 1 chạm "Giải thích dễ hiểu hơn (Ví dụ đời thường ELI15)"
 *    • #C039: Gợi ý Socratic tức thì 0s (không tốn lượt gọi AI) theo dạng bài
 *    • #C040: Hộp kiểm tra nhanh 1 chạm "Bạn đã nắm vững dạng câu này chưa?"
 * ============================================================================
 */

export interface AiTutorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  question?: string;
  passage?: string;
  choices?: string[];
  userChoice?: string | null;
  correctChoice?: string;
  explanation?: string;
  domain?: string;
  skillId?: string;
  questionType?: string;
  difficulty?: string;
  onMarkMastered?: (status: 'mastered' | 'review_later') => void;
  className?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  badge?: string;
  timestamp: Date;
}

/**
 * Bộ renderer toán học LaTeX và Markdown an toàn không crash
 */
function renderMathMarkdown(text: string): ReactNode {
  if (!text) return null;

  let s = text
    .replace(/\\pm/g, '±')
    .replace(/\\(leq|le)\b/g, '≤')
    .replace(/\\(geq|ge)\b/g, '≥')
    .replace(/\\(neq|ne)\b/g, '≠')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\times\b/g, '×')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\degree|\^\\circ/g, '°');

  // Bỏ dấu $ bao bọc
  s = s.replace(/\$([^\$]+)\$/g, '$1');

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
        <span key={`frac-${m.index}`} className="inline-flex flex-col text-center align-middle mx-1 font-mono text-[0.88em] leading-tight text-amber-300 font-bold">
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
        <code key={`code-${m.index}`} className="bg-slate-900 text-amber-300 px-1.5 py-0.5 rounded text-[12px] font-mono border border-slate-700">
          {m[9]}
        </code>
      );
    } else if (m[10]) {
      // sup
      nodes.push(
        <sup key={`sup-${m.index}`} className="text-[0.78em] font-mono font-bold text-cyan-300">
          {m[11] || m[12]}
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
 * Sinh gợi ý Socratic tức thì (0 giây - không tốn API) dựa vào đặc trưng câu hỏi (#C039)
 */
function getInstantSocraticTip(
  question?: string,
  domain?: string,
  questionType?: string,
  passage?: string
): { title: string; steps: string[]; tag: string } {
  const qLower = `${question || ''} ${domain || ''} ${questionType || ''} ${passage || ''}`.toLowerCase();

  // 1. Dạng Transitions / Liên từ liên kết
  if (qLower.includes('transition') || qLower.includes('which choice completes the text with the most logical transition')) {
    return {
      tag: 'Transitions (Liên từ)',
      title: 'Chiến thuật 2 nhịp: Xác định quan hệ trước khi nhìn đáp án',
      steps: [
        'Bước 1: Tóm tắt 1 câu ý Mệnh đề trước và 1 câu ý Mệnh đề sau.',
        'Bước 2: Gán nhãn quan hệ: Tương đồng (+/Thêm vào), Tương phản (-/Tuy nhiên), hay Nhân quả (Do đó/Vì vậy).',
        'Bước 3: Loại ngay các từ đồng nghĩa (nếu có 2 đáp án cùng chỉ quan hệ nguyên nhân, loại cả 2).'
      ]
    };
  }

  // 2. Dạng Words in Context / Từ vựng ngữ cảnh
  if (qLower.includes('words in context') || qLower.includes('most nearly means') || qLower.includes('which choice completes the text with the most logical and precise word')) {
    return {
      tag: 'Words in Context (Từ vựng)',
      title: 'Nguyên tắc Vô Hình Hóa: Điền từ thay thế tự nhiên',
      steps: [
        'Bước 1: Lấy tay che chỗ trống lại, đọc manh mối từ các từ khóa xung quanh (dấu phẩy, liên từ đối lập).',
        'Bước 2: Tự nghĩ ra một từ tiếng Việt hoặc tiếng Anh đơn giản nhất phù hợp vào ô trống.',
        'Bước 3: Soi 4 lựa chọn, chọn từ có sắc thái và ý nghĩa trùng khớp nhất với từ bạn vừa nghĩ.'
      ]
    };
  }

  // 3. Dạng Punctuation / Dấu câu & Boundaries
  if (qLower.includes('boundaries') || qLower.includes('punctuation') || qLower.includes('comma') || qLower.includes('semicolon')) {
    return {
      tag: 'Boundaries (Dấu câu & Mệnh đề)',
      title: 'Quy tắc Độc Lập - Phụ Thuộc (Independent vs. Dependent)',
      steps: [
        'Bước 1: Tìm Chủ ngữ & Vị ngữ chính của từng vế để đếm số Mệnh đề độc lập (IC).',
        'Bước 2: Nhớ công thức: IC + [Dấu chấm / Chấm phẩy / Dấu phẩy + FANBOYS] + IC.',
        'Bước 3: Cấm dùng dấu phẩy đơn lẻ nối 2 mệnh đề độc lập (lỗi kinh điển Comma Splice).'
      ]
    };
  }

  // 4. Dạng Toán: Phương trình bậc hai & Parabol
  if (qLower.includes('quadratic') || qLower.includes('parabola') || qLower.includes('vertex') || qLower.includes('bậc hai') || qLower.includes('x^2')) {
    return {
      tag: 'Toán: Bậc hai & Parabol',
      title: 'Quy tắc Tọa độ Đỉnh & Biệt thức Delta',
      steps: [
        'Bước 1: Tọa độ hoành độ đỉnh: x_vertex = -b / (2a). Thế lại vào hàm tìm giá trị max/min.',
        'Bước 2: Số nghiệm thực: Δ = b² - 4ac (> 0: 2 nghiệm; = 0: 1 nghiệm; < 0: vô nghiệm).',
        'Bước 3: Bật Desmos gõ trực tiếp biểu thức và click chuột vào đỉnh/giao điểm trục hoành trong 5 giây!'
      ]
    };
  }

  // 5. Dạng Toán: Hệ phương trình Tuyến tính
  if (qLower.includes('system of equations') || qLower.includes('hệ phương trình') || qLower.includes('no solution') || qLower.includes('infinitely many')) {
    return {
      tag: 'Toán: Hệ Tuyến Tính',
      title: 'Tỉ số hệ số đường thẳng song song / trùng nhau',
      steps: [
        'Bước 1: Viết 2 phương trình về dạng chuẩn ax + by = c.',
        'Bước 2: Vô nghiệm (No solution): Song song (a1/a2 = b1/b2 ≠ c1/c2).',
        'Bước 3: Vô số nghiệm (Infinitely many): Trùng nhau (a1/a2 = b1/b2 = c1/c2).'
      ]
    };
  }

  // Mặc định cho các câu khác
  return {
    tag: 'Tư Duy College Board Chuẩn',
    title: 'Chiến thuật Socratic 3 Bước Độc Quyền',
    steps: [
      'Bước 1: Gạch chân đúng yêu cầu cốt lõi (Main Idea, Function, Value of x).',
      'Bước 2: Đọc lướt loại trừ 2 đáp án nhiễu có bẫy cực đoan (always, never, perfectly).',
      'Bước 3: Chỉ chốt đáp án khi có bằng chứng trực tiếp 1-đối-1 từ bài đọc hoặc phép toán kiểm tra lại.'
    ]
  };
}

export function AiTutorDrawer({
  isOpen,
  onClose,
  question = '',
  passage = '',
  choices = [],
  userChoice = null,
  correctChoice = '',
  explanation = '',
  domain = '',
  skillId = '',
  questionType = '',
  difficulty = 'Medium',
  onMarkMastered,
  className = '',
}: AiTutorDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [masteryStatus, setMasteryStatus] = useState<'idle' | 'mastered' | 'review_later'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Gợi ý Socratic tức thì (0s không tốn quota AI #C039)
  const instantTip = useMemo(
    () => getInstantSocraticTip(question, domain, questionType, passage),
    [question, domain, questionType, passage]
  );

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Khởi tạo tin nhắn chào hỏi ban đầu khi mở drawer
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          role: 'assistant',
          content: `Chào em! Thầy Nghĩa đây 🎓. Hãy để thầy dẫn dắt em theo **phương pháp Socratic** để tự mình tìm ra chìa khóa câu này thay vì chỉ đọc lời giải thụ động.\n\nEm muốn thầy gợi ý theo hướng nào dưới đây?`,
          badge: 'Socratic Coach',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  // Đóng bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Gửi prompt tới AI Tutor API
  const sendPromptToAI = async (userPrompt: string, stepBadge?: string) => {
    if (!userPrompt.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          passage,
          choices,
          userChoice,
          correctChoice,
          explanation,
          domain,
          skillId,
          questionType,
          userMessage: userPrompt,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const aiReply =
        data.reply ||
        data.text ||
        data.content ||
        'Thầy đã nhận được câu hỏi. Hãy cùng phân tích các manh mối trong đề bài nhé!';

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiReply,
          badge: stepBadge || 'Socratic Hint',
          timestamp: new Date(),
        },
      ]);
    } catch {
      // Local Socratic Fail-Safe khi mạng chập chờn
      let fallbackText = `💡 **Gợi ý điểm tựa Socratic:**\n\n`;
      if (stepBadge?.includes('Bước 1')) {
        fallbackText += `Em hãy chú ý **từ khóa quan trọng nhất** trong câu hỏi hoặc dòng cuối cùng của văn bản. Manh mối thường nằm ngay trước dấu liên kết!`;
      } else if (stepBadge?.includes('Bước 2')) {
        fallbackText += `🪤 **Phân tích bẫy:** College Board thường tạo ra 1 đáp án mang từ ngữ y hệt bài đọc nhưng **đổi hướng ý nghĩa** (Word-matching trap) và 1 đáp án **quá phóng đại** (Extreme trap). Hãy gạch bỏ chúng trước!`;
      } else if (stepBadge?.includes('Bước 3')) {
        fallbackText += `⚡ **Quy tắc giải nhanh 15s:** Đối với dạng này, hãy kiểm tra tính tương đương logic hoặc thay thế trực tiếp vào đề bài để kiểm chứng 100%.`;
      } else {
        fallbackText += `Em hãy đọc kỹ lại từ khóa trong đề và so sánh từng từ trong 4 lựa chọn với dữ liệu gốc!`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-fallback-${Date.now()}`,
          role: 'assistant',
          content: fallbackText,
          badge: stepBadge || 'Socratic Local',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Kích hoạt nấc thang gợi ý Socratic 3 bước (#C031)
  const triggerSocraticStep = (stepNumber: 1 | 2 | 3) => {
    setActiveStep(stepNumber);
    let prompt = '';
    let badge = '';

    if (stepNumber === 1) {
      badge = 'Bước 1: Từ Khóa';
      prompt = 'Thầy ơi, hãy chỉ cho em từ khóa cốt lõi (Keywords & Clues) trong đề bài này mà em cần tập trung cao độ, đừng giải vội!';
    } else if (stepNumber === 2) {
      badge = 'Bước 2: Bẫy Đáp Án';
      prompt = 'Thầy ơi, hãy giải phẫu 2 đáp án nhiễu dễ lừa nhất trong câu này và chỉ ra lý do tại sao chúng lại là bẫy của College Board!';
    } else {
      badge = 'Bước 3: Quy Tắc 15s';
      prompt = 'Thầy ơi, hãy chốt quy tắc giải nhanh 15 giây hoặc mẹo Desmos chuẩn để lần sau gặp dạng này em ăn điểm tuyệt đối!';
    }

    sendPromptToAI(prompt, badge);
  };

  // Nút 1 chạm "Giải thích dễ hiểu hơn (Ví dụ đời thường ELI15)" (#C036)
  const triggerEli15 = () => {
    const prompt =
      'Thầy ơi, hãy giải thích câu này bằng một ví dụ đời thường thật gần gũi, dí dỏm cho học sinh 15 tuổi (ELI15) để em hiểu thấu bản chất bản vẽ/quy tắc này nhé!';
    sendPromptToAI(prompt, 'Ví dụ Đời Thường ELI15');
  };

  // Đánh dấu nắm vững (#C040)
  const handleMark = (status: 'mastered' | 'review_later') => {
    setMasteryStatus(status);
    if (onMarkMastered) {
      onMarkMastered(status);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden ${className}`}>
      {/* Backdrop mờ nền */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer trượt vào từ cạnh phải */}
      <aside
        className="absolute inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-drawer-title"
      >
        <div className="w-screen max-w-xl bg-gradient-to-b from-slate-900 via-[#0d1527] to-[#070b14] border-l border-cyan-500/30 text-slate-100 flex flex-col shadow-2xl relative">
          
          {/* 1. Header Gia Sư Socratic */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400/40">
                🎓
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="tutor-drawer-title" className="text-base font-bold text-white tracking-wide">
                    Gia Sư AI Socratic
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    Thầy Nghĩa Guru
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Sẵn sàng gợi mở tư duy • Không spoil đáp án
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
              title="Đóng drawer (Esc)"
              aria-label="Đóng drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 2. Hộp Gợi Ý Socratic Tức Thì 0 Giây (#C039) */}
          <div className="mx-4 mt-4 p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-indigo-950/40 border border-cyan-500/30 shadow-inner">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <span>⚡ Gợi ý Socratic Tức Thì (0s — Tiết kiệm AI)</span>
              </div>
              <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-200 px-2 py-0.5 rounded border border-cyan-500/30">
                {instantTip.tag}
              </span>
            </div>
            <p className="text-[12px] font-semibold text-slate-200 mb-2">
              {instantTip.title}
            </p>
            <div className="space-y-1.5 text-[11px] text-slate-300">
              {instantTip.steps.map((st, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0">{i + 1}.</span>
                  <span className="leading-snug">{st}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Thanh Thang Gợi Ý Socratic 3 Bước (#C031) */}
          <div className="px-4 pt-3 pb-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Thang Gợi Ý 3 Bước</span>
              <span className="text-amber-400 text-[10px] lowercase font-normal">bấm để dẫn dắt</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => triggerSocraticStep(1)}
                disabled={isLoading}
                className={`p-2 rounded-lg text-left border transition-all text-xs flex flex-col gap-1 ${
                  activeStep === 1
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10'
                    : 'bg-slate-800/80 border-slate-700 hover:border-amber-400/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase">
                  <span>Step 1</span>
                </div>
                <span className="font-semibold leading-tight line-clamp-2">🔍 Chỉ ra từ khóa đề bài</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSocraticStep(2)}
                disabled={isLoading}
                className={`p-2 rounded-lg text-left border transition-all text-xs flex flex-col gap-1 ${
                  activeStep === 2
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-md shadow-rose-500/10'
                    : 'bg-slate-800/80 border-slate-700 hover:border-rose-400/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase">
                  <span>Step 2</span>
                </div>
                <span className="font-semibold leading-tight line-clamp-2">🪤 Phân tích 2 bẫy nhiễu</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSocraticStep(3)}
                disabled={isLoading}
                className={`p-2 rounded-lg text-left border transition-all text-xs flex flex-col gap-1 ${
                  activeStep === 3
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-800/80 border-slate-700 hover:border-emerald-400/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase">
                  <span>Step 3</span>
                </div>
                <span className="font-semibold leading-tight line-clamp-2">⚡ Chốt quy tắc giải 15s</span>
              </button>
            </div>

            {/* Nút 1 chạm Giải thích dễ hiểu hơn (Ví dụ đời thường ELI15) (#C036) */}
            <div className="mt-2">
              <button
                type="button"
                onClick={triggerEli15}
                disabled={isLoading}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-900/50 to-pink-900/50 hover:from-purple-800/60 hover:to-pink-800/60 border border-purple-500/40 text-purple-200 flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-purple-500/10"
              >
                <span>💡 Giải thích dễ hiểu hơn (Ví dụ đời thường ELI15)</span>
                <span className="text-[10px] bg-purple-500/30 px-1.5 py-0.2 rounded font-mono">1-Chạm</span>
              </button>
            </div>
          </div>

          {/* 4. Khung Đàm Thoại AI */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[11px] font-bold text-slate-400">
                    {msg.role === 'user' ? 'Bạn' : 'Thầy Nghĩa Guru'}
                  </span>
                  {msg.badge && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {msg.badge}
                    </span>
                  )}
                </div>

                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none shadow-md'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700 rounded-tl-none shadow-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{renderMathMarkdown(msg.content)}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-slate-800/90 border border-slate-700 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-cyan-300 flex items-center gap-3">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-xs text-slate-400">Đang suy luận Socratic...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 5. Hộp Kiểm Tra Nhanh 1 Chạm "Bạn đã nắm vững dạng này chưa?" (#C040) */}
          <div className="mx-4 mb-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span>🎯</span> Bạn đã nắm vững dạng câu này chưa?
              </span>
              {masteryStatus === 'mastered' && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                  ✓ Đã thành thạo
                </span>
              )}
              {masteryStatus === 'review_later' && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  ⏳ Đã lưu ôn tập
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMark('mastered')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  masteryStatus === 'mastered'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <span>✅ Đã hiểu rõ 100%</span>
              </button>

              <button
                type="button"
                onClick={() => handleMark('review_later')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  masteryStatus === 'review_later'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                <span>🔄 Cần ôn lại sau</span>
              </button>
            </div>
          </div>

          {/* 6. Thanh Nhập Tin Nhắn Chat */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/95 sticky bottom-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendPromptToAI(inputValue);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Hỏi thầy bất kỳ khúc mắc nào về câu này..."
                disabled={isLoading}
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center gap-1 shadow-lg shadow-cyan-500/20"
              >
                <span>Gửi</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
