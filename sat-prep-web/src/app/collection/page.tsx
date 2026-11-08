'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { COSMETIC_CATALOG, seasonKey, tierPerkCosmeticIds, type CosmeticItem } from '@/lib/cosmetics';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';

// Thứ hạng gói để so điều kiện mở khóa (free < premium < ultimate).
const TIER_RANK: Record<string, number> = { free: 0, premium: 1, ultimate: 2 };

// Nhãn loại cosmetic cho phụ đề thẻ (thẩm mỹ + danh vọng, KHÔNG chỉ số).
const KIND_LABEL: Record<CosmeticItem['kind'], string> = {
  skin: 'Trang phục',
  theme: 'Chủ đề',
  frame: 'Khung viền',
  title: 'Danh hiệu',
};

type QuestionCard = {
  id: string;
  tag: string;
  text: string;
  source: string;
  subject: 'Reading & Writing' | 'Math';
  difficulty: string;
};

type ActiveExam = {
  question: PracticeQuestion;
  timeLimit: number;
};

// =========================================================================
// POINT 92: BỘ XỬ LÝ & ĐỊNH DẠNG BIỂU THỨC TOÁN HỌC, PHÂN SỐ, SỐ MŨ
// =========================================================================
function MathFormattedText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null;

  const cleanSymbols = (str: string) => {
    return str
      .replace(/\\ge/g, '≥')
      .replace(/\\le/g, '≤')
      .replace(/\\neq/g, '≠')
      .replace(/\\pm/g, '±')
      .replace(/\\pi/g, 'π')
      .replace(/\\times/g, '×')
      .replace(/\\approx/g, '≈')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  };

  const renderFormattedTokens = (raw: string) => {
    const cleaned = cleanSymbols(raw);
    const fracRegex = /\\frac\{([^}]+)\}\{([^}]+)\}|(\((?:[^()]+)\))\s*\/\s*(\((?:[^()]+)\))/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match;

    while ((match = fracRegex.exec(cleaned)) !== null) {
      if (match.index > lastIdx) {
        parts.push(renderSupSub(cleaned.slice(lastIdx, match.index), `sub-${lastIdx}`));
      }
      const num = match[1] || match[3]?.replace(/^\(|\)$/g, '');
      const den = match[2] || match[4]?.replace(/^\(|\)$/g, '');
      parts.push(
        <span key={`frac-${match.index}`} className="inline-flex flex-col text-center align-middle mx-1.5 my-0.5 text-xs font-serif font-bold text-purple-200">
          <span className="border-b border-purple-300/60 px-1 leading-tight">{num}</span>
          <span className="px-1 leading-tight">{den}</span>
        </span>
      );
      lastIdx = fracRegex.lastIndex;
    }

    if (lastIdx < cleaned.length) {
      parts.push(renderSupSub(cleaned.slice(lastIdx), `sub-tail`));
    }

    return parts;
  };

  const renderSupSub = (str: string, keyPrefix: string) => {
    const supSubRegex = /(\^\{[^}]+\}|\^[0-9a-zA-Z+-]+)|(_\{[^}]+\}|_[0-9a-zA-Z+-]+)/g;
    const tokens: React.ReactNode[] = [];
    let cur = 0;
    let m;

    while ((m = supSubRegex.exec(str)) !== null) {
      if (m.index > cur) {
        tokens.push(str.slice(cur, m.index));
      }
      if (m[1]) {
        const supVal = m[1].replace(/^\^\{?|\}?$/g, '');
        tokens.push(
          <sup key={`${keyPrefix}-sup-${m.index}`} className="text-[10px] text-amber-300 font-bold px-0.5">
            {supVal}
          </sup>
        );
      } else if (m[2]) {
        const subVal = m[2].replace(/^_{?|}?$/g, '');
        tokens.push(
          <sub key={`${keyPrefix}-sub-${m.index}`} className="text-[10px] text-purple-300 font-mono px-0.5">
            {subVal}
          </sub>
        );
      }
      cur = supSubRegex.lastIndex;
    }

    if (cur < str.length) {
      tokens.push(str.slice(cur));
    }
    return <span key={keyPrefix}>{tokens}</span>;
  };

  const segments = text.split(/(\$[^$]+\$)/g);

  return (
    <span className={`leading-relaxed ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.startsWith('$') && seg.endsWith('$') && seg.length > 2) {
          const mathInner = seg.slice(1, -1);
          return (
            <span
              key={idx}
              className="inline-flex items-center mx-1 px-1.5 py-0.5 rounded bg-[#1e1b4b] border border-purple-500/40 font-serif italic text-purple-200 text-sm align-baseline shadow-inner"
            >
              {renderFormattedTokens(mathInner)}
            </span>
          );
        }
        return <span key={idx}>{renderFormattedTokens(seg)}</span>;
      })}
    </span>
  );
}

export default function CollectionPage() {
  const { inventory, tier, ownedCosmetics } = useGamification();

  // =========================================================================
  // POINT 99: LƯU & KHÔI PHỤC TAB, BỘ LỌC VÀ CUỘN TRANG TRONG SESSIONSTORAGE
  // =========================================================================
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'cosmetics'>('bookmarks');

  // Filters for Bookmarked Questions (Point 94 & 95)
  const [qSearch, setQSearch] = useState('');
  const [qSubject, setQSubject] = useState('Tất cả môn học');
  const [qDomain, setQDomain] = useState('Tất cả chuyên đề');
  const [qDifficulty, setQDifficulty] = useState('Tất cả độ khó');

  // Filters for Cosmetics Catalog (Point 94)
  const [cosmeticSearch, setCosmeticSearch] = useState('');
  const [cosmeticKind, setCosmeticKind] = useState('Tất cả loại');
  const [cosmeticStatus, setCosmeticStatus] = useState('Tất cả trạng thái');
  const [cosmeticTier, setCosmeticTier] = useState('Tất cả gói');

  // Khôi phục từ sessionStorage khi load
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('sat_collection_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
        if (parsed.qSearch !== undefined) setQSearch(parsed.qSearch);
        if (parsed.qSubject) setQSubject(parsed.qSubject);
        if (parsed.qDomain) setQDomain(parsed.qDomain);
        if (parsed.qDifficulty) setQDifficulty(parsed.qDifficulty);
        if (parsed.cosmeticSearch !== undefined) setCosmeticSearch(parsed.cosmeticSearch);
        if (parsed.cosmeticKind) setCosmeticKind(parsed.cosmeticKind);
        if (parsed.cosmeticStatus) setCosmeticStatus(parsed.cosmeticStatus);
        if (parsed.cosmeticTier) setCosmeticTier(parsed.cosmeticTier);
      }

      const savedScroll = sessionStorage.getItem('sat_collection_scroll_v1');
      if (savedScroll) {
        setTimeout(() => {
          window.scrollTo({ top: Number(savedScroll), behavior: 'smooth' });
        }, 150);
      }
    } catch {
      // ignore
    }
  }, []);

  // Lưu trạng thái vào sessionStorage
  const saveCollectionState = useCallback((overrides?: Record<string, unknown>) => {
    try {
      const state = {
        activeTab,
        qSearch,
        qSubject,
        qDomain,
        qDifficulty,
        cosmeticSearch,
        cosmeticKind,
        cosmeticStatus,
        cosmeticTier,
        ...overrides,
      };
      sessionStorage.setItem('sat_collection_state_v1', JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [activeTab, qSearch, qSubject, qDomain, qDifficulty, cosmeticSearch, cosmeticKind, cosmeticStatus, cosmeticTier]);

  const handleTabChange = (tab: 'bookmarks' | 'cosmetics') => {
    setActiveTab(tab);
    saveCollectionState({ activeTab: tab });
  };

  const rememberScroll = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sat_collection_scroll_v1', String(window.scrollY));
      }
    } catch {
      // ignore
    }
  }, []);

  // =========================================================================
  // DỮ LIỆU CỔ VẬT & COSMETICS (GIỮ NGUYÊN 100% TÍNH NĂNG CŨ)
  // =========================================================================
  const ownedIds = new Set<string>([
    ...inventory.filter((i): i is string => typeof i === 'string'),
    ...tierPerkCosmeticIds(tier),
    ...ownedCosmetics,
  ]);

  const currentSeason = seasonKey(new Date().toISOString());
  const visibleCosmetics = COSMETIC_CATALOG.filter((c) => !c.season || c.season === currentSeason);

  // Bộ lọc mỹ phẩm (Point 94 áp dụng cho Catalog)
  const filteredCosmetics = useMemo(() => {
    const q = cosmeticSearch.trim().toLowerCase();
    return visibleCosmetics.filter((item) => {
      const owned = ownedIds.has(item.id);
      const tierOk = TIER_RANK[tier] >= TIER_RANK[item.requiredTier];
      const locked = !owned || !tierOk;

      const matchSearch = q === '' || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
      const matchKind = cosmeticKind === 'Tất cả loại' || KIND_LABEL[item.kind] === cosmeticKind;
      const matchStatus =
        cosmeticStatus === 'Tất cả trạng thái' ||
        (cosmeticStatus === 'Đã mở khóa' && !locked) ||
        (cosmeticStatus === 'Chưa mở khóa' && locked);
      const matchTier =
        cosmeticTier === 'Tất cả gói' ||
        item.requiredTier.toLowerCase() === cosmeticTier.toLowerCase();

      return matchSearch && matchKind && matchStatus && matchTier;
    });
  }, [visibleCosmetics, cosmeticSearch, cosmeticKind, cosmeticStatus, cosmeticTier, ownedIds, tier]);

  // =========================================================================
  // POINT 95: BỘ SƯU TẬP CÂU HỎI HAY ĐÃ ĐÁNH DẤU (BOOKMARKED QUESTIONS ⭐)
  // =========================================================================
  const [bookmarkedSet, setBookmarkedSet] = useState<Set<string>>(new Set());
  const [allQuestions, setAllQuestions] = useState<QuestionCard[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load bookmark IDs
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sat_bookmarked_questions_v1');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) setBookmarkedSet(new Set(arr));
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch câu hỏi từ API library
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/library');
        if (!res.ok) throw new Error('Failed to load questions');
        const data = await res.json();
        if (!cancelled && Array.isArray(data.questions)) {
          setAllQuestions(data.questions);
        }
      } catch {
        // Fallback placeholder questions if offline
        if (!cancelled && allQuestions.length === 0) {
          setAllQuestions([]);
        }
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        showToast('Đã xóa câu hỏi khỏi Bộ sưu tập');
      } else {
        next.add(id);
        showToast('⭐ Đã lưu câu hỏi vào Bộ sưu tập!');
      }
      try {
        localStorage.setItem('sat_bookmarked_questions_v1', JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Danh sách câu hỏi đã bookmark
  const bookmarkedQuestionsList = useMemo(() => {
    return allQuestions.filter((q) => bookmarkedSet.has(q.id));
  }, [allQuestions, bookmarkedSet]);

  // Danh sách Chuyên đề (Domain) từ các câu hỏi đã bookmark
  const questionDomainOptions = useMemo(() => {
    const set = new Set<string>();
    bookmarkedQuestionsList.forEach((q) => {
      if (q.tag) set.add(q.tag);
    });
    return Array.from(set).sort();
  }, [bookmarkedQuestionsList]);

  // =========================================================================
  // POINT 94: BỘ LỌC ĐA TIÊU CHÍ CHO BỘ SƯU TẬP CÂU HỎI
  // =========================================================================
  const filteredBookmarkedQuestions = useMemo(() => {
    const q = qSearch.trim().toLowerCase();
    return bookmarkedQuestionsList.filter((item) => {
      const matchSubject = qSubject === 'Tất cả môn học' || item.subject === qSubject;
      const matchDomain = qDomain === 'Tất cả chuyên đề' || item.tag === qDomain;
      const matchDiff =
        qDifficulty === 'Tất cả độ khó' ||
        item.difficulty.toLowerCase().includes(qDifficulty.toLowerCase());
      const matchSearch =
        q === '' ||
        item.text.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q);

      return matchSubject && matchDomain && matchDiff && matchSearch;
    });
  }, [bookmarkedQuestionsList, qSearch, qSubject, qDomain, qDifficulty]);

  // =========================================================================
  // POINTS 93 & 97: CHI TIẾT CÂU HỎI, TOÁN HỌC & LÀM BÀI TRỰC TIẾP
  // =========================================================================
  const [detailQuestion, setDetailQuestion] = useState<QuestionCard | null>(null);
  const [activePractice, setActivePractice] = useState<ActiveExam | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const handleStartQuestion = async (id: string) => {
    rememberScroll();
    setStartingId(id);
    setStartError(null);
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('start failed');
      const data = await res.json();
      setActivePractice({ question: data.question, timeLimit: data.timeLimit });
    } catch {
      setStartError('Không thể bắt đầu làm bài lúc này. Vui lòng thử lại sau.');
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 relative">

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-[#1e1b4b] border border-purple-400 text-purple-200 px-5 py-2.5 rounded-xl shadow-2xl font-medium text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-300">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div
        className="math-academy-header epic-shake-active shadow-xl"
        style={{ background: "linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%)" }}
      >
        <div className="math-title-container">
          <div className="math-icon">🗺️</div>
          <div>
            <h1
              className="math-title"
              style={{ background: "linear-gradient(to right, #e879f9, #c084fc)", WebkitBackgroundClip: "text" }}
            >
              BẢN ĐỒ SƯU TẬP & KHO BÁU
            </h1>
            <p className="math-subtitle text-purple-200">
              Lưu giữ những cổ vật vinh quang và kho tàng các câu hỏi hay tâm đắc nhất!
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TABS CHUYỂN ĐỔI: ⭐ CÂU HỎI ĐÃ ĐÁNH DẤU vs 🏆 CỔ VẬT & DANH HIỆU     */}
      {/* =================================================================== */}
      <div className="flex border-b border-[#334155] gap-4">
        <button
          onClick={() => handleTabChange('bookmarks')}
          className={`pb-3 px-4 font-bold text-sm sm:text-base transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'bookmarks'
              ? 'border-purple-400 text-purple-300'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>⭐ Bộ Sưu Tập Câu Hỏi Hay</span>
          <span className="bg-purple-900/60 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-500/30 font-mono">
            {bookmarkedSet.size}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('cosmetics')}
          className={`pb-3 px-4 font-bold text-sm sm:text-base transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'cosmetics'
              ? 'border-purple-400 text-purple-300'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>🏆 Cổ Vật & Danh Hiệu</span>
          <span className="bg-purple-900/60 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-500/30 font-mono">
            {ownedIds.size}/{visibleCosmetics.length}
          </span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: ⭐ BỘ SƯU TẬP CÂU HỎI HAY & ĐÃ ĐÁNH DẤU (POINTS 92-95, 97, 99) */}
      {/* =================================================================== */}
      {activeTab === 'bookmarks' && (
        <div className="space-y-6">
          {/* Point 94: Filter Box for Bookmarks */}
          <div className="bg-[#181a2f] border border-[#2d2f52] rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={qSearch}
                  onChange={(e) => {
                    setQSearch(e.target.value);
                    saveCollectionState({ qSearch: e.target.value });
                  }}
                  placeholder="Tìm trong danh sách câu hỏi đã lưu (từ khóa, mã ID, dạng đề)..."
                  className="w-full bg-[#111222] border border-[#33355c] rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 min-h-[44px] text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Link
                  href="/library"
                  className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm border border-purple-500/40 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <span>📚</span> Thêm câu hỏi từ Thư viện
                </Link>
                <button
                  onClick={() => {
                    setQSearch('');
                    setQSubject('Tất cả môn học');
                    setQDomain('Tất cả chuyên đề');
                    setQDifficulty('Tất cả độ khó');
                    saveCollectionState({
                      qSearch: '',
                      qSubject: 'Tất cả môn học',
                      qDomain: 'Tất cả chuyên đề',
                      qDifficulty: 'Tất cả độ khó',
                    });
                  }}
                  className="bg-[#242642] hover:bg-[#32355c] text-gray-300 px-4 py-3 rounded-xl font-medium text-xs sm:text-sm transition-colors border border-[#373a66] min-h-[44px]"
                >
                  Đặt lại
                </button>
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#2d2f52]">
              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">MÔN HỌC</label>
                <select
                  value={qSubject}
                  onChange={(e) => {
                    setQSubject(e.target.value);
                    saveCollectionState({ qSubject: e.target.value });
                  }}
                  className="w-full bg-[#111222] border border-[#33355c] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-400 min-h-[40px]"
                >
                  <option>Tất cả môn học</option>
                  <option>Reading & Writing</option>
                  <option>Math</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">CHUYÊN ĐỀ (DOMAIN)</label>
                <select
                  value={qDomain}
                  onChange={(e) => {
                    setQDomain(e.target.value);
                    saveCollectionState({ qDomain: e.target.value });
                  }}
                  className="w-full bg-[#111222] border border-[#33355c] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-400 min-h-[40px]"
                >
                  <option>Tất cả chuyên đề</option>
                  {questionDomainOptions.map((dom) => (
                    <option key={dom} value={dom}>{dom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">ĐỘ KHÓ</label>
                <select
                  value={qDifficulty}
                  onChange={(e) => {
                    setQDifficulty(e.target.value);
                    saveCollectionState({ qDifficulty: e.target.value });
                  }}
                  className="w-full bg-[#111222] border border-[#33355c] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-400 min-h-[40px]"
                >
                  <option>Tất cả độ khó</option>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-purple-300/80 pt-1 flex justify-between items-center flex-wrap gap-2">
              <span>Đang hiển thị <strong>{filteredBookmarkedQuestions.length}</strong> / <strong>{bookmarkedSet.size}</strong> câu hỏi đã đánh dấu</span>
              <span>⭐ Lưu lại các câu mẹo hay để ôn tập lại trước ngày thi</span>
            </div>
          </div>

          {startError && (
            <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{startError}</span>
            </div>
          )}

          {/* Bookmarked Questions List */}
          {loadingQuestions ? (
            <div className="bg-[#181a2f] border border-[#2d2f52] rounded-2xl p-10 text-center text-purple-300 animate-pulse">
              Đang tải dữ liệu câu hỏi sưu tập...
            </div>
          ) : bookmarkedSet.size === 0 ? (
            <div className="bg-[#181a2f] border border-[#2d2f52] rounded-2xl p-12 text-center text-gray-300 space-y-4 shadow-xl">
              <div className="text-5xl">⭐</div>
              <h3 className="text-lg font-bold text-white">Bạn chưa lưu câu hỏi nào vào Bộ sưu tập</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Khi duyệt kho đề ở Thư viện hoặc làm bài thi thử, hãy bấm vào biểu tượng ngôi sao <strong className="text-amber-300">⭐ Lưu câu hỏi</strong> để gom lại các câu hay, mẹo hay và xem lại tại đây!
              </p>
              <Link
                href="/library"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-[#78350f] font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg active:scale-95"
              >
                <span>📚</span> Khám phá Thư viện Đề ngay
              </Link>
            </div>
          ) : filteredBookmarkedQuestions.length === 0 ? (
            <div className="bg-[#181a2f] border border-[#2d2f52] rounded-2xl p-10 text-center text-gray-400 space-y-3">
              <div className="text-4xl">🔍</div>
              <p className="text-sm">Không tìm thấy câu hỏi nào trong bộ sưu tập phù hợp với bộ lọc hiện tại.</p>
              <button
                onClick={() => {
                  setQSearch('');
                  setQSubject('Tất cả môn học');
                  setQDomain('Tất cả chuyên đề');
                  setQDifficulty('Tất cả độ khó');
                }}
                className="text-xs text-purple-300 underline hover:text-purple-200"
              >
                Xóa bộ lọc để xem toàn bộ {bookmarkedSet.size} câu đã lưu
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookmarkedQuestions.map((q) => (
                <div
                  key={q.id}
                  className="bg-[#181a2f] border border-[#2d2f52] rounded-2xl p-5 hover:border-purple-400 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md group"
                >
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                      {/* Unbookmark button */}
                      <button
                        onClick={(e) => toggleBookmark(q.id, e)}
                        className="p-1.5 rounded-lg border bg-amber-400/20 text-amber-300 border-amber-400/50 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 transition-all"
                        title="Bỏ lưu khỏi Bộ sưu tập"
                        aria-label="Bỏ lưu câu hỏi"
                      >
                        ⭐
                      </button>

                      <span className="bg-[#242642] text-purple-200 text-xs px-2.5 py-1 rounded-md font-mono font-medium">
                        {q.subject}
                      </span>

                      <span className="text-amber-300 text-xs font-bold bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/30">
                        {q.tag}
                      </span>

                      <span className="text-gray-400 text-xs hidden sm:inline">
                        Nguồn: {q.source}
                      </span>

                      <span className="text-yellow-400 text-xs font-medium">
                        🔥 {q.difficulty}
                      </span>
                    </div>

                    {/* Point 92: Math Formatted Text */}
                    <div className="text-gray-200 text-sm line-clamp-2 md:line-clamp-3 leading-relaxed">
                      <MathFormattedText text={q.text} />
                    </div>
                  </div>

                  {/* Points 93 & 97: Large Touch Action Buttons */}
                  <div className="flex items-center gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-[#2d2f52]">
                    <button
                      onClick={() => {
                        rememberScroll();
                        setDetailQuestion(q);
                      }}
                      className="flex-1 md:flex-none bg-[#242642] hover:bg-[#32355c] text-purple-200 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm border border-[#373a66] transition-all min-h-[44px] flex items-center justify-center gap-1.5"
                    >
                      <span>👁️</span> Chi tiết
                    </button>

                    <button
                      onClick={() => handleStartQuestion(q.id)}
                      disabled={startingId !== null}
                      className="flex-1 md:flex-none bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all shadow-md active:scale-95 min-h-[44px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {startingId === q.id ? '⏳ Đang mở...' : '🚀 Luyện câu này'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: 🏆 CỔ VẬT & DANH HIỆU (COSMETICS CATALOG CŨ - BỔ SUNG FILTER)  */}
      {/* =================================================================== */}
      {activeTab === 'cosmetics' && (
        <div className="space-y-6">
          {/* Point 94: Filter for Cosmetics */}
          <div className="bg-[#181a2f] border border-[#2d2f52] rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={cosmeticSearch}
                  onChange={(e) => {
                    setCosmeticSearch(e.target.value);
                    saveCollectionState({ cosmeticSearch: e.target.value });
                  }}
                  placeholder="Tìm tên vật phẩm, khung viền, danh hiệu..."
                  className="w-full bg-[#111222] border border-[#33355c] rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 min-h-[44px] text-sm"
                />
              </div>

              <button
                onClick={() => {
                  setCosmeticSearch('');
                  setCosmeticKind('Tất cả loại');
                  setCosmeticStatus('Tất cả trạng thái');
                  setCosmeticTier('Tất cả gói');
                  saveCollectionState({
                    cosmeticSearch: '',
                    cosmeticKind: 'Tất cả loại',
                    cosmeticStatus: 'Tất cả trạng thái',
                    cosmeticTier: 'Tất cả gói',
                  });
                }}
                className="bg-[#242642] hover:bg-[#32355c] text-gray-300 px-4 py-3 rounded-xl font-medium text-xs sm:text-sm transition-colors border border-[#373a66] min-h-[44px]"
              >
                Đặt lại
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#2d2f52]">
              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">LOẠI VẬT PHẨM</label>
                <select
                  value={cosmeticKind}
                  onChange={(e) => {
                    setCosmeticKind(e.target.value);
                    saveCollectionState({ cosmeticKind: e.target.value });
                  }}
                  className="w-full bg-[#111222] border border-[#33355c] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-400 min-h-[40px]"
                >
                  <option>Tất cả loại</option>
                  <option>Trang phục</option>
                  <option>Chủ đề</option>
                  <option>Khung viền</option>
                  <option>Danh hiệu</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">TRẠNG THÁI</label>
                <select
                  value={cosmeticStatus}
                  onChange={(e) => {
                    setCosmeticStatus(e.target.value);
                    saveCollectionState({ cosmeticStatus: e.target.value });
                  }}
                  className="w-full bg-[#111222] border border-[#33355c] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-400 min-h-[40px]"
                >
                  <option>Tất cả trạng thái</option>
                  <option>Đã mở khóa</option>
                  <option>Chưa mở khóa</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">YÊU CẦU GÓI</label>
                <select
                  value={cosmeticTier}
                  onChange={(e) => {
                    setCosmeticTier(e.target.value);
                    saveCollectionState({ cosmeticTier: e.target.value });
                  }}
                  className="w-full bg-[#111222] border border-[#33355c] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-400 min-h-[40px]"
                >
                  <option>Tất cả gói</option>
                  <option value="premium">Premium</option>
                  <option value="ultimate">Ultimate</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cosmetics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {filteredCosmetics.map((item) => {
              const owned = ownedIds.has(item.id);
              const tierOk = TIER_RANK[tier] >= TIER_RANK[item.requiredTier];
              const locked = !owned || !tierOk;
              const tierLabel = item.requiredTier === 'ultimate' ? 'Ultimate' : 'Premium';

              return (
                <div
                  key={item.id}
                  className={`bg-[#1b2533] p-6 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    locked
                      ? 'border-[#334155] opacity-50 grayscale'
                      : `border-[#c084fc] shadow-[0_0_15px_rgba(192,132,252,0.2)] ${item.cssClass || ''}`
                  }`}
                >
                  <div className="text-5xl mb-4">{locked ? '🔒' : item.icon}</div>
                  <h3 className="text-white font-bold text-sm">{locked ? 'Chưa mở khóa' : item.name}</h3>
                  <span className="mt-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {KIND_LABEL[item.kind]} · {tierLabel}
                  </span>
                  {locked && !tierOk && (
                    <span className="mt-1 text-[10px] text-[#94a3b8]">Cần gói {tierLabel}</span>
                  )}
                  {!locked && (
                    <span className="mt-1 text-[10px] text-emerald-400 font-semibold">✓ Đã sở hữu</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* POINTS 93 & 97: MODAL XEM CHI TIẾT CÂU HỎI & CÔNG THỨC TOÁN HỌC     */}
      {/* =================================================================== */}
      {detailQuestion && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDetailQuestion(null)}
        >
          <div
            className="w-full max-w-3xl bg-[#0f172a] border border-[#334155] rounded-2xl shadow-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-[#1e293b] mb-4 gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="bg-[#334155] text-white text-xs px-2.5 py-1 rounded font-mono font-medium">
                    {detailQuestion.subject}
                  </span>
                  <span className="text-amber-300 text-xs font-bold bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/30">
                    {detailQuestion.tag}
                  </span>
                  <span className="text-yellow-400 text-xs font-semibold">
                    🔥 {detailQuestion.difficulty}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Mã câu hỏi: #{detailQuestion.id}</span>
                </h3>
              </div>

              <button
                onClick={() => setDetailQuestion(null)}
                className="text-gray-400 hover:text-white bg-[#1e293b] hover:bg-[#334155] p-2 rounded-lg border border-[#334155] transition-colors"
                aria-label="Đóng chi tiết"
              >
                ✕
              </button>
            </div>

            {/* Question Body with Full Math Formatting (Point 92) */}
            <div className="my-6 bg-[#162030] border border-[#2b394f] rounded-xl p-5 text-gray-100 text-base leading-relaxed">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-3">NỘI DUNG CÂU HỎI CHI TIẾT:</h4>
              <div className="prose prose-invert max-w-none">
                <MathFormattedText text={detailQuestion.text} />
              </div>
            </div>

            {/* Source info */}
            <div className="text-xs text-gray-400 mb-6 flex items-center justify-between">
              <span>Nguồn đề: <strong className="text-gray-200">{detailQuestion.source}</strong></span>
              <span className="text-purple-300">Bộ Sưu Tập Cá Nhân</span>
            </div>

            {/* Large Touch Actions (Points 93 & 97) */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#1e293b]">
              <button
                onClick={() => toggleBookmark(detailQuestion.id)}
                className="flex-1 py-3 px-5 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 min-h-[48px] bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20"
              >
                <span>✕ Xóa khỏi Bộ sưu tập</span>
              </button>

              <button
                onClick={() => {
                  const id = detailQuestion.id;
                  setDetailQuestion(null);
                  handleStartQuestion(id);
                }}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold py-3 px-5 rounded-xl text-sm transition-all shadow-lg min-h-[48px] flex items-center justify-center gap-2"
              >
                <span>🚀 Luyện tập câu hỏi này ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal LÀM BÀI TRỰC TIẾP TỪ BỘ SƯU TẬP */}
      {activePractice && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto my-8 bg-[#0e1117] border border-[#334155] rounded-2xl shadow-2xl p-6 relative">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-white">📝 Luyện tập câu hỏi từ Bộ sưu tập</h3>
              <button
                onClick={() => setActivePractice(null)}
                className="text-gray-400 hover:text-white text-sm border border-gray-600 hover:bg-gray-800 px-3 py-1 rounded transition-colors"
              >
                ✕ Thoát
              </button>
            </div>
            <CorePracticeUI
              questionData={activePractice.question}
              timeLimit={activePractice.timeLimit}
              onNext={() => setActivePractice(null)}
              hideNextUntilSubmitted
            />
          </div>
        </div>
      )}

    </div>
  );
}
