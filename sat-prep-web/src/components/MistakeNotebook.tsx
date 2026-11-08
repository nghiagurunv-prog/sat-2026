'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { CorePracticeUI, type PracticeQuestion } from './CorePracticeUI';
import { matchesAnswer } from '@/lib/answer-match';

export function isMistakeAnswerCorrect(userAns: string | undefined | null, correctAns: string | undefined | null): boolean {
  return Boolean(userAns && correctAns && (userAns === correctAns || matchesAnswer(userAns, correctAns)));
}

export type Mistake = {
  id?: string;
  question: string;
  choices: string[];
  correct_choice: string;
  user_choice?: string;
  explanation: string;
  source: string;
  passage?: string;
  box?: number;
  next_review?: string;
  nextReviewAt?: string;
  skill_id?: string | null;
  subject?: string;
  domain?: string;
  skill?: string;
  createdAt?: string;
};

export type Mode = 'browse' | 'review' | 'sprint' | 'cram';

// [Point 47] 5 Nhãn nguyên nhân sai kinh điển
export const ROOT_CAUSES = [
  {
    id: 'careless',
    label: '⚡ Sai ngu / Đọc lướt (Careless)',
    short: '⚡ Sai ngu / Đọc lướt',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    barColor: '#f59e0b',
  },
  {
    id: 'vocab',
    label: '📖 Hổng từ vựng (Vocab Gap)',
    short: '📖 Hổng từ vựng',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    barColor: '#3b82f6',
  },
  {
    id: 'concept',
    label: '🧠 Hổng kiến thức / Công thức (Concept Gap)',
    short: '🧠 Hổng công thức',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    barColor: '#a855f7',
  },
  {
    id: 'time',
    label: '⏱️ Thiếu thời gian (Time Pressure)',
    short: '⏱️ Thiếu thời gian',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    barColor: '#f43f5e',
  },
  {
    id: 'desmos',
    label: '📈 Chưa biết bấm Desmos (Desmos Skill)',
    short: '📈 Chưa thạo Desmos',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    barColor: '#10b981',
  },
] as const;

export type RootCauseId = (typeof ROOT_CAUSES)[number]['id'];

// Helper nhận diện môn học (Toán vs R&W)
function detectSubject(m: Mistake): 'Math' | 'R&W' {
  if (m.subject) {
    return m.subject.toLowerCase().includes('math') || m.subject.toLowerCase().includes('toán') ? 'Math' : 'R&W';
  }
  if (m.passage) return 'R&W';
  const text = `${m.question || ''} ${m.source || ''} ${m.skill || ''} ${m.domain || ''}`.toLowerCase();
  if (
    text.includes('math') ||
    text.includes('toán') ||
    text.includes('algebra') ||
    text.includes('geometry') ||
    text.includes('equation') ||
    text.includes('triangle') ||
    text.includes('desmos') ||
    text.includes('f(x)') ||
    text.includes('x =')
  ) {
    return 'Math';
  }
  return 'R&W';
}

// [Point 57] Helper định dạng nhãn thời gian ôn tập tiếp theo
function getNextReviewInfo(nextReviewDate?: string) {
  if (!nextReviewDate) {
    return { label: '🔥 Đến hạn hôm nay', isDue: true };
  }
  const target = new Date(nextReviewDate).getTime();
  const now = Date.now();
  const diffMs = target - now;
  if (isNaN(target) || diffMs <= 0) {
    return { label: '🔥 Đến hạn hôm nay', isDue: true };
  }
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return { label: `⏳ Ôn lại sau ${diffHours || 1} giờ`, isDue: false };
  }
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { label: `⏳ Ôn lại sau ${diffDays} ngày`, isDue: false };
}

// [Point 48] Lời khuyên chiến thuật tự động dựa trên nguyên nhân mất điểm cao nhất
function getTacticalAdvice(highestCause: string | null, totalTagged: number) {
  if (totalTagged === 0) {
    return {
      title: '💡 Bắt đầu gắn nhãn nguyên nhân sai',
      body: 'Gắn nhãn 1 trong 5 nguyên nhân (Sai ngu, Từ vựng, Công thức, Thiếu giờ, Desmos) cho mỗi câu để Guru vẽ bản đồ lỗ hổng và tư vấn chiến thuật giải đề tối ưu cho bạn.',
      bg: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    };
  }
  switch (highestCause) {
    case 'careless':
      return {
        title: '⚡ Chiến thuật khắc phục "Sai ngu / Đọc lướt"',
        body: 'Bạn đang mất điểm nhiều nhất do đọc ẩu! Hãy tập thói quen: Dùng bút gạch chân từ khóa câu hỏi (NOT, EXCEPT, which, what is the value of 2x - thay vì x). Trước khi chọn, đọc lại đề bài 1 lần để xác nhận đúng điều được hỏi.',
        bg: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
      };
    case 'vocab':
      return {
        title: '📖 Chiến thuật bù đắp "Hổng từ vựng"',
        body: 'Kho từ vựng đang kéo điểm của bạn xuống! Hãy chuyển ngay sang mục "Làm Chủ Từ Vựng (/vocab)" học từ theo chùm từ đồng nghĩa và collocations. Khi đọc đoạn văn R&W, luôn xác định tông giọng và hướng lập luận (+/-) của câu.',
        bg: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
      };
    case 'concept':
      return {
        title: '🧠 Chiến thuật lấp "Hổng kiến thức / Công thức"',
        body: 'Bạn đang gặp khó vì chưa nắm vững nền tảng! Hãy mở "Cây Năng Lực SAT (/skill-tree)" rà soát các chuyên đề còn đỏ, và luyện sâu 15-20 câu cùng dạng trong mục "Khổ Luyện Chuyên Sâu (/grind)" trước khi làm đề tổng hợp.',
        bg: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
      };
    case 'time':
      return {
        title: '⏱️ Chiến thuật giải tỏa "Áp lực thời gian"',
        body: 'Thiếu thời gian chứng tỏ bạn bị kẹt quá lâu ở các câu khó. Áp dụng quy tắc 60 giây: Nếu sau 60s chưa tìm được hướng giải, gắn cờ (Flag) rồi chuyển ngay câu khác. Luyện thêm mục "Trả Lời Nhanh (/speed-quiz)" để tăng tốc phản xạ 1.5 phút/câu!',
        bg: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
      };
    case 'desmos':
      return {
        title: '📈 Chiến thuật bứt phá "Bí kíp Desmos"',
        body: 'Bạn đang tốn công giải tay những bài Desmos xử lý được trong 15 giây! Hãy truy cập ngay "Bí Kíp Hack Desmos (/desmos)" học kỹ năng: Nhập hệ phương trình tìm giao điểm, dùng slider thử nghiệm tham số, và dùng hàm regression ~ để tìm nghiệm ngay tức thì.',
        bg: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
      };
    default:
      return {
        title: '🎯 Chiến thuật tổng thể',
        body: 'Tiếp tục duy trì nhịp ôn luyện và phân loại lỗi sai để biến mỗi lần vấp ngã thành điểm số thực tế!',
        bg: 'border-gray-500/40 bg-gray-500/10 text-gray-200',
      };
  }
}

// Helper sinh gợi ý 3 nấc (3-Step Socratic Hint Ladder)
export function getHintLadderData(m?: Mistake) {
  const safeMistake: Mistake = m || {
    question: '',
    choices: ['A', 'B', 'C', 'D'],
    correct_choice: 'A',
    explanation: '',
    source: 'Luyện tập',
  };
  const isMath = detectSubject(safeMistake) === 'Math';
  const subjectLabel = isMath ? 'Toán SAT (Math)' : 'Đọc & Viết (Reading & Writing)';

  let step1Title = isMath ? '📐 Gợi ý từ khóa & Công thức cốt lõi (Toán)' : '📖 Gợi ý từ khóa & Cấu trúc lập luận (R&W)';
  let step1Content = '';
  let keywords: string[] = [];

  const qLower = (safeMistake.question || '').toLowerCase();
  const expLower = (safeMistake.explanation || '').toLowerCase();

  if (isMath) {
    if (qLower.includes('slope') || qLower.includes('dốc') || qLower.includes('y-intercept') || qLower.includes('linear') || qLower.includes('hệ số')) {
      step1Content = '🔑 Dạng hàm bậc nhất (Linear): Chú ý dạng chuẩn y = mx + b, trong đó m là tốc độ thay đổi (rate of change / slope), b là điểm cắt trục tung (y-intercept). Đọc kỹ xem đề bài hỏi m, b hay giá trị tại một điểm cụ thể.';
      keywords = ['Linear Equation', 'Slope (m)', 'Y-intercept (b)'];
    } else if (qLower.includes('system') || qLower.includes('hệ phương trình') || qLower.includes('no solution') || qLower.includes('infinitely')) {
      step1Content = '🔑 Hệ phương trình hai ẩn: Vô nghiệm (no solution) khi 2 đường thẳng song song (cùng hệ số góc, khác b). Vô số nghiệm (infinitely many) khi 2 phương trình thực chất là một (tỉ lệ các hệ số bằng nhau). Bạn có thể mở Desmos nhập 2 vế để nhìn giao điểm.';
      keywords = ['System of Equations', 'Giao điểm Desmos', 'Tỉ lệ hệ số'];
    } else if (qLower.includes('triangle') || qLower.includes('tam giác') || qLower.includes('circle') || qLower.includes('đường tròn') || qLower.includes('angle') || qLower.includes('góc')) {
      step1Content = '🔑 Hình học & Lượng giác: Tam giác vuông tuân theo định lý Pythagore a² + b² = c² và tỉ số sin = đối/huyền, cos = kề/huyền. Phương trình đường tròn chuẩn là (x - h)² + (y - k)² = r² với tâm (h, k) và bán kính r.';
      keywords = ['Geometry & Trig', 'Pythagore', 'Circle Equation'];
    } else if (qLower.includes('quadrat') || qLower.includes('bậc hai') || qLower.includes('parabola') || qLower.includes('vertex') || qLower.includes('minimum') || qLower.includes('maximum')) {
      step1Content = '🔑 Hàm bậc hai & Parabol: Đỉnh parabol có hoành độ x = -b / (2a). Biệt thức Δ = b² - 4ac quyết định số nghiệm (Δ > 0: 2 nghiệm phân biệt; Δ = 0: 1 nghiệm kép; Δ < 0: không có nghiệm thực).';
      keywords = ['Quadratics', 'Vertex x = -b/2a', 'Discriminant Δ'];
    } else if (qLower.includes('percent') || qLower.includes('%') || qLower.includes('ratio') || qLower.includes('tỉ lệ') || qLower.includes('tăng') || qLower.includes('giảm')) {
      step1Content = '🔑 Tăng/Giảm phần trăm: Giá trị mới = Giá trị gốc × (1 ± r%). Luôn xác định đúng "giá trị gốc" làm mốc so sánh (mẫu số khi tính phần trăm thay đổi).';
      keywords = ['Percentage Change', 'Base Value', 'Ratio & Proportion'];
    } else {
      step1Content = `🔑 Manh mối tư duy: Tách biệt rõ "Đề bài cho gì" và "Đề bài thực sự hỏi gì" (rất nhiều câu bẫy hỏi 2x hoặc x+y thay vì x). ${safeMistake.skill ? `Chuyên đề: ${safeMistake.skill}.` : ''} Hãy thử vẽ hình phác thảo hoặc nhập công thức vào Desmos.`;
      keywords = [safeMistake.skill || 'SAT Math Core', 'Xác định biến đích', 'Kiểm chứng Desmos'];
    }
  } else {
    // R&W
    if (qLower.includes('transition') || qLower.includes('chuyển ý') || expLower.includes('contrast') || expLower.includes('addition')) {
      step1Content = '🔑 Từ nối chuyển ý (Transitions): Đọc kỹ câu trước và câu chứa chỗ trống. Xác định quan hệ logic: Tương phản (However, Nonetheless, In contrast), Bổ sung (Furthermore, Moreover), Nhân quả (Therefore, Thus), hay Minh họa (For example).';
      keywords = ['Transitions', 'Logic +/-', 'Quan hệ 2 mệnh đề'];
    } else if (qLower.includes('central idea') || qLower.includes('main idea') || qLower.includes('chủ đề') || qLower.includes('primarily')) {
      step1Content = '🔑 Ý chính / Luận điểm trung tâm: Đáp án đúng phải bao quát toàn bài, tránh đáp án quá hẹp (chỉ là chi tiết phụ) hoặc quá phóng đại (vượt ra ngoài phạm vi tác giả đề cập). Chú ý câu mở đầu và kết đoạn.';
      keywords = ['Central Idea', 'Tránh bẫy Too Narrow', 'Tránh bẫy Extreme'];
    } else if (qLower.includes('words in context') || qLower.includes('vocab') || qLower.includes('most nearly means') || qLower.includes('as used in')) {
      step1Content = '🔑 Từ vựng theo ngữ cảnh: Tuyệt đối không chọn theo nghĩa quen nhất của từ! Hãy tìm từ khóa chỉ sắc thái (tích cực/tiêu cực/trung lập) ở câu văn xung quanh, rồi thay thế từng đáp án vào xem câu có mượt mà logic không.';
      keywords = ['Words in Context', 'Context Clues', 'Sắc thái Tone +/-'];
    } else if (qLower.includes('punctuation') || qLower.includes('boundaries') || qLower.includes('comma') || qLower.includes('colon') || qLower.includes('semicolon')) {
      step1Content = '🔑 Quy tắc dấu câu: Xác định Mệnh đề độc lập (Independent Clause) và Mệnh đề phụ thuộc. Dấu chấm phẩy (;) nối 2 mệnh đề độc lập. Dấu hai chấm (:) yêu cầu vế trước phải là câu hoàn chỉnh. Cấm nối 2 mệnh đề độc lập bằng một dấu phẩy đơn độc.';
      keywords = ['Boundaries', 'Independent Clause', 'Quy tắc ; và :'];
    } else {
      step1Content = `🔑 Bằng chứng thép trong đoạn văn: Mọi đáp án chuẩn của SAT Reading đều có bằng chứng trực tiếp trong bài (Direct Evidence). Tránh xa các đáp án suy diễn theo cảm tính cá nhân. ${safeMistake.skill ? `Kỹ năng: ${safeMistake.skill}.` : ''}`;
      keywords = [safeMistake.skill || 'Reading Comprehension', 'Direct Evidence', 'Loại trừ suy diễn'];
    }
  }

  // Nấc 2: Cảnh báo 2 đáp án nhiễu
  const choices = safeMistake.choices && safeMistake.choices.length > 0 ? safeMistake.choices : ['A', 'B', 'C', 'D'];
  const wrongChoices = choices.filter(c => c !== safeMistake.correct_choice);

  let trap1 = safeMistake.user_choice && safeMistake.user_choice !== safeMistake.correct_choice && wrongChoices.includes(safeMistake.user_choice)
    ? safeMistake.user_choice
    : (wrongChoices[0] || 'Đáp án bẫy số 1');

  let trap2 = wrongChoices.find(c => c !== trap1) || wrongChoices[1] || 'Đáp án bẫy số 2';

  const trap1Reason = trap1 === safeMistake.user_choice
    ? '⚠️ Bẫy bạn đã từng chọn nhầm: Đây là phương án kinh điển đánh trúng tâm lý đọc lướt hoặc dừng lại ở kết quả trung gian chưa xong.'
    : '⚠️ Bẫy nhiễu phổ biến: Nhìn bề ngoài có số liệu hoặc từ ngữ rất quen thuộc trong đề nhưng sai về mặt logic hỏi.';

  const trap2Reason = '⚠️ Bẫy suy diễn cực đoan: Chứa từ ngữ khẳng định thái quá hoặc áp dụng sai công thức đổi dấu (+ / -).';

  const trapList = [
    `${trap1} — ${trap1Reason}`,
    `${trap2} — ${trap2Reason}`,
  ];

  const generalTip = isMath
    ? 'Kiểm tra lại câu hỏi cuối cùng xem đề yêu cầu tìm x hay biểu thức chứa x, và thử thế ngược đáp án vào phương trình.'
    : 'Chỉ chọn phương án có từ khóa đồng nghĩa trực tiếp với câu chủ đề trong đoạn văn, loại ngay phương án chứa từ cực đoan (always, never, completely).';

  return {
    subject: subjectLabel,
    keywords,
    formulaOrRule: step1Content,
    coreFormula: step1Content,
    traps: trapList,
    trapWarnings: trapList,
    generalTip,
    step1Title,
    step1Content,
    step2Title: '⚠️ Cảnh báo 2 đáp án nhiễu dễ sập bẫy College Board',
    trap1,
    trap1Reason,
    trap2,
    trap2Reason,
    correctChoice: safeMistake.correct_choice,
    explanation: safeMistake.explanation,
  };
}

/**
 * Tab chuyển chế độ — KHAI BÁO NGOÀI component cha.
 * Giữ nguyên kiến trúc chống remount của bản gốc.
 */
function ModeTabs({
  mode,
  onChange,
  dueCount,
  totalCount,
  masteryShards,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  dueCount?: number;
  totalCount?: number;
  masteryShards?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-[#262730] pb-4">
      <button
        type="button"
        onClick={() => onChange('browse')}
        className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
          mode === 'browse'
            ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
            : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155] hover:text-white'
        }`}
      >
        📚 Xem tất cả {totalCount !== undefined && <span className="text-xs bg-black/30 px-1.5 py-0.5 rounded-full">{totalCount}</span>}
      </button>

      <button
        type="button"
        onClick={() => onChange('review')}
        className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
          mode === 'review'
            ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
            : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155] hover:text-white'
        }`}
      >
        🔁 Ôn tập đến hạn
        {dueCount !== undefined && dueCount > 0 && (
          <span className="text-xs bg-amber-500 text-black font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
            {dueCount}
          </span>
        )}
      </button>

      {/* [Point 56] Nút Chế độ Phục thù 5 câu nhanh */}
      <button
        type="button"
        onClick={() => onChange('sprint')}
        className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
          mode === 'sprint'
            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_12px_rgba(245,158,11,0.4)]'
            : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155] hover:text-white'
        }`}
      >
        ⚡ Phục thù nhanh 5 câu (3 phút)
      </button>

      {/* [Point 52] Nút Chế độ In / Xuất Tờ Ôn Tập Nhanh */}
      <button
        type="button"
        onClick={() => onChange('cram')}
        className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
          mode === 'cram'
            ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
            : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155] hover:text-white'
        }`}
      >
        🖨️ In Tờ Ôn Tập Phòng Thi
      </button>

      {/* Kết nối sang Lò Rèn /forge với số Tinh Thể Phục Thù */}
      <Link
        href="/forge"
        className="text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border border-purple-500/40 text-purple-200 hover:text-white hover:border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.25)] ml-auto"
        title="Dùng Tinh Thể Khắc Phục Lỗi để rèn thần khí, tăng 100% tỷ lệ đập đồ tại Lò Rèn /forge"
      >
        💎 <span className="font-extrabold text-amber-300">{masteryShards ?? 0}</span> Tinh Thể (Lò Rèn ⚒️)
      </Link>
    </div>
  );
}

export function MistakeNotebook() {
  const [mode, setMode] = useState<Mode>('browse');
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Trạng thái riêng cho chế độ ôn tập (review).
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Luyện BIẾN THỂ (Nhóm 7 #6)
  const [variantQ, setVariantQ] = useState<PracticeQuestion | null>(null);
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [variantScored, setVariantScored] = useState(false);

  // [Point 46] Chế độ Che Đáp Án để tự nhẩm lại (Blind Retry Mode)
  const [blindRetryMode, setBlindRetryMode] = useState<boolean>(true);
  const [browseRevealed, setBrowseRevealed] = useState<boolean>(false);
  const [browseGuess, setBrowseGuess] = useState<string | null>(null);

  // [Point 47] Gắn Nhãn Nguyên Nhân Sai (lưu localStorage key sat_mistake_root_causes_v1)
  const [rootCauses, setRootCauses] = useState<Record<string, RootCauseId>>({});

  // [Point 49] Ghi chú "Bài học xương máu" (lưu localStorage key sat_mistake_notes_v1)
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [noteDraft, setNoteDraft] = useState<string>('');

  // [Point 58] Lưu trữ / Ẩn khỏi danh sách (lưu localStorage key sat_mistake_archived_v1)
  const [archivedIds, setArchivedIds] = useState<string[]>([]);

  // [Point 50] Bộ lọc Đa chiều
  const [filterSubject, setFilterSubject] = useState<'all' | 'Math' | 'R&W'>('all');
  const [filterBox, setFilterBox] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterRootCause, setFilterRootCause] = useState<string>('all');
  const [filterArchive, setFilterArchive] = useState<'active' | 'archived' | 'all'>('active');

  // [Point 51] Thanh Tìm kiếm Nội dung Câu hỏi Sai
  const [searchQuery, setSearchQuery] = useState<string>('');

  // [Point 54] Khung Gia sư AI Socratic
  const [aiTutorOpen, setAiTutorOpen] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiCustomQuestion, setAiCustomQuestion] = useState<string>('');

  // [Point 56] Trạng thái Mistake Sprint (5 câu / 3 phút)
  const [sprintIndex, setSprintIndex] = useState<number>(0);
  const [sprintChoices, setSprintChoices] = useState<Record<number, string>>({});
  const [sprintSubmitted, setSprintSubmitted] = useState<boolean>(false);
  const [sprintTimeLeft, setSprintTimeLeft] = useState<number>(180);
  const [sprintRunning, setSprintRunning] = useState<boolean>(false);
  const sprintTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tham chiếu vòng đời và dọn dẹp AbortController / setTimeout (#064, #065)
  const isMountedRef = useRef<boolean>(true);
  const variantAbortControllerRef = useRef<AbortController | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const shardToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Thang Gợi Ý 3 Cấp Độ (3-Step Socratic Hint Ladder: 0: Đóng, 1: Từ khóa/Công thức, 2: Cảnh báo bẫy, 3: Mở toàn bộ)
  const [hintStep, setHintStep] = useState<number>(0);

  // Tích lũy "Tinh Thể Phục Thù" (Mastery Shard - lưu key sat_mastery_shards_v1)
  const [masteryShards, setMasteryShards] = useState<number>(0);
  const [shardToast, setShardToast] = useState<{ amount: number; message: string } | null>(null);

  // Bản đồ Chiến dịch 14 Ngày Quét Sạch Lỗi Sai Banner
  const [showCampaignBanner, setShowCampaignBanner] = useState<boolean>(true);

  // Hàm thưởng Tinh Thể Phục Thù và đồng bộ localStorage
  const awardMasteryShard = (amount = 1, reason = 'Khắc phục thành công câu sai!') => {
    setMasteryShards(prev => {
      const next = prev + amount;
      try {
        localStorage.setItem('sat_mastery_shards_v1', String(next));
      } catch {}
      return next;
    });
    setShardToast({ amount, message: reason });
    if (shardToastTimerRef.current) {
      clearTimeout(shardToastTimerRef.current);
    }
    shardToastTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setShardToast(null);
      }
    }, 4500);
  };

  // Load localStorage on mount & cleanup unmount
  useEffect(() => {
    isMountedRef.current = true;
    try {
      const savedCauses = localStorage.getItem('sat_mistake_root_causes_v1');
      if (savedCauses) setRootCauses(JSON.parse(savedCauses));

      const savedNotes = localStorage.getItem('sat_mistake_notes_v1');
      if (savedNotes) setNotes(JSON.parse(savedNotes));

      const savedArchived = localStorage.getItem('sat_mistake_archived_v1');
      if (savedArchived) setArchivedIds(JSON.parse(savedArchived));

      const savedBlind = localStorage.getItem('sat_mistake_blind_retry_v1');
      if (savedBlind !== null) setBlindRetryMode(JSON.parse(savedBlind));

      const savedShards = localStorage.getItem('sat_mastery_shards_v1');
      if (savedShards) setMasteryShards(parseInt(savedShards, 10) || 0);

      const savedBanner = localStorage.getItem('sat_campaign_banner_open_v1');
      if (savedBanner !== null) setShowCampaignBanner(JSON.parse(savedBanner));
    } catch {
      // Graceful fallback
    }
    return () => {
      isMountedRef.current = false;
      if (variantAbortControllerRef.current) {
        variantAbortControllerRef.current.abort();
      }
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
      }
      if (shardToastTimerRef.current) {
        clearTimeout(shardToastTimerRef.current);
      }
      if (sprintTimerRef.current) {
        clearInterval(sprintTimerRef.current);
      }
    };
  }, []);

  // [Point 66] Hỗ trợ phím Escape đóng modal ôn tập / variant / AI tutor / sprint / cram
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (variantQ) {
          if (variantAbortControllerRef.current) {
            variantAbortControllerRef.current.abort();
          }
          setVariantLoading(false);
          setVariantQ(null);
          setVariantScored(false);
          return;
        }
        if (aiTutorOpen) {
          if (aiAbortControllerRef.current) {
            aiAbortControllerRef.current.abort();
          }
          setAiLoading(false);
          setAiTutorOpen(false);
          return;
        }
        if (isEditingNote) {
          setIsEditingNote(false);
          return;
        }
        if (mode === 'cram' || mode === 'sprint') {
          setMode('browse');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [variantQ, aiTutorOpen, isEditingNote, mode]);

  const toggleCampaignBanner = () => {
    setShowCampaignBanner(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sat_campaign_banner_open_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Sync root causes to localStorage
  const handleSetRootCause = (mistakeId: string, causeId: RootCauseId) => {
    setRootCauses(prev => {
      const next = { ...prev };
      if (next[mistakeId] === causeId) {
        delete next[mistakeId];
      } else {
        next[mistakeId] = causeId;
      }
      try {
        localStorage.setItem('sat_mistake_root_causes_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Sync notes to localStorage
  const handleSaveNote = (mistakeId: string, noteText: string) => {
    setNotes(prev => {
      const next = { ...prev };
      if (!noteText.trim()) {
        delete next[mistakeId];
      } else {
        next[mistakeId] = noteText.trim();
      }
      try {
        localStorage.setItem('sat_mistake_notes_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    setIsEditingNote(false);
  };

  // Sync archive to localStorage
  const handleToggleArchive = (mistakeId: string) => {
    setArchivedIds(prev => {
      const exists = prev.includes(mistakeId);
      const next = exists ? prev.filter(id => id !== mistakeId) : [...prev, mistakeId];
      try {
        localStorage.setItem('sat_mistake_archived_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Toggle Blind Retry Mode
  const toggleBlindRetryMode = () => {
    setBlindRetryMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sat_mistake_blind_retry_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const load = useCallback((m: Mode) => {
    setIsLoading(true);
    const url = m === 'review' ? '/api/cau-sai?due=true' : '/api/cau-sai';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!isMountedRef.current) return;
        const loaded: Mistake[] = Array.isArray(data) ? data : [];
        setMistakes(loaded);
        setCurrentIndex(0);
        setRevealed(false);
        setBrowseRevealed(false);
        setBrowseGuess(null);
        setHintStep(0);
        setVariantQ(null);
        setVariantError('');
        setReviewError('');
        setVariantScored(false);
        setAiTutorOpen(false);
        setAiExplanation('');
        setIsLoading(false);
      })
      .catch(err => {
        if (!isMountedRef.current) return;
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    load(mode);
  }, [mode, load]);

  // Ghi kết quả ôn tập 1 câu (Leitner) rồi chuyển sang câu kế tiếp
  const handleReview = async (isRemembered: boolean) => {
    const m = mistakes[currentIndex];
    if (!m?.id) return;
    setReviewError('');
    try {
      const res = await fetch('/api/cau-sai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistakeId: m.id, isRemembered }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (isMountedRef.current) {
          setReviewError(data?.error || 'Không lưu được kết quả ôn tập. Vui lòng thử lại.');
        }
        return;
      }
    } catch (e) {
      console.error('Lỗi ghi kết quả ôn tập', e);
      if (isMountedRef.current) {
        setReviewError('Lỗi kết nối khi lưu kết quả ôn tập. Vui lòng thử lại.');
      }
      return;
    }
    if (!isMountedRef.current) return;
    if (isRemembered) {
      awardMasteryShard(1, 'Đã nhớ vững & đẩy câu sai lên hộp Leitner cao hơn! +1 Tinh Thể Phục Thù');
    }
    setReviewedCount(c => c + 1);
    setMistakes(prev => prev.filter((_, i) => i !== currentIndex));
    setCurrentIndex(0);
    setRevealed(false);
    setBrowseRevealed(false);
    setBrowseGuess(null);
    setHintStep(0);
    setVariantQ(null);
    setVariantError('');
    setReviewError('');
    setVariantScored(false);
  };

  // Sinh câu BIẾN THỂ cùng skill (Nhóm 7 #6 - SOP #064, #065)
  const handlePracticeVariant = async () => {
    const m = mistakes[currentIndex];
    if (!m?.skill_id) return;
    // Chặn bấm nút tạo biến thể liên tiếp khi đang loading (#064)
    if (variantLoading) return;

    if (variantAbortControllerRef.current) {
      variantAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    variantAbortControllerRef.current = controller;

    setVariantLoading(true);
    setVariantError('');
    try {
      const res = await fetch(`/api/cau-sai/variant?skillId=${encodeURIComponent(m.skill_id)}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (!isMountedRef.current) return;
      if (!res.ok) {
        setVariantError(data?.error || 'Không tạo được câu biến thể. Thử lại sau nhé.');
        setVariantQ(null);
      } else {
        setVariantQ(data as PracticeQuestion);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      console.error('Lỗi sinh câu biến thể', e);
      setVariantError('Lỗi kết nối khi tạo câu biến thể.');
    } finally {
      if (isMountedRef.current) {
        setVariantLoading(false);
      }
    }
  };

  const handleVariantAnswer = (isCorrect: boolean) => {
    if (variantScored) return;
    setVariantScored(true);
    if (isCorrect) {
      awardMasteryShard(2, 'Hạ gục câu biến thể tương đương! +2 Tinh Thể Phục Thù');
    }
    void handleReview(isCorrect);
  };

  // [Point 50 & 51] Lọc đa chiều & tìm kiếm
  const archivedIdsSet = useMemo(() => new Set(archivedIds), [archivedIds]);

  const filteredMistakes = useMemo(() => {
    return mistakes.filter(m => {
      const id = m.id || '';
      const isArchived = archivedIdsSet.has(id);

      if (filterArchive === 'active' && isArchived) return false;
      if (filterArchive === 'archived' && !isArchived) return false;

      if (filterSubject !== 'all') {
        const sub = detectSubject(m);
        if (sub !== filterSubject) return false;
      }

      if (filterBox !== 'all') {
        const targetBox = Number(filterBox);
        const actualBox = m.box ?? 1;
        if (actualBox !== targetBox) return false;
      }

      if (filterSource !== 'all' && m.source !== filterSource) {
        return false;
      }

      if (filterRootCause !== 'all') {
        const cause = rootCauses[id];
        if (filterRootCause === 'untagged') {
          if (cause) return false;
        } else {
          if (cause !== filterRootCause) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const personalNote = notes[id] || '';
        const match =
          m.question.toLowerCase().includes(q) ||
          (m.passage && m.passage.toLowerCase().includes(q)) ||
          (m.explanation && m.explanation.toLowerCase().includes(q)) ||
          (m.skill_id && m.skill_id.toLowerCase().includes(q)) ||
          (m.skill && m.skill.toLowerCase().includes(q)) ||
          (m.domain && m.domain.toLowerCase().includes(q)) ||
          personalNote.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [mistakes, archivedIdsSet, filterArchive, filterSubject, filterBox, filterSource, filterRootCause, searchQuery, notes, rootCauses]);

  // Unique sources for filter dropdown
  const uniqueSources = useMemo(() => {
    const set = new Set<string>();
    mistakes.forEach(m => {
      if (m.source) set.add(m.source);
    });
    return Array.from(set);
  }, [mistakes]);

  // [Point 48] Thống kê tỉ lệ % nguyên nhân mất điểm
  const rootCauseStats = useMemo(() => {
    const counts: Record<string, number> = {
      careless: 0,
      vocab: 0,
      concept: 0,
      time: 0,
      desmos: 0,
    };
    let taggedTotal = 0;
    mistakes.forEach(m => {
      const id = m.id || '';
      if (archivedIdsSet.has(id)) return;
      const c = rootCauses[id];
      if (c && counts[c] !== undefined) {
        counts[c]++;
        taggedTotal++;
      }
    });

    let highestCause: string | null = null;
    let highestCount = 0;
    for (const [cause, count] of Object.entries(counts)) {
      if (count > highestCount) {
        highestCount = count;
        highestCause = cause;
      }
    }

    return { counts, taggedTotal, highestCause, highestCount };
  }, [mistakes, archivedIdsSet, rootCauses]);

  // [Point 53] Thanh tiến độ tốt nghiệp sổ tay (Box 4-5 vs Box 1-2)
  const masteryStats = useMemo(() => {
    let mastered = 0;
    let learning = 0;
    let danger = 0;
    const activeMistakes = mistakes.filter(m => !archivedIdsSet.has(m.id || ''));
    const total = activeMistakes.length;

    activeMistakes.forEach(m => {
      const b = m.box ?? 1;
      if (b >= 4) mastered++;
      else if (b === 3) learning++;
      else danger++;
    });

    const masteredPercent = total > 0 ? Math.round((mastered / total) * 100) : 0;
    const learningPercent = total > 0 ? Math.round((learning / total) * 100) : 0;
    const dangerPercent = total > 0 ? Math.round((danger / total) * 100) : 0;

    return { mastered, learning, danger, total, masteredPercent, learningPercent, dangerPercent };
  }, [mistakes, archivedIdsSet]);

  // Số lượng câu đến hạn ôn hôm nay
  const dueCount = useMemo(() => {
    return mistakes.filter(m => {
      if (archivedIdsSet.has(m.id || '')) return false;
      return getNextReviewInfo(m.next_review || m.nextReviewAt).isDue;
    }).length;
  }, [mistakes, archivedIdsSet]);

  // Đảm bảo currentIndex hợp lệ khi danh sách filteredMistakes thay đổi
  const safeCurrentIndex = Math.min(currentIndex, Math.max(0, filteredMistakes.length - 1));
  const currentMistake = filteredMistakes[safeCurrentIndex];

  // [Point 54] Gọi AI Tutor Socratic (SOP #064, #065)
  const handleAskAiTutor = async (customPrompt?: string) => {
    if (!currentMistake) return;
    if (aiLoading) return; // Chặn spam click liên tục khi đang tải phản hồi

    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;

    setAiLoading(true);
    setAiTutorOpen(true);
    try {
      const res = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question: currentMistake.question,
          passage: currentMistake.passage,
          userChoice: currentMistake.user_choice,
          correctChoice: currentMistake.correct_choice,
          explanation: currentMistake.explanation,
          prompt:
            customPrompt ||
            'Hãy giải thích theo phương pháp Socratic: 1. Tại sao đáp án của học sinh chọn là một cái bẫy thường gặp của College Board? 2. Đâu là manh mối vàng trong đề bài để nhận diện đáp án đúng? 3. Quy tắc tư duy giúp học sinh không bao giờ mắc lại lỗi này.',
        }),
      });
      if (!isMountedRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (!isMountedRef.current) return;
        setAiExplanation(data.response || data.answer || data.explanation || 'Đã nhận phân tích từ Gia sư AI.');
      } else {
        // Fallback Socratic thông minh tại chỗ
        setAiExplanation(
          `🤖 **Gia sư Socratic Nghia Guru:**\n\n` +
            `1. **Bản chất của bẫy (${currentMistake.user_choice || 'lựa chọn của bạn'}):** Đây là phương án đánh trúng tâm lý đọc lướt hoặc ngộ nhận khái niệm. Đề bài thường cố tình đưa ra một chi tiết có thật trong bài nhưng không trả lời trực tiếp câu hỏi trọng tâm.\n\n` +
            `2. **Manh mối chìa khóa để chọn ${currentMistake.correct_choice}:** Hãy bám sát định nghĩa logic và từ khóa giới hạn trong đề bài. Đáp án đúng luôn có bằng chứng trực tiếp và không suy diễn quá mức.\n\n` +
            `3. **Bí kíp phòng thi:** Luôn gạch chân từ khóa hỏi và tự nhẩm lại câu trả lời độc lập trước khi nhìn 4 phương án.`
        );
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      setAiExplanation(
        `🤖 **Gia sư Socratic Nghia Guru:**\n\n` +
          `• **Phân tích bẫy:** Phương án ${currentMistake.user_choice || 'bạn chọn'} thường là bẫy phổ biến do College Board thiết kế để bẫy thí sinh đọc lướt.\n` +
          `• **Vì sao ${currentMistake.correct_choice} đúng:** ${currentMistake.explanation}\n` +
          `• **Chiến thuật:** Luôn kiểm tra lại câu hỏi xem đề hỏi x hay biểu thức chứa x trước khi chốt!`
      );
    } finally {
      if (isMountedRef.current) {
        setAiLoading(false);
        setAiCustomQuestion('');
      }
    }
  };

  // [Point 56] Bắt đầu Mistake Sprint (5 câu / 3 phút)
  const sprintQuestions = useMemo(() => {
    if (mode !== 'sprint') return [];
    // Lấy tối đa 5 câu sai ưu tiên box thấp nhất hoặc đến hạn hôm nay
    const eligible = mistakes.filter(m => !archivedIdsSet.has(m.id || ''));
    return [...eligible]
      .sort((a, b) => {
        const boxA = a.box ?? 1;
        const boxB = b.box ?? 1;
        if (boxA !== boxB) return boxA - boxB;
        const dueA = getNextReviewInfo(a.next_review || a.nextReviewAt).isDue ? 0 : 1;
        const dueB = getNextReviewInfo(b.next_review || b.nextReviewAt).isDue ? 0 : 1;
        return dueA - dueB;
      })
      .slice(0, 5);
  }, [mode, mistakes, archivedIdsSet]);

  const sprintChoicesRef = useRef(sprintChoices);
  sprintChoicesRef.current = sprintChoices;

  const startSprint = () => {
    setSprintIndex(0);
    setSprintChoices({});
    setSprintSubmitted(false);
    setSprintTimeLeft(180);
    setSprintRunning(true);
  };

  useEffect(() => {
    if (mode === 'sprint' && !sprintRunning && !sprintSubmitted) {
      startSprint();
    }
  }, [mode]);

  useEffect(() => {
    if (sprintRunning && sprintTimeLeft > 0) {
      sprintTimerRef.current = setInterval(() => {
        setSprintTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(sprintTimerRef.current as NodeJS.Timeout);
            setSprintRunning(false);
            setSprintSubmitted(true);
            let correct = 0;
            sprintQuestions.forEach((q, idx) => {
              if (isMistakeAnswerCorrect(sprintChoicesRef.current[idx], q.correct_choice)) {
                correct++;
              }
            });
            if (correct > 0) {
              awardMasteryShard(correct, `Hết giờ Sprint: Làm đúng ${correct}/${sprintQuestions.length} câu! +${correct} Tinh Thể Phục Thù`);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (sprintTimerRef.current) clearInterval(sprintTimerRef.current);
    };
  }, [sprintRunning, sprintTimeLeft, sprintQuestions, awardMasteryShard]);

  if (isLoading) {
    return (
      <div className="my-8 text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3" />
        <div className="text-white text-base font-medium">Đang tải sổ tay ôn tập...</div>
      </div>
    );
  }

  const renderShardToast = () => {
    if (!shardToast) return null;
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-[#0f172a] border-2 border-amber-400 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
        <div className="text-2xl animate-bounce">💎</div>
        <div>
          <div className="font-extrabold text-amber-300 text-xs uppercase tracking-wider">
            + {shardToast.amount} Tinh Thể Phục Thù (Tổng: {masteryShards})
          </div>
          <div className="text-xs text-gray-200 font-medium">{shardToast.message}</div>
        </div>
        <Link
          href="/forge"
          className="ml-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs px-3 py-1.5 rounded-lg transition-transform hover:scale-105 shadow"
        >
          Sang Lò Rèn ⚒️
        </Link>
      </div>
    );
  };

  // ==========================================
  // [Point 52] CHẾ ĐỘ IN TỜ ÔN TẬP PHÒNG THI (CRAM SHEET)
  // ==========================================
  if (mode === 'cram') {
    return (
      <div className="my-6">
        <ModeTabs mode={mode} onChange={setMode} dueCount={dueCount} totalCount={mistakes.length} masteryShards={masteryShards} />

        {/* Khung điều khiển bản in */}
        <div className="bg-[#1b2533] border border-[#262730] p-4 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🖨️ Tờ Ôn Tập Phòng Thi Siêu Tốc (Cram Sheet)
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Bản in cô đọng gồm câu hỏi sai, đáp án đúng và bài học xương máu cá nhân để cầm vào phòng thi.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors shadow-md flex items-center gap-2"
            >
              🖨️ In ngay (Ctrl + P)
            </button>
            <button
              type="button"
              onClick={() => setMode('browse')}
              className="bg-[#262730] hover:bg-[#334155] text-gray-200 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              ← Quay lại Sổ tay
            </button>
          </div>
        </div>

        {/* Nội dung trang in */}
        <div className="bg-[#0e1117] print:bg-white print:text-black text-white p-6 rounded-xl border border-[#262730] print:border-none shadow-xl space-y-6">
          <div className="border-b border-[#262730] print:border-gray-300 pb-4">
            <h1 className="text-2xl font-extrabold print:text-black text-white">
              🎓 SAT CRAM SHEET — TỔNG HỢP LỖI SAI &amp; BÀI HỌC XƯƠNG MÁU
            </h1>
            <div className="flex flex-wrap gap-4 text-xs text-gray-400 print:text-gray-600 mt-2">
              <span>Học sinh: Chiến binh SAT</span>
              <span>Tổng số câu: {filteredMistakes.length} câu</span>
              <span>Ngày in: {new Date().toLocaleDateString('vi-VN')}</span>
            </div>
          </div>

          {filteredMistakes.length === 0 ? (
            <p className="text-gray-400 py-8 text-center">Không có câu sai nào khớp với bộ lọc hiện tại.</p>
          ) : (
            <div className="space-y-6">
              {filteredMistakes.map((m, idx) => {
                const id = m.id || `cram-${idx}`;
                const note = notes[id];
                const causeId = rootCauses[id];
                const causeObj = ROOT_CAUSES.find(c => c.id === causeId);
                return (
                  <div
                    key={id}
                    className="p-4 rounded-lg bg-[#161f2e] print:bg-gray-50 border border-[#262730] print:border-gray-300 break-inside-avoid space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                      <span className="font-bold text-blue-400 print:text-blue-700">
                        Câu #{idx + 1} • {detectSubject(m)} • Nguồn: {m.source || 'Luyện tập'}
                      </span>
                      {causeObj && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 print:text-amber-800 border border-amber-500/40">
                          {causeObj.label}
                        </span>
                      )}
                    </div>

                    {m.passage && (
                      <div className="text-xs italic bg-[#101725] print:bg-white p-3 rounded border-l-2 border-blue-500 text-gray-300 print:text-gray-700">
                        {m.passage}
                      </div>
                    )}

                    <div className="text-sm font-semibold text-gray-100 print:text-black leading-relaxed">
                      {m.question}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-red-950/30 print:bg-red-50 border border-red-800/40 print:border-red-200 text-red-300 print:text-red-700">
                        <strong>❌ Đã chọn sai:</strong> {m.user_choice || 'Chưa rõ'}
                      </div>
                      <div className="p-2 rounded bg-emerald-950/30 print:bg-emerald-50 border border-emerald-800/40 print:border-emerald-200 text-emerald-300 print:text-emerald-700">
                        <strong>✅ Đáp án chuẩn:</strong> {m.correct_choice}
                      </div>
                    </div>

                    {/* [Point 49] Bài học xương máu trên trang in */}
                    {note && (
                      <div className="p-2.5 rounded-lg bg-amber-950/30 print:bg-amber-50 border border-amber-500/40 print:border-amber-300 text-xs text-amber-200 print:text-amber-900 font-medium">
                        🩸 <strong>BÀI HỌC XƯƠNG MÁU:</strong> &ldquo;{note}&rdquo;
                      </div>
                    )}

                    <div className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                      💡 <strong>Giải thích cốt lõi:</strong> {m.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {renderShardToast()}
      </div>
    );
  }

  // ==========================================
  // [Point 56] CHẾ ĐỘ MISTAKE SPRINT (5 CÂU / 3 PHÚT)
  // ==========================================
  if (mode === 'sprint') {
    const totalSprint = sprintQuestions.length;
    const currentSprintQ = sprintQuestions[sprintIndex];
    const minutesLeft = Math.floor(sprintTimeLeft / 60);
    const secondsLeft = sprintTimeLeft % 60;

    // Tính điểm sau khi nộp (SOP #073: Chống NaN%)
    let correctCount = 0;
    if (sprintSubmitted) {
      sprintQuestions.forEach((q, idx) => {
        if (isMistakeAnswerCorrect(sprintChoices[idx], q.correct_choice)) {
          correctCount++;
        }
      });
    }
    const sprintAccuracy = totalSprint > 0 ? Math.round((correctCount / totalSprint) * 100) : 0;

    return (
      <div className="my-6">
        <ModeTabs mode={mode} onChange={setMode} dueCount={dueCount} totalCount={mistakes.length} masteryShards={masteryShards} />

        <div className="bg-[#131922] border border-[#262730] p-5 rounded-2xl shadow-xl space-y-6">
          {/* Header Sprint */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#262730] pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                ⚡ Phục thù nhanh 5 câu (Mistake Sprint)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Rèn phản xạ thần tốc trong 3 phút với 5 câu sai ưu tiên Box thấp nhất.
              </p>
            </div>

            {/* Đồng hồ đếm ngược */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-black border ${
                sprintTimeLeft <= 30
                  ? 'bg-rose-950/40 text-rose-400 border-rose-500 animate-pulse'
                  : 'bg-[#1b2533] text-amber-300 border-amber-500/40'
              }`}
            >
              ⏱️ {String(minutesLeft).padStart(2, '0')}:{String(secondsLeft).padStart(2, '0')}
            </div>
          </div>

          {totalSprint === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg text-white font-bold mb-2">🎉 Bạn chưa có câu sai nào trong danh sách!</p>
              <p className="text-sm">Hãy làm thêm bài kiểm tra hoặc câu hỏi AI để tích lũy dữ liệu phục thù.</p>
            </div>
          ) : sprintSubmitted ? (
            /* Kết quả Sprint */
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">
                {correctCount >= 4 ? '🏆' : correctCount >= 2 ? '💪' : '🔥'}
              </div>
              <h3 className="text-2xl font-black text-white">
                Kết quả Sprint: {correctCount}/{totalSprint} câu đúng ({sprintAccuracy}%)!
              </h3>
              <p className="text-sm text-gray-300 max-w-md mx-auto">
                {correctCount === 5
                  ? 'Tuyệt đỉnh! Bạn đã làm chủ hoàn toàn các cạm bẫy cũ!'
                  : correctCount >= 3
                  ? 'Rất tốt! Phản xạ đã nhanh và chính xác hơn nhiều.'
                  : 'Đừng nản chí! Hãy xem kỹ lại bài học xương máu bên dưới.'}
              </p>

              {/* Chi tiết từng câu */}
              <div className="max-w-2xl mx-auto space-y-3 text-left pt-4">
                {sprintQuestions.map((q, idx) => {
                  const userAns = sprintChoices[idx];
                  const isCorrect = isMistakeAnswerCorrect(userAns, q.correct_choice);
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs ${
                        isCorrect
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <div className="font-bold mb-1">
                        Câu {idx + 1}: {isCorrect ? '✅ Đúng' : '❌ Chưa đúng'}
                      </div>
                      <div className="text-gray-300 mb-1">{q.question}</div>
                      <div>
                        Bạn chọn: <strong>{userAns || '(Chưa chọn)'}</strong> • Đáp án chuẩn: <strong>{q.correct_choice}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={startSprint}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition-colors"
                >
                  🔄 Phục thù đợt khác
                </button>
                <button
                  type="button"
                  onClick={() => setMode('browse')}
                  className="bg-[#262730] hover:bg-[#334155] text-white text-sm px-6 py-2.5 rounded-lg transition-colors"
                >
                  📚 Về sổ tay
                </button>
              </div>
            </div>
          ) : (
            /* Khung làm bài Sprint */
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  Câu hỏi <strong>{sprintIndex + 1}</strong> / {totalSprint}
                </span>
                <span>Nguồn: {currentSprintQ?.source || 'SAT Mock'}</span>
              </div>

              {currentSprintQ?.passage && (
                <div className="bg-[#1b2533] border-l-4 border-blue-500 p-4 rounded text-sm text-[#e2e8f0] leading-relaxed">
                  {currentSprintQ.passage}
                </div>
              )}

              <div className="bg-[#1b2533] border-l-4 border-amber-500 p-4 rounded text-sm font-semibold text-white leading-relaxed">
                {currentSprintQ?.question}
              </div>

              {/* Lựa chọn đáp án */}
              {currentSprintQ?.choices && currentSprintQ.choices.length > 0 ? (
                <div className="space-y-2">
                  {currentSprintQ.choices.map((choice, cIdx) => {
                    const isSelected = sprintChoices[sprintIndex] === choice;
                    return (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() =>
                          setSprintChoices(prev => ({ ...prev, [sprintIndex]: choice }))
                        }
                        className={`w-full text-left p-3.5 rounded-xl border text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600/30 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                            : 'bg-[#1b2533] border-[#262730] text-gray-300 hover:bg-[#223042]'
                        }`}
                      >
                        <span className="font-bold text-amber-400 mr-2">
                          {String.fromCharCode(65 + cIdx)}.
                        </span>
                        {choice}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="pt-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sprintChoices[sprintIndex] || ''}
                    onChange={e => setSprintChoices(prev => ({ ...prev, [sprintIndex]: e.target.value }))}
                    placeholder="Nhập đáp án số / phân số (VD: 3/4, 12.5)..."
                    className="w-full bg-[#1b2533] border border-[#334155] focus:border-amber-400 rounded-xl p-3.5 text-sm text-white font-mono outline-none"
                  />
                </div>
              )}

              {/* Nút chuyển câu / Nộp bài */}
              <div className="flex justify-between items-center pt-4 border-t border-[#262730]">
                <button
                  type="button"
                  disabled={sprintIndex === 0}
                  onClick={() => setSprintIndex(prev => prev - 1)}
                  className="px-4 py-2 rounded-lg bg-[#262730] hover:bg-[#334155] disabled:opacity-40 text-xs font-semibold text-white transition-colors"
                >
                  ⬅️ Câu trước
                </button>

                {sprintIndex < totalSprint - 1 ? (
                  <button
                    type="button"
                    onClick={() => setSprintIndex(prev => prev + 1)}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
                  >
                    Câu tiếp theo ➡️
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSprintRunning(false);
                      setSprintSubmitted(true);
                      let correct = 0;
                      sprintQuestions.forEach((q, idx) => {
                        if (isMistakeAnswerCorrect(sprintChoices[idx], q.correct_choice)) {
                          correct++;
                        }
                      });
                      if (correct > 0) {
                        awardMasteryShard(correct, `Hoàn thành Mistake Sprint: ${correct}/${sprintQuestions.length} câu đúng! +${correct} Tinh Thể Phục Thù`);
                      }
                    }}
                    className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-extrabold text-white transition-colors shadow-lg"
                  >
                    🚀 Hoàn thành Sprint
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // CHẾ ĐỘ ÔN TẬP (REVIEW / SRS)
  // ==========================================
  if (mode === 'review') {
    if (mistakes.length === 0) {
      return (
        <div className="my-6">
          <ModeTabs mode={mode} onChange={setMode} dueCount={dueCount} totalCount={mistakes.length} masteryShards={masteryShards} />
          <div className="text-center text-gray-400 py-12">
            <h2 className="text-[22px] font-bold text-white mb-3">🎉 Không còn câu nào đến hạn ôn!</h2>
            <p className="text-sm">
              {reviewedCount > 0
                ? `Bạn vừa ôn xong ${reviewedCount} câu. Trí nhớ dài hạn đã được kích hoạt!`
                : 'Hãy quay lại sau khi có câu đến lịch ôn tập nhé.'}
            </p>
          </div>
          {renderShardToast()}
        </div>
      );
    }

    const m = mistakes[currentIndex];
    const mistakeId = m?.id || `rev-${currentIndex}`;
    const personalNote = notes[mistakeId];

    if (variantQ) {
      return (
        <div className="my-6">
          <ModeTabs mode={mode} onChange={setMode} dueCount={dueCount} totalCount={mistakes.length} masteryShards={masteryShards} />
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[20px] font-bold text-white">🎲 Biến thể câu sai — cùng dạng, khác số liệu</h2>
            <button
              type="button"
              onClick={() => {
                setVariantQ(null);
                setVariantScored(false);
              }}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              ← Quay lại xem đáp án
            </button>
          </div>
          <p className="text-sm text-[#94a3b8] mb-2">
            Trả lời đúng = bạn đã nắm dạng này (ôn thưa dần); sai = ôn lại sớm. Kết quả tự cập nhật lịch ôn.
          </p>
          <CorePracticeUI
            questionData={variantQ}
            isLoading={variantLoading}
            onNext={handlePracticeVariant}
            onAnswer={handleVariantAnswer}
          />
          {renderShardToast()}
        </div>
      );
    }

    return (
      <div className="my-6">
        <ModeTabs mode={mode} onChange={setMode} dueCount={dueCount} totalCount={mistakes.length} masteryShards={masteryShards} />
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[22px] font-bold text-white">🔁 Ôn tập câu sai</h2>
          <span className="text-sm text-gray-400 bg-[#1e293b] px-3 py-1 rounded-full">
            Còn {mistakes.length} câu • Đã ôn {reviewedCount}
          </span>
        </div>

        <hr className="border-[#262730] my-4" />

        {/* [Point 57] Nhãn thời gian ôn tập tiếp theo */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
            {getNextReviewInfo(m.next_review || m.nextReviewAt).label}
          </span>
          <span className="text-xs text-gray-400">
            Hộp Leitner: <strong>Hộp {m.box ?? 1}</strong>
          </span>
        </div>

        {/* [Point 49] Bài học xương máu hiển thị nổi bật mỗi khi ôn lại */}
        {personalNote && (
          <div className="bg-gradient-to-r from-red-950/40 to-amber-950/30 border border-amber-500/40 rounded-xl p-4 mb-4 shadow-sm">
            <span className="text-amber-400 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wide mb-1">
              🩸 Bài học xương máu của bạn:
            </span>
            <p className="text-amber-100 text-sm italic font-medium leading-relaxed">
              &ldquo;{personalNote}&rdquo;
            </p>
          </div>
        )}

        {m.passage && (
          <div className="bg-[#1b2533] border-l-4 border-[#3b82f6] text-[#e2e8f0] p-4 rounded mb-4 text-[15px] leading-relaxed">
            {m.passage}
          </div>
        )}

        <div className="bg-[#1b2533] border-l-4 border-[#fbbf24] text-[#e2e8f0] p-4 rounded mb-6 text-[15px] leading-relaxed">
          <strong>Thử nhớ lại đáp án đúng cho câu này:</strong>
          <br />
          <br />
          {m.question}
        </div>

        {m.skill_id && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handlePracticeVariant}
              disabled={variantLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold px-4 py-3 rounded transition-colors"
            >
              {variantLoading ? '⚙️ Đang tạo câu biến thể...' : '🎲 Luyện câu biến thể (cùng dạng, khác số liệu)'}
            </button>
            <p className="text-xs text-[#94a3b8] mt-2 text-center">
              Cách ôn hiệu quả nhất: tự làm lại một câu tương tự thay vì chỉ xem đáp án.
            </p>
            {variantError && <p className="text-red-400 text-xs mt-1 text-center">{variantError}</p>}
          </div>
        )}

        {!revealed ? (
          <div className="bg-[#131922] border border-[#262730] rounded-2xl p-5 space-y-4 shadow-xl mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262730] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🪜</span>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Thang Gợi Ý Socratic 3 Cấp Độ</h4>
                  <p className="text-[11px] text-gray-400">
                    Đừng mở toạc đáp án ngay! Hãy kích hoạt từng nấc gợi ý để rèn luyện tư duy chủ động (Active Recall).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { step: 1, label: 'Nấc 1' },
                  { step: 2, label: 'Nấc 2' },
                  { step: 3, label: 'Nấc 3' },
                ].map(({ step, label }) => (
                  <span
                    key={step}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      hintStep >= step
                        ? 'bg-amber-400 text-black shadow'
                        : 'bg-[#1b2533] text-gray-400 border border-[#262730]'
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Nấc 1: Từ khóa / Công thức */}
            {hintStep >= 1 && (
              <div className="bg-[#1b2533] border-l-4 border-amber-400 p-3.5 rounded-r-xl space-y-1.5 animate-in fade-in">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                  💡 Nấc 1: Từ khóa cốt lõi &amp; Công thức then chốt
                </div>
                <div className="text-xs text-gray-300">
                  <span className="text-gray-400">Từ khóa trọng tâm: </span>
                  <span className="font-semibold text-white">{getHintLadderData(m).keywords}</span>
                </div>
                <div className="text-xs text-amber-200/90 font-medium bg-[#101725] p-2 rounded border border-amber-500/20">
                  📌 {getHintLadderData(m).formulaOrRule}
                </div>
              </div>
            )}

            {/* Nấc 2: Cảnh báo 2 đáp án bẫy */}
            {hintStep >= 2 && (
              <div className="bg-[#1b2533] border-l-4 border-rose-500 p-3.5 rounded-r-xl space-y-2 animate-in fade-in">
                <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5 uppercase tracking-wider">
                  ⚠️ Nấc 2: Cảnh báo 2 đáp án nhiễu dễ sập bẫy
                </div>
                <ul className="text-xs text-gray-300 space-y-1">
                  {getHintLadderData(m).traps.map((trap, tidx) => (
                    <li key={tidx} className="flex items-start gap-1.5 text-rose-200/90">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>
                        <strong className="text-white">Bẫy #{tidx + 1}:</strong> {trap}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="text-[11px] text-gray-400 italic">
                  💡 Mẹo loại trừ: {getHintLadderData(m).generalTip}
                </div>
              </div>
            )}

            {/* 3 Nút kích hoạt nấc */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setHintStep(prev => (prev < 1 ? 1 : prev))}
                className={`p-2.5 rounded-xl text-xs font-bold transition-all border ${
                  hintStep >= 1
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-[#1b2533] text-gray-300 hover:text-white border-[#262730] hover:border-amber-500/40'
                }`}
              >
                {hintStep >= 1 ? '✓ Đã mở Nấc 1' : '💡 Mở Nấc 1 (Từ khóa)'}
              </button>

              <button
                type="button"
                disabled={hintStep < 1}
                onClick={() => setHintStep(prev => (prev < 2 ? 2 : prev))}
                className={`p-2.5 rounded-xl text-xs font-bold transition-all border ${
                  hintStep >= 2
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : hintStep >= 1
                    ? 'bg-[#1b2533] text-gray-300 hover:text-white border-[#262730] hover:border-rose-500/40'
                    : 'bg-[#1b2533]/40 text-gray-600 border-[#262730] cursor-not-allowed'
                }`}
              >
                {hintStep >= 2 ? '✓ Đã mở Nấc 2' : '⚠️ Mở Nấc 2 (Cảnh báo bẫy)'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setHintStep(3);
                  setRevealed(true);
                }}
                className="p-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md transition-all hover:scale-[1.02]"
              >
                👁️ Mở Nấc 3: Hiện lời giải
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-[rgba(16,185,129,0.1)] border border-[#10b981] p-4 rounded mb-4">
              <div className="text-[#10b981] font-bold mb-1">✅ Đáp án đúng:</div>
              <div className="text-sm text-[#e2e8f0]">{m.correct_choice}</div>
            </div>
            <div className="bg-[#1e293b] p-4 rounded border border-[#334155] mb-6">
              <h4 className="text-[#fbbf24] font-bold mb-2">💡 Giải thích:</h4>
              <div className="text-sm text-[#e2e8f0] leading-relaxed">{m.explanation}</div>
            </div>
            <div className="flex flex-wrap gap-3">
              {reviewError && (
                <div className="basis-full bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] px-3 py-2 rounded text-sm">
                  {reviewError}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleReview(false)}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold px-4 py-3 rounded transition-colors"
              >
                😓 Chưa nhớ (ôn lại sớm)
              </button>
              <button
                type="button"
                onClick={() => handleReview(true)}
                className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white font-bold px-4 py-3 rounded transition-colors"
              >
                😎 Đã nhớ (ôn thưa hơn)
              </button>
            </div>
          </>
        )}
        {renderShardToast()}
      </div>
    );
  }

  // ==========================================
  // CHẾ ĐỘ XEM TẤT CẢ (BROWSE MODE)
  // ==========================================
  const currentMistakeId = currentMistake?.id || `browse-${safeCurrentIndex}`;
  const currentPersonalNote = notes[currentMistakeId] || '';
  const currentCause = rootCauses[currentMistakeId];
  const isCurrentArchived = archivedIdsSet.has(currentMistakeId);
  const tacticalAdvice = getTacticalAdvice(rootCauseStats.highestCause, rootCauseStats.taggedTotal);

  const handleNext = () => {
    if (safeCurrentIndex < filteredMistakes.length - 1) {
      setCurrentIndex(safeCurrentIndex + 1);
      setBrowseRevealed(false);
      setBrowseGuess(null);
      setHintStep(0);
      setIsEditingNote(false);
      setAiTutorOpen(false);
    }
  };

  const handlePrev = () => {
    if (safeCurrentIndex > 0) {
      setCurrentIndex(safeCurrentIndex - 1);
      setBrowseRevealed(false);
      setBrowseGuess(null);
      setHintStep(0);
      setIsEditingNote(false);
      setAiTutorOpen(false);
    }
  };

  return (
    <div className="my-6 space-y-6">
      <ModeTabs mode={mode} onChange={setMode} dueCount={dueCount} totalCount={mistakes.length} masteryShards={masteryShards} />

      {/* ========================================================= */}
      {/* BẢN ĐỒ CHIẾN DỊCH 14 NGÀY QUÉT SẠCH LỖI SAI (14-DAY MISTAKE ERADICATION) */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-[#111827] via-[#1a1c2e] to-[#111827] border border-indigo-500/30 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 bg-indigo-500/20 border border-indigo-500/40 rounded-xl">🚩</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white tracking-wide uppercase">
                  Chiến dịch 14 Ngày Quét Sạch Lỗi Sai
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                  LỘ TRÌNH 3 CHẶNG
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Phương pháp triệt tiêu lỗ hổng kiến thức SAT theo chu kỳ phản xạ có điều kiện
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleCampaignBanner}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e293b] hover:bg-[#334155] text-gray-200 transition-colors border border-gray-700 flex items-center gap-1.5"
            >
              {showCampaignBanner ? 'Thu gọn lộ trình ▲' : 'Xem chi tiết 3 chặng ▼'}
            </button>
          </div>
        </div>

        {/* 3 Chặng chiến dịch */}
        {showCampaignBanner && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {/* Chặng 1 */}
            <div className={`p-4 rounded-xl border transition-all ${
              masteryStats.danger === 0 && mistakes.length > 0
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                : 'bg-[#151c28] border-[#262730] text-gray-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-amber-400">CHẶNG 1 • NGÀY 1–4</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  masteryStats.danger === 0 && mistakes.length > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {masteryStats.danger === 0 && mistakes.length > 0 ? '✓ ĐÃ HOÀN TẤT' : `CÒN ${masteryStats.danger} CÂU HỘP 1`}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Xóa Sổ Hộp 1 (Box 1 Zero)</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Ôn tập thần tốc mọi câu sai mới phát sinh. Không để bất kỳ câu nào tồn đọng ở Hộp 1 quá 24h.
              </p>
              <div className="w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{
                    width: `${mistakes.length > 0 ? Math.max(0, Math.min(100, Math.round(((mistakes.length - masteryStats.danger) / mistakes.length) * 100))) : 100}%`
                  }}
                />
              </div>
            </div>

            {/* Chặng 2 */}
            <div className={`p-4 rounded-xl border transition-all ${
              rootCauseStats.taggedTotal >= mistakes.length && mistakes.length > 0
                ? 'bg-indigo-950/20 border-indigo-500/40 text-indigo-200'
                : 'bg-[#151c28] border-[#262730] text-gray-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-cyan-400">CHẶNG 2 • NGÀY 5–9</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  rootCauseStats.taggedTotal >= mistakes.length && mistakes.length > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}>
                  {rootCauseStats.taggedTotal >= mistakes.length && mistakes.length > 0
                    ? '✓ 100% GẮN NHÃN'
                    : `${rootCauseStats.taggedTotal}/${mistakes.length} ĐÃ GẮN NHÃN`}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Trị Lỗi Đọc Lướt &amp; Phá Bẫy</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Dùng Thang Gợi Ý 3 Bước phát hiện 2 phương án gây nhiễu, ghi chép bài học xương máu tránh lặp lại.
              </p>
              <div className="w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full transition-all"
                  style={{
                    width: `${mistakes.length > 0 ? Math.min(100, Math.round((rootCauseStats.taggedTotal / mistakes.length) * 100)) : 100}%`
                  }}
                />
              </div>
            </div>

            {/* Chặng 3 */}
            <div className={`p-4 rounded-xl border transition-all ${
              masteryStats.masteredPercent >= 70
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                : 'bg-[#151c28] border-[#262730] text-gray-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-purple-400">CHẶNG 3 • NGÀY 10–14</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  masteryStats.masteredPercent >= 70
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}>
                  {masteryStats.masteredPercent}% TỐT NGHIỆP
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Đề Ôn Phục Thù &amp; Tốt Nghiệp</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Luyện câu biến thể và chạy Mistake Sprint để đẩy &ge;70% câu lên Hộp 4–5, thu thập Tinh Thể Khắc Phục Lỗi.
              </p>
              <div className="w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full transition-all"
                  style={{ width: `${masteryStats.masteredPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span>💎 <strong>Phần thưởng Lò Rèn:</strong> Giải đúng câu sai thưởng <strong>+1 đến +2 Tinh Thể Khắc Phục Lỗi</strong>.</span>
          </div>
          <Link
            href="/forge"
            className="text-amber-400 hover:text-amber-300 font-bold underline flex items-center gap-1 transition-colors"
          >
            Đến Lò Rèn Thần Khí /forge →
          </Link>
        </div>
      </div>

      {/* [Point 53] Thanh tiến độ "Tốt nghiệp Sổ Tay" (Mastered Progress Bar) */}
      <div className="bg-[#131922] border border-[#262730] p-4 rounded-xl shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span>🎓 TIẾN ĐỘ TỐT NGHIỆP SỔ TAY</span>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-extrabold">
              {masteryStats.masteredPercent}% Đã làm chủ
            </span>
          </div>
          <div className="text-xs text-gray-400">
            Tổng cộng: <strong>{masteryStats.total}</strong> câu đang luyện
          </div>
        </div>

        {/* Thanh tiến độ 3 màu */}
        <div className="w-full bg-[#1b2533] h-3 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${masteryStats.masteredPercent}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Đã làm chủ (Box 4-5): ${masteryStats.mastered} câu`}
          />
          <div
            style={{ width: `${masteryStats.learningPercent}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`Đang củng cố (Box 3): ${masteryStats.learning} câu`}
          />
          <div
            style={{ width: `${masteryStats.dangerPercent}%` }}
            className="bg-rose-600 transition-all duration-500"
            title={`Vùng nguy hiểm (Box 1-2): ${masteryStats.danger} câu`}
          />
        </div>

        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Đã làm chủ (Box 4–5): <strong>{masteryStats.mastered}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Đang củng cố (Box 3): <strong>{masteryStats.learning}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Vùng nguy hiểm (Box 1–2): <strong>{masteryStats.danger}</strong>
          </span>
        </div>
      </div>

      {/* [Point 48] Biểu đồ Phân tích Nguyên nhân Mất điểm & Lời khuyên chiến thuật */}
      <div className="bg-[#131922] border border-[#262730] p-4 rounded-xl shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            📊 Bản đồ nguyên nhân mất điểm ({rootCauseStats.taggedTotal}/{mistakes.length} câu đã gắn nhãn)
          </span>
        </div>

        {/* Thanh tỉ lệ các nguyên nhân */}
        <div className="w-full bg-[#1b2533] h-2.5 rounded-full overflow-hidden flex">
          {ROOT_CAUSES.map(rc => {
            const count = rootCauseStats.counts[rc.id] || 0;
            const pct = rootCauseStats.taggedTotal > 0 ? (count / rootCauseStats.taggedTotal) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={rc.id}
                style={{ width: `${pct}%`, backgroundColor: rc.barColor }}
                title={`${rc.label}: ${count} câu (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>

        {/* Chú thích các nhãn */}
        <div className="flex flex-wrap gap-2 pt-1">
          {ROOT_CAUSES.map(rc => {
            const count = rootCauseStats.counts[rc.id] || 0;
            const pct = rootCauseStats.taggedTotal > 0 ? Math.round((count / rootCauseStats.taggedTotal) * 100) : 0;
            return (
              <span
                key={rc.id}
                className="text-[11px] px-2 py-0.5 rounded-md bg-[#1b2533] border border-[#262730] text-gray-300"
              >
                {rc.short}: <strong>{count}</strong> ({pct}%)
              </span>
            );
          })}
        </div>

        {/* Lời khuyên chiến thuật tự động */}
        <div className={`p-3 rounded-lg border text-xs leading-relaxed ${tacticalAdvice.bg}`}>
          <strong>{tacticalAdvice.title}:</strong> {tacticalAdvice.body}
        </div>
      </div>

      {/* [Point 51] Thanh Tìm kiếm Nội dung Câu hỏi Sai */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            setCurrentIndex(0);
          }}
          placeholder="🔍 Tìm kiếm theo từ khóa câu hỏi, kỹ năng (skill), hoặc bài học xương máu..."
          className="w-full bg-[#1b2533] border border-[#262730] focus:border-[#3b82f6] text-white text-sm rounded-xl px-4 py-3 outline-none transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded"
          >
            ✕ Xóa
          </button>
        )}
      </div>

      {/* [Point 50] Bộ lọc Đa chiều */}
      <div className="bg-[#131922] border border-[#262730] p-3.5 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Lọc Môn */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Môn:</span>
            <select
              value={filterSubject}
              onChange={e => {
                setFilterSubject(e.target.value as any);
                setCurrentIndex(0);
              }}
              className="bg-[#1b2533] border border-[#262730] text-gray-200 rounded px-2 py-1 outline-none"
            >
              <option value="all">Tất cả môn</option>
              <option value="Math">📐 Math (Toán)</option>
              <option value="R&W">📚 Reading &amp; Writing</option>
            </select>
          </div>

          {/* Lọc Hộp Leitner */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Hộp Leitner:</span>
            <select
              value={filterBox}
              onChange={e => {
                setFilterBox(e.target.value as any);
                setCurrentIndex(0);
              }}
              className="bg-[#1b2533] border border-[#262730] text-gray-200 rounded px-2 py-1 outline-none"
            >
              <option value="all">Tất cả hộp (1-5)</option>
              <option value="1">Hộp 1 (Mới sai)</option>
              <option value="2">Hộp 2 (Đang ôn)</option>
              <option value="3">Hộp 3 (Nhớ tạm)</option>
              <option value="4">Hộp 4 (Vững vàng)</option>
              <option value="5">Hộp 5 (Thành thạo)</option>
            </select>
          </div>

          {/* Lọc Nguồn */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Nguồn:</span>
            <select
              value={filterSource}
              onChange={e => {
                setFilterSource(e.target.value);
                setCurrentIndex(0);
              }}
              className="bg-[#1b2533] border border-[#262730] text-gray-200 rounded px-2 py-1 outline-none max-w-[140px] truncate"
            >
              <option value="all">Tất cả nguồn</option>
              {uniqueSources.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc Nguyên nhân */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Nguyên nhân:</span>
            <select
              value={filterRootCause}
              onChange={e => {
                setFilterRootCause(e.target.value);
                setCurrentIndex(0);
              }}
              className="bg-[#1b2533] border border-[#262730] text-gray-200 rounded px-2 py-1 outline-none max-w-[160px] truncate"
            >
              <option value="all">Tất cả nhãn</option>
              {ROOT_CAUSES.map(rc => (
                <option key={rc.id} value={rc.id}>
                  {rc.short}
                </option>
              ))}
              <option value="untagged">Chưa gắn nhãn</option>
            </select>
          </div>

          {/* Lọc Trạng thái ẩn/lưu trữ */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Kho:</span>
            <select
              value={filterArchive}
              onChange={e => {
                setFilterArchive(e.target.value as any);
                setCurrentIndex(0);
              }}
              className="bg-[#1b2533] border border-[#262730] text-gray-200 rounded px-2 py-1 outline-none"
            >
              <option value="active">Đang học</option>
              <option value="archived">Đã ẩn / Hiểu triệt để</option>
              <option value="all">Tất cả</option>
            </select>
          </div>

          {/* Reset filter */}
          {(filterSubject !== 'all' ||
            filterBox !== 'all' ||
            filterSource !== 'all' ||
            filterRootCause !== 'all' ||
            filterArchive !== 'active' ||
            searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setFilterSubject('all');
                setFilterBox('all');
                setFilterSource('all');
                setFilterRootCause('all');
                setFilterArchive('active');
                setSearchQuery('');
                setCurrentIndex(0);
              }}
              className="text-xs text-rose-400 hover:underline ml-auto"
            >
              🔄 Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* [Point 46] Thanh điều khiển Blind Retry Mode */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131922] border border-[#262730] px-4 py-2.5 rounded-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleBlindRetryMode}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              blindRetryMode
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
          >
            {blindRetryMode ? '🙈 Che đáp án để tự nhẩm: BẬT' : '👁️ Hiện đáp án tự động: TẮT'}
          </button>
          <span className="text-[11px] text-gray-400 hidden sm:inline">
            (Rèn luyện tư duy active recall trước khi xem đáp án đúng)
          </span>
        </div>

        <div className="text-xs text-gray-400 bg-[#1e293b] px-3 py-1 rounded-full">
          {filteredMistakes.length > 0
            ? `Câu ${safeCurrentIndex + 1} / ${filteredMistakes.length}`
            : '0 câu'}
        </div>
      </div>

      {/* Hiển thị chi tiết câu hỏi */}
      {filteredMistakes.length === 0 ? (
        <div className="text-center text-gray-400 py-12 bg-[#131922] border border-[#262730] rounded-xl">
          <h3 className="text-lg font-bold text-white mb-2">Không tìm thấy câu hỏi sai nào</h3>
          <p className="text-sm">Hãy thử nới lỏng từ khóa tìm kiếm hoặc điều chỉnh bộ lọc ở trên.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metadata badges của câu hỏi */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#1e293b] border border-[#334155] px-2.5 py-1 rounded text-xs text-[#94a3b8]">
              Nguồn: {currentMistake.source || 'Không rõ'}
            </span>
            <span className="bg-[#1e293b] border border-[#334155] px-2.5 py-1 rounded text-xs text-blue-400">
              {detectSubject(currentMistake) === 'Math' ? '📐 Toán học' : '📚 Reading & Writing'}
            </span>
            <span className="bg-[#1e293b] border border-[#334155] px-2.5 py-1 rounded text-xs text-amber-300">
              Hộp Leitner: Hộp {currentMistake.box ?? 1}
            </span>

            {/* [Point 57] Nhãn thời gian ôn tập tiếp theo */}
            <span
              className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                getNextReviewInfo(currentMistake.next_review || currentMistake.nextReviewAt).isDue
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              }`}
            >
              {getNextReviewInfo(currentMistake.next_review || currentMistake.nextReviewAt).label}
            </span>

            {/* [Point 58] Nút Ẩn / Phục hồi câu hỏi */}
            <button
              type="button"
              onClick={() => handleToggleArchive(currentMistakeId)}
              className="ml-auto text-xs px-2.5 py-1 rounded border border-[#334155] bg-[#1e293b] text-gray-300 hover:text-white transition-colors"
              title="Ẩn những câu bạn đã hiểu triệt để hoặc do bấm nhầm"
            >
              {isCurrentArchived ? '↩️ Bỏ ẩn câu này' : '🗄️ Đã hiểu triệt để / Ẩn câu này'}
            </button>
          </div>

          {currentMistake.passage && (
            <div className="bg-[#1b2533] border-l-4 border-[#3b82f6] text-[#e2e8f0] p-4 rounded-xl text-[15px] leading-relaxed">
              {currentMistake.passage}
            </div>
          )}

          <div className="bg-[#1b2533] border-l-4 border-[#ef4444] text-[#e2e8f0] p-4 rounded-xl text-[15px] leading-relaxed font-medium">
            <strong className="text-white block mb-2">Câu hỏi đã làm sai:</strong>
            {currentMistake.question}
          </div>

          {/* [Point 47] Gắn Nhãn Nguyên Nhân Sai (5 nhãn kinh điển) */}
          <div className="bg-[#131922] border border-[#262730] p-3.5 rounded-xl space-y-2">
            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
              <span>🏷️ Gắn nhãn nguyên nhân sai:</span>
              {currentCause && (
                <span className="text-gray-400 font-normal">
                  Đã chọn: <strong className="text-white">{ROOT_CAUSES.find(c => c.id === currentCause)?.short}</strong>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {ROOT_CAUSES.map(cause => {
                const isSelected = currentCause === cause.id;
                return (
                  <button
                    key={cause.id}
                    type="button"
                    onClick={() => handleSetRootCause(currentMistakeId, cause.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
                        ? `${cause.badgeClass} ring-2 ring-amber-400/30 font-bold scale-105 shadow-sm`
                        : 'bg-[#1b2533] border-[#262730] text-gray-400 hover:text-white hover:bg-[#243242]'
                    }`}
                  >
                    {cause.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* [Point 49] Ghi chú "Bài học xương máu" cá nhân */}
          <div className="bg-[#131922] border border-[#262730] p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                🩸 Bài học xương máu cá nhân
              </span>
              {!isEditingNote && (
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(currentPersonalNote);
                    setIsEditingNote(true);
                  }}
                  className="text-xs text-blue-400 hover:underline"
                >
                  {currentPersonalNote ? '✏️ Chỉnh sửa' : '+ Thêm ghi chú bài học'}
                </button>
              )}
            </div>

            {isEditingNote ? (
              <div className="space-y-2">
                <textarea
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  placeholder="Ghi lại bài học rút ra để không bao giờ vấp lại: ví dụ: 'Đề bài hỏi 2x chứ không phải x! Nhớ gạch chân từ khóa hỏi.'"
                  className="w-full bg-[#1b2533] border border-[#334155] rounded-lg p-3 text-sm text-white outline-none focus:border-amber-400"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingNote(false)}
                    className="px-3 py-1 text-xs text-gray-400 hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveNote(currentMistakeId, noteDraft)}
                    className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
                  >
                    💾 Lưu bài học
                  </button>
                </div>
              </div>
            ) : currentPersonalNote ? (
              <div className="bg-gradient-to-r from-red-950/30 to-amber-950/20 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-100 italic leading-relaxed">
                &ldquo;{currentPersonalNote}&rdquo;
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">
                Chưa có ghi chú bài học. Hãy đúc kết 1 câu ngắn để ghi nhớ lâu dài!
              </p>
            )}
          </div>

          {/* [Point 46] Thang Gợi Ý 3 Cấp Độ (3-Step Socratic Hint Ladder) & Che Đáp Án */}
          {blindRetryMode && !browseRevealed ? (
            <div className="bg-[#141b26] border border-dashed border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262730] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🪜</span>
                  <div>
                    <h4 className="text-white font-extrabold text-sm">
                      Thang Gợi Ý 3 Cấp Độ (Socratic Hint Ladder)
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Tự nhẩm và mở dần từng nấc gợi ý trước khi mở toàn bộ lời giải để rèn phản xạ tư duy độc lập
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Nấc: {hintStep === 0 ? 'Chưa mở' : hintStep === 1 ? 'Nấc 1 (Từ khóa)' : hintStep === 2 ? 'Nấc 2 (Bẫy)' : 'Nấc 3 (Mở tất cả)'}
                </span>
              </div>

              {/* Nấc 1: Từ khóa cốt lõi & Công thức */}
              {hintStep >= 1 && (
                <div className="bg-[#101723] border border-amber-500/30 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <span>💡 Nấc 1 — Gợi ý từ khóa &amp; Công thức cốt lõi:</span>
                  </div>
                  <div className="text-xs text-gray-200 flex flex-wrap gap-1.5 items-center">
                    <span className="text-gray-400">Chủ điểm:</span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                      {getHintLadderData(currentMistake).subject}
                    </span>
                    {getHintLadderData(currentMistake).keywords.map((kw, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                        #{kw}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-amber-200/90 bg-[#162032] p-2.5 rounded-lg border border-amber-500/20">
                    🔑 <strong>Công thức / Mẫu tư duy:</strong> {getHintLadderData(currentMistake).coreFormula}
                  </div>
                </div>
              )}

              {/* Nấc 2: Cảnh báo 2 đáp án nhiễu dễ sập bẫy */}
              {hintStep >= 2 && (
                <div className="bg-[#19101d] border border-rose-500/30 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200">
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <span>⚠️ Nấc 2 — Cảnh báo 2 đáp án nhiễu dễ sập bẫy:</span>
                  </div>
                  <ul className="text-xs text-rose-200/90 space-y-1.5 pl-2">
                    {getHintLadderData(currentMistake).trapWarnings.map((trap, tidx) => (
                      <li key={tidx} className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>
                          <strong className="text-white">Bẫy #{tidx + 1}:</strong> {trap}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-[11px] text-gray-400 italic">
                    💡 Mẹo loại trừ: {getHintLadderData(currentMistake).generalTip}
                  </div>
                </div>
              )}

              {/* Tùy chọn thử chọn phương án (+1 Tinh thể nếu đoán trúng) */}
              {currentMistake.choices && currentMistake.choices.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs text-gray-300 font-semibold flex items-center justify-between">
                    <span>🎯 Thử chọn đáp án bạn cho là đúng:</span>
                    <span className="text-[11px] text-amber-400 font-bold">+1 Tinh Thể nếu nhẩm đúng!</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentMistake.choices.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (browseGuess === c) return;
                          setBrowseGuess(c);
                          if (isMistakeAnswerCorrect(c, currentMistake.correct_choice)) {
                            awardMasteryShard(1, 'Xuất sắc! Nhẩm chính xác đáp án khi che đề! +1 Tinh Thể Phục Thù');
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                          browseGuess === c
                            ? 'bg-blue-600/30 border-blue-400 text-white font-bold'
                            : 'bg-[#131922] border-[#262730] text-gray-300 hover:bg-[#1f2937]'
                        }`}
                      >
                        <span className="font-bold text-amber-400 mr-2">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3 Nút kích hoạt Thang gợi ý */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setHintStep(prev => (prev < 1 ? 1 : prev))}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all border ${
                    hintStep >= 1
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-[#1b2533] text-gray-300 hover:text-white border-[#262730] hover:border-amber-500/40'
                  }`}
                >
                  {hintStep >= 1 ? '✓ Đã mở Nấc 1' : '💡 Mở Nấc 1 (Từ khóa)'}
                </button>

                <button
                  type="button"
                  disabled={hintStep < 1}
                  onClick={() => setHintStep(prev => (prev < 2 ? 2 : prev))}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all border ${
                    hintStep >= 2
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : hintStep >= 1
                      ? 'bg-[#1b2533] text-gray-300 hover:text-white border-[#262730] hover:border-rose-500/40'
                      : 'bg-[#1b2533]/40 text-gray-600 border-[#262730] cursor-not-allowed'
                  }`}
                >
                  {hintStep >= 2 ? '✓ Đã mở Nấc 2' : '⚠️ Mở Nấc 2 (Cảnh báo bẫy)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHintStep(3);
                    setBrowseRevealed(true);
                  }}
                  className="p-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md transition-all hover:scale-[1.02]"
                >
                  👁️ Mở Nấc 3: Hiện đáp án &amp; giải thích
                </button>
              </div>
            </div>
          ) : (
            /* Hiển thị đáp án & giải thích */
            <div className="space-y-4">
              {browseGuess && (
                <div
                  className={`p-3 rounded-lg border text-xs font-bold ${
                    isMistakeAnswerCorrect(browseGuess, currentMistake.correct_choice)
                      ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500 text-rose-300'
                  }`}
                >
                  {isMistakeAnswerCorrect(browseGuess, currentMistake.correct_choice)
                    ? '🎉 Xuất sắc! Bạn đã tự nhẩm đúng đáp án chuẩn!'
                    : `⚠️ Lần này bạn nhẩm "${browseGuess}". Hãy xem lời giải chi tiết bên dưới nhé.`}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[rgba(239,68,68,0.1)] border border-[#ef4444] p-4 rounded-xl">
                  <div className="text-[#ef4444] font-bold text-xs uppercase tracking-wide mb-1">
                    ❌ Đáp án bạn đã chọn:
                  </div>
                  <div className="text-sm text-gray-200">{currentMistake.user_choice || 'Không rõ'}</div>
                </div>
                <div className="bg-[rgba(16,185,129,0.1)] border border-[#10b981] p-4 rounded-xl">
                  <div className="text-[#10b981] font-bold text-xs uppercase tracking-wide mb-1">
                    ✅ Đáp án đúng:
                  </div>
                  <div className="text-sm text-gray-200">{currentMistake.correct_choice}</div>
                </div>
              </div>

              <div className="bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
                <h4 className="text-[#fbbf24] font-bold text-sm mb-2">💡 Giải thích chi tiết:</h4>
                <div className="text-sm text-[#e2e8f0] leading-relaxed">
                  {currentMistake.explanation}
                </div>
              </div>
            </div>
          )}

          {/* [Point 54] Nút Hỏi Gia sư AI & [Point 59] Luyện thêm kỹ năng */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* [Point 54] Nút Hỏi Gia sư AI */}
            <button
              type="button"
              onClick={() => {
                if (!aiTutorOpen) {
                  void handleAskAiTutor();
                } else {
                  setAiTutorOpen(false);
                }
              }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md transition-all flex items-center gap-1.5"
            >
              🤖 {aiTutorOpen ? 'Thu gọn Gia sư AI' : 'Hỏi Gia sư AI về câu sai này'}
            </button>

            {/* [Point 59] Nút Luyện thêm Kỹ năng tương tự */}
            {(currentMistake.skill || currentMistake.skill_id) && (
              <Link
                href={`/grind?skill=${encodeURIComponent(currentMistake.skill || currentMistake.skill_id || '')}`}
                className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                🎯 Luyện thêm kỹ năng này →
              </Link>
            )}
          </div>

          {/* [Point 54] Khung hiển thị Gia sư AI Socratic */}
          {aiTutorOpen && (
            <div className="bg-[#151c28] border border-purple-500/40 p-4 rounded-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                <span>🤖 Gia Sư AI Socratic — Nghia Guru Phân Tích</span>
                {aiLoading && <span className="animate-pulse">Đang suy nghĩ...</span>}
              </div>

              {aiExplanation ? (
                <div className="text-sm text-gray-200 whitespace-pre-line leading-relaxed bg-[#101723] p-3 rounded-lg border border-[#262730]">
                  {aiExplanation}
                </div>
              ) : (
                <div className="text-xs text-gray-400 py-3 text-center">
                  Đang khởi tạo lời giải thích chuyên sâu theo phương pháp Socratic...
                </div>
              )}

              {/* Khung đặt câu hỏi thêm cho AI */}
              <div className="flex gap-2 pt-2 border-t border-[#262730]">
                <input
                  type="text"
                  value={aiCustomQuestion}
                  onChange={e => setAiCustomQuestion(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && aiCustomQuestion.trim()) {
                      void handleAskAiTutor(aiCustomQuestion);
                    }
                  }}
                  placeholder="Hỏi thêm Gia sư: Em vẫn chưa hiểu tại sao..."
                  className="flex-1 bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                />
                <button
                  type="button"
                  disabled={aiLoading || !aiCustomQuestion.trim()}
                  onClick={() => handleAskAiTutor(aiCustomQuestion)}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  Gửi
                </button>
              </div>
            </div>
          )}

          {/* Thanh điều hướng câu trước / câu sau */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-[#262730]">
            <button
              type="button"
              onClick={handlePrev}
              disabled={safeCurrentIndex === 0}
              className="text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
            >
              ⬅️ Câu trước
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={safeCurrentIndex === filteredMistakes.length - 1}
              className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-6 py-2.5 rounded-xl transition-colors shadow-[0_0_12px_rgba(37,99,235,0.4)]"
            >
              Câu tiếp theo ➡️
            </button>
          </div>
        </div>
      )}
      {renderShardToast()}
    </div>
  );
}

export default MistakeNotebook;
