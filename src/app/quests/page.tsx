'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { EmptyState } from '@/components/EmptyState';

type QuestTrack = 'answer' | 'vocab' | 'exam' | 'boss' | 'forge' | 'tree';
type DailyQuest = { 
  id: string; 
  progress: number; 
  target: number; 
  name: string; 
  desc: string; 
  claimed?: boolean; 
  xp: number; 
  coins: number; 
  track?: QuestTrack 
};

function questActionHref(q: DailyQuest): string {
  const lowerName = (q.name || '').toLowerCase();
  const lowerDesc = (q.desc || '').toLowerCase();

  if (q.track === 'vocab' || lowerName.includes('từ vựng') || lowerDesc.includes('vocab')) {
    return '/vocab';
  }
  if (q.track === 'boss' || lowerName.includes('boss') || lowerDesc.includes('đại boss') || lowerDesc.includes('khiêu chiến')) {
    return '/boss';
  }
  if (q.track === 'forge' || lowerName.includes('lò rèn') || lowerDesc.includes('câu sai') || lowerDesc.includes('forge')) {
    return '/forge';
  }
  if (lowerName.includes('tháp') || lowerDesc.includes('tower') || lowerDesc.includes('tầng')) {
    return '/tower';
  }
  if (q.track === 'tree' || lowerName.includes('kỹ năng') || lowerDesc.includes('skill tree')) {
    return '/skill-tree';
  }
  if (q.track === 'exam' || lowerName.includes('thi thử') || lowerDesc.includes('mock') || lowerDesc.includes('đề thi')) {
    return '/mock-exams';
  }
  
  // Mặc định kết nối trực tiếp vào Luyện Tập Thích Ứng Grind thay vì trang chủ
  return '/grind';
}

const WEEKLY_TARGET = 15;
const WEEKLY_CHEST_STORAGE_KEY = 'sat_weekly_chest_claimed_v1';
const WEEKLY_PROGRESS_STORAGE_KEY = 'sat_weekly_quest_progress_v1';

export default function QuestsPage() {
  const { quests, claimQuest, gamificationLoaded } = useGamification();
  const { showToast } = useToast();

  const [weeklyClaimed, setWeeklyClaimed] = useState(false);
  const [bonusWeeklyProgress, setBonusWeeklyProgress] = useState(8); // Điểm khởi đầu mô phỏng tích lũy tuần

  // Lock chống bấm đúp nhận thưởng (double-claim lock)
  const claimingRef = useRef<Set<string>>(new Set());
  const claimingWeeklyRef = useRef(false);

  // Khôi phục trạng thái Rương Tuần từ localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedClaimed = localStorage.getItem(WEEKLY_CHEST_STORAGE_KEY);
        if (storedClaimed === 'true') {
          setWeeklyClaimed(true);
        }

        const storedProgress = localStorage.getItem(WEEKLY_PROGRESS_STORAGE_KEY);
        if (storedProgress) {
          const val = parseInt(storedProgress, 10);
          if (!isNaN(val)) setBonusWeeklyProgress(val);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Tính số nhiệm vụ hàng ngày đã hoàn thành
  const completedDailyCount = quests?.daily
    ? quests.daily.filter((q: DailyQuest) => q.progress >= q.target).length
    : 0;

  const totalWeeklyCompleted = Math.min(WEEKLY_TARGET, bonusWeeklyProgress + completedDailyCount);
  const isWeeklyChestReady = totalWeeklyCompleted >= WEEKLY_TARGET;

  const handleClaimDaily = (id: string) => {
    if (claimingRef.current.has(id)) return;
    claimingRef.current.add(id);
    try {
      claimQuest(id);
    } finally {
      setTimeout(() => {
        claimingRef.current.delete(id);
      }, 500);
    }
  };

  const handleClaimWeeklyChest = () => {
    if (weeklyClaimed || !isWeeklyChestReady || claimingWeeklyRef.current) return;
    claimingWeeklyRef.current = true;

    setWeeklyClaimed(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(WEEKLY_CHEST_STORAGE_KEY, 'true');
        const currentGems = parseInt(localStorage.getItem('sat_user_gems') || '120', 10);
        localStorage.setItem('sat_user_gems', (currentGems + 1000).toString());
      }
    } catch (e) {
      console.error(e);
    }

    showToast('🎉 CHÚC MỪNG! Bạn đã mở [RƯƠNG THẦN THOẠI TUẦN], nhận 1,000 Kim Cương 💎 và 3 Vé Gate Exam!', 'success');
  };

  // Tính thời gian còn lại đến Chủ Nhật cuối tuần
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday
  const daysUntilSunday = (7 - dayOfWeek) % 7;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24 max-w-6xl mx-auto px-4 sm:px-6">
      {/* Header Sổ Tay Nhiệm Vụ */}
      <div 
        className="math-academy-header epic-shake-active relative overflow-hidden rounded-2xl p-6 sm:p-8 border border-blue-900/60 shadow-2xl" 
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #172554 100%)" }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="math-title-container flex items-center gap-4">
            <div className="math-icon text-5xl">📜</div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-blue-950/80 border border-blue-400/40 text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">
                <span>⚡ HỆ THỐNG GAMIFICATION CHUẨN DUOLINGO</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-sky-200 to-blue-400">
                SỔ TAY NHIỆM VỤ & THỬ THÁCH
              </h1>
              <p className="text-blue-100 text-sm mt-1 max-w-xl">
                Hoàn thành nhiệm vụ mỗi ngày theo vòng lặp 4 bước để tích lũy XP, cày Kim Cương và mở khóa Rương Thần Thoại Tuần!
              </p>
            </div>
          </div>

          {/* Huy hiệu tóm tắt nhanh */}
          <div className="flex items-center gap-4 bg-slate-900/80 border border-blue-500/30 p-3.5 rounded-xl shadow-lg">
            <div className="text-center px-2 border-r border-gray-700">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Nhiệm Vụ Hôm Nay</div>
              <div className="text-xl font-black text-sky-400">
                {completedDailyCount} / {quests?.daily?.length || 3}
              </div>
            </div>
            <div className="text-center px-2">
              <div className="text-[10px] text-amber-300 font-bold uppercase">Rương Tuần</div>
              <div className="text-xl font-black text-amber-400">
                {totalWeeklyCompleted}/{WEEKLY_TARGET}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VÒNG LẶP 4 BƯỚC CHUẨN DUOLINGO (THE 4-STEP MASTERY LOOP) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔄</span>
            <h2 className="text-xl font-black text-white tracking-tight">
              VÒNG LẶP 4 BƯỚC LUYỆN SAT CHUẨN DUOLINGO
            </h2>
          </div>
          <span className="text-xs text-blue-400 font-semibold hidden sm:inline">
            Chu trình vàng tăng 150-200 điểm SAT
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* BƯỚC 1: CÂY KỸ NĂNG */}
          <div className="group relative bg-[#131b2e] hover:bg-[#18233c] p-5 rounded-2xl border border-blue-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-500/40 flex items-center justify-center text-xl">
                  🌳
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  Bước 1
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors">
                  Chẩn Đoán Cây Kỹ Năng
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Quét toàn bộ 44 kỹ năng SAT để phát hiện lỗ hổng và xác định điểm yếu cần ưu tiên.
                </p>
              </div>
            </div>

            <Link
              href="/skill-tree"
              className="mt-4 w-full py-2 px-3 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl text-xs font-bold text-center border border-blue-500/40 transition flex items-center justify-center gap-1"
            >
              Xem Cây Kỹ Năng →
            </Link>
          </div>

          {/* BƯỚC 2: GRIND THÍCH ỨNG */}
          <div className="group relative bg-[#112328] hover:bg-[#162d34] p-5 rounded-2xl border border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-xl">
                  🎯
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Bước 2
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-base group-hover:text-emerald-300 transition-colors">
                  Luyện Tập Thích Ứng (Grind)
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Luyện câu hỏi được cá nhân hóa độ khó theo đúng ngưỡng năng lực của bạn.
                </p>
              </div>
            </div>

            <Link
              href="/grind"
              className="mt-4 w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-bold text-center border border-emerald-500/40 transition flex items-center justify-center gap-1"
            >
              Bắt Đầu Grind →
            </Link>
          </div>

          {/* BƯỚC 3: LÒ RÈN CÂU SAI */}
          <div className="group relative bg-[#2a1c12] hover:bg-[#342418] p-5 rounded-2xl border border-amber-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-500/40 flex items-center justify-center text-xl">
                  🔥
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Bước 3
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors">
                  Lò Rèn Câu Sai (Forge)
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Đúc lại toàn bộ câu sai bằng câu hỏi biến thể isomorphic để diệt tận gốc điểm mù.
                </p>
              </div>
            </div>

            <Link
              href="/forge"
              className="mt-4 w-full py-2 px-3 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-xl text-xs font-bold text-center border border-amber-500/40 transition flex items-center justify-center gap-1"
            >
              Vào Lò Rèn Rèn Lại →
            </Link>
          </div>

          {/* BƯỚC 4: ĐẤU TRƯỜNG BOSS */}
          <div className="group relative bg-[#2a1215] hover:bg-[#35181c] p-5 rounded-2xl border border-red-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-red-950 border border-red-500/40 flex items-center justify-center text-xl">
                  ⚔️
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40">
                  Bước 4
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-base group-hover:text-red-300 transition-colors">
                  Công Thành Đại Boss (/boss)
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Đánh bại 8 Đại Boss đại diện cho 8 Domain của SAT để đoạt Rương Báu Huyền Thoại.
                </p>
              </div>
            </div>

            <Link
              href="/boss"
              className="mt-4 w-full py-2 px-3 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-xl text-xs font-bold text-center border border-red-500/40 transition flex items-center justify-center gap-1"
            >
              Khiêu Chiến Boss Ngay →
            </Link>
          </div>
        </div>
      </section>

      {/* RƯƠNG THƯỞNG TUẦN (WEEKLY MILESTONE CHEST) */}
      <section className="bg-gradient-to-r from-[#17122a] via-[#1e173a] to-[#0f172a] rounded-2xl border border-amber-500/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`text-6xl p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 shadow-inner ${isWeeklyChestReady && !weeklyClaimed ? 'animate-bounce' : ''}`}>
              {weeklyClaimed ? '✅' : isWeeklyChestReady ? '🎁' : '🧰'}
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                <span>🏆 RƯƠNG THẦN THOẠI TUẦN (WEEKLY MILESTONE)</span>
              </div>
              <h3 className="text-2xl font-black text-white">
                Chinh Phục 15 Nhiệm Vụ Trong Tuần
              </h3>
              <p className="text-xs text-gray-300 max-w-lg">
                Phần thưởng siêu cấp: <strong className="text-amber-300">1,000 Kim Cương 💎</strong> + <strong className="text-sky-300">3 Vé Gate Exam 🎟️</strong> + <strong className="text-indigo-300">Huy Hiệu Chiến Binh Bất Diệt 🏅</strong>.
              </p>
            </div>
          </div>

          <div className="w-full lg:w-80 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-300">Tiến độ tuần:</span>
              <span className="text-amber-400 font-mono text-sm">
                {totalWeeklyCompleted} / {WEEKLY_TARGET} ({WEEKLY_TARGET > 0 ? Math.round((totalWeeklyCompleted / WEEKLY_TARGET) * 100) : 0}%)
              </span>
            </div>

            <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden border border-gray-700/60 p-0.5">
              <div 
                className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                style={{ width: `${WEEKLY_TARGET > 0 ? (totalWeeklyCompleted / WEEKLY_TARGET) * 100 : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
              <span>Làm mới sau: {daysUntilSunday > 0 ? `${daysUntilSunday} ngày nữa` : 'Đêm nay (Chủ Nhật)'}</span>

              {weeklyClaimed ? (
                <span className="px-3 py-1 rounded bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-500/40 text-xs">
                  ✓ Đã Nhận Thưởng
                </span>
              ) : isWeeklyChestReady ? (
                <button
                  onClick={handleClaimWeeklyChest}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-black text-xs shadow-lg animate-pulse transition"
                >
                  MỞ RƯƠNG NGAY 🎁
                </button>
              ) : (
                <span className="text-gray-400 text-xs italic">
                  Còn thiếu {WEEKLY_TARGET - totalWeeklyCompleted} nhiệm vụ
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* DANH SÁCH NHIỆM VỤ HÀNG NGÀY (DAILY QUESTS) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📅</span>
            <h2 className="text-xl font-black text-white tracking-tight">
              NHIỆM VỤ HÀNG NGÀY (DAILY QUESTS)
            </h2>
          </div>
          <span className="text-xs text-gray-400">
            Tự động làm mới vào 00:00 mỗi ngày
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {!gamificationLoaded ? (
            <div className="bg-[#1b2533] p-10 rounded-2xl border border-[#262730] text-center text-gray-400">
              <div className="text-3xl animate-spin mb-3">📜</div>
              Đang tải danh sách nhiệm vụ hôm nay...
            </div>
          ) : quests && quests.daily && quests.daily.length > 0 ? (
            quests.daily.map((q: DailyQuest, idx: number) => {
              const isDone = q.progress >= q.target;
              const percent = q.target > 0 ? Math.min(100, Math.max(0, Math.round((q.progress / q.target) * 100))) : 0;

              return (
                <div 
                  key={q.id || idx} 
                  className="bg-[#1b2533] hover:bg-[#202c3d] p-5 rounded-2xl border border-[#262730] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg transition-transform hover:scale-[1.005]"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-bold text-lg">{q.name}</h3>
                      {isDone && !q.claimed && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Sẵn sàng nhận thưởng
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">{q.desc}</p>
                    
                    {/* Tiến độ chi tiết */}
                    <div className="flex items-center gap-3 pt-1 max-w-md">
                      <div className="flex-1 bg-gray-900 h-2 rounded-full overflow-hidden border border-gray-700/60">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-blue-400 font-bold">
                        {q.progress}/{q.target}
                      </span>
                    </div>
                  </div>

                  {/* Nút hành động */}
                  <div className="flex items-center gap-3 shrink-0">
                    {q.claimed ? (
                      <button className="bg-[#1e293b] text-[#94a3b8] px-6 py-2.5 rounded-xl font-bold text-xs cursor-not-allowed border border-[#334155]">
                        ✓ Đã Nhận Thưởng
                      </button>
                    ) : isDone ? (
                      <button 
                        onClick={() => handleClaimDaily(q.id)} 
                        className="bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white px-6 py-2.5 rounded-xl font-black text-xs animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.4)] transition"
                      >
                        Nhận {q.xp} XP & {q.coins} Xu
                      </button>
                    ) : (
                      <Link
                        href={questActionHref(q)}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md text-center flex items-center justify-center gap-1.5"
                      >
                        <span>Thực Hiện Ngay</span>
                        <span>→</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState icon="📭" message="Không có nhiệm vụ nào hôm nay!" />
          )}
        </div>
      </section>

      {/* Banner Liên Kết Tháp Vô Tận & Đấu Trường Boss */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗼</span>
          <div>
            <div className="font-bold text-white text-sm">Tháp Vô Tận (Endless Tower) Đã Được Nâng Cấp!</div>
            <div>Bổ sung 3 Khiên Hộ Mệnh 🛡️ & Lưu Mốc Checkpoint mỗi 5 tầng.</div>
          </div>
        </div>
        <Link
          href="/tower"
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow"
        >
          Leo Tháp Ngay →
        </Link>
      </div>
    </div>
  );
}
