'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';

interface DailyQuestItem {
  id: string;
  name: string;
  desc: string;
  progress: number;
  target: number;
  claimed?: boolean;
  xp: number;
  coins: number;
}

export type IntensityMode = 'warmup' | 'standard' | 'deep';

const STREAK_SHIELD_KEY = 'sat_exam_streak_shield_v1';
const INTENSITY_MODE_KEY = 'sat_daily_intensity_mode_v1';

export function DailyQuestsWidget() {
  const { quests, claimQuest } = useGamification();
  const streak = 0;
  const { showToast } = useToast();

  // #C071: Khiên Bảo Vệ Streak Mùa Thi Học Kỳ
  const [shieldActive, setShieldActive] = useState<boolean>(false);
  const [shieldDaysLeft, setShieldDaysLeft] = useState<number>(7);

  // #C077: Chế độ cường độ ngày
  const [intensityMode, setIntensityMode] = useState<IntensityMode>('standard');

  // Khôi phục trạng thái từ localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedShield = localStorage.getItem(STREAK_SHIELD_KEY);
        if (savedShield === 'true') {
          setShieldActive(true);
        }
        const savedMode = localStorage.getItem(INTENSITY_MODE_KEY) as IntensityMode;
        if (savedMode && ['warmup', 'standard', 'deep'].includes(savedMode)) {
          setIntensityMode(savedMode);
        }
      }
    } catch (e) {
      console.error('Error loading widget state:', e);
    }
  }, []);

  const handleToggleShield = () => {
    const nextState = !shieldActive;
    setShieldActive(nextState);
    try {
      localStorage.setItem(STREAK_SHIELD_KEY, String(nextState));
      if (nextState) {
        showToast('🛡️ Đã kích hoạt [Khiên Bảo Vệ Streak Mùa Thi]! Chuỗi học được bảo toàn an toàn trong 7 ngày tới.', 'success');
      } else {
        showToast('ℹ️ Đã tắt Khiên Bảo Vệ Streak.', 'info');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectIntensity = (mode: IntensityMode) => {
    setIntensityMode(mode);
    try {
      localStorage.setItem(INTENSITY_MODE_KEY, mode);
      const labels = {
        warmup: 'Khởi động 5p (5 câu)',
        standard: 'Tiêu chuẩn 20p (15 câu + 1 đề)',
        deep: 'Chuyên sâu 45p (1 Module + Phân tích lỗi)',
      };
      showToast(`🎯 Chế độ học hôm nay: ${labels[mode]}`, 'success');
    } catch (e) {
      console.error(e);
    }
  };

  const dailyList: DailyQuestItem[] = quests?.daily || [
    { id: 'q1', name: 'Luyện 10 câu Math', desc: 'Hoàn thành 10 câu Đại số tuyến tính', progress: 7, target: 10, xp: 50, coins: 20 },
    { id: 'q2', name: 'Đọc hiểu RW', desc: 'Làm đúng 5 câu hỏi Craft & Structure', progress: 5, target: 5, xp: 60, coins: 30 },
    { id: 'q3', name: 'Khắc phục 1 lỗi sai', desc: 'Ôn tập câu hỏi trong Sổ tay lỗi sai', progress: 1, target: 1, xp: 40, coins: 15, claimed: true },
  ];

  return (
    <div className="bg-[#1b2533] border border-blue-900/50 rounded-2xl p-5 shadow-xl space-y-5 text-slate-100">
      {/* Header Widget */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <div>
            <h3 className="font-black text-white text-base flex items-center gap-2">
              Nhiệm Vụ Hàng Ngày
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                🔥 {streak} ngày
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Vòng lặp học tập hàng ngày - Bền bỉ mỗi ngày để đạt 1500+</p>
          </div>
        </div>
        <Link
          href="/quests"
          className="text-xs text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-1"
        >
          Chi tiết <span>→</span>
        </Link>
      </div>

      {/* #C071: Nút bật Khiên Bảo Vệ Streak Mùa Thi Học Kỳ */}
      <div className={`p-3.5 rounded-xl border transition-all ${
        shieldActive
          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
          : 'bg-slate-900/60 border-slate-700/60'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{shieldActive ? '🛡️' : '⏱️'}</span>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                Khiên Bảo Vệ Streak Mùa Thi Học Kỳ
                {shieldActive && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    ĐANG BẬT ({shieldDaysLeft} ngày)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Bảo lưu chuỗi Streak không bị reset khi bạn bận thi giữa kỳ / học kỳ tại trường THPT.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleShield}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              shieldActive
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
            }`}
          >
            {shieldActive ? '✓ Đang Bật' : 'Bật Khiên'}
          </button>
        </div>
      </div>

      {/* #C077: Nhãn chế độ cường độ ngày */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span>⚡</span> Cường Độ Học Hôm Nay:
          </span>
          <span className="text-[11px] text-amber-400 font-normal">Tùy biến theo thời gian rảnh</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'warmup', label: 'Khởi động', time: '5 phút', count: '5 câu', color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30' },
            { id: 'standard', label: 'Tiêu chuẩn', time: '20 phút', count: '15 câu', color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/40' },
            { id: 'deep', label: 'Chuyên sâu', time: '45 phút', count: '1 Module', color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30' },
          ].map((item) => {
            const isSelected = intensityMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectIntensity(item.id as IntensityMode)}
                className={`p-2 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'bg-gradient-to-b from-blue-600/30 to-blue-800/30 border-blue-400 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <div className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                  {item.label}
                </div>
                <div className="text-[10px] text-amber-300 font-mono mt-0.5">{item.time}</div>
                <div className="text-[9px] text-slate-400">{item.count}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh sách nhiệm vụ nhanh */}
      <div className="space-y-2.5">
        {dailyList.map((q) => {
          const isDone = q.progress >= q.target;
          return (
            <div
              key={q.id}
              className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold text-white truncate">{q.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{q.desc}</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all"
                    style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-slate-400 font-mono mb-1">
                  {q.progress}/{q.target}
                </div>
                {q.claimed ? (
                  <span className="text-[10px] text-slate-500 font-bold">✓ Đã nhận</span>
                ) : isDone ? (
                  <button
                    onClick={() => {
                      claimQuest(q.id);
                      showToast(`🎁 Đã nhận +${q.xp} XP và +${q.coins} Xu!`, 'success');
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-2.5 py-1 rounded text-[11px] shadow animate-pulse"
                  >
                    Nhận
                  </button>
                ) : (
                  <span className="text-[10px] text-amber-400 font-medium">+{q.coins} Xu</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* #C079: Lời nhắc Pomodoro Care Chống Burnout */}
      <div className="bg-gradient-to-r from-teal-950/40 to-slate-900/60 p-3 rounded-xl border border-teal-500/30 flex items-center gap-3">
        <span className="text-2xl shrink-0">🌿</span>
        <div className="text-[11px] text-slate-300 leading-snug">
          <strong className="text-teal-300">Pomodoro Care:</strong> Não bộ ghi nhớ kiến thức tốt nhất ở nhịp 25 phút tập trung + 5 phút giải lao. Đừng quên uống nước và rời mắt khỏi màn hình để bảo toàn thể lực mùa thi!
        </div>
      </div>
    </div>
  );
}

export default DailyQuestsWidget;
