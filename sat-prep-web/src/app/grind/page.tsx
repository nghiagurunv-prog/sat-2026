'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';
import { ALL_SKILLS } from '@/lib/skill-taxonomy';

/**
 * KHỔ LUYỆN (GRIND) — nhồi 1 skill yếu nhất (hoặc do user chọn) tới mastered.
 * Quyền lợi ULTIMATE. Clone luồng Tower: server chọn skill + độ khó theo mastery
 * thật rồi sinh câu qua /api/grind/question → CorePracticeUI ghi mastery đúng skill
 * qua /api/grade (giữ ROOT A, không chấm/faucet ở client).
 *
 * POINT 68: Thẻ Tổng kết Mini sau mỗi 5 câu luyện tập (Grind Session Summary Card)
 * + Modal chúc mừng cột mốc 5 câu (5, 10, 15...) kèm nút "Tiếp tục 5 câu nữa" hoặc "Đổi kỹ năng".
 */

const MASTERED_THRESHOLD = 80;

// Shape trả về từ GET /api/mastery (getMasterySummary).
interface MasterySkill {
  id: string;
  label: string;
  score: number;
  attempts: number;
  correct: number;
  reliable: boolean;
  mastered: boolean;
  moduleType: string;
}

export default function GrindPage() {
  const { showToast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  // '' = để hệ thống tự chọn skill yếu nhất.
  const [chosenSkill, setChosenSkill] = useState('');
  // skillId thực tế đang nhồi (do server trả về trên câu hỏi).
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [mastery, setMastery] = useState<MasterySkill[] | null>(null);

  // POINT 68: Session Tracking State
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [initialSkillScore, setInitialSkillScore] = useState<number | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

  // Bảo vệ unmount / chống rò rỉ bộ nhớ (#058)
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Deep-link hỗ trợ ?skillId=... từ Journey và Skill Tree
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get('skillId');
      if (sid) {
        setChosenSkill(sid);
      }
    }
  }, []);

  const activeSkill = mastery && activeSkillId ? mastery.find((s) => s.id === activeSkillId) ?? null : null;

  const loadMastery = useCallback(async () => {
    try {
      const res = await fetch('/api/mastery');
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        if (isMountedRef.current) {
          setMastery(data.skills ?? []);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/mastery');
        if (res.ok && !cancelled && isMountedRef.current) {
          const data = await res.json();
          if (!cancelled && isMountedRef.current) {
            setMastery(data.skills ?? []);
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const generateQuestion = async () => {
    // Chống bấm đúp (double-submit / spam) (#073)
    if (isLoading) return;

    setIsLoading(true);
    setQuestionData(null);
    try {
      const qs = chosenSkill ? `?skillId=${encodeURIComponent(chosenSkill)}` : '';
      const res = await fetch(`/api/grind/question${qs}`);

      if (!isMountedRef.current) return;

      if (res.status === 403) {
        setLocked(true);
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (!isMountedRef.current) return;
        setQuestionData(data);
        setActiveSkillId(data.skillId ?? null);
        if (initialSkillScore === null && data.skillId && mastery) {
          const found = mastery.find(m => m.id === data.skillId);
          if (found) setInitialSkillScore(found.score);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        if (!isMountedRef.current) return;
        showToast(err?.error ?? 'Thất bại khi sinh câu khổ luyện (API Error).', 'error');
        setIsPlaying(false);
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      console.error(e);
      setIsPlaying(false);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const startGrind = () => {
    if (isLoading) return;
    setIsPlaying(true);
    setSessionCount(0);
    setSessionCorrect(0);
    setSessionStartTime(Date.now());
    setInitialSkillScore(null);
    setShowMilestoneModal(false);
    generateQuestion();
  };

  // Callback khi submit câu hỏi (Point 68)
  const handleQuestionSubmitted = (res?: any) => {
    const isCorrect = res?.isCorrect ?? res?.correct ?? true;
    if (isCorrect) {
      setSessionCorrect(prev => prev + 1);
    }
    setSessionCount(prev => {
      const next = prev + 1;
      if (next > 0 && next % 5 === 0) {
        setShowMilestoneModal(true);
      }
      return next;
    });
    loadMastery();
  };

  // Upsell khi không phải Ultimate.
  if (locked) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="text-center p-12 bg-[#0e1117] rounded-xl border border-[#f59e0b] shadow-[0_0_30px_rgba(245,158,11,0.2)] max-w-2xl mx-auto">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-3xl font-black text-amber-400 mb-4">Khổ luyện là quyền lợi Ultimate</h2>
          <p className="text-gray-300 mb-8 max-w-lg mx-auto">
            Chế độ Khổ Luyện dồn toàn lực vào đúng kỹ năng yếu nhất của bạn, nhồi câu độ khó vừa tầm tới khi thành thạo. Đây là quyền lợi dành riêng cho gói Ultimate.
          </p>
          <Link
            href="/upgrade?from=grind&unlock=ultimate"
            className="inline-block bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-black text-lg px-10 py-4 rounded-full shadow-lg transition-transform hover:scale-105"
          >
            Nâng cấp Ultimate
          </Link>
        </div>
      </div>
    );
  }

  // Khắc phục lỗ hổng #065: bảo vệ các phép tính tỷ lệ/thanh phần trăm khỏi chia cho 0 hoặc NaN
  const safeThreshold = MASTERED_THRESHOLD > 0 ? MASTERED_THRESHOLD : 80;
  const rawScore = Number(activeSkill?.score) || 0;
  const pct = activeSkill ? Math.max(0, Math.min(100, Math.round((Math.max(0, rawScore) / safeThreshold) * 100))) : 0;
  const isMastered = !!activeSkill?.mastered;
  // Gợi ý skill kế tiếp (yếu nhất chưa thành thạo, khác skill hiện tại).
  const nextSuggestion = mastery
    ? [...mastery]
        .filter((s) => !s.mastered && s.id !== activeSkillId)
        .sort((a, b) => a.score - b.score || a.attempts - b.attempts)[0] ?? null
    : null;

  // Tính toán chỉ số thống kê phiên luyện (Point 68) — An toàn tuyệt đối không bao giờ NaN% (#065)
  const safeSessionCount = Math.max(0, sessionCount);
  const safeSessionCorrect = Math.max(0, Math.min(safeSessionCount, sessionCorrect));
  const accuracyPct = safeSessionCount > 0 ? Math.max(0, Math.min(100, Math.round((safeSessionCorrect / safeSessionCount) * 100))) : 100;
  const elapsedSec = sessionStartTime ? Math.max(1, Math.round((Date.now() - sessionStartTime) / 1000)) : 1;
  const avgSecPerQuestion = safeSessionCount > 0 ? Math.max(0, Math.round(elapsedSec / safeSessionCount)) : 0;
  const masteryGain = activeSkill && initialSkillScore !== null
    ? Math.max(0, Math.min(100, Math.round(activeSkill.score - initialSkillScore)))
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #1c1917 0%, #451a03 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">🏋️</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #f59e0b, #fcd34d)', WebkitBackgroundClip: 'text' }}>KHỔ LUYỆN (GRIND)</h1>
            <p className="math-subtitle text-gray-300">Dồn toàn lực nhồi 1 kỹ năng yếu nhất tới khi thành thạo.</p>
          </div>
        </div>
      </div>

      {!isPlaying && (
        <div className="text-center p-12 bg-[#0e1117] rounded-xl border border-[#334155] max-w-2xl mx-auto">
          <div className="text-6xl mb-6">🎯</div>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            AI sinh liên tục các câu nhắm đúng một kỹ năng, độ khó vừa tầm với năng lực hiện tại. Cày tới khi đạt {MASTERED_THRESHOLD}% mastery là thành thạo!
          </p>

          <div className="mb-8 max-w-sm mx-auto text-left">
            <label htmlFor="grindSkill" className="block text-sm text-gray-400 mb-2 font-bold">Chọn kỹ năng muốn nhồi</label>
            <select
              id="grindSkill"
              value={chosenSkill}
              onChange={(e) => setChosenSkill(e.target.value)}
              className="w-full bg-[#1b2533] border border-[#334155] text-white rounded-lg px-4 py-3 focus:border-amber-500 focus:outline-none"
            >
              <option value="">🤖 Tự động — kỹ năng yếu nhất của tôi</option>
              {ALL_SKILLS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={startGrind}
            disabled={isLoading}
            className={`bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-amber-950 font-black text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-transform ${
              isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'
            }`}
          >
            {isLoading ? 'ĐANG TẢI...' : 'BẮT ĐẦU KHỔ LUYỆN'}
          </button>
        </div>
      )}

      {isPlaying && (
        <>
          {/* Header: tên skill đang nhồi + thanh tiến độ mastery */}
          {activeSkill && (
            <div className="bg-[#1b2533] p-5 rounded-xl border border-[#262730]">
              <div className="flex justify-between items-center mb-3 gap-4">
                <div>
                  <span className="text-gray-400 text-sm">Đang nhồi kỹ năng:</span>
                  <h2 className="text-xl font-black text-amber-400">{activeSkill.label}</h2>
                </div>
                <button
                  onClick={() => { setIsPlaying(false); setQuestionData(null); loadMastery(); }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors whitespace-nowrap"
                >
                  Thoát phiên
                </button>
              </div>
              <div className="w-full bg-[#0e1117] rounded-full h-4 overflow-hidden border border-[#334155]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isMastered ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-amber-500 to-yellow-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-sm text-gray-400 mt-2">
                Mastery: <b className="text-white">{activeSkill.score}%</b> / {MASTERED_THRESHOLD}% (đã làm {activeSkill.attempts} câu)
              </div>
            </div>
          )}

          {/* =========================================================================
              POINT 68: THẺ TỔNG KẾT MINI PHIÊN LUYỆN (GRIND SESSION SUMMARY CARD)
              ========================================================================= */}
          <div className="bg-[#131b26] border border-amber-500/30 rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Phiên Khổ Luyện Hiện Tại</span>
                <div className="text-sm text-gray-200 font-medium">
                  Đã hoàn thành <strong className="text-amber-300 font-bold">{sessionCount}</strong> câu
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-6 text-center">
              <div className="bg-[#0b1017] px-3 py-1.5 rounded-lg border border-gray-800">
                <div className="text-[11px] text-gray-400">Độ chính xác</div>
                <div className={`text-sm font-bold ${accuracyPct >= 80 ? 'text-emerald-400' : accuracyPct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                  {accuracyPct}%
                </div>
              </div>

              <div className="bg-[#0b1017] px-3 py-1.5 rounded-lg border border-gray-800">
                <div className="text-[11px] text-gray-400">Tốc độ tb</div>
                <div className="text-sm font-bold text-sky-400">
                  {avgSecPerQuestion > 0 ? `${avgSecPerQuestion}s/câu` : '--'}
                </div>
              </div>

              <div className="bg-[#0b1017] px-3 py-1.5 rounded-lg border border-gray-800">
                <div className="text-[11px] text-gray-400">Mastery tăng</div>
                <div className="text-sm font-bold text-emerald-400">
                  +{masteryGain}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                Cột mốc kế tiếp: <strong className="text-amber-400">{Math.ceil((sessionCount + 1) / 5) * 5} câu</strong>
              </span>
            </div>
          </div>

          {/* Ăn mừng khi đạt mastered */}
          {isMastered && (
            <div className="text-center p-8 bg-[#022c22] rounded-xl border-2 border-[#10b981] shadow-[0_0_30px_rgba(16,185,129,0.25)]">
              <div className="text-5xl mb-3">🏆</div>
              <h2 className="text-2xl font-black text-emerald-400 mb-2">THÀNH THẠO KỸ NĂNG!</h2>
              <p className="text-gray-200 mb-6">Bạn đã làm chủ kỹ năng này. Chuyển sang mục tiêu kế tiếp nhé!</p>
              {nextSuggestion ? (
                <button
                  onClick={() => {
                    if (isLoading) return;
                    setChosenSkill(nextSuggestion.id);
                    setActiveSkillId(null);
                    generateQuestion();
                  }}
                  disabled={isLoading}
                  className={`bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-amber-950 font-black px-8 py-3 rounded-full transition-transform ${
                    isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'
                  }`}
                >
                  {isLoading ? 'Đang chuẩn bị...' : `Nhồi tiếp: ${nextSuggestion.label}`}
                </button>
              ) : (
                <p className="text-emerald-300 font-bold">Mọi kỹ năng đã thành thạo — quá đỉnh! 🎉</p>
              )}
            </div>
          )}

          {(isLoading || questionData) && (
            <div className="bg-[#0e1117] p-6 rounded-xl border border-[#f59e0b] shadow-lg">
              <CorePracticeUI
                questionData={questionData as PracticeQuestion}
                isLoading={isLoading}
                onSubmitted={handleQuestionSubmitted}
                onNext={generateQuestion}
              />
            </div>
          )}

          {/* =========================================================================
              POINT 68: MODAL CHÚC MỪNG CỘT MỐC SAU MỖI 5 CÂU (5, 10, 15...)
              ========================================================================= */}
          {showMilestoneModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#1b2533] border-2 border-amber-500 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center">
                  <div className="text-5xl mb-3">🔥</div>
                  <span className="text-xs font-bold text-amber-400 bg-amber-950/80 border border-amber-600/40 px-3 py-1 rounded-full uppercase">
                    Cột Mốc {sessionCount} Câu Khổ Luyện
                  </span>
                  <h3 className="text-2xl font-black text-white mt-3 mb-2">
                    Nỗ Lực Tuyệt Vời!
                  </h3>
                  <p className="text-sm text-gray-300 mb-6">
                    Bạn vừa hoàn thành thêm một chu kỳ 5 câu hỏi nhồi sâu. Đây là nhịp tập trung tối ưu để não bộ ghi nhớ kiến thức dài hạn.
                  </p>

                  {/* Summary Box */}
                  <div className="grid grid-cols-2 gap-3 mb-6 bg-[#0e1117] p-4 rounded-xl border border-gray-800 text-left">
                    <div>
                      <div className="text-xs text-gray-400">Số câu phiên này:</div>
                      <div className="text-lg font-extrabold text-amber-300">{sessionCount} câu</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Độ chính xác:</div>
                      <div className="text-lg font-extrabold text-emerald-400">{accuracyPct}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Thời gian trung bình:</div>
                      <div className="text-lg font-extrabold text-sky-400">{avgSecPerQuestion}s / câu</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Tiến độ Mastery:</div>
                      <div className="text-lg font-extrabold text-purple-400">+{masteryGain}%</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        setShowMilestoneModal(false);
                        generateQuestion();
                      }}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-black text-sm shadow-lg transition-all"
                    >
                      ⚡ Tiếp tục 5 câu nữa
                    </button>
                    <button
                      onClick={() => {
                        setShowMilestoneModal(false);
                        setIsPlaying(false);
                        setQuestionData(null);
                        loadMastery();
                      }}
                      className="py-3 px-4 rounded-xl bg-[#2a3649] hover:bg-[#35445c] text-gray-200 font-bold text-sm border border-gray-600 transition-all"
                    >
                      🔄 Đổi kỹ năng
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
