'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';

/**
 * ============================================================================
 * TRUNG TÂM ÔN TẬP PHỤC THÙ & NHẬT KÝ LỖI SAI 5 CHIỀU (MISTAKE REVIEW & REVENGE)
 * Thực thi các tiêu chuẩn cải tiến:
 * - #C022: Nhật ký Lỗi sai 5 Chiều (5-D Error Taxonomy)
 *          ⚡ Sai ngu/Đọc nhầm, 📐 Hổng kiến thức, 📕 Thiếu từ vựng,
 *          🪤 Sập bẫy College Board, ⏳ Thiếu thời gian
 *          Lưu vào localStorage ('sat_error_tags_v1') kèm Dashboard phân tích.
 * - #C023: Chu kỳ Ôn Phục Thù (1 – 3 – 7 – 14 ngày)
 *          Lọc danh sách câu sai theo hạn ôn tập Leitner & Spaced Repetition.
 *          Chế độ làm lại câu sai trực tiếp để xóa nợ lỗi sai.
 * ============================================================================
 */

export interface ReviewMistakeItem {
  id: string;
  question: string;
  passage?: string;
  choices: string[];
  correct_choice: string;
  user_choice?: string;
  explanation: string;
  trap_analysis?: string;
  skill_id?: string;
  subject?: 'math' | 'reading';
  box?: number; // 1, 2, 3, 4 tương ứng 1, 3, 7, 14 ngày
  next_review?: string;
  created_at?: string;
}

// 5 Chiều phân loại lỗi sai kinh điển SAT Digital (#C022)
const ERROR_TAXONOMY_5D = [
  {
    id: 'careless',
    label: '⚡ Sai ngu / Đọc nhầm',
    sub: 'Careless Misread',
    color: 'amber',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    barColor: 'bg-amber-400',
    desc: 'Đọc lướt bỏ sót từ "NOT", "except", dấu trừ hoặc nhầm lẫn đơn vị.',
  },
  {
    id: 'concept',
    label: '📐 Hổng kiến thức',
    sub: 'Concept / Formula Gap',
    color: 'purple',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    barColor: 'bg-purple-400',
    desc: 'Chưa vững công thức Toán, ngữ pháp dấu câu hoặc quy tắc lập luận.',
  },
  {
    id: 'vocab',
    label: '📕 Thiếu từ vựng',
    sub: 'Vocabulary Gap',
    color: 'blue',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    barColor: 'bg-blue-400',
    desc: 'Không nắm nghĩa của từ khóa hiếm hoặc nghĩa bóng trong văn cảnh.',
  },
  {
    id: 'trap',
    label: '🪤 Sập bẫy College Board',
    sub: 'Distractor Trap',
    color: 'orange',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    barColor: 'bg-orange-400',
    desc: 'Bị dụ bởi đáp án nhiễu có vẻ đúng một phần hoặc dùng từ quá cực đoan.',
  },
  {
    id: 'time',
    label: '⏳ Thiếu thời gian',
    sub: 'Time Pressure',
    color: 'rose',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    barColor: 'bg-rose-400',
    desc: 'Hết giờ phải chọn vội hoặc hoảng loạn khi còn dưới 1 phút.',
  },
] as const;

export type ErrorTagId = (typeof ERROR_TAXONOMY_5D)[number]['id'];

// Kho dữ liệu hạt giống mẫu khi chưa có lịch sử
const SEED_REVIEW_MISTAKES: ReviewMistakeItem[] = [
  {
    id: 'm1',
    question: 'Cho hệ phương trình:\n  $2x - 3y = 7$\n  $kx + 6y = -14$\nTìm giá trị của k để hệ phương trình trên có VÔ SỐ NGHIỆM.',
    choices: ['A. k = -4', 'B. k = 4', 'C. k = -2', 'D. k = 6'],
    correct_choice: 'A',
    user_choice: 'B',
    explanation: 'Để hệ có vô số nghiệm: 2/k = -3/6 = 7/(-14). Vì -3/6 = -1/2 và 7/(-14) = -1/2, ta suy ra 2/k = -1/2 ⇒ k = -4.',
    trap_analysis: 'Bẫy College Board: Rất nhiều học sinh bỏ quên dấu âm ở -14 hoặc quên rằng hệ số y ở phương trình 2 là +6 trong khi ở pt 1 là -3, dẫn đến chọn nhầm k = +4.',
    skill_id: 'algebra.systems',
    subject: 'math',
    box: 1,
    next_review: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'm2',
    question: 'The author\'s primary purpose in mentioning the "sedimentary isotopic ratios" in lines 34-36 is to:',
    choices: [
      'A. prove conclusively that previous archaeological timelines were completely fabricated.',
      'B. provide empirical corroboration for the continued cultivation hypothesis.',
      'C. refute the utility of modern geological dating techniques in historic settlements.',
      'D. introduce an unresolved paradox regarding volcanic eruptions.'
    ],
    correct_choice: 'B',
    user_choice: 'A',
    explanation: 'Đáp án B chuẩn xác vì tỷ lệ đồng vị trầm tích đóng vai trò bằng chứng thực nghiệm (empirical corroboration) chứng minh giả thuyết canh tác liên tục.',
    trap_analysis: 'Bẫy Extreme Wording: Đáp án A dùng từ cực đoan "completely fabricated" (hoàn toàn bịa đặt) - đây là bẫy kinh điển của College Board, văn bản học thuật SAT hiếm khi kết luận cực đoan như vậy.',
    skill_id: 'craft.structure',
    subject: 'reading',
    box: 2,
    next_review: new Date(Date.now() + 86400000 * 2).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'm3',
    question: 'Although the team experienced multiple logistical setbacks, ________ commitment to precision ensured the project\'s eventual triumph.',
    choices: ['A. their', 'B. they\'re', 'C. its', 'D. it\'s'],
    correct_choice: 'C',
    user_choice: 'A',
    explanation: 'Trong ngữ pháp SAT chuẩn, "team" là danh từ tập hợp số ít (collective singular noun). Do đó tính từ sở hữu tương ứng bắt buộc phải là "its", không được dùng "their" hay "they\'re".',
    trap_analysis: 'Bẫy Pronoun Agreement: Trong khẩu ngữ tiếng Anh hằng ngày ta hay gọi nhóm là "their", nhưng chuẩn College Board coi tập hợp danh từ số ít đòi hỏi đại từ "its".',
    skill_id: 'conventions.agreement',
    subject: 'reading',
    box: 1,
    next_review: new Date().toISOString(),
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'm4',
    question: 'Một hình nón có bán kính đáy $r = 6$ cm và chiều cao $h = 8$ cm. Diện tích xung quanh của hình nón đó bằng bao nhiêu $\\pi$ $\\text{cm}^2$?',
    choices: ['A. 48', 'B. 60', 'C. 96', 'D. 100'],
    correct_choice: 'B',
    user_choice: 'A',
    explanation: 'Đường sinh l = √(r² + h²) = √(6² + 8²) = 10 cm. Diện tích xung quanh hình nón: S_xq = π × r × l = π × 6 × 10 = 60π. Do đó số cần điền là 60.',
    trap_analysis: 'Bẫy Sai Ngu / Nhầm Công Thức: Học sinh thường lấy ngay bán kính nhân chiều cao: 6 × 8 = 48π mà quên tính độ dài đường sinh l theo định lý Pythagoras.',
    skill_id: 'geometry.3d',
    subject: 'math',
    box: 3,
    next_review: new Date(Date.now() + 86400000 * 5).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  }
];

const ERROR_TAGS_STORAGE_KEY = 'sat_error_tags_v1';

export default function ReviewPage() {
  const { showToast } = useToast();

  const [mistakes, setMistakes] = useState<ReviewMistakeItem[]>(SEED_REVIEW_MISTAKES);
  const [errorTags, setErrorTags] = useState<Record<string, ErrorTagId>>({
    m1: 'careless',
    m2: 'trap',
    m3: 'concept',
    m4: 'careless',
  });

  // #C022: Lọc theo nhãn lỗi 5D
  const [selectedTagFilter, setSelectedTagFilter] = useState<'all' | ErrorTagId>('all');

  // #C023: Lọc theo chu kỳ ôn phục thù (1, 3, 7, 14 ngày)
  const [selectedCycleFilter, setSelectedCycleFilter] = useState<'all' | 'due' | 'box1' | 'box2' | 'box3' | 'box4'>('all');

  // Chế độ Phục Thù Trực Tiếp (Revenge Drill Active)
  const [activeRevengeItem, setActiveRevengeItem] = useState<ReviewMistakeItem | null>(null);

  // Khởi tạo đọc từ LocalStorage & API
  useEffect(() => {
    try {
      const savedTags = localStorage.getItem(ERROR_TAGS_STORAGE_KEY);
      if (savedTags) {
        setErrorTags((prev) => ({ ...prev, ...JSON.parse(savedTags) }));
      }
    } catch (e) {
      console.error('Lỗi đọc nhãn lỗi sai:', e);
    }

    // Tải từ /api/cau-sai nếu có
    (async () => {
      try {
        const res = await fetch('/api/cau-sai');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Chuẩn hóa vào mistakes
            const normalized: ReviewMistakeItem[] = data.map((d: any, idx: number) => ({
              id: d.id || `api_m_${idx}`,
              question: d.question,
              passage: d.passage,
              choices: d.choices || [],
              correct_choice: d.correct_choice || 'A',
              user_choice: d.user_choice,
              explanation: d.explanation || 'Chưa có phân tích chi tiết.',
              trap_analysis: d.trap || 'Bẫy đề thi cần chú ý đọc kỹ yêu cầu.',
              skill_id: d.skill_id,
              subject: d.subject?.toLowerCase().includes('math') ? 'math' : 'reading',
              box: d.box || 1,
              next_review: d.next_review || new Date().toISOString(),
              created_at: d.created_at || new Date().toISOString(),
            }));
            setMistakes(normalized);
          }
        }
      } catch {
        // Dự phòng SEED_REVIEW_MISTAKES
      }
    })();
  }, []);

  // Gán nhãn lỗi 5 chiều cho 1 câu sai
  const handleSetErrorTag = (mistakeId: string, tagId: ErrorTagId) => {
    const updated = { ...errorTags, [mistakeId]: tagId };
    setErrorTags(updated);
    try {
      localStorage.setItem(ERROR_TAGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignored
    }
    const found = ERROR_TAXONOMY_5D.find((t) => t.id === tagId);
    showToast(`Đã gán nhãn: ${found?.label}`, 'success');
  };

  // #C022: Tính toán thống kê 5 chiều
  const errorStats = useMemo(() => {
    const counts: Record<ErrorTagId, number> = {
      careless: 0,
      concept: 0,
      vocab: 0,
      trap: 0,
      time: 0,
    };
    let taggedCount = 0;

    mistakes.forEach((m) => {
      const tag = errorTags[m.id];
      if (tag && counts[tag] !== undefined) {
        counts[tag]++;
        taggedCount++;
      }
    });

    return { counts, total: mistakes.length, taggedCount };
  }, [mistakes, errorTags]);

  // #C023: Phân loại câu theo chu kỳ phục thù
  const cycleCounts = useMemo(() => {
    const now = Date.now();
    let dueCount = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;

    mistakes.forEach((m) => {
      const reviewTime = m.next_review ? new Date(m.next_review).getTime() : 0;
      if (reviewTime <= now) dueCount++;

      const box = m.box || 1;
      if (box === 1) b1++;
      else if (box === 2) b2++;
      else if (box === 3) b3++;
      else b4++;
    });

    return { dueCount, b1, b2, b3, b4, total: mistakes.length };
  }, [mistakes]);

  // Lọc danh sách hiển thị
  const filteredMistakes = useMemo(() => {
    const now = Date.now();
    return mistakes.filter((m) => {
      // Lọc theo tag 5D
      if (selectedTagFilter !== 'all') {
        const tag = errorTags[m.id];
        if (tag !== selectedTagFilter) return false;
      }

      // Lọc theo chu kỳ ôn
      if (selectedCycleFilter === 'due') {
        const reviewTime = m.next_review ? new Date(m.next_review).getTime() : 0;
        if (reviewTime > now) return false;
      } else if (selectedCycleFilter === 'box1') {
        if ((m.box || 1) !== 1) return false;
      } else if (selectedCycleFilter === 'box2') {
        if ((m.box || 1) !== 2) return false;
      } else if (selectedCycleFilter === 'box3') {
        if ((m.box || 1) !== 3) return false;
      } else if (selectedCycleFilter === 'box4') {
        if ((m.box || 1) < 4) return false;
      }

      return true;
    });
  }, [mistakes, errorTags, selectedTagFilter, selectedCycleFilter]);

  // Chuyển sang câu luyện phục thù
  const handleStartRevenge = (item: ReviewMistakeItem) => {
    setActiveRevengeItem(item);
  };

  // Chuyển đổi mistake sang PracticeQuestion cho CorePracticeUI
  const revengePracticeQuestion: PracticeQuestion | null = useMemo(() => {
    if (!activeRevengeItem) return null;
    return {
      title: `⚔️ Phục Thù Lỗi Sai: ${activeRevengeItem.subject === 'math' ? 'Toán SAT' : 'Reading & Writing'}`,
      practice_question: activeRevengeItem.question,
      full_passage: activeRevengeItem.passage,
      choices: activeRevengeItem.choices,
      correct_choice: activeRevengeItem.correct_choice,
      explanation: activeRevengeItem.explanation,
      difficulty: 'hard',
      trapRate: 65,
      skillId: activeRevengeItem.skill_id,
    };
  }, [activeRevengeItem]);

  // Xử lý khi hoàn thành câu phục thù
  const handleRevengeAnswer = (isCorrect: boolean) => {
    if (!activeRevengeItem) return;
    if (isCorrect) {
      showToast('🎉 XUẤT SẮC! Bạn đã xóa sổ lỗi sai và thăng hạng cấp độ ghi nhớ!', 'success');
      // Thăng cấp box
      setMistakes((prev) =>
        prev.map((item) =>
          item.id === activeRevengeItem.id
            ? {
                ...item,
                box: Math.min(4, (item.box || 1) + 1),
                next_review: new Date(Date.now() + 86400000 * 3).toISOString(),
              }
            : item
        )
      );
    } else {
      showToast('⚠️ Vẫn chưa chuẩn! Câu này sẽ tiếp tục giữ ở Hộp 1 để ôn lại sớm.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 py-6 px-3 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
              📕 MISTAKE NOTEBOOK & REVENGE QUEUE
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              Tổng số: {mistakes.length} câu sai
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Nhật Ký Lỗi Sai 5 Chiều & Hàng Đợi Phục Thù
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Bóc tách nguồn gốc sai sót, chấm dứt tình trạng lặp lại bẫy cũ theo chu kỳ Spaced Repetition
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow"
          >
            <span>⚡</span>
            <span>Về Phòng Luyện Thích Ứng</span>
          </Link>
        </div>
      </div>

      {/* #C022: 5-D ERROR TAXONOMY DASHBOARD */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <div>
              <h2 className="text-sm font-black text-white">
                Bản Đồ Bóc Tách 5 Nguyên Nhân Sai Cốt Tử (5-D Taxonomy)
              </h2>
              <p className="text-xs text-slate-400">
                Hiểu rõ vì sao mình sai là 80% con đường tiến tới điểm 1550+
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Đã phân loại: <strong className="text-amber-400">{errorStats.taggedCount}</strong> / {errorStats.total} câu
          </div>
        </div>

        {/* 5-D Breakdown Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {ERROR_TAXONOMY_5D.map((t) => {
            const count = errorStats.counts[t.id];
            const pct = errorStats.total > 0 ? Math.round((count / errorStats.total) * 100) : 0;
            const isFilterActive = selectedTagFilter === t.id;

            return (
              <button
                key={t.id}
                onClick={() => setSelectedTagFilter(isFilterActive ? 'all' : t.id)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  isFilterActive
                    ? 'bg-slate-800/90 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-850'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-black text-white">{t.label}</span>
                    <span className="text-xs font-black text-amber-400">{pct}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-2 truncate">{t.sub}</div>
                </div>

                <div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mb-1.5">
                    <div
                      className={`h-full ${t.barColor} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold text-right">
                    {count} câu
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* #C023: CHU KỲ ÔN PHỤC THÙ (1 - 3 - 7 - 14 NGÀY) TABS */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">⏳</span>
            <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider">
              Chu Kỳ Ôn Phục Thù Spaced Repetition (Leitner)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Lịch ôn thưa dần giúp kiến thức chuyển từ trí nhớ ngắn hạn sang dài hạn
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            onClick={() => setSelectedCycleFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border ${
              selectedCycleFilter === 'all'
                ? 'bg-slate-700 text-white border-slate-600'
                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Tất Cả ({cycleCounts.total})
          </button>

          <button
            onClick={() => setSelectedCycleFilter('due')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border flex items-center gap-1.5 ${
              selectedCycleFilter === 'due'
                ? 'bg-rose-900/40 text-rose-200 border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'bg-slate-950/40 text-rose-300 border-slate-800 hover:text-rose-200'
            }`}
          >
            <span>🔥</span>
            <span>Đến Hạn Hôm Nay ({cycleCounts.dueCount})</span>
          </button>

          <button
            onClick={() => setSelectedCycleFilter('box1')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border ${
              selectedCycleFilter === 'box1'
                ? 'bg-amber-900/40 text-amber-200 border-amber-500/60'
                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Hộp 1 (Hạn 1 ngày) ({cycleCounts.b1})
          </button>

          <button
            onClick={() => setSelectedCycleFilter('box2')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border ${
              selectedCycleFilter === 'box2'
                ? 'bg-blue-900/40 text-blue-200 border-blue-500/60'
                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Hộp 2 (Hạn 3 ngày) ({cycleCounts.b2})
          </button>

          <button
            onClick={() => setSelectedCycleFilter('box3')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border ${
              selectedCycleFilter === 'box3'
                ? 'bg-purple-900/40 text-purple-200 border-purple-500/60'
                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Hộp 3 (Hạn 7 ngày) ({cycleCounts.b3})
          </button>

          <button
            onClick={() => setSelectedCycleFilter('box4')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border ${
              selectedCycleFilter === 'box4'
                ? 'bg-emerald-900/40 text-emerald-200 border-emerald-500/60'
                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Hộp 4 (Hạn 14 ngày - Mastered) ({cycleCounts.b4})
          </button>
        </div>
      </div>

      {/* MODAL / OVERLAY PHỤC THÙ TRỰC TIẾP */}
      {activeRevengeItem && revengePracticeQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚔️</span>
                <div>
                  <h3 className="text-sm font-black text-white">
                    PHIÊN PHỤC THÙ TRỰC TIẾP (REVENGE DRILL)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Làm lại câu sai để nâng cấp ghi nhớ hoặc xóa nợ khỏi Hộp 1
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveRevengeItem(null)}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                ✕ Đóng Phiên
              </button>
            </div>

            <CorePracticeUI
              questionData={revengePracticeQuestion}
              onNext={() => setActiveRevengeItem(null)}
              onAnswer={handleRevengeAnswer}
            />
          </div>
        </div>
      )}

      {/* DANH SÁCH CÂU SAI & BỘ GẮN NHÃN 5 CHIỀU */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase text-slate-300 tracking-wider flex items-center gap-2">
            <span>📋</span> Danh Sách Câu Sai ({filteredMistakes.length} câu phù hợp bộ lọc)
          </h2>
          {selectedTagFilter !== 'all' && (
            <button
              onClick={() => setSelectedTagFilter('all')}
              className="text-xs text-amber-400 hover:underline"
            >
              Xóa bộ lọc nhãn ✕
            </button>
          )}
        </div>

        {filteredMistakes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <h3 className="text-base font-bold text-white">Không có câu sai nào trong danh mục này!</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Bạn đã xử lý hết các câu đến hạn hoặc chưa có câu sai thuộc nhóm này. Hãy tiếp tục duy trì phong độ!
            </p>
            <Link
              href="/practice"
              className="inline-block mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Luyện Thêm Đề Mới
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMistakes.map((item, idx) => {
              const currentTagId = errorTags[item.id] || 'careless';
              const currentTag = ERROR_TAXONOMY_5D.find((t) => t.id === currentTagId);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 space-y-3 shadow-md hover:border-slate-700/80 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {item.subject === 'math' ? '📐 TOÁN' : '📖 R&W'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        Hộp {item.box || 1} (Chu kỳ {item.box === 1 ? '1 ngày' : item.box === 2 ? '3 ngày' : item.box === 3 ? '7 ngày' : '14 ngày'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartRevenge(item)}
                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow transition flex items-center gap-1.5"
                      >
                        <span>⚔️</span>
                        <span>Làm Lại Phục Thù</span>
                      </button>
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-serif whitespace-pre-line">
                    {item.question}
                  </div>

                  {/* User Choice vs Correct Choice */}
                  <div className="flex items-center gap-3 text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-rose-400 font-bold">
                      ❌ Bạn đã chọn: {item.user_choice || 'Chưa trả lời'}
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-emerald-400 font-bold">
                      ✅ Đáp án đúng: {item.correct_choice}
                    </span>
                  </div>

                  {/* Explanation & Trap */}
                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    <div>
                      <strong className="text-amber-300">🔍 Phân tích chi tiết: </strong>
                      {item.explanation}
                    </div>
                    {item.trap_analysis && (
                      <div className="text-orange-200/90 pt-1">
                        <strong className="text-orange-400">🪤 Bẫy đề thi: </strong>
                        {item.trap_analysis}
                      </div>
                    )}
                  </div>

                  {/* #C022: Bộ chọn gắn nhãn 5 chiều cho câu này */}
                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 font-medium">
                      Nhãn nguyên nhân sai (5-D):
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ERROR_TAXONOMY_5D.map((t) => {
                        const isCurrent = currentTagId === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleSetErrorTag(item.id, t.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                              isCurrent
                                ? `${t.badgeClass} shadow-[0_0_8px_rgba(255,255,255,0.15)] ring-1 ring-white/20`
                                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                            title={t.desc}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
