'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';
import { SpeedQuizLeaderboard } from './SpeedQuizLeaderboard';

/** Mốc thưởng trong lượt (số câu đúng → xu). Đồng bộ SPEED_QUIZ_MILESTONES server. */
const MILESTONES: { correct: number; coins: number }[] = [
  { correct: 10, coins: 100 },
  { correct: 20, coins: 250 },
  { correct: 30, coins: 500 },
];

/** Số câu sai LIÊN TIẾP để kết thúc lượt (survival "2 mạng"). */
const MAX_WRONG_STREAK = 2;

type Tab = 'play' | 'ranking';

// Point 85: Kiểu dữ liệu lưu lại từng câu vừa làm để xem lại lời giải chi tiết
interface QuizAnswerReview {
  order: number;
  questionText: string;
  choices?: Record<string, string> | string[];
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  domain?: string;
}

export default function SpeedQuizPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('play');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rewardCoins, setRewardCoins] = useState(0);
  // Point 85: State danh sách câu đã làm trong phiên & bộ lọc xem lại
  const [sessionReviews, setSessionReviews] = useState<QuizAnswerReview[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'correct'>('all');

  // Khắc phục #036 & #073: Chống double-submit và rò rỉ bộ nhớ/state update khi unmount
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const nextMilestone = MILESTONES.find((m) => m.correct > correctCount)?.correct ?? null;

  const generateQuestion = useCallback(async (answered: number, session: string | null) => {
    setIsLoading(true);
    setQuestionData(null);
    isSubmittingRef.current = false; // Mở khoá lựa chọn cho câu mới
    try {
      // Server chọn skill + độ khó theo MASTERY thật (adaptive, ĐA MÔN) và sinh câu.
      // Kèm session để server TAG câu (chống gian lận đếm câu đúng lúc kết thúc).
      const qs = new URLSearchParams({ answered: String(answered) });
      if (session) qs.set('session', session);
      const res = await fetch(`/api/speed-quiz/question?${qs.toString()}`);
      if (!isMountedRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (isMountedRef.current) setQuestionData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        if (isMountedRef.current) {
          showToast(err?.error ?? 'Thất bại khi sinh câu hỏi (API Error).', 'error');
          setIsPlaying(false);
        }
      }
    } catch (e) {
      console.error(e);
      if (isMountedRef.current) {
        showToast('Lỗi kết nối khi sinh câu hỏi.', 'error');
        setIsPlaying(false);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [showToast]);

  const startRun = useCallback(async () => {
    isSubmittingRef.current = false;
    setIsPlaying(true);
    setIsGameOver(false);
    setCorrectCount(0);
    setWrongStreak(0);
    setRewardCoins(0);
    setSessionReviews([]); // Point 85: Reset danh sách câu đã làm trong phiên
    // Mở session server-side (chống gian lận + nguồn correct_count). Pre-migration
    // → sessionId null: vẫn chơi được, chỉ không thưởng/không xếp hạng (fail-safe).
    let session: string | null = null;
    try {
      const res = await fetch('/api/speed-quiz/start', { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        session = data.sessionId ?? null;
      }
    } catch (e) {
      console.error('start session error', e);
    }
    if (!isMountedRef.current) return;
    setSessionId(session);
    generateQuestion(0, session);
  }, [generateQuestion]);

  // Kết thúc lượt: finalize + claim mốc (server đếm câu đúng THẬT). Idempotent.
  const endRun = useCallback(async (session: string | null) => {
    isSubmittingRef.current = true;
    setIsGameOver(true);
    setIsPlaying(false);
    if (!session) return;
    try {
      const res = await fetch('/api/speed-quiz/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session }),
      });
      if (!isMountedRef.current) return;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.rewardCoins > 0 && isMountedRef.current) {
          setRewardCoins(data.rewardCoins);
          showToast(`🎉 Nhận ${data.rewardCoins} xu thưởng theo mốc!`, 'success');
        }
      }
    } catch (e) {
      console.error('end session error', e);
    }
  }, [showToast]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #0c1a2b 0%, #1e3a5f 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">⚡</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #38bdf8, #a5f3fc)', WebkitBackgroundClip: 'text' }}>TRẢ LỜI NHANH (SPEED QUIZ)</h1>
            <p className="math-subtitle text-gray-300">Mỗi câu 15 giây. Sai {MAX_WRONG_STREAK} câu liên tiếp là kết thúc. Đúng càng nhiều, thưởng càng lớn!</p>
          </div>
        </div>
      </div>

      {/* Tabs: Chơi / Bảng xếp hạng — ẩn khi đang trong lượt để tập trung. */}
      {!isPlaying && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab('play')}
            className={`px-5 py-2 rounded-lg font-bold text-sm transition-colors ${tab === 'play' ? 'bg-amber-500 text-[#78350f]' : 'bg-[#1b2533] text-gray-300 hover:bg-[#26344a]'}`}
          >
            ⚡ Chơi
          </button>
          <button
            onClick={() => setTab('ranking')}
            className={`px-5 py-2 rounded-lg font-bold text-sm transition-colors ${tab === 'ranking' ? 'bg-amber-500 text-[#78350f]' : 'bg-[#1b2533] text-gray-300 hover:bg-[#26344a]'}`}
          >
            🏆 Bảng Xếp Hạng
          </button>
        </div>
      )}

      {tab === 'ranking' && !isPlaying && <SpeedQuizLeaderboard />}

      {tab === 'play' && (
        <>
          {!isPlaying && !isGameOver && (
            <div className="text-center p-12 bg-[#0e1117] rounded-xl border border-[#334155]">
              <div className="text-6xl mb-6">⚡</div>
              <p className="text-gray-300 mb-6 max-w-lg mx-auto">Chế độ tốc độ đa môn: AI đưa câu nhắm đúng điểm yếu của bạn (Toán, Đọc/Viết, Từ vựng), độ khó tăng dần theo số câu đúng. Trả lời trong 15 giây — hết giờ tính là sai. Sai {MAX_WRONG_STREAK} câu liên tiếp thì dừng lượt.</p>
              <div className="flex justify-center gap-3 mb-8 flex-wrap">
                {MILESTONES.map((m) => (
                  <span key={m.correct} className="px-3 py-1.5 rounded-full bg-[#1b2533] border border-[#38bdf8]/40 text-sm text-sky-300">
                    🎯 {m.correct} câu đúng → +{m.coins} xu
                  </span>
                ))}
              </div>
              <button onClick={startRun} className="bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-[#78350f] font-black text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.5)] transition-transform hover:scale-105">
                BẮT ĐẦU
              </button>
            </div>
          )}

          {isGameOver && (
            <div className="space-y-6">
              <div className="text-center p-8 md:p-12 bg-gradient-to-br from-[#0c243a] to-[#0f172a] rounded-2xl border-2 border-sky-500 shadow-[0_0_30px_rgba(56,189,248,0.3)]">
                <div className="text-5xl mb-3">🏁</div>
                <h2 className="text-4xl font-black text-sky-400 mb-2">HẾT LƯỢT THỬ THÁCH</h2>
                <p className="text-xl text-white mb-2">
                  Bạn trả lời đúng <span className="font-black text-yellow-400 text-2xl">{correctCount}</span>
                  {sessionReviews.length > 0 ? ` / ${sessionReviews.length}` : ''} câu trong lượt này!
                </p>
                {sessionReviews.length > 0 && (
                  <p className="text-sm text-sky-200/80 mb-4">
                    Độ chính xác phản xạ:{' '}
                    <strong className="text-amber-300">
                      {Number.isFinite(correctCount / sessionReviews.length)
                        ? Math.round((correctCount / sessionReviews.length) * 100)
                        : 0}
                      %
                    </strong>
                  </p>
                )}
                {rewardCoins > 0 ? (
                  <div className="inline-block bg-emerald-500/20 border border-emerald-400/40 px-6 py-2 rounded-xl text-emerald-300 font-bold mb-6">
                    🎉 +{rewardCoins} xu thưởng mốc đã được cộng vào ví của bạn!
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mb-6">
                    Đạt mốc 10 / 20 / 30 câu đúng để nhận thưởng xu (mỗi mốc 1 lần/ngày).
                  </p>
                )}
                <div className="flex justify-center gap-4 flex-wrap">
                  <button
                    onClick={startRun}
                    className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black text-lg px-8 py-3 rounded-xl shadow-lg transition-transform hover:scale-105"
                  >
                    ⚡ Chơi Lại Ngay
                  </button>
                  <button
                    onClick={() => setTab('ranking')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-6 py-3 rounded-xl border border-slate-600 transition"
                  >
                    🏆 Xem Bảng Xếp Hạng
                  </button>
                </div>
              </div>

              {/* POINT 85: Xem lại Lời giải Chi tiết sau màn Speed Quiz */}
              <div className="bg-[#1b2533] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>📝</span> Xem Lại Lời Giải Chi Tiết Của Phiên Này
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Rút kinh nghiệm ngay lập tức các bẫy đề thi và phương pháp giải nhanh để bứt phá phản xạ
                    </p>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 gap-1 text-xs font-semibold shrink-0">
                    <button
                      onClick={() => setReviewFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition ${reviewFilter === 'all'
                          ? 'bg-sky-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Tất cả ({sessionReviews.length})
                    </button>
                    <button
                      onClick={() => setReviewFilter('wrong')}
                      className={`px-3 py-1.5 rounded-lg transition ${reviewFilter === 'wrong'
                          ? 'bg-rose-500 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      ❌ Câu sai ({sessionReviews.filter((r) => !r.isCorrect).length})
                    </button>
                    <button
                      onClick={() => setReviewFilter('correct')}
                      className={`px-3 py-1.5 rounded-lg transition ${reviewFilter === 'correct'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      ✅ Câu đúng ({sessionReviews.filter((r) => r.isCorrect).length})
                    </button>
                  </div>
                </div>

                {sessionReviews.length === 0 ? (
                  <p className="text-center py-6 text-sm text-slate-400">Chưa có dữ liệu câu hỏi trong phiên này.</p>
                ) : (
                  <div className="space-y-4">
                    {sessionReviews
                      .filter((r) => {
                        if (reviewFilter === 'wrong') return !r.isCorrect;
                        if (reviewFilter === 'correct') return r.isCorrect;
                        return true;
                      })
                      .map((item) => (
                        <div
                          key={item.order}
                          className={`p-4 md:p-5 rounded-xl border transition ${item.isCorrect
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-rose-950/20 border-rose-500/30'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                                Câu #{item.order}
                              </span>
                              <span className="text-xs text-sky-300 bg-sky-950/60 px-2.5 py-0.5 rounded border border-sky-800">
                                {item.domain || 'Tổng hợp'}
                              </span>
                            </div>
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${item.isCorrect
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                }`}
                            >
                              {item.isCorrect ? '✅ Trả lời Đúng' : '❌ Sai / Hết giờ'}
                            </span>
                          </div>

                          {/* Đề bài */}
                          <div className="text-sm text-slate-200 mb-3 whitespace-pre-wrap leading-relaxed font-sans">
                            {item.questionText}
                          </div>

                          {/* Lựa chọn đáp án nếu có */}
                          {item.choices && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                              {Array.isArray(item.choices)
                                ? item.choices.map((choice, idx) => (
                                  <div
                                    key={idx}
                                    className="text-xs p-2 rounded bg-slate-900/60 border border-slate-800 text-slate-300"
                                  >
                                    {choice}
                                  </div>
                                ))
                                : Object.entries(item.choices).map(([key, val]) => (
                                  <div
                                    key={key}
                                    className={`text-xs p-2 rounded border transition ${key === item.correctAnswer || item.correctAnswer.includes(key)
                                        ? 'bg-emerald-900/30 border-emerald-500/60 text-emerald-200 font-semibold'
                                        : 'bg-slate-900/60 border-slate-800 text-slate-300'
                                      }`}
                                  >
                                    <strong className="text-amber-400 mr-1.5">{key}.</strong> {val}
                                  </div>
                                ))}
                            </div>
                          )}

                          {/* Khóa đáp án đúng */}
                          <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                            <span>🎯 Đáp án chuẩn:</span>
                            <span className="bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300">
                              {item.correctAnswer}
                            </span>
                          </div>

                          {/* Lời giải chi tiết */}
                          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/60 text-xs text-slate-300 space-y-1">
                            <div className="font-bold text-sky-300 flex items-center gap-1">
                              <span>💡</span> Lời giải chi tiết & Phương pháp giải:
                            </div>
                            <p className="leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {isPlaying && (
            <>
              <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
                <div>
                  <span className="text-gray-400 text-sm">Số câu đúng:</span>
                  <h2 className="text-2xl font-black text-sky-400">{correctCount}</h2>
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Mốc kế tiếp:</span>
                  <h2 className="text-lg font-bold text-yellow-400">{nextMilestone ? `🎯 ${nextMilestone} câu` : '🏆 Đã đạt hết mốc'}</h2>
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Mạng còn:</span>
                  <h2 className="text-2xl font-black text-red-400">{'❤️'.repeat(MAX_WRONG_STREAK - wrongStreak) || '💀'}</h2>
                </div>
                <button
                  onClick={() => endRun(sessionId)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                >
                  Thoát
                </button>
              </div>

              {(isLoading || questionData) && (
                <div className="relative">
                  <div className="bg-[#0e1117] p-6 rounded-xl border border-[#38bdf8] shadow-lg mb-6">
                    <p className="text-sky-300 font-bold mb-4">⚡ Trả lời thật nhanh — 15 giây mỗi câu, độ khó tăng dần khi bạn đúng nhiều hơn.</p>
                    <CorePracticeUI
                      questionData={questionData as PracticeQuestion}
                      isLoading={isLoading}
                      timeLimit={15}
                      hideNextUntilSubmitted
                      onAnswer={(isCorrect) => {
                        // Khắc phục #036: Chống double-submit khi hết giờ hoặc click liên tiếp
                        if (isSubmittingRef.current) return;
                        isSubmittingRef.current = true;

                        // Point 85: Lưu lại câu hỏi vào sessionReviews để xem lại lời giải chi tiết
                        if (questionData) {
                          const q = questionData as unknown as Record<string, unknown>;
                          const qText = String(q.question || q.prompt || q.stem || 'Câu hỏi luyện tập');
                          const cAns = String(q.correctAnswer || q.correct_answer || q.answer || 'Đáp án đúng');
                          const exp = String(q.explanation || q.solution || q.rationale || 'Hãy nắm vững định nghĩa và phương pháp giải.');
                          const dom = String(q.domain || q.subject || q.skill || 'SAT');
                          const choices = q.choices as Record<string, string> | string[] | undefined;

                          setSessionReviews((prev) => [
                            ...prev,
                            {
                              order: prev.length + 1,
                              questionText: qText,
                              choices,
                              correctAnswer: cAns,
                              isCorrect,
                              explanation: exp,
                              domain: dom,
                            },
                          ]);
                        }

                        if (isCorrect) {
                          setWrongStreak(0);
                          setCorrectCount((prev) => prev + 1);
                        } else {
                          // Sai (hoặc hết giờ tự nộp rỗng) → mất 1 mạng; hết mạng thì kết thúc.
                          const nextWrong = wrongStreak + 1;
                          setWrongStreak(nextWrong);
                          if (nextWrong >= MAX_WRONG_STREAK) {
                            void endRun(sessionId);
                          }
                        }
                      }}
                      onNext={() => {
                        // correctCount đã +1 ở onAnswer với câu đúng; câu tiếp dùng nó làm độ khó.
                        if (!isGameOver) {
                          isSubmittingRef.current = false;
                          generateQuestion(correctCount, sessionId);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
