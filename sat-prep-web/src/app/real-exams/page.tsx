'use client';

/**
 * REAL EXAMS PAGE — VƯỢT VŨ MÔN THI THẬT (Point 70)
 * Bổ sung:
 * - Đọc lịch sử làm bài từ localStorage (`sat_exam_history_v1`)
 * - Bộ lọc 3 chế độ: "Tất cả đề" | "Chưa làm" | "Đã hoàn thành"
 * - Thẻ đề thi QAS hiển thị huy hiệu: Điểm cao nhất, Lần gần nhất, Số lần làm, Chênh lệch lần đầu - gần nhất
 * - Bảo toàn 100% logic phân quyền Ultimate tier & soft warning học thuật
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import ExamRunner from '@/components/ExamRunner';

export interface ExamStatSummary {
  bestScore: number;
  latestScore: number;
  firstScore: number;
  attemptsCount: number;
  delta: number;
  lastAttemptDate?: string;
}

export interface RealExamCard {
  id: string;
  code: string;
  title: string;
  session: string;
  difficulty: 'Chuẩn thi thật' | 'Phân hóa cao' | 'Rất khó';
  questionsCount: number;
  durationMinutes: number;
  description: string;
  source: string;
  tags: string[];
}

const REAL_EXAM_CATALOG: RealExamCard[] = [
  {
    id: 'sat-qas-2024-03',
    code: 'QAS-2024-03',
    title: 'Digital SAT Official — Tháng 03/2024',
    session: 'Đợt 1 Quốc tế',
    difficulty: 'Chuẩn thi thật',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Đề thi thật đợt Digital SAT quốc tế đầu tiên năm 2024. Phù hợp làm đề mốc để chuẩn đoán ban đầu.',
    source: 'Official QAS Released',
    tags: ['Đề thi thật', 'March 2024', 'College Board'],
  },
  {
    id: 'sat-qas-2024-05',
    code: 'QAS-2024-05',
    title: 'Digital SAT Official — Tháng 05/2024',
    session: 'Đợt 2 Toàn cầu',
    difficulty: 'Chuẩn thi thật',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Bài thi chính thức tháng 5 với độ phân hóa cao ở Module 2 Math phần Hình học giải tích không gian.',
    source: 'Official QAS Released',
    tags: ['Đề thi thật', 'May 2024', 'Phân hóa Math'],
  },
  {
    id: 'sat-qas-2024-06',
    code: 'QAS-2024-06',
    title: 'Digital SAT Official — Tháng 06/2024',
    session: 'Đợt 3 Mùa hè',
    difficulty: 'Phân hóa cao',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Đề thi kiểm tra độ chính xác phần Đọc hiểu Văn học cổ điển và từ vựng trong văn cảnh phức hợp.',
    source: 'Official QAS Released',
    tags: ['Đề thi thật', 'June 2024', 'Từ vựng ngữ cảnh'],
  },
  {
    id: 'sat-qas-2024-08',
    code: 'QAS-2024-08',
    title: 'Digital SAT Official — Tháng 08/2024',
    session: 'Đợt 4 Tựu trường',
    difficulty: 'Chuẩn thi thật',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Đề thi tháng 8 được đánh giá chuẩn mực nhất về thang điểm đường cong (curve), sát kỳ thi thực tế.',
    source: 'Official QAS Released',
    tags: ['Đề thi thật', 'August 2024', 'Standard Curve'],
  },
  {
    id: 'sat-qas-2024-10',
    code: 'QAS-2024-10',
    title: 'Digital SAT Official — Tháng 10/2024',
    session: 'Đợt 5 Early Action',
    difficulty: 'Phân hóa cao',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Kỳ thi quan trọng của học sinh nộp hồ sơ sớm đợt Early Action, mật độ câu hỏi logic cao.',
    source: 'Official QAS Released',
    tags: ['Đề thi thật', 'October 2024', 'Early Action'],
  },
  {
    id: 'sat-qas-2024-11',
    code: 'QAS-2024-11',
    title: 'Digital SAT Official — Tháng 11/2024',
    session: 'Đợt 6 Cuối năm',
    difficulty: 'Rất khó',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Đề thi thử thách với các dạng bài toán thực tế đa bước giải và văn bản so sánh hai quan điểm.',
    source: 'Official QAS Released',
    tags: ['Đề thi thật', 'November 2024', 'Thử thách 1500+'],
  },
];

type FilterMode = 'all' | 'unattempted' | 'completed';

export default function RealExamsPage() {
  const { level, tier, gamificationLoaded } = useGamification();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('sat-qas-2024-03');
  const [historyMap, setHistoryMap] = useState<Record<string, ExamStatSummary>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Point 70: Đọc & đồng bộ lịch sử thi thật từ cả 2 khóa localStorage ('sat_exam_history_v1' & 'sat_exam_history_log_v1')
  useEffect(() => {
    try {
      const stats: Record<string, ExamStatSummary> = {};
      const grouped: Record<string, Array<{ score: number; timestamp: number; date?: string }>> = {};

      const ingestItem = (item: any) => {
        if (!item || typeof item !== 'object') return;
        const examId = String(item.examId || item.id || item.testId || '').trim().toLowerCase();
        if (!examId) return;
        const score = Number(item.score ?? item.totalScore ?? 0);
        const ts = Number((item.timestamp ?? (item.date ? new Date(item.date).getTime() : 0)) || Date.now());
        const dateStr = item.date ? String(item.date) : new Date(ts).toLocaleDateString('vi-VN');
        if (!grouped[examId]) grouped[examId] = [];
        grouped[examId].push({ score, timestamp: ts, date: dateStr });
      };

      const parseStorage = (key: string) => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(ingestItem);
          } else if (typeof parsed === 'object' && parsed !== null) {
            Object.entries(parsed).forEach(([key, val]) => {
              const cleanKey = key.trim().toLowerCase();
              if (Array.isArray(val)) {
                val.forEach((item) => ingestItem({ ...item, examId: item.examId || cleanKey }));
              } else if (typeof val === 'object' && val !== null) {
                const v = val as any;
                ingestItem({ ...v, examId: v.examId || cleanKey });
              }
            });
          }
        } catch (e) {
          console.warn(`Lỗi đọc ${key}:`, e);
        }
      };

      // Đọc đồng bộ từ cả 2 khóa lưu trữ
      parseStorage('sat_exam_history_v1');
      parseStorage('sat_exam_history_log_v1');

      Object.entries(grouped).forEach(([id, attempts]) => {
        if (attempts.length === 0) return;
        const uniqueAttempts = Array.from(
          new Map(attempts.map((a) => [`${a.score}-${Math.round(a.timestamp / 1000)}`, a])).values()
        );
        uniqueAttempts.sort((a, b) => a.timestamp - b.timestamp);
        const firstScore = uniqueAttempts[0].score;
        const latestScore = uniqueAttempts[uniqueAttempts.length - 1].score;
        const bestScore = Math.max(...uniqueAttempts.map((a) => a.score));
        stats[id] = {
          bestScore,
          latestScore,
          firstScore,
          attemptsCount: uniqueAttempts.length,
          delta: latestScore - firstScore,
          lastAttemptDate: uniqueAttempts[uniqueAttempts.length - 1].date,
        };
      });

      setHistoryMap(stats);
    } catch (err) {
      console.warn('Lỗi đọc sat_exam_history:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const getExamStats = (exam: RealExamCard): ExamStatSummary | null => {
    const key1 = exam.id.toLowerCase();
    const key2 = exam.code.toLowerCase();
    return historyMap[key1] || historyMap[key2] || null;
  };

  const filteredExams = useMemo(() => {
    return REAL_EXAM_CATALOG.filter((exam) => {
      const stats = getExamStats(exam);
      const isCompleted = !!stats && stats.attemptsCount > 0;
      if (filter === 'completed') return isCompleted;
      if (filter === 'unattempted') return !isCompleted;
      return true;
    });
  }, [filter, historyMap]);

  const totalExamsCount = REAL_EXAM_CATALOG.length;
  const completedCount = useMemo(() => {
    return REAL_EXAM_CATALOG.filter((exam) => {
      const stats = getExamStats(exam);
      return !!stats && stats.attemptsCount > 0;
    }).length;
  }, [historyMap]);
  const unattemptedCount = totalExamsCount - completedCount;

  // Lấy thông tin bài thi QAS đang được người dùng lựa chọn
  const selectedExam = useMemo(() => {
    return REAL_EXAM_CATALOG.find((e) => e.id === selectedExamId) || REAL_EXAM_CATALOG[0];
  }, [selectedExamId]);

  const scrollToRunner = () => {
    const el = document.getElementById('exam-runner-workspace');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!gamificationLoaded) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">
        <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)" }}>
          <div className="math-title-container">
            <div className="math-icon">🎓</div>
            <div>
              <h1 className="math-title" style={{ background: "linear-gradient(to right, #c084fc, #fbcfe8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VƯỢT VŨ MÔN THI THẬT</h1>
              <p className="math-subtitle text-pink-200">Đang kiểm tra quyền truy cập...</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1b2533] border border-[#262730] p-8 rounded-lg text-center text-gray-400">
          Đang tải trạng thái gói học...
        </div>
      </div>
    );
  }

  // Gate UX sớm: server /api/exam-session/start MỚI là nguồn quyết định (gate
  // tier === 'ultimate' VÀ level >= 7). Đây chỉ lớp chặn sớm để không cho user
  // bấm rồi mới nhận 403. Thứ tự: tier trước (Premium chưa đủ → upsell Ultimate),
  // rồi capability (đã Ultimate nhưng chưa đủ skill).
  if (tier !== 'ultimate') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">
        <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)" }}>
          <div className="math-title-container">
            <div className="math-icon">🎓</div>
            <div>
              <h1 className="math-title" style={{ background: "linear-gradient(to right, #c084fc, #fbcfe8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VƯỢT VŨ MÔN THI THẬT</h1>
              <p className="math-subtitle text-pink-200">Kỳ thi quyết định! Chúc chiến binh đạt điểm tối đa!</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1b2533] border border-[#a855f7]/50 text-[#e9d5ff] p-6 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.2)]">
          <h3 className="font-bold text-xl mb-2 flex items-center gap-2">👑 Thi Thật QAS — quyền lợi gói Ultimate</h3>
          <p className="text-sm leading-relaxed text-[#cbb6e6]">
            Bộ đề thi thật (QAS / Past Papers) mô phỏng sát đề thi SAT thật, chỉ mở khóa cho học viên gói Ultimate.
            Nâng cấp lên Ultimate để luyện với đề thật và bảo vệ nguồn tài nguyên Học viện.
          </p>
          <Link href="/upgrade?from=real-exams&unlock=ultimate" className="inline-block mt-4 text-sm font-bold bg-gradient-to-r from-yellow-300 to-amber-500 text-[#78350f] px-5 py-2.5 rounded-lg hover:from-yellow-200 hover:to-amber-400 shadow-lg">
            Nâng cấp lên Ultimate →
          </Link>
        </div>
      </div>
    );
  }

  // Học viên đã có gói Ultimate: Hiển thị Cảnh báo khuyên dùng (Soft Warning) nếu chưa đạt Cấp 7,
  // nhưng KHÔNG khóa cứng để học viên vừa nâng cấp gói VIP có thể thi thử QAS ngay lập tức.
  const masteredCount = Math.max(0, level - 1);

  return (
    <div className="space-y-6">
      {level < 7 && (
        <div className="bg-amber-950/40 border border-amber-500/40 text-amber-100 p-4 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.12)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm sm:text-base flex items-center gap-2 text-amber-300">
              <span>💡 Khuyến nghị học thuật (Cấp {level}/7 · {masteredCount}/6 kỹ năng)</span>
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-amber-100/90">
              Để đạt điểm tối ưu với Đề Thi Thật QAS, lộ trình khuyến nghị bạn tinh thông 6 kỹ năng nền tảng trước.
              Tuy nhiên với đặc quyền <strong>Ultimate</strong>, bạn có thể bấm làm đề Thi Thật ngay bên dưới bất cứ lúc nào.
            </p>
          </div>
          <Link
            href="/skill-tree"
            className="shrink-0 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 px-4 py-2 rounded-lg transition"
          >
            🌳 Luyện Cây Năng Lực ({masteredCount}/6) →
          </Link>
        </div>
      )}

      {/* Point 70: Bảng Lịch sử & Bộ Lọc Thẻ Đề Thi Thật QAS */}
      <section className="bg-gradient-to-br from-[#1c1335] to-[#120d24] border border-purple-500/30 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-purple-900/50">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-300 text-xs font-semibold mb-2">
              <span>👑 POINT 70 · KHO ĐỀ THI THẬT CHÍNH THỨC</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>📜 Lịch Sử & Tiến Trình Đề Thi Thật QAS</span>
            </h2>
            <p className="text-sm text-purple-200/80 mt-1">
              Kho đề gốc QAS từ các kỳ thi Digital SAT quốc tế. Đánh giá chính xác phong độ trước kỳ thi bước ngoặt.
            </p>
          </div>

          {/* Huy hiệu tổng quan */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#241743]/90 border border-purple-800/80 rounded-xl px-4 py-2.5 text-center">
              <span className="block text-xs text-purple-300/70">Đã Hoàn Thành</span>
              <span className="text-lg font-black text-emerald-400">
                {isLoaded ? completedCount : 0}/{totalExamsCount}
              </span>
            </div>
            <div className="bg-[#241743]/90 border border-purple-800/80 rounded-xl px-4 py-2.5 text-center">
              <span className="block text-xs text-purple-300/70">Chưa Làm</span>
              <span className="text-lg font-black text-purple-300">
                {isLoaded ? unattemptedCount : totalExamsCount}
              </span>
            </div>
          </div>
        </div>

        {/* Thanh Bộ Lọc: Tất cả / Chưa làm / Đã hoàn thành */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
          <div className="inline-flex p-1 bg-purple-950/60 rounded-xl border border-purple-800/50">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                filter === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              Tất cả đề ({totalExamsCount})
            </button>
            <button
              onClick={() => setFilter('unattempted')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                filter === 'unattempted'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              Chưa làm ({unattemptedCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                filter === 'completed'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              Đã hoàn thành ({completedCount})
            </button>
          </div>

          <div className="text-xs text-purple-300/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            <span>Đặc quyền trọn đời gói Ultimate</span>
          </div>
        </div>

        {/* Grid Danh Sách Thẻ Đề Thi QAS kèm Huy Hiệu Điểm */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {filteredExams.map((exam) => {
            const stats = getExamStats(exam);
            const hasAttempted = !!stats && stats.attemptsCount > 0;

            return (
              <div
                key={exam.id}
                className={`flex flex-col justify-between rounded-xl p-5 border transition-all duration-300 ${
                  hasAttempted
                    ? 'bg-gradient-to-b from-[#241743] to-[#150e28] border-purple-500/50 hover:border-purple-400 shadow-[0_4px_20px_rgba(168,85,247,0.15)]'
                    : 'bg-[#18102e] border-purple-900/60 hover:border-purple-700/80'
                }`}
              >
                <div>
                  {/* Top Bar thẻ: Code & Session */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-purple-900/60 text-purple-200 border border-purple-700/50">
                      {exam.code}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {exam.session}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-base text-white line-clamp-1">{exam.title}</h3>
                  <p className="text-xs text-purple-200/70 mt-1.5 leading-relaxed line-clamp-2">
                    {exam.description}
                  </p>

                  {/* Point 70: KHU VỰC HUY HIỆU ĐIỂM SỐ & TIẾN TRÌNH QAS */}
                  <div className="mt-4 pt-3 border-t border-purple-800/50">
                    {hasAttempted && stats ? (
                      <div className="space-y-2.5">
                        {/* Huy hiệu điểm cao nhất & Lần gần nhất */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-2 text-center">
                            <span className="block text-[10px] text-amber-300/80 uppercase font-medium">
                              🏆 Kỷ lục QAS
                            </span>
                            <span className="text-sm font-black text-amber-300">
                              {stats.bestScore}
                              <span className="text-[10px] text-amber-400/60 font-normal">/1600</span>
                            </span>
                          </div>
                          <div className="bg-purple-950/50 border border-purple-500/40 rounded-lg p-2 text-center">
                            <span className="block text-[10px] text-purple-300/80 uppercase font-medium">
                              ⏱️ Gần nhất
                            </span>
                            <span className="text-sm font-black text-purple-200">
                              {stats.latestScore}
                              <span className="text-[10px] text-purple-400/60 font-normal">/1600</span>
                            </span>
                          </div>
                        </div>

                        {/* Số lần làm & Chênh lệch điểm giữa lần đầu và gần nhất */}
                        <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-purple-950/80 border border-purple-800/60">
                          <span className="text-purple-200 flex items-center gap-1 font-medium">
                            <span>🔄</span> {stats.attemptsCount} lần làm
                          </span>
                          <span
                            className={`font-bold flex items-center gap-1 ${
                              stats.delta > 0
                                ? 'text-emerald-400'
                                : stats.delta < 0
                                ? 'text-rose-400'
                                : 'text-purple-200'
                            }`}
                          >
                            {stats.delta > 0 ? (
                              <>
                                <span>📈</span> +{stats.delta} đ
                              </>
                            ) : stats.delta < 0 ? (
                              <>
                                <span>📉</span> {stats.delta} đ
                              </>
                            ) : (
                              <>
                                <span>➖</span> Giữ điểm
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-purple-950/30 border border-dashed border-purple-800/60 rounded-lg p-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs text-purple-300">
                          <span>✨</span> Đề QAS chưa thực hiện
                        </span>
                        <p className="text-[11px] text-purple-300/60 mt-0.5">
                          Làm đề thật để cọ xát áp lực thực chiến phòng thi
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="mt-5 pt-3">
                  <button
                    onClick={() => {
                      setSelectedExamId(exam.id);
                      scrollToRunner();
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      selectedExamId === exam.id
                        ? 'ring-2 ring-purple-400 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 font-black'
                        : hasAttempted
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                    }`}
                  >
                    {selectedExamId === exam.id ? (
                      <>
                        <span>👑</span> Đang Chọn — Bắt Đầu Thi
                      </>
                    ) : hasAttempted ? (
                      <>
                        <span>🔄</span> Làm Lại Đề Thật QAS
                      </>
                    ) : (
                      <>
                        <span>⚡</span> Bắt Đầu Thi Đề Này
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Banner thông báo đề QAS đang được nạp vào ExamRunner */}
      <div className="bg-gradient-to-r from-[#20143d] via-[#2a1752] to-[#160c2b] border border-purple-500/40 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-2xl shrink-0 shadow-inner">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider bg-purple-900/50 px-2 py-0.5 rounded border border-purple-700/50">
                {selectedExam?.code || 'OFFICIAL QAS'}
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                {selectedExam?.session || 'Đợt thi chính thức'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                {selectedExam?.difficulty || 'Chuẩn thi thật'}
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-black text-white mt-1">
              Đang nạp: {selectedExam?.title || selectedExamId}
            </h4>
          </div>
        </div>
        <div className="text-xs text-purple-200/80 sm:text-right shrink-0">
          <span className="block text-purple-100 font-medium">Phòng thi thực chiến Digital SAT</span>
          <span>Chọn đề khác từ danh sách thẻ phía trên để thi đợt khác</span>
        </div>
      </div>

      {/* Runner bài thi thật */}
      <div id="exam-runner-workspace" className="scroll-mt-6">
        <ExamRunner
          key={selectedExamId}
          examId={selectedExamId}
          title={selectedExam?.title || 'VƯỢT VŨ MÔN THI THẬT'}
          subtitle={selectedExam?.description || 'Kỳ thi quyết định! Chúc chiến binh đạt điểm tối đa!'}
          mode="real"
          headerGradient="linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)"
          titleGradient="linear-gradient(to right, #c084fc, #fbcfe8)"
          accentColor="#a855f7"
        />
      </div>
    </div>
  );
}
