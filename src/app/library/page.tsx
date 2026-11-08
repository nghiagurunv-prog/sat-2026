'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';

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

  // Xử lý các ký tự toán học chuẩn
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

  // Chia nhỏ text nếu có chứa cú pháp phân số hoặc số mũ
  const renderFormattedTokens = (raw: string) => {
    const cleaned = cleanSymbols(raw);

    // Xử lý phân số dạng \frac{a}{b} hoặc (a)/(b)
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
        <span key={`frac-${match.index}`} className="inline-flex flex-col text-center align-middle mx-1.5 my-0.5 text-xs font-serif font-bold text-amber-200">
          <span className="border-b border-amber-300/60 px-1 leading-tight">{num}</span>
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

  // Xử lý số mũ x^2, x^{n+1} và chỉ số dưới x_1, x_{i}
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
          <sub key={`${keyPrefix}-sub-${m.index}`} className="text-[10px] text-blue-300 font-mono px-0.5">
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

  // Tách các đoạn công thức $...$ nếu có
  const segments = text.split(/(\$[^$]+\$)/g);

  return (
    <span className={`leading-relaxed ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.startsWith('$') && seg.endsWith('$') && seg.length > 2) {
          const mathInner = seg.slice(1, -1);
          return (
            <span
              key={idx}
              className="inline-flex items-center mx-1 px-1.5 py-0.5 rounded bg-[#0f172a] border border-amber-500/40 font-serif italic text-amber-200 text-sm align-baseline shadow-inner"
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

export default function LibraryPage() {
  // =========================================================================
  // POINT 99: LƯU & KHÔI PHỤC BỘ LỌC VÀ VỊ TRÍ CUỘN TRONG SESSIONSTORAGE
  // =========================================================================
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('Tất cả môn học');
  const [domain, setDomain] = useState('Tất cả chuyên đề');
  const [difficulty, setDifficulty] = useState('Tất cả độ khó');
  const [status, setStatus] = useState('Tất cả trạng thái');

  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedSubject, setAppliedSubject] = useState('Tất cả môn học');
  const [appliedDomain, setAppliedDomain] = useState('Tất cả chuyên đề');
  const [appliedDifficulty, setAppliedDifficulty] = useState('Tất cả độ khó');
  const [appliedStatus, setAppliedStatus] = useState('Tất cả trạng thái');

  // Khôi phục bộ lọc từ sessionStorage khi mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('sat_library_filters_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.query !== undefined) {
          setQuery(parsed.query);
          setAppliedQuery(parsed.query);
        }
        if (parsed.subject) {
          setSubject(parsed.subject);
          setAppliedSubject(parsed.subject);
        }
        if (parsed.domain) {
          setDomain(parsed.domain);
          setAppliedDomain(parsed.domain);
        }
        if (parsed.difficulty) {
          setDifficulty(parsed.difficulty);
          setAppliedDifficulty(parsed.difficulty);
        }
        if (parsed.status) {
          setStatus(parsed.status);
          setAppliedStatus(parsed.status);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Lưu bộ lọc vào sessionStorage mỗi khi áp dụng
  const saveFiltersToSession = (nextFilters: {
    query: string;
    subject: string;
    domain: string;
    difficulty: string;
    status: string;
  }) => {
    try {
      sessionStorage.setItem('sat_library_filters_v1', JSON.stringify(nextFilters));
    } catch {
      // ignore
    }
  };

  const [cards, setCards] = useState<QuestionCard[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // =========================================================================
  // POINT 95: ĐÁNH DẤU CÂU HỎI HAY / CẦN XEM LẠI (BOOKMARKED QUESTIONS ⭐)
  // =========================================================================
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem('sat_bookmarked_questions_v1');
      if (savedBookmarks) {
        const arr = JSON.parse(savedBookmarks);
        if (Array.isArray(arr)) setBookmarkedIds(new Set(arr));
      }
      const savedCompleted = localStorage.getItem('sat_completed_questions_v1');
      if (savedCompleted) {
        const arr = JSON.parse(savedCompleted);
        if (Array.isArray(arr)) setCompletedIds(new Set(arr));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      const isSaved = next.has(id);
      if (isSaved) {
        next.delete(id);
        showToast('Đã bỏ lưu câu hỏi');
      } else {
        next.add(id);
        showToast('⭐ Đã lưu vào Bộ sưu tập câu hỏi hay!');
      }
      try {
        localStorage.setItem('sat_bookmarked_questions_v1', JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Trạng thái làm bài
  const [active, setActive] = useState<ActiveExam | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // =========================================================================
  // POINTS 93 & 97: CHẾ ĐỘ XEM CHI TIẾT CÂU HỎI & BỐ CỤC MOBILE / IPAD
  // =========================================================================
  const [previewQuestion, setPreviewQuestion] = useState<QuestionCard | null>(null);

  // Nạp danh sách câu hỏi thật từ server khi mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/library');
        if (!res.ok) throw new Error('load failed');
        const data = await res.json();
        if (!cancelled) {
          const list = Array.isArray(data.questions) ? data.questions : [];
          setCards(list);

          // Khôi phục vị trí cuộn trang (Point 99)
          try {
            const savedScroll = sessionStorage.getItem('sat_library_scroll_v1');
            if (savedScroll) {
              setTimeout(() => {
                window.scrollTo({ top: Number(savedScroll), behavior: 'smooth' });
              }, 150);
            }
          } catch {
            // ignore
          }
        }
      } catch {
        if (!cancelled) setListError('Không tải được danh sách câu hỏi. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lưu vị trí cuộn trang trước khi rời hoặc mở bài thi (Point 99)
  const rememberScrollPosition = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sat_library_scroll_v1', String(window.scrollY));
      }
    } catch {
      // ignore
    }
  }, []);

  // Danh sách các chuyên đề (Domain) tự động tổng hợp từ dữ liệu
  const domainOptions = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      if (c.tag) set.add(c.tag);
    });
    return Array.from(set).sort();
  }, [cards]);

  // =========================================================================
  // POINT 94: BỘ LỌC ĐA TIÊU CHÍ (DOMAIN, DIFFICULTY, STATUS, QUERY, SUBJECT)
  // =========================================================================
  const results = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    return cards.filter((item) => {
      // 1. Lọc môn học
      const matchSubject = appliedSubject === 'Tất cả môn học' || item.subject === appliedSubject;

      // 2. Lọc chuyên đề (Domain / tag)
      const matchDomain = appliedDomain === 'Tất cả chuyên đề' || item.tag === appliedDomain;

      // 3. Lọc độ khó
      const matchDiff =
        appliedDifficulty === 'Tất cả độ khó' ||
        item.difficulty.toLowerCase().includes(appliedDifficulty.toLowerCase());

      // 4. Lọc trạng thái (Đã lưu / Chưa làm / Đã làm)
      let matchStatus = true;
      if (appliedStatus === '⭐ Đã đánh dấu') {
        matchStatus = bookmarkedIds.has(item.id);
      } else if (appliedStatus === 'Đã hoàn thành') {
        matchStatus = completedIds.has(item.id);
      } else if (appliedStatus === 'Chưa làm') {
        matchStatus = !completedIds.has(item.id);
      }

      // 5. Tìm kiếm từ khóa
      const matchQuery =
        q === '' ||
        item.text.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q);

      return matchSubject && matchDomain && matchDiff && matchStatus && matchQuery;
    });
  }, [appliedQuery, appliedSubject, appliedDomain, appliedDifficulty, appliedStatus, cards, bookmarkedIds, completedIds]);

  const handleSearch = () => {
    setAppliedQuery(query);
    setAppliedSubject(subject);
    setAppliedDomain(domain);
    setAppliedDifficulty(difficulty);
    setAppliedStatus(status);

    saveFiltersToSession({
      query,
      subject,
      domain,
      difficulty,
      status,
    });
  };

  const handleResetFilters = () => {
    setQuery('');
    setSubject('Tất cả môn học');
    setDomain('Tất cả chuyên đề');
    setDifficulty('Tất cả độ khó');
    setStatus('Tất cả trạng thái');

    setAppliedQuery('');
    setAppliedSubject('Tất cả môn học');
    setAppliedDomain('Tất cả chuyên đề');
    setAppliedDifficulty('Tất cả độ khó');
    setAppliedStatus('Tất cả trạng thái');

    saveFiltersToSession({
      query: '',
      subject: 'Tất cả môn học',
      domain: 'Tất cả chuyên đề',
      difficulty: 'Tất cả độ khó',
      status: 'Tất cả trạng thái',
    });
  };

  // Bấm "Làm bài": issue câu qua server → mở CorePracticeUI có tính giờ.
  const handleStart = async (id: string) => {
    rememberScrollPosition();
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
      setActive({ question: data.question, timeLimit: data.timeLimit });

      // Đánh dấu câu đã làm vào danh sách
      setCompletedIds((prev) => {
        const next = new Set(prev).add(id);
        try {
          localStorage.setItem('sat_completed_questions_v1', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    } catch {
      setStartError('Không thể bắt đầu làm bài. Vui lòng thử lại.');
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">

      {/* Floating Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-[#1e293b] border border-amber-400 text-amber-200 px-5 py-2.5 rounded-xl shadow-2xl font-medium text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-300">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📚</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #93c5fd, #60a5fa)", WebkitBackgroundClip: "text" }}>
              THƯ VIỆN ĐỀ THỰC CHIẾN
            </h1>
            <p className="math-subtitle text-blue-200">
              Kho đề luyện tập được phân loại theo kỹ năng, độ khó và trạng thái làm bài.
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* POINT 94: BỘ LỌC ĐA TIÊU CHÍ (CHUYÊN ĐỀ, ĐỘ KHÓ, TRẠNG THÁI, TÌM KIẾM) */}
      {/* =================================================================== */}
      <div className="bg-[#131c2a] border border-[#26354a] rounded-2xl p-5 shadow-lg space-y-4">
        {/* Row 1: Search & Action buttons */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Tìm theo nội dung câu hỏi, mã ID, từ khóa, nguồn đề..."
              aria-label="Tìm kiếm câu hỏi"
              className="w-full bg-[#1b2533] border border-[#334155] rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-amber-400 min-h-[44px] text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="flex-1 md:flex-none bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-[#78350f] px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 min-h-[44px] flex items-center justify-center gap-1.5 text-sm"
            >
              <span>🔍</span> Lọc kết quả
            </button>
            <button
              onClick={handleResetFilters}
              className="bg-[#1e293b] hover:bg-[#334155] text-gray-300 hover:text-white px-4 py-3 rounded-xl font-medium text-sm transition-colors border border-[#334155] min-h-[44px]"
              title="Đặt lại bộ lọc"
            >
              Đặt lại
            </button>
          </div>
        </div>

        {/* Row 2: Dropdown filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-[#1e293b]">
          {/* 1. Môn học */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">MÔN HỌC</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-amber-400 min-h-[40px]"
            >
              <option>Tất cả môn học</option>
              <option>Reading & Writing</option>
              <option>Math</option>
            </select>
          </div>

          {/* 2. Chuyên đề (Domain) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">CHUYÊN ĐỀ (DOMAIN)</label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-amber-400 min-h-[40px]"
            >
              <option>Tất cả chuyên đề</option>
              {domainOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* 3. Độ khó (Difficulty) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">ĐỘ KHÓ</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-amber-400 min-h-[40px]"
            >
              <option>Tất cả độ khó</option>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>

          {/* 4. Trạng thái (Status & Bookmarked ⭐) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">TRẠNG THÁI</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-amber-400 min-h-[40px]"
            >
              <option>Tất cả trạng thái</option>
              <option>⭐ Đã đánh dấu</option>
              <option>Chưa làm</option>
              <option>Đã hoàn thành</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Tags / Counter Bar */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>Tìm thấy: <strong className="text-amber-300">{results.length}</strong> câu hỏi</span>
            {bookmarkedIds.size > 0 && (
              <button
                onClick={() => {
                  setStatus('⭐ Đã đánh dấu');
                  setAppliedStatus('⭐ Đã đánh dấu');
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] border flex items-center gap-1 transition-colors ${
                  appliedStatus === '⭐ Đã đánh dấu'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-[#1e293b] text-gray-300 border-[#334155] hover:text-amber-300'
                }`}
              >
                <span>⭐ Đã đánh dấu:</span>
                <strong>{bookmarkedIds.size}</strong>
              </button>
            )}
          </div>
          <span className="text-[11px] text-gray-500">
            Mẹo: Nhấn nút 👁️ để xem dạng thức toán học chuẩn trước khi làm bài
          </span>
        </div>
      </div>

      {startError && (
        <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{startError}</span>
        </div>
      )}

      {/* Danh sách câu hỏi */}
      <div className="space-y-4">
        {loadingList ? (
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-10 text-center text-gray-400 animate-pulse">
            Đang tải dữ liệu thư viện câu hỏi...
          </div>
        ) : listError ? (
          <div className="bg-[#450a0a] border border-[#ef4444] rounded-xl p-8 text-center text-[#fca5a5]">
            {listError}
          </div>
        ) : results.length === 0 ? (
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-10 text-center text-gray-400 space-y-3">
            <div className="text-4xl">🔍</div>
            <p className="text-sm">Không tìm thấy câu hỏi nào phù hợp với bộ lọc hiện tại.</p>
            <button
              onClick={handleResetFilters}
              className="text-xs text-amber-400 underline hover:text-amber-300"
            >
              Xóa các bộ lọc để xem toàn bộ câu hỏi
            </button>
          </div>
        ) : (
          results.map((q) => {
            const isBookmarked = bookmarkedIds.has(q.id);
            const isCompleted = completedIds.has(q.id);

            return (
              <div
                key={q.id}
                className="bg-[#1b2533] border border-[#262730] rounded-2xl p-5 hover:border-amber-400/80 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group shadow-md"
              >
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                    {/* Bookmark Star Button (Point 95) */}
                    <button
                      onClick={(e) => toggleBookmark(q.id, e)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        isBookmarked
                          ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-sm'
                          : 'bg-[#141d2b] text-gray-400 border-[#2d3a4f] hover:text-amber-300'
                      }`}
                      title={isBookmarked ? 'Bỏ lưu câu hỏi' : 'Lưu câu hỏi hay ⭐'}
                      aria-label="Đánh dấu câu hỏi"
                    >
                      {isBookmarked ? '⭐' : '☆'}
                    </button>

                    <span className="bg-[#334155] text-white text-xs px-2.5 py-1 rounded-md font-mono font-medium">
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

                    {isCompleted && (
                      <span className="text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        ✓ Đã làm
                      </span>
                    )}
                  </div>

                  {/* Math Formatted Question Preview (Point 92) */}
                  <div className="text-[#e2e8f0] text-sm line-clamp-2 md:line-clamp-3 leading-relaxed">
                    <MathFormattedText text={q.text} />
                  </div>
                </div>

                {/* Touch-Friendly Action Buttons (Points 93 & 97) */}
                <div className="flex items-center gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-[#26354a]">
                  <button
                    onClick={() => {
                      rememberScrollPosition();
                      setPreviewQuestion(q);
                    }}
                    className="flex-1 md:flex-none bg-[#1e293b] hover:bg-[#2d3d54] text-gray-200 hover:text-white px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm border border-[#334155] transition-all min-h-[44px] flex items-center justify-center gap-1.5"
                    title="Xem chi tiết câu hỏi và công thức"
                  >
                    <span>👁️</span> Chi tiết
                  </button>

                  <button
                    onClick={() => handleStart(q.id)}
                    disabled={startingId !== null}
                    className="flex-1 md:flex-none bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#78350f] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all shadow-md active:scale-95 min-h-[44px] flex items-center justify-center gap-1.5"
                  >
                    {startingId === q.id ? '⏳ Đang mở...' : '🚀 Làm bài'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =================================================================== */}
      {/* POINTS 93 & 97: POPUP XEM CHI TIẾT CÂU HỎI & CÔNG THỨC TOÁN HỌC     */}
      {/* =================================================================== */}
      {previewQuestion && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewQuestion(null)}
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
                    {previewQuestion.subject}
                  </span>
                  <span className="text-amber-300 text-xs font-bold bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/30">
                    {previewQuestion.tag}
                  </span>
                  <span className="text-yellow-400 text-xs font-semibold">
                    🔥 {previewQuestion.difficulty}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Mã câu hỏi: #{previewQuestion.id}</span>
                </h3>
              </div>

              <button
                onClick={() => setPreviewQuestion(null)}
                className="text-gray-400 hover:text-white bg-[#1e293b] hover:bg-[#334155] p-2 rounded-lg border border-[#334155] transition-colors"
                aria-label="Đóng chi tiết"
              >
                ✕
              </button>
            </div>

            {/* Question Body with Full Math Formatting (Point 92) */}
            <div className="my-6 bg-[#162030] border border-[#2b394f] rounded-xl p-5 text-gray-100 text-base leading-relaxed">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">NỘI DUNG CÂU HỎI:</h4>
              <div className="prose prose-invert max-w-none">
                <MathFormattedText text={previewQuestion.text} />
              </div>
            </div>

            {/* Source info */}
            <div className="text-xs text-gray-400 mb-6 flex items-center justify-between">
              <span>Nguồn đề tài liệu: <strong className="text-gray-200">{previewQuestion.source}</strong></span>
              <span className="text-amber-400/80">Digital SAT Preparation Master</span>
            </div>

            {/* Large Touch Actions (Points 93 & 97) */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#1e293b]">
              <button
                onClick={() => toggleBookmark(previewQuestion.id)}
                className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 min-h-[48px] ${
                  bookmarkedIds.has(previewQuestion.id)
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                    : 'bg-[#1e293b] text-gray-200 border-[#334155] hover:text-amber-300'
                }`}
              >
                <span>{bookmarkedIds.has(previewQuestion.id) ? '⭐ Đã lưu trong Bộ sưu tập' : '☆ Lưu vào Bộ sưu tập'}</span>
              </button>

              <button
                onClick={() => {
                  const idToStart = previewQuestion.id;
                  setPreviewQuestion(null);
                  handleStart(idToStart);
                }}
                className="flex-1 bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-[#78350f] font-bold py-3 px-5 rounded-xl text-sm transition-all shadow-lg min-h-[48px] flex items-center justify-center gap-2"
              >
                <span>🚀 Bắt đầu làm câu này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal LÀM BÀI THẬT (có tính giờ) */}
      {active && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto my-8 bg-[#0e1117] border border-[#334155] rounded-2xl shadow-2xl p-6 relative">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-white">📝 Chế độ làm bài — tính giờ</h3>
              <button
                onClick={() => setActive(null)}
                className="text-gray-400 hover:text-white text-sm border border-gray-600 hover:bg-gray-800 px-3 py-1 rounded transition-colors"
              >
                ✕ Thoát
              </button>
            </div>
            <CorePracticeUI
              questionData={active.question}
              timeLimit={active.timeLimit}
              onNext={() => setActive(null)}
              hideNextUntilSubmitted
            />
          </div>
        </div>
      )}

    </div>
  );
}
