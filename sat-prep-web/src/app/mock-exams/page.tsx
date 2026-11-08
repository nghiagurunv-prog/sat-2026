'use client';

/**
 * MOCK EXAMS PAGE — ĐẤU TRƯỜNG THI THỬ (Point 70)
 * Bổ sung:
 * - Đọc lịch sử làm bài từ localStorage (`sat_exam_history_v1`)
 * - Bộ lọc 3 chế độ: "Tất cả đề" | "Chưa làm" | "Đã hoàn thành"
 * - Thẻ đề thi hiển thị huy hiệu: Điểm cao nhất, Lần gần nhất, Số lần làm, Chênh lệch lần đầu - gần nhất
 * - Tích hợp mượt mà với ExamRunner bên dưới
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import ExamRunner from '@/components/ExamRunner';

export interface ExamHistoryItem {
  examId?: string;
  testId?: string;
  id?: string;
  score?: number;
  totalScore?: number;
  timestamp?: number;
  date?: string | number;
}

export interface ExamStatSummary {
  bestScore: number;
  latestScore: number;
  firstScore: number;
  attemptsCount: number;
  delta: number;
  lastAttemptDate?: string;
}

export interface MockExamCard {
  id: string;
  code: string;
  title: string;
  difficulty: 'Chuẩn hóa' | 'Khá khó' | 'Nâng cao' | 'Cực khó';
  questionsCount: number;
  durationMinutes: number;
  description: string;
  tags: string[];
}

const MOCK_EXAM_CATALOG: MockExamCard[] = [
  {
    id: 'sat-mock-01',
    code: 'MOCK-01',
    title: 'SAT Practice Test #01 (Adaptive)',
    difficulty: 'Chuẩn hóa',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Đề thi thử tiêu chuẩn cấu trúc Digital SAT mới nhất, bám sát ma trận College Board phân tầng Module 2.',
    tags: ['Toán', 'Đọc-Viết', 'Adaptive Chuẩn', 'Target 1300+'],
  },
  {
    id: 'sat-mock-02',
    code: 'MOCK-02',
    title: 'SAT Practice Test #02 (Adaptive)',
    difficulty: 'Chuẩn hóa',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Tập trung rèn tốc độ đọc lướt văn bản khoa học xã hội và xử lý bẫy thời gian phần Đại số tuyến tính.',
    tags: ['Toán', 'Đọc-Viết', 'Bẫy thời gian', 'Target 1350+'],
  },
  {
    id: 'sat-mock-03',
    code: 'MOCK-03',
    title: 'SAT Practice Test #03 (Adaptive)',
    difficulty: 'Khá khó',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Tăng cường các câu hỏi suy luận sâu Ngữ văn, quy tắc dấu câu phức hợp và bài toán Tham số hình học.',
    tags: ['Suy luận sâu', 'Toán phân hóa', 'Target 1400+'],
  },
  {
    id: 'sat-mock-04',
    code: 'MOCK-04',
    title: 'SAT Practice Test #04 (Adaptive)',
    difficulty: 'Khá khó',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Bài thi thử bứt phá điểm số với Module 2 phân hóa mạnh, rèn tâm lý phòng thi trước kỳ thi thật 2 tuần.',
    tags: ['Phân hóa mạnh', 'Mô phỏng áp lực', 'Target 1450+'],
  },
  {
    id: 'sat-mock-05',
    code: 'MOCK-05',
    title: 'SAT Practice Test #05 (Chuyên sâu)',
    difficulty: 'Nâng cao',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Bộ câu hỏi tuyển chọn từ ngân hàng thử thách, kiểm tra độ bền tư duy và độ chính xác ở các câu 800.',
    tags: ['Chuyên sâu', 'Cực trị & Bất đẳng thức', 'Target 1500+'],
  },
  {
    id: 'sat-mock-06',
    code: 'MOCK-06',
    title: 'SAT Practice Test #06 (Super Hard)',
    difficulty: 'Cực khó',
    questionsCount: 134,
    durationMinutes: 134,
    description: 'Thử thách cực hạn dành cho học viên săn học bổng Top 20 Đại học Mỹ và tuyển thẳng Top trường Việt Nam.',
    tags: ['Thử thách cực hạn', 'Chinh phục 1550+', 'Học bổng Top'],
  },
];

type FilterMode = 'all' | 'unattempted' | 'completed';

export default function MockExamsPage() {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('sat-mock-01');
  const [historyMap, setHistoryMap] = useState<Record<string, ExamStatSummary>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const isStartingRef = useRef(false);

  // Point 70: Đọc & đồng bộ lịch sử thi từ cả 2 khóa localStorage ('sat_exam_history_v1' & 'sat_exam_history_log_v1')
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        setIsLoaded(true);
        return;
      }

      const stats: Record<string, ExamStatSummary> = {};
      const grouped: Record<string, Array<{ score: number; timestamp: number; date?: string }>> = {};

      const ingestItem = (item: any) => {
        if (!item || typeof item !== 'object') return;
        const examId = String(item.examId || item.id || item.testId || '').trim().toLowerCase();
        if (!examId) return;
        const rawScore = Number(item.score ?? item.totalScore ?? 0);
        const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(1600, rawScore)) : 0;
        let ts = 0;
        if (Number.isFinite(Number(item.timestamp))) {
          ts = Number(item.timestamp);
        } else if (item.date) {
          const parsedDate = new Date(item.date).getTime();
          ts = Number.isFinite(parsedDate) ? parsedDate : Date.now();
        } else {
          ts = Date.now();
        }
        const dateStr = item.date ? String(item.date) : new Date(ts).toLocaleDateString('vi-VN');
        if (!grouped[examId]) grouped[examId] = [];
        grouped[examId].push({ score, timestamp: ts, date: dateStr });
      };

      const parseStorage = (key: string) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(ingestItem);
          } else if (typeof parsed === 'object' && parsed !== null) {
            Object.entries(parsed).forEach(([subKey, val]) => {
              const cleanKey = subKey.trim().toLowerCase();
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
        if (!attempts || attempts.length === 0) return;
        // Loại bỏ trùng lặp nếu cả 2 khóa cùng lưu 1 lần thi (cùng mốc giây)
        const uniqueAttempts = Array.from(
          new Map(attempts.map((a) => [`${a.score}-${Math.round((Number.isFinite(a.timestamp) ? a.timestamp : 0) / 1000)}`, a])).values()
        );
        if (uniqueAttempts.length === 0) return;
        uniqueAttempts.sort((a, b) => a.timestamp - b.timestamp);
        const firstScore = Number.isFinite(uniqueAttempts[0].score) ? uniqueAttempts[0].score : 0;
        const latestScore = Number.isFinite(uniqueAttempts[uniqueAttempts.length - 1].score)
          ? uniqueAttempts[uniqueAttempts.length - 1].score
          : 0;
        const validScores = uniqueAttempts.map((a) => a.score).filter((s) => Number.isFinite(s));
        const bestScore = validScores.length > 0 ? Math.max(...validScores) : latestScore;
        const delta = Number.isFinite(latestScore - firstScore) ? latestScore - firstScore : 0;
        stats[id] = {
          bestScore,
          latestScore,
          firstScore,
          attemptsCount: uniqueAttempts.length,
          delta,
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

  // Helper tìm dữ liệu lịch sử tương ứng của thẻ đề
  const getExamStats = (exam: MockExamCard): ExamStatSummary | null => {
    const key1 = exam.id.toLowerCase();
    const key2 = exam.code.toLowerCase();
    return historyMap[key1] || historyMap[key2] || null;
  };

  // Tính toán số lượng theo bộ lọc
  const filteredExams = useMemo(() => {
    return MOCK_EXAM_CATALOG.filter((exam) => {
      const stats = getExamStats(exam);
      const isCompleted = !!stats && stats.attemptsCount > 0;
      if (filter === 'completed') return isCompleted;
      if (filter === 'unattempted') return !isCompleted;
      return true; // 'all'
    });
  }, [filter, historyMap]);

  const totalExamsCount = MOCK_EXAM_CATALOG.length;
  const completedCount = useMemo(() => {
    return MOCK_EXAM_CATALOG.filter((exam) => {
      const stats = getExamStats(exam);
      return !!stats && stats.attemptsCount > 0;
    }).length;
  }, [historyMap]);
  const unattemptedCount = Math.max(0, totalExamsCount - completedCount);
  const completionRate = totalExamsCount > 0
    ? Math.min(100, Math.max(0, Math.round((completedCount / totalExamsCount) * 100)))
    : 0;

  // Lấy thông tin bài thi đang được người dùng lựa chọn để thi
  const selectedExam = useMemo(() => {
    return MOCK_EXAM_CATALOG.find((e) => e.id === selectedExamId) || MOCK_EXAM_CATALOG[0];
  }, [selectedExamId]);

  const scrollToRunner = () => {
    const el = document.getElementById('exam-runner-workspace');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectExam = (examId: string) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
    setSelectedExamId(examId);
    scrollToRunner();
    setTimeout(() => {
      isStartingRef.current = false;
      setIsStarting(false);
    }, 400);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      {/* Point 70: Bảng Lịch sử & Bộ Lọc Thẻ Đề Thi Thử */}
      <section className="bg-gradient-to-br from-[#131b2e] to-[#0f172a] border border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-2">
              <span>🎯 POINT 70 · HỆ THỐNG THEO DÕI ĐỀ THI</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>📊 Lịch Sử Làm Đề & Quản Lý Thi Thử</span>
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Theo dõi chi tiết điểm số cao nhất, số lần thử sức và mức độ tiến bộ sau mỗi lượt thi thử Full-length.
            </p>
          </div>

          {/* Huy hiệu tổng quan */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#1e293b]/90 border border-slate-700 rounded-xl px-4 py-2.5 text-center min-w-[110px]">
              <span className="block text-xs text-slate-400">Đã Hoàn Thành</span>
              <span className="text-lg font-black text-emerald-400">
                {isLoaded ? completedCount : 0}/{totalExamsCount}
              </span>
              <div className="w-full bg-slate-700/60 rounded-full h-1 mt-1 overflow-hidden">
                <div
                  className="bg-emerald-400 h-1 rounded-full transition-all duration-500"
                  style={{ width: `${Number.isFinite(completionRate) ? completionRate : 0}%` }}
                />
              </div>
            </div>
            <div className="bg-[#1e293b]/90 border border-slate-700 rounded-xl px-4 py-2.5 text-center min-w-[110px]">
              <span className="block text-xs text-slate-400">Chưa Làm</span>
              <span className="text-lg font-black text-blue-400">
                {isLoaded ? unattemptedCount : totalExamsCount}
              </span>
              <div className="w-full bg-slate-700/60 rounded-full h-1 mt-1 overflow-hidden">
                <div
                  className="bg-blue-400 h-1 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      totalExamsCount > 0
                        ? Math.min(100, Math.max(0, Math.round((unattemptedCount / totalExamsCount) * 100)))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Thanh Bộ Lọc: Tất cả / Chưa làm / Đã hoàn thành */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
          <div className="inline-flex p-1 bg-slate-900/80 rounded-xl border border-slate-700">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả đề ({totalExamsCount})
            </button>
            <button
              onClick={() => setFilter('unattempted')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                filter === 'unattempted'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chưa làm ({unattemptedCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                filter === 'completed'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Đã hoàn thành ({completedCount})
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Tự động đồng bộ với hồ sơ làm bài cá nhân</span>
          </div>
        </div>

        {/* Grid Danh Sách Thẻ Đề Thi kèm Huy Hiệu Điểm */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {filteredExams.map((exam) => {
            const stats = getExamStats(exam);
            const hasAttempted = !!stats && stats.attemptsCount > 0;

            return (
              <div
                key={exam.id}
                className={`flex flex-col justify-between rounded-xl p-5 border transition-all duration-300 ${
                  hasAttempted
                    ? 'bg-gradient-to-b from-[#1a233a] to-[#111827] border-blue-500/40 hover:border-blue-400 shadow-[0_4px_20px_rgba(59,130,246,0.12)]'
                    : 'bg-[#151c2c] border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <div>
                  {/* Top Bar thẻ: Code & Difficulty */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-800 text-blue-300 border border-slate-700">
                      {exam.code}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        exam.difficulty === 'Cực khó'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : exam.difficulty === 'Nâng cao'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {exam.difficulty}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-base text-white line-clamp-1">{exam.title}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                    {exam.description}
                  </p>

                  {/* Point 70: KHU VỰC HUY HIỆU ĐIỂM SỐ & TIẾN TRÌNH */}
                  <div className="mt-4 pt-3 border-t border-slate-700/60">
                    {hasAttempted && stats ? (
                      <div className="space-y-2.5">
                        {/* Huy hiệu điểm cao nhất & Lần gần nhất */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-2 text-center">
                            <span className="block text-[10px] text-amber-300/80 uppercase font-medium">
                              🏆 Cao nhất
                            </span>
                            <span className="text-sm font-black text-amber-300">
                              {stats.bestScore}
                              <span className="text-[10px] text-amber-400/60 font-normal">/1600</span>
                            </span>
                          </div>
                          <div className="bg-blue-950/40 border border-blue-500/40 rounded-lg p-2 text-center">
                            <span className="block text-[10px] text-blue-300/80 uppercase font-medium">
                              ⏱️ Gần nhất
                            </span>
                            <span className="text-sm font-black text-blue-300">
                              {stats.latestScore}
                              <span className="text-[10px] text-blue-400/60 font-normal">/1600</span>
                            </span>
                          </div>
                        </div>

                        {/* Số lần làm & Chênh lệch điểm giữa lần đầu và gần nhất */}
                        <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
                          <span className="text-slate-300 flex items-center gap-1 font-medium">
                            <span>🔄</span> {stats.attemptsCount} lần làm
                          </span>
                          <span
                            className={`font-bold flex items-center gap-1 ${
                              stats.delta > 0
                                ? 'text-emerald-400'
                                : stats.delta < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
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
                      <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-lg p-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <span>🆕</span> Chưa làm bài thi này
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Làm bài để ghi nhận kỷ lục và kích hoạt phân tích
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="mt-5 pt-3">
                  <button
                    disabled={isStarting}
                    onClick={() => handleSelectExam(exam.id)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isStarting ? 'opacity-70 cursor-not-allowed' : ''
                    } ${
                      selectedExamId === exam.id
                        ? 'ring-2 ring-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                        : hasAttempted
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                    }`}
                  >
                    {selectedExamId === exam.id ? (
                      <>
                        <span>🎯</span> Đang Chọn — Bắt Đầu Làm
                      </>
                    ) : hasAttempted ? (
                      <>
                        <span>🔄</span> Thi Lại Để Bứt Phá
                      </>
                    ) : (
                      <>
                        <span>⚡</span> Bắt Đầu Làm Bài Ngay
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Point 05: Chế độ Thi Thử Chẩn Đoán Nhanh (Quick Diagnostic 20 câu - 25 phút) */}
      <section className="bg-gradient-to-r from-indigo-950/80 via-[#131b2e] to-emerald-950/60 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
            <span>⚡ CHẨN ĐOÁN NHANH TRÌNH ĐỘ (QUICK DIAGNOSTIC)</span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-white">
            Bận lịch học thêm? Làm bài Test Chẩn Đoán Nhanh 20 câu (25 phút)
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Đánh giá nhanh năng lực Reading & Writing (10 câu) và Math (10 câu) để hệ thống ước lượng band điểm hiện tại và gợi ý lộ trình ôn tập cá nhân hóa mà không cần ngồi đủ 2 tiếng 14 phút.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedExamId('sat-diagnostic-quick');
            scrollToRunner();
          }}
          className="shrink-0 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
        >
          <span>🩺</span> Bắt đầu Chẩn Đoán Nhanh
        </button>
      </section>

      {/* Banner thông báo đề thi đang được nạp vào ExamRunner */}
      <div className="bg-gradient-to-r from-[#111c35] via-[#152342] to-[#0f172a] border border-blue-500/40 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-2xl shrink-0 shadow-inner">
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-300 uppercase tracking-wider bg-blue-900/40 px-2 py-0.5 rounded border border-blue-700/50">
                {selectedExam?.code || (selectedExamId === 'sat-diagnostic-quick' ? 'DIAGNOSTIC' : 'MOCK EXAM')}
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                {selectedExamId === 'sat-diagnostic-quick' ? 'Chẩn đoán 25 phút' : selectedExam?.difficulty || 'Chuẩn hóa'}
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-black text-white mt-1">
              {selectedExamId === 'sat-diagnostic-quick'
                ? 'SAT Quick Diagnostic Test (20 câu · 25 phút)'
                : selectedExam?.title || selectedExamId}
            </h4>
          </div>
        </div>
        <div className="text-xs text-slate-400 sm:text-right shrink-0">
          <span className="block text-slate-300 font-medium">Cấu trúc phòng thi chuẩn Bluebook</span>
          <span>Bấm các nút thẻ đề ở trên để chuyển bài thi bất kỳ lúc nào</span>
        </div>
      </div>

      {/* Trình làm bài thi thực tế */}
      <div id="exam-runner-workspace" className="scroll-mt-6">
        <ExamRunner
          key={selectedExamId}
          examId={selectedExamId}
          title={
            selectedExamId === 'sat-diagnostic-quick'
              ? 'SAT QUICK DIAGNOSTIC TEST'
              : selectedExam?.title || 'ĐẤU TRƯỜNG THI THỬ'
          }
          subtitle={
            selectedExamId === 'sat-diagnostic-quick'
              ? 'Đánh giá cấp tốc trình độ Reading & Writing và Math trong 25 phút'
              : selectedExam?.description || 'Vượt qua bài thi Full-length để chứng minh sức mạnh thực sự!'
          }
          mode="mock"
          accentColor="#3b82f6"
        />
      </div>
    </div>
  );
}
