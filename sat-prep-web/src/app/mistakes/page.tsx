'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Filter,
  Search,
  AlertTriangle,
  Brain,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Flame,
  ShieldAlert,
  Layers,
  Award,
  Zap,
  Target,
  ArrowRight,
  Eye,
  RefreshCw,
  Check,
  X,
  Compass
} from 'lucide-react';

/**
 * ============================================================================
 * SỔ TAY LỖI SAI & PHÂN TÍCH BẪY TƯ DUY DIGITAL SAT (MISTAKE BANK & RETRY MODE)
 * ============================================================================
 * - Đồng bộ 2 chiều: localStorage ('sat_mistake_bank_v1') & API (/api/error-logs, /api/cau-sai)
 * - Starter Diagnostic Mistake Deck: 8 Bẫy điểm kinh điển Digital SAT (R&W & Math)
 * - 4 Chiều phân tích nguyên nhân gốc rễ:
 *     1. Conceptual Gap (Hổng Kiến Thức / Công Thức)
 *     2. Careless Error (Sai Ngu / Đọc Nhầm)
 *     3. Time Pressure (Áp Lực Thời Gian / Vội Vàng)
 *     4. Trap Answer (Sập Bẫy College Board)
 * - Lời giải song ngữ Anh-Việt chuẩn College Board & KaTeX Math rendering
 * - Chế độ "Làm Lại Phục Thù (Retry Mode)" tương tác trực tiếp
 * ============================================================================
 */

export type RootCauseType = 'Conceptual Gap' | 'Careless Error' | 'Time Pressure' | 'Trap Answer';
export type SubjectType = 'Reading & Writing' | 'Math';

export interface MistakeItem {
  id: string;
  subject: SubjectType;
  topic: string;
  question: string;
  passage?: string;
  choices: string[];
  correctChoice: string;
  userChoice?: string;
  rootCause: RootCauseType;
  trapType: string;
  explanationEn: string;
  explanationVi: string;
  ruleSummary?: string;
  isMastered: boolean;
  retryCount: number;
  lastReviewedAt?: string;
  createdAt: string;
  source?: string;
}

// 4 Chiều nguyên nhân gốc rễ
const ROOT_CAUSE_META: Record<
  RootCauseType,
  { label: string; sub: string; color: string; bg: string; border: string; icon: string }
> = {
  'Conceptual Gap': {
    label: 'Hổng Kiến Thức / Công Thức',
    sub: 'Conceptual Gap',
    color: 'text-purple-400',
    bg: 'bg-purple-950/40',
    border: 'border-purple-500/40',
    icon: '🧠',
  },
  'Careless Error': {
    label: 'Sai Ngu / Đọc Nhầm Đề',
    sub: 'Careless Error',
    color: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/40',
    icon: '⚡',
  },
  'Time Pressure': {
    label: 'Áp Lực Thời Gian / Vội Vàng',
    sub: 'Time Pressure',
    color: 'text-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-500/40',
    icon: '⏱️',
  },
  'Trap Answer': {
    label: 'Sập Bẫy College Board',
    sub: 'Trap Answer',
    color: 'text-blue-400',
    bg: 'bg-blue-950/40',
    border: 'border-blue-500/40',
    icon: '🪤',
  },
};

// BỘ 8 TÌNH HUỐNG BẪY ĐIỂM KINH ĐIỂN DIGITAL SAT (STARTER DIAGNOSTIC MISTAKE DECK)
const STARTER_MISTAKES_DECK: MistakeItem[] = [
  // --- READING & WRITING (4 ITEMS) ---
  {
    id: 'starter-rw-01',
    subject: 'Reading & Writing',
    topic: 'Boundaries / Comma Splice Trap',
    question:
      'The committee members reviewed the preliminary architectural designs for the new library center, they ultimately decided to postpone the final vote until financial audits were complete.',
    choices: [
      'center, they',
      'center; they',
      'center, and who',
      'center they'
    ],
    correctChoice: 'center; they',
    userChoice: 'center, they',
    rootCause: 'Conceptual Gap',
    trapType: 'Comma Splice (Nối 2 Mệnh Đề Độc Lập Sai Quy Tắc)',
    explanationEn:
      'A comma splice occurs when two independent clauses are joined with only a comma. Both "The committee members reviewed..." and "they ultimately decided..." are full independent clauses (complete thoughts with their own subjects and verbs). In Standard English, two independent clauses must be joined by a semicolon (;), a period, or a comma accompanied by a coordinating conjunction (FANBOYS). Choice B correctly uses a semicolon to separate the two independent clauses.',
    explanationVi:
      'BẪY COMMA SPLICE: Nối hai mệnh đề độc lập chỉ bằng một dấu phẩy là lỗi ngữ pháp bị trừ điểm nặng nhất trong Digital SAT. "The committee members reviewed..." và "they ultimately decided..." đều là câu hoàn chỉnh có S + V riêng. Ta bắt buộc phải dùng: (1) Dấu chấm phẩy (;), (2) Dấu chấm (.), hoặc (3) Dấu phẩy + liên từ đẳng lập FANBOYS (for, and, nor, but, or, yet, so). Đáp án B dùng dấu chấm phẩy chuẩn xác 100%.',
    ruleSummary: 'Independent Clause 1 ; Independent Clause 2 (Hoặc , + FANBOYS)',
    isMastered: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    source: 'Digital SAT Diagnostic Benchmark #1',
  },
  {
    id: 'starter-rw-02',
    subject: 'Reading & Writing',
    topic: 'Form, Structure & Sense / Misplaced Modifier Trap',
    question:
      'Having spent over three years excavating the remote Andean plateau, the ancient stone monolith was finally uncovered by Dr. Alvarez and her archaeological team.',
    choices: [
      'Having spent over three years excavating the remote Andean plateau, the ancient stone monolith was finally uncovered by Dr. Alvarez and her archaeological team.',
      'Having spent over three years excavating the remote Andean plateau, Dr. Alvarez and her archaeological team finally uncovered the ancient stone monolith.',
      'Excavating the remote Andean plateau for over three years, uncovering the ancient stone monolith was accomplished by Dr. Alvarez and her archaeological team.',
      'After over three years spent excavating the remote Andean plateau, it was Dr. Alvarez and her archaeological team who had the ancient stone monolith uncovered.'
    ],
    correctChoice:
      'Having spent over three years excavating the remote Andean plateau, Dr. Alvarez and her archaeological team finally uncovered the ancient stone monolith.',
    userChoice:
      'Having spent over three years excavating the remote Andean plateau, the ancient stone monolith was finally uncovered by Dr. Alvarez and her archaeological team.',
    rootCause: 'Careless Error',
    trapType: 'Dangling Modifier (Bổ Ngữ Treo Lơ Lửng)',
    explanationEn:
      'An introductory modifying phrase starting with a participle ("Having spent over three years excavating...") MUST immediately modify the subject that directly follows the comma. A stone monolith cannot spend three years excavating; only human researchers (Dr. Alvarez and her archaeological team) can do so. Therefore, the subject right after the comma must be "Dr. Alvarez and her archaeological team". Choice B is the only grammatically coherent correction.',
    explanationVi:
      'BẪY BỔ NGỮ TREO (DANGLING MODIFIER): Mệnh đề phân từ mở đầu câu chỉ hành động "Dành hơn 3 năm khai quật...". Danh từ đứng ngay sau dấu phẩy BẮT BUỘC phải là chủ thể thực hiện hành động này. Một khối đá cổ ("the ancient stone monolith") không thể tự khai quật chính nó! Chủ thể khai quật là Tiến sĩ Alvarez và đội ngũ khảo cổ. Do đó, danh từ sau dấu phẩy phải là "Dr. Alvarez and her archaeological team".',
    ruleSummary: 'Introductory Modifier Phrase, [Target Subject Doing the Action] + Verb...',
    isMastered: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    source: 'Digital SAT Diagnostic Benchmark #2',
  },
  {
    id: 'starter-rw-03',
    subject: 'Reading & Writing',
    topic: 'Craft & Structure / Words in Context Trap',
    passage:
      'While several vocal members of the city council initially criticized the municipal transit expansion project as financially reckless, Mayor Torres remained ________, steadfastly maintaining that long-term commuter ridership data would eventually vindicate the substantial upfront capital expenditure.',
    question: 'Which choice completes the text with the most logical and precise word?',
    choices: ['indifferent', 'resolute', 'skeptical', 'erratic'],
    correctChoice: 'resolute',
    userChoice: 'indifferent',
    rootCause: 'Trap Answer',
    trapType: 'False Synonym & Tone Mismatch Trap (Từ Vựng Lạc Sắc Thái)',
    explanationEn:
      'The sentence sets up a clear contrast introduced by "While several members... criticized...". The second half tells us Mayor Torres "steadfastly maintaining that long-term commuter ridership data would eventually vindicate the expenditure." This requires an adjective meaning firm, unwavering, or determined in one\'s purpose. "Resolute" fits precisely. "Indifferent" (unconcerned/apathetic) is a trap: the mayor actively defended the project rather than ignoring it.',
    explanationVi:
      'BẪY TỪ VỰNG NGỮ CẢNH: Liên từ tương phản "While" đối lập việc hội đồng chỉ trích với thái độ kiên định của Thị trưởng Torres ("steadfastly maintaining..." - kiên quyết duy trì quan điểm). Từ cần điền phải mang nghĩa "vững vàng, kiên quyết". "Resolute" (kiên định) là từ chính xác duy nhất. Bẫy "Indifferent" (thờ ơ, vô cảm) đánh lừa người đọc nhầm lẫn giữa kiên định bảo vệ với phớt lờ không quan tâm.',
    ruleSummary: 'Bám chặt từ chỉ dấu tương phản (While, Although) và cụm từ định nghĩa song hành (steadfastly maintaining).',
    isMastered: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    source: 'Digital SAT Diagnostic Benchmark #3',
  },
  {
    id: 'starter-rw-04',
    subject: 'Reading & Writing',
    topic: 'Information & Ideas / Overgeneralization & Fallacy Trap',
    passage:
      'Marine biologist Dr. Elena Rostova investigated microbial communities residing in abyssal hydrothermal vents and observed that bacterial strain Hydro-9 actively synthesized thermostable enzymes at temperatures up to 95°C. In contrast, phylogenetically related bacterial strains isolated from shallow coastal waters completely ceased metabolic enzymatic activity above 42°C. Rostova hypothesized that Hydro-9\'s extraordinary thermal resilience is directly caused by its unique synthesis of dense intramolecular disulfide-bond crosslinks.',
    question:
      'Which finding, if true, would most directly support Dr. Rostova’s hypothesis regarding Hydro-9’s thermal tolerance?',
    choices: [
      'When genetic mutations prevent Hydro-9 from synthesizing intramolecular disulfide bonds, its enzymes denature and cease functioning at 45°C.',
      'All bacterial organisms living in abyssal ecosystems share the exact same metabolic gene sequences as coastal bacterial colonies.',
      'Hydrothermal vent chimneys consistently supply higher molar concentrations of dissolved sulfur minerals than shallow coastal estuaries.',
      'Eukaryotic deep-sea microorganisms consistently outcompete bacterial colonies for environmental nutrients near 95°C thermal vents.'
    ],
    correctChoice:
      'When genetic mutations prevent Hydro-9 from synthesizing intramolecular disulfide bonds, its enzymes denature and cease functioning at 45°C.',
    userChoice:
      'All bacterial organisms living in abyssal ecosystems share the exact same metabolic gene sequences as coastal bacterial colonies.',
    rootCause: 'Time Pressure',
    trapType: 'Extreme Language & Irrelevant Correlation Trap (Ngôn Từ Cực Đoan & Sai Mối Quan Hệ)',
    explanationEn:
      'To test a causal hypothesis ("X causes Y"), the strongest experimental support is showing that removing the proposed cause X (the disulfide bonds) results in the loss of effect Y (thermal tolerance). Choice A directly demonstrates this causal dependency via a knock-out test. Choice B contains extreme language ("All bacterial organisms") and contradicts the passage\'s premise. Choices C and D focus on background environmental conditions rather than testing the biological mechanism.',
    explanationVi:
      'BẪY BẰNG CHỨNG HỌC THUẬT: Giả thuyết khẳng định "Liên kết disulfide độc nhất (X) TRỰC TIẾP gây ra khả năng chịu nhiệt 95°C (Y)". Trong Digital SAT, để chứng minh mối quan hệ nhân quả (Causation), phương pháp vàng là "Thử nghiệm loại trừ": Khi triệt tiêu X mà Y biến mất ngay lập tức (enzymes bị biến tính ở 45°C) thì giả thuyết được bảo vệ tuyệt đối. Đáp án B dính bẫy ngôn từ cực đoan ("All bacterial organisms"). Đáp án C và D lạc đề (chỉ nêu khoáng chất hoặc sinh vật nhân thực).',
    ruleSummary: 'Chứng minh nhân quả: Triệt tiêu nguyên nhân giả định (Knock-out) -> Hệ quả mất đi.',
    isMastered: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    source: 'Digital SAT Diagnostic Benchmark #4',
  },

  // --- MATH (4 ITEMS) ---
  {
    id: 'starter-math-01',
    subject: 'Math',
    topic: 'Advanced Math / Quadratic Sign Trap',
    question:
      'The quadratic function $f$ is defined by $f(x) = -2(x - 4)^2 + 18$. In the $xy$-plane, what is the coordinate of the maximum vertex of the parabola $y = f(x)$?',
    choices: ['(-4, 18)', '(4, 18)', '(4, -18)', '(-4, -18)'],
    correctChoice: '(4, 18)',
    userChoice: '(-4, 18)',
    rootCause: 'Careless Error',
    trapType: 'Vertex Form Sign Inversion Trap (Bẫy Đảo Dấu Đỉnh Parabol)',
    explanationEn:
      'The standard vertex form of a quadratic equation is $y = a(x - h)^2 + k$, where $(h, k)$ represents the coordinates of the vertex. Here, $f(x) = -2(x - 4)^2 + 18$. Comparing with $(x - h)$, we see that $h = 4$ (not $-4$) and $k = 18$. Since the coefficient $a = -2 < 0$, the parabola opens downward, confirming that $(4, 18)$ is the maximum point. College Board intentionally writes $(x - 4)$ knowing students habitually associate the minus sign with $-4$.',
    explanationVi:
      'BẪY DẤU ĐỈNH PARABOL: Công thức dạng đỉnh chuẩn là $y = a(x - h)^2 + k$ với đỉnh là $(h, k)$. Chú ý biểu thức trong ngoặc là $(x - 4)$, tức là $(x - h)$ với $h = +4$ (không phải $-4$). Tung độ đỉnh là $k = +18$. Vì $a = -2 < 0$ nên đồ thị quay bề lõm xuống dưới, điểm $(4, 18)$ chính là điểm cực đại. Học sinh đọc lướt thường chọn ngay $(-4, 18)$ và mất điểm oan.',
    ruleSummary: 'Dạng đỉnh: y = a(x - h)² + k => Đỉnh Parabol luôn là (+h, k)',
    isMastered: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    source: 'Digital SAT Diagnostic Benchmark #5',
  },
  {
    id: 'starter-math-02',
    subject: 'Math',
    topic: 'Problem Solving & Data Analysis / Unit Conversion Trap',
    question:
      'An automated industrial 3D additive printer consumes molten photopolymer resin filament at a constant rate of $0.75\\text{ grams per second}$. At this constant rate, how many kilograms of filament does the printer consume during an $8\\text{-hour}$ continuous production shift?',
    choices: ['6.0 kg', '21.6 kg', '21,600 kg', '360 kg'],
    correctChoice: '21.6 kg',
    userChoice: '21,600 kg',
    rootCause: 'Time Pressure',
    trapType: 'Missing Unit Conversion Trap (Quên Đổi Đơn Vị Gam -> Kilogam)',
    explanationEn:
      'First, calculate the total duration in seconds: $8\\text{ hours} \\times 60\\text{ min/hr} \\times 60\\text{ sec/min} = 28,800\\text{ seconds}$. Next, compute the total filament mass consumed in grams: $28,800\\text{ seconds} \\times 0.75\\text{ g/sec} = 21,600\\text{ grams}$. Crucially, the question asks for mass in KILOGRAMS. Since $1\\text{ kg} = 1,000\\text{ grams}$, convert: $21,600 / 1,000 = 21.6\\text{ kg}$. Choice C ($21,600\\text{ kg}$) is the classic College Board distractor targeting students who forget the final unit conversion.',
    explanationVi:
      'BẪY ĐƠN VỊ KINH ĐIỂN: Đề bài cho tốc độ theo "giây" và "gam", nhưng hỏi kết quả sau "8 giờ" theo "KILOGAM".\nBước 1: Đổi 8 giờ ra giây: $8 \\times 3,600 = 28,800\\text{ giây}$.\nBước 2: Tính khối lượng gam: $28,800 \\times 0.75 = 21,600\\text{ gam}$.\nBước 3: Đổi ra kg (chia 1,000): $21,600 / 1,000 = 21.6\\text{ kg}$.\nĐáp án C (21,600) là cái bẫy giăng sẵn cho thí sinh tính ra số 21,600 là mừng rỡ khoanh ngay mà không đọc kỹ đơn vị!',
    ruleSummary: 'Luôn gạch chân đơn vị cuối cùng được hỏi: Gram vs Kilogram, Giây vs Giờ.',
    isMastered: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    source: 'Digital SAT Diagnostic Benchmark #6',
  },
  {
    id: 'starter-math-03',
    subject: 'Math',
    topic: 'Algebra / System of Equations No-Solution Trap',
    question:
      'Consider the following linear system in variables $x$ and $y$:\n$$\\begin{cases} 3x - 5y = 14 \\\\ kx - 15y = 22 \\end{cases}$$\nIf the system of linear equations has no solution, what is the value of the constant $k$?',
    choices: ['9', '-9', '1', '45'],
    correctChoice: '9',
    userChoice: '-9',
    rootCause: 'Conceptual Gap',
    trapType: 'Parallel Lines & Coefficient Sign Trap (Bẫy Dấu Hệ Số Góc Đường Thẳng Song Song)',
    explanationEn:
      'A system of two linear equations has no solution if and only if the two lines are parallel and distinct (same slope, different $y$-intercepts). For equations $A_1 x + B_1 y = C_1$ and $A_2 x + B_2 y = C_2$, the lines are parallel when: $\\frac{A_1}{A_2} = \\frac{B_1}{B_2} \\neq \\frac{C_1}{C_2}$. Substituting the coefficients: $\\frac{3}{k} = \\frac{-5}{-15}$. Simplifying the right side gives: $\\frac{3}{k} = \\frac{1}{3} \\implies k = 9$. Note that $\\frac{14}{22} \\neq \\frac{1}{3}$, confirming no solution exists. Watch out for negative signs: $\\frac{-5}{-15} = +\\frac{1}{3}$, not $-\\frac{1}{3}$.',
    explanationVi:
      'BẪY HỆ VÔ NGHIỆM: Hệ phương trình bậc nhất hai ẩn VÔ NGHIỆM khi và chỉ khi 2 đường thẳng SONG SONG và KHÔNG TRÙNG NHAU (cùng hệ số góc, khác tung độ gốc).\nĐiều kiện: $\\frac{a_1}{a_2} = \\frac{b_1}{b_2} \\neq \\frac{c_1}{c_2}$\nThay số: $\\frac{3}{k} = \\frac{-5}{-15} = \\frac{1}{3} \\implies k = 3 \\times 3 = 9$.\nCần hết sức cẩn thận với dấu: $\\frac{-5}{-15}$ là số dương $+1/3$. Học sinh hấp tấp quên triệt tiêu hai dấu trừ sẽ tính ra $k = -9$ và sập bẫy đáp án B!',
    ruleSummary: 'Hệ vô nghiệm <=> a1/a2 = b1/b2 != c1/c2 (Hai đường thẳng song song)',
    isMastered: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    source: 'Digital SAT Diagnostic Benchmark #7',
  },
  {
    id: 'starter-math-04',
    subject: 'Math',
    topic: 'Geometry & Trigonometry / Circle Equation Radius-Squared Trap',
    question:
      'In the $xy$-plane, the graph of the equation $x^2 + y^2 - 6x + 8y = 24$ is a circle. What is the radius of the circle?',
    choices: ['7', '49', '\\sqrt{24}', '5'],
    correctChoice: '7',
    userChoice: '49',
    rootCause: 'Trap Answer',
    trapType: 'Radius vs. Radius-Squared Trap (Bẫy Nhầm Bán Kính r với r²)',
    explanationEn:
      'Convert the equation to standard form $(x - h)^2 + (y - k)^2 = r^2$ by completing the square:\nGroup terms: $(x^2 - 6x) + (y^2 + 8y) = 24$\nComplete squares:\n$(x - 3)^2 - 9 + (y + 4)^2 - 16 = 24$\n$(x - 3)^2 + (y + 4)^2 = 24 + 9 + 16 = 49$\nIn standard form, the right-hand side is $r^2 = 49$. Therefore, the radius is $r = \\sqrt{49} = 7$. Choice B (49) is the #1 most frequently selected trap in College Board geometry tests.',
    explanationVi:
      'BẪY KINH ĐIỂN BÁN KÍNH ĐƯỜNG TRÒN $r$ vs $r^2$:\nĐưa về phương trình chuẩn $(x - h)^2 + (y - k)^2 = r^2$ bằng cách thêm bớt hằng đẳng thức:\n$(x^2 - 6x + 9) + (y^2 + 8y + 16) = 24 + 9 + 16$\n$(x - 3)^2 + (y + 4)^2 = 49$.\nVế phải là $r^2 = 49$. Đề bài hỏi BÁN KÍNH $r$, do đó $r = \\sqrt{49} = 7$.\nHơn 65% thí sinh sau khi cộng dồn vế phải ra 49 liền lập tức khoanh đáp án 49 mà quên bước lấy căn bậc hai cuối cùng!',
    ruleSummary: 'Phương trình chuẩn: (x - h)² + (y - k)² = r² => Luôn nhớ r = √(vế phải)!',
    isMastered: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    source: 'Digital SAT Diagnostic Benchmark #8',
  },
];

/**
 * Component render Math an toàn KaTeX
 */
function KaTeXInline({ math }: { math: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      return math;
    }
  }, [math]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function KaTeXBlock({ math }: { math: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return math;
    }
  }, [math]);

  return <div className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Parser phân tích văn bản có chứa KaTeX $...$ hoặc $$...$$
 */
function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null;

  // Split by $$ or $
  const parts = useMemo(() => {
    const segments: { type: 'text' | 'inline-math' | 'block-math'; content: string }[] = [];
    const lines = text.split('\n');

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      // Check block math $$...$$
      const blockRegex = /\$\$([\s\S]*?)\$\$/g;
      let lastIdx = 0;
      let match: RegExpExecArray | null;

      const lineSegments: typeof segments = [];

      while ((match = blockRegex.exec(line)) !== null) {
        if (match.index > lastIdx) {
          lineSegments.push({ type: 'text', content: line.substring(lastIdx, match.index) });
        }
        lineSegments.push({ type: 'block-math', content: match[1] });
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < line.length) {
        lineSegments.push({ type: 'text', content: line.substring(lastIdx) });
      }

      // Then split text segments by inline $...$
      for (const seg of lineSegments) {
        if (seg.type === 'block-math') {
          segments.push(seg);
        } else {
          const inlineRegex = /\$([^\$]+?)\$/g;
          let inlineLastIdx = 0;
          let inlineMatch: RegExpExecArray | null;

          while ((inlineMatch = inlineRegex.exec(seg.content)) !== null) {
            if (inlineMatch.index > inlineLastIdx) {
              segments.push({
                type: 'text',
                content: seg.content.substring(inlineLastIdx, inlineMatch.index),
              });
            }
            segments.push({ type: 'inline-math', content: inlineMatch[1] });
            inlineLastIdx = inlineMatch.index + inlineMatch[0].length;
          }
          if (inlineLastIdx < seg.content.length) {
            segments.push({
              type: 'text',
              content: seg.content.substring(inlineLastIdx),
            });
          }
        }
      }

      if (l < lines.length - 1) {
        segments.push({ type: 'text', content: '\n' });
      }
    }

    return segments;
  }, [text]);

  return (
    <div className={`leading-relaxed whitespace-pre-wrap ${className}`}>
      {parts.map((p, idx) => {
        if (p.type === 'block-math') {
          return <KaTeXBlock key={idx} math={p.content} />;
        }
        if (p.type === 'inline-math') {
          return <KaTeXInline key={idx} math={p.content} />;
        }
        return <span key={idx}>{p.content}</span>;
      })}
    </div>
  );
}

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<'All' | SubjectType>('All');
  const [selectedCause, setSelectedCause] = useState<'All' | RootCauseType>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'NeedsReview' | 'Mastered'>('All');

  // Retry Mode State
  const [retryState, setRetryState] = useState<Record<string, {
    inRetry: boolean;
    selectedChoice: string | null;
    isSubmitted: boolean;
    isCorrect: boolean;
  }>>({});

  // Expanded explanations State
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Load and Sync Mistakes
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      let loadedItems: MistakeItem[] = [];

      // 1. Đọc từ localStorage trước
      try {
        const localData = localStorage.getItem('sat_mistake_bank_v1');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedItems = parsed;
          }
        }
      } catch (e) {
        console.error('Lỗi đọc localStorage sat_mistake_bank_v1:', e);
      }

      // 2. Thử fetch từ API /api/error-logs (hoặc /api/cau-sai)
      try {
        const res = await fetch('/api/error-logs');
        if (res.ok) {
          const apiData = await res.json();
          if (Array.isArray(apiData) && apiData.length > 0) {
            // Chuẩn hóa và gộp dữ liệu
            const formattedApi: MistakeItem[] = apiData.map((item: any, idx: number) => ({
              id: item.id || `api-err-${idx}`,
              subject: item.subject === 'math' ? 'Math' : 'Reading & Writing',
              topic: item.topic || item.skill || 'Digital SAT Skill',
              question: item.question || '',
              passage: item.passage,
              choices: item.choices || [],
              correctChoice: item.correct_choice || item.correctChoice || '',
              userChoice: item.user_choice || item.userChoice || '',
              rootCause: (item.rootCause as RootCauseType) || 'Conceptual Gap',
              trapType: item.trapType || 'Bẫy Điểm Digital SAT',
              explanationEn: item.explanation || item.explanationEn || '',
              explanationVi: item.explanationVi || item.explanation_vi || 'Đang cập nhật lời giải tiếng Việt...',
              ruleSummary: item.ruleSummary,
              isMastered: Boolean(item.isMastered || (item.box && item.box >= 4)),
              retryCount: item.retryCount || 0,
              createdAt: item.createdAt || item.created_at || new Date().toISOString(),
              source: item.source || 'Lịch sử luyện tập',
            }));

            // Merge tránh duplicate id
            const existingIds = new Set(loadedItems.map((m) => m.id));
            for (const item of formattedApi) {
              if (!existingIds.has(item.id)) {
                loadedItems.push(item);
              }
            }
          }
        } else {
          // Thử endpoint dự phòng /api/cau-sai
          const fallbackRes = await fetch('/api/cau-sai');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (Array.isArray(fallbackData) && fallbackData.length > 0) {
              const formattedFallback: MistakeItem[] = fallbackData.map((item: any, idx: number) => ({
                id: item.id || `cau-sai-${idx}`,
                subject: item.subject?.toLowerCase().includes('math') ? 'Math' : 'Reading & Writing',
                topic: item.skill || 'Luyện tập kỹ năng',
                question: item.question || '',
                passage: item.passage,
                choices: item.choices || [],
                correctChoice: item.correct_choice || '',
                userChoice: item.user_choice || '',
                rootCause: 'Conceptual Gap',
                trapType: 'Bẫy đề thi',
                explanationEn: item.explanation || '',
                explanationVi: 'Xem phân tích chi tiết bên dưới để nắm vững phương pháp giải.',
                isMastered: item.box && item.box >= 4,
                retryCount: 0,
                createdAt: item.created_at || new Date().toISOString(),
                source: item.source || 'Ngân hàng câu hỏi',
              }));

              const existingIds = new Set(loadedItems.map((m) => m.id));
              for (const item of formattedFallback) {
                if (!existingIds.has(item.id)) {
                  loadedItems.push(item);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('API error-logs / cau-sai không sẵn sàng, sử dụng dữ liệu cục bộ:', err);
      }

      // 3. Nếu chưa có dữ liệu nào, nạp Bộ 8 Starter Diagnostic Deck
      if (loadedItems.length === 0) {
        loadedItems = [...STARTER_MISTAKES_DECK];
        try {
          localStorage.setItem('sat_mistake_bank_v1', JSON.stringify(loadedItems));
        } catch (e) {
          console.error('Lỗi lưu starter deck vào localStorage:', e);
        }
      }

      setMistakes(loadedItems);
      setIsLoading(false);
    }

    loadData();
  }, []);

  // Lưu lại vào localStorage khi mistakes thay đổi
  const saveMistakesToLocal = useCallback((updated: MistakeItem[]) => {
    setMistakes(updated);
    try {
      localStorage.setItem('sat_mistake_bank_v1', JSON.stringify(updated));
    } catch (e) {
      console.error('Lỗi ghi localStorage:', e);
    }
  }, []);

  // Đánh dấu Mastered / Cần ôn lại
  const toggleMastered = useCallback(
    async (id: string) => {
      const updated = mistakes.map((m) => {
        if (m.id === id) {
          const nextVal = !m.isMastered;
          return { ...m, isMastered: nextVal, lastReviewedAt: new Date().toISOString() };
        }
        return m;
      });
      saveMistakesToLocal(updated);

      // Thử đồng bộ ngầm lên API /api/cau-sai nếu có
      try {
        const target = updated.find((m) => m.id === id);
        if (target) {
          await fetch('/api/cau-sai', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mistakeId: id,
              isRemembered: target.isMastered,
            }),
          });
        }
      } catch {
        // Fail-safe ngầm, không chặn UI
      }
    },
    [mistakes, saveMistakesToLocal]
  );

  // Kích hoạt Retry Mode cho 1 câu
  const startRetry = useCallback((id: string) => {
    setRetryState((prev) => ({
      ...prev,
      [id]: {
        inRetry: true,
        selectedChoice: null,
        isSubmitted: false,
        isCorrect: false,
      },
    }));
  }, []);

  // Chọn đáp án trong Retry Mode
  const selectRetryChoice = useCallback((id: string, choice: string) => {
    setRetryState((prev) => {
      const curr = prev[id] || { inRetry: true, isSubmitted: false, isCorrect: false };
      if (curr.isSubmitted) return prev; // Đã nộp bài thì không đổi
      return {
        ...prev,
        [id]: {
          ...curr,
          selectedChoice: choice,
        },
      };
    });
  }, []);

  // Nộp bài Retry
  const submitRetry = useCallback(
    (id: string) => {
      const target = mistakes.find((m) => m.id === id);
      if (!target) return;
      const currentRetry = retryState[id];
      if (!currentRetry || !currentRetry.selectedChoice) return;

      const isCorrect =
        currentRetry.selectedChoice.trim().toLowerCase() === target.correctChoice.trim().toLowerCase();

      setRetryState((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          isSubmitted: true,
          isCorrect,
        },
      }));

      // Tăng retryCount và tự động mở thẻ phân tích
      setExpandedCards((prev) => ({ ...prev, [id]: true }));

      const updated = mistakes.map((m) => {
        if (m.id === id) {
          return {
            ...m,
            retryCount: m.retryCount + 1,
            isMastered: isCorrect ? true : m.isMastered,
            lastReviewedAt: new Date().toISOString(),
          };
        }
        return m;
      });
      saveMistakesToLocal(updated);
    },
    [mistakes, retryState, saveMistakesToLocal]
  );

  // Hủy Retry Mode, quay về xem thông thường
  const cancelRetry = useCallback((id: string) => {
    setRetryState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Toggle xem phân tích chi tiết
  const toggleExpand = useCallback((id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Khôi phục Bộ 8 Starter Deck
  const resetToStarterDeck = useCallback(() => {
    if (confirm('Bạn có chắc muốn nạp lại Bộ 8 Tình Huống Bẫy Điểm Chuẩn Digital SAT không?')) {
      saveMistakesToLocal([...STARTER_MISTAKES_DECK]);
      setRetryState({});
      setExpandedCards({});
    }
  }, [saveMistakesToLocal]);

  // Bộ lọc danh sách
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      // Môn
      if (selectedSubject !== 'All' && m.subject !== selectedSubject) return false;
      // Nguyên nhân
      if (selectedCause !== 'All' && m.rootCause !== selectedCause) return false;
      // Trạng thái
      if (statusFilter === 'NeedsReview' && m.isMastered) return false;
      if (statusFilter === 'Mastered' && !m.isMastered) return false;
      // Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = `${m.question} ${m.topic} ${m.trapType} ${m.explanationEn} ${m.explanationVi} ${m.ruleSummary || ''}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });
  }, [mistakes, selectedSubject, selectedCause, statusFilter, searchQuery]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = mistakes.length;
    const mastered = mistakes.filter((m) => m.isMastered).length;
    const needsReview = total - mastered;
    const rate = total > 0 ? Math.round((mastered / total) * 100) : 0;

    // Tìm bẫy hay gặp nhất
    const causeCounts: Record<string, number> = {};
    mistakes.forEach((m) => {
      causeCounts[m.rootCause] = (causeCounts[m.rootCause] || 0) + 1;
    });
    let topCause: RootCauseType = 'Conceptual Gap';
    let maxCount = 0;
    Object.entries(causeCounts).forEach(([c, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        topCause = c as RootCauseType;
      }
    });

    return { total, mastered, needsReview, rate, topCause };
  }, [mistakes]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 selection:bg-indigo-500/30">
      {/* HEADER SECTION */}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                Digital SAT Revenge System
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                Spaced Repetition & Error Analytics
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-indigo-400" />
              Sổ Tay Lỗi Sai & Phân Tích Bẫy Tư Duy Digital SAT
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Nắm vững 4 chiều giải phẫu bẫy điểm College Board, luyện tập chế độ Phục Thù (Retry Mode)
              và theo dõi quá trình làm chủ kiến thức triệt để.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={resetToStarterDeck}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all flex items-center gap-1.5 shadow-sm"
              title="Khôi phục Bộ 8 Bẫy Điểm Chuẩn Digital SAT"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              Nạp Lại 8 Bẫy Mẫu
            </button>
            <Link
              href="/review"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              Ôn Phục Thù Leitner
            </Link>
          </div>
        </div>

        {/* METRICS DASHBOARD CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 space-y-1 shadow-sm">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Tổng Số Lỗi Sai
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{stats.total}</div>
            <div className="text-[11px] text-slate-500">Trong kho lưu trữ</div>
          </div>

          <div className="bg-slate-900/80 border border-amber-900/30 rounded-xl p-3.5 space-y-1 shadow-sm">
            <div className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Cần Ôn Phục Thù
            </div>
            <div className="text-2xl font-bold text-amber-400 tracking-tight">{stats.needsReview}</div>
            <div className="text-[11px] text-slate-500">Chưa nắm vững 100%</div>
          </div>

          <div className="bg-slate-900/80 border border-emerald-900/30 rounded-xl p-3.5 space-y-1 shadow-sm">
            <div className="text-xs text-emerald-300 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Đã Khắc Phục
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">{stats.mastered}</div>
            <div className="text-[11px] text-slate-500">Đã phục thù thành công</div>
          </div>

          <div className="bg-slate-900/80 border border-indigo-900/30 rounded-xl p-3.5 space-y-1 shadow-sm">
            <div className="text-xs text-indigo-300 font-medium flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-indigo-400" />
              Tỷ Lệ Làm Chủ
            </div>
            <div className="text-2xl font-bold text-indigo-400 tracking-tight">{stats.rate}%</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.rate}%` }}
              />
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-slate-900/80 border border-purple-900/30 rounded-xl p-3.5 space-y-1 shadow-sm">
            <div className="text-xs text-purple-300 font-medium flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              Bẫy Thường Gặp
            </div>
            <div className="text-sm font-bold text-purple-300 truncate">
              {ROOT_CAUSE_META[stats.topCause]?.label.split('/')[0] || stats.topCause}
            </div>
            <div className="text-[11px] text-slate-500">{ROOT_CAUSE_META[stats.topCause]?.sub}</div>
          </div>
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bẫy sai, câu hỏi, từ khóa, công thức..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Subject Filters */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-lg">
              {(['All', 'Reading & Writing', 'Math'] as const).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    selectedSubject === sub
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sub === 'All' ? 'Tất Cả Môn' : sub}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-lg">
              <button
                onClick={() => setStatusFilter('All')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === 'All' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tất cả ({mistakes.length})
              </button>
              <button
                onClick={() => setStatusFilter('NeedsReview')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === 'NeedsReview'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cần Ôn ({stats.needsReview})
              </button>
              <button
                onClick={() => setStatusFilter('Mastered')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === 'Mastered'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Đã Khắc Phục ({stats.mastered})
              </button>
            </div>
          </div>

          {/* Root Cause Category Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Phân Loại Nguyên Nhân:
            </span>
            <button
              onClick={() => setSelectedCause('All')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                selectedCause === 'All'
                  ? 'bg-slate-200 text-slate-900 border-slate-200 font-semibold'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              Tất cả nguyên nhân
            </button>
            {(Object.keys(ROOT_CAUSE_META) as RootCauseType[]).map((rc) => {
              const meta = ROOT_CAUSE_META[rc];
              const isSelected = selectedCause === rc;
              return (
                <button
                  key={rc}
                  onClick={() => setSelectedCause(rc)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? `${meta.bg} ${meta.color} ${meta.border} font-bold ring-1 ring-offset-1 ring-offset-slate-950 ring-indigo-500`
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* MISTAKES LIST */}
        {isLoading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">Đang đồng bộ sổ tay lỗi sai...</p>
          </div>
        ) : filteredMistakes.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-xl space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-75" />
            <h3 className="text-base font-semibold text-slate-200">Không tìm thấy lỗi sai phù hợp!</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Tất cả các câu hỏi trong bộ lọc đã được khắc phục hoặc không có từ khóa trùng khớp.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSubject('All');
                setSelectedCause('All');
                setStatusFilter('All');
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all inline-block mt-2"
            >
              Xóa Bộ Lọc
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMistakes.map((mistake, index) => {
              const causeMeta = ROOT_CAUSE_META[mistake.rootCause];
              const retryInfo = retryState[mistake.id];
              const isRetrying = retryInfo?.inRetry;
              const isExpanded = expandedCards[mistake.id] || false;

              return (
                <div
                  key={mistake.id}
                  className={`bg-slate-900/80 border rounded-xl transition-all shadow-md overflow-hidden ${
                    mistake.isMastered
                      ? 'border-emerald-900/40 bg-gradient-to-r from-slate-900/90 to-emerald-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* CARD HEADER */}
                  <div className="p-4 md:p-5 border-b border-slate-800/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Index & Subject Badge */}
                        <span className="text-xs font-mono font-bold text-slate-400">
                          #{String(index + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                            mistake.subject === 'Math'
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {mistake.subject}
                        </span>

                        {/* Root Cause Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1 ${causeMeta.bg} ${causeMeta.color} border ${causeMeta.border}`}
                        >
                          <span>{causeMeta.icon}</span>
                          <span>{causeMeta.label}</span>
                        </span>

                        {/* Topic Tag */}
                        <span className="text-xs font-medium text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {mistake.topic}
                        </span>
                      </div>

                      {/* Mastered & Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleMastered(mistake.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            mistake.isMastered
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {mistake.isMastered ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              Đã Khắc Phục Triệt Để
                            </>
                          ) : (
                            <>
                              <Target className="w-3.5 h-3.5 text-slate-400" />
                              Đánh Dấu Đã Làm Chủ
                            </>
                          )}
                        </button>

                        {!isRetrying && (
                          <button
                            onClick={() => startRetry(mistake.id)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Làm Lại Phục Thù
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Trap mechanism title */}
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-300/90 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong className="text-amber-200">Đặc Điểm Bẫy:</strong> {mistake.trapType}
                      </span>
                    </div>
                  </div>

                  {/* QUESTION BODY */}
                  <div className="p-4 md:p-5 space-y-4">
                    {/* Passage if applicable */}
                    {mistake.passage && (
                      <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-lg text-sm text-slate-300 italic border-l-4 border-l-indigo-500">
                        <FormattedText text={mistake.passage} />
                      </div>
                    )}

                    {/* Question Statement */}
                    <div className="text-sm md:text-base font-medium text-slate-100">
                      <FormattedText text={mistake.question} />
                    </div>

                    {/* RETRY MODE OR NORMAL CHOICES VIEW */}
                    {isRetrying ? (
                      /* CHẾ ĐỘ LÀM LẠI PHỤC THÙ */
                      <div className="p-4 bg-slate-950 border border-rose-900/40 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-rose-400" />
                            Đang Trong Chế Độ Làm Lại Phục Thù
                          </div>
                          <button
                            onClick={() => cancelRetry(mistake.id)}
                            className="text-xs text-slate-400 hover:text-slate-200"
                          >
                            Hủy Bỏ
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {mistake.choices.map((choice, cIdx) => {
                            const letter = String.fromCharCode(65 + cIdx);
                            const isSelected = retryInfo.selectedChoice === choice;
                            const isSubmitted = retryInfo.isSubmitted;
                            const isCorrectChoice = choice === mistake.correctChoice;

                            let choiceStyle = 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700';
                            if (isSelected) {
                              choiceStyle = 'bg-indigo-950/60 border-indigo-500 text-indigo-100 ring-1 ring-indigo-500';
                            }
                            if (isSubmitted) {
                              if (isCorrectChoice) {
                                choiceStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500 font-semibold';
                              } else if (isSelected && !isCorrectChoice) {
                                choiceStyle = 'bg-rose-950/60 border-rose-500 text-rose-200 ring-1 ring-rose-500';
                              } else {
                                choiceStyle = 'opacity-40 bg-slate-900/60 border-slate-800 text-slate-400';
                              }
                            }

                            return (
                              <button
                                key={cIdx}
                                disabled={isSubmitted}
                                onClick={() => selectRetryChoice(mistake.id, choice)}
                                className={`w-full text-left p-3 rounded-lg border text-sm transition-all flex items-start gap-3 ${choiceStyle}`}
                              >
                                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {letter}
                                </span>
                                <div className="flex-1">
                                  <FormattedText text={choice} />
                                </div>
                                {isSubmitted && isCorrectChoice && (
                                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                )}
                                {isSubmitted && isSelected && !isCorrectChoice && (
                                  <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Submit or Result Action */}
                        <div className="flex items-center justify-between pt-2">
                          {!retryInfo.isSubmitted ? (
                            <button
                              disabled={!retryInfo.selectedChoice}
                              onClick={() => submitRetry(mistake.id)}
                              className="px-5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:pointer-events-none text-white transition-all shadow-md flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Kiểm Tra Kết Quả Phục Thù
                            </button>
                          ) : (
                            <div className="flex items-center gap-3 w-full justify-between">
                              <div
                                className={`text-xs font-bold flex items-center gap-1.5 ${
                                  retryInfo.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {retryInfo.isCorrect ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    🎉 Chúc mừng! Bạn đã phục thù thành công và tránh được bẫy!
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-4 h-4" />
                                    ⚠️ Bạn vẫn chưa vượt qua bẫy này. Đọc kỹ phân tích bên dưới!
                                  </>
                                )}
                              </div>
                              <button
                                onClick={() => cancelRetry(mistake.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
                              >
                                Hoàn tất
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* CHẾ ĐỘ HIỂN THỊ THÔNG THƯỜNG */
                      <div className="grid grid-cols-1 gap-2">
                        {mistake.choices.map((choice, cIdx) => {
                          const letter = String.fromCharCode(65 + cIdx);
                          const isCorrect = choice.trim() === mistake.correctChoice.trim();
                          const isUserSelected =
                            mistake.userChoice && choice.trim() === mistake.userChoice.trim();

                          let rowClass = 'bg-slate-950/60 border-slate-800 text-slate-300';
                          if (isCorrect) {
                            rowClass = 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200';
                          } else if (isUserSelected) {
                            rowClass = 'bg-rose-950/40 border-rose-500/40 text-rose-200 line-through opacity-85';
                          }

                          return (
                            <div
                              key={cIdx}
                              className={`p-2.5 rounded-lg border text-sm flex items-start gap-3 ${rowClass}`}
                            >
                              <span
                                className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                                  isCorrect
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : isUserSelected
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {letter}
                              </span>
                              <div className="flex-1">
                                <FormattedText text={choice} />
                              </div>
                              {isCorrect && (
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                                  <Check className="w-3.5 h-3.5" /> Đáp án đúng
                                </span>
                              )}
                              {isUserSelected && !isCorrect && (
                                <span className="text-xs font-bold text-rose-400 flex items-center gap-1 shrink-0">
                                  <X className="w-3.5 h-3.5" /> Lựa chọn sai trước đó
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TOGGLE EXPAND EXPLANATION */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                      <button
                        onClick={() => toggleExpand(mistake.id)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" /> Ẩn Giải Phẫu Bẫy Chi Tiết
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" /> Xem Giải Phẫu Bẫy & Lời Giải Song Ngữ
                          </>
                        )}
                      </button>

                      {mistake.ruleSummary && (
                        <div className="text-xs text-slate-400 font-mono hidden md:block">
                          💡 <span className="text-slate-300">{mistake.ruleSummary}</span>
                        </div>
                      )}
                    </div>

                    {/* EXPANDABLE EXPLANATION SECTION */}
                    {isExpanded && (
                      <div className="mt-4 p-4 md:p-5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-4 animate-in fade-in duration-200">
                        {/* Quy tắc tóm tắt nổi bật */}
                        {mistake.ruleSummary && (
                          <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-xs text-indigo-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>
                              <strong>Quy Tắc Vàng Cần Khắc Cốt Ghi Tâm:</strong> {mistake.ruleSummary}
                            </span>
                          </div>
                        )}

                        {/* Phân tích Tiếng Việt */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-emerald-400" />
                            Giải Phẫu Bản Chất & Bẫy Điểm (Tiếng Việt)
                          </h4>
                          <div className="text-xs md:text-sm text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                            <FormattedText text={mistake.explanationVi} />
                          </div>
                        </div>

                        {/* Phân tích Tiếng Anh */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                            Official Standard Explanation (College Board Style)
                          </h4>
                          <div className="text-xs md:text-sm text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                            <FormattedText text={mistake.explanationEn} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FOOTER CALL-TO-ACTION */}
        <div className="p-6 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-900/30 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-base font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              Sẵn sàng cho bài thi thử tiếp theo?
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Sau khi phục thù hết các câu sai trong Sổ Tay, hãy thử sức với phòng thi Bluebook mô phỏng
              để kiểm chứng xem phản xạ nhận diện bẫy đã được nâng cấp chưa.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/practice"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              Luyện Tập Kỹ Năng
            </Link>
            <Link
              href="/exams"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5"
            >
              Vào Phòng Thi Bluebook <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
