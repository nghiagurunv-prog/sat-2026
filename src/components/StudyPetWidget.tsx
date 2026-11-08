'use client';

import React from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';

// #C078: Mốc tiến hóa học thuật tương ứng với mục tiêu điểm SAT (1200 -> 1350 -> 1450 -> 1550+)
export interface PetEvolutionStage {
  stage: number;
  targetScore: string;
  name: string;
  icon: string;
  title: string;
  focus: string;
  statusBadge: string;
}

export const ACADEMIC_PET_STAGES: PetEvolutionStage[] = [
  {
    stage: 1,
    targetScore: '1200+',
    name: 'Cú Non Học Vấn',
    icon: '🦉',
    title: 'Nền Tảng Vững Vàng',
    focus: 'Triệt tiêu 100% sai sót ở các câu Easy & Medium. Nắm vững đại số cơ bản & dấu câu RW.',
    statusBadge: 'Nền Tảng',
  },
  {
    stage: 2,
    targetScore: '1350+',
    name: 'Sói Chiến Khởi Sắc',
    icon: '🐺',
    title: 'Bứt Phá Trung Cấp',
    focus: 'Tăng tốc độ làm bài < 1 phút/câu. Thành thạo phân tích bảng biểu & dạng đỉnh parabol.',
    statusBadge: 'Bứt Tốc',
  },
  {
    stage: 3,
    targetScore: '1450+',
    name: 'Đại Bàng Tinh Anh',
    icon: '🦅',
    title: 'Chinh Phục Câu Khó (Hard)',
    focus: 'Làm chủ Desmos đỉnh cao. Xử lý triệt để bẫy suy luận & văn bản đối sánh trong Reading.',
    statusBadge: 'Tinh Anh',
  },
  {
    stage: 4,
    targetScore: '1550+',
    name: 'Hắc Long Bất Bại',
    icon: '🐉',
    title: 'Top 1% Quốc Gia • Ivy League',
    focus: 'Phản xạ hoàn hảo 800/800 Math & 750+ RW. Sẵn sàng cạnh tranh học bổng toàn phần danh giá.',
    statusBadge: 'Thần Thoại',
  },
];

export function StudyPetWidget() {
  const { level = 1, activePet, equipPet } = useGamification();

  // Xác định mốc tiến hóa dựa trên cấp độ hoặc năng lực
  const currentStageIndex = Math.min(
    ACADEMIC_PET_STAGES.length - 1,
    Math.max(0, Math.floor((level - 1) / 2))
  );
  const currentPet = ACADEMIC_PET_STAGES[currentStageIndex];

  return (
    <div className="bg-gradient-to-br from-[#1e1b4b]/80 via-[#1b2533] to-[#0f172a] border border-pink-500/40 rounded-2xl p-5 shadow-xl text-slate-100 space-y-4">
      {/* Header Widget */}
      <div className="flex items-center justify-between border-b border-pink-500/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐾</span>
          <div>
            <h3 className="font-black text-white text-base flex items-center gap-2">
              Linh Thú Học Thuật Đồng Hành
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Giai Đoạn {currentPet.stage}/4
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Tiến hóa cùng năng lực điểm số Digital SAT thực tế</p>
          </div>
        </div>
        <Link
          href="/pets"
          className="text-xs text-pink-400 hover:text-pink-300 font-bold transition flex items-center gap-1"
        >
          Trang trại Linh Thú <span>→</span>
        </Link>
      </div>

      {/* Hiển thị linh thú hiện tại */}
      <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/10 to-transparent border border-pink-500/30 shadow-inner">
          <span className="text-5xl animate-bounce">{currentPet.icon}</span>
          <span className="absolute -top-1.5 -right-1.5 text-[10px] font-black px-1.5 py-0.2 rounded-full bg-pink-500 text-white shadow">
            LV {level}
          </span>
        </div>

        <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <span className="text-base font-black text-white">{currentPet.name}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Mục Tiêu SAT: {currentPet.targetScore}
            </span>
          </div>
          <div className="text-xs font-semibold text-pink-300">{currentPet.title}</div>
          <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
            {currentPet.focus}
          </p>
        </div>
      </div>

      {/* #C078: Lộ trình 4 Mốc Tiến Hóa Học Thuật */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span>📈 4 Cột Mốc Tiến Hóa Theo Điểm Số:</span>
          <span className="text-[11px] text-pink-400 font-normal">Học thật - Tiến hóa thật</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ACADEMIC_PET_STAGES.map((s, idx) => {
            const isReached = currentStageIndex >= idx;
            const isCurrent = currentStageIndex === idx;

            return (
              <div
                key={s.stage}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-b from-pink-500/20 to-purple-500/10 border-pink-400 shadow-md'
                    : isReached
                    ? 'bg-slate-900/80 border-slate-700 text-slate-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500 opacity-60'
                }`}
              >
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xs font-bold text-white truncate">{s.name}</div>
                <div className="text-[10px] font-black font-mono text-amber-300">{s.targetScore}</div>
                <div className="text-[9px] mt-1">
                  {isCurrent ? (
                    <span className="text-pink-300 font-bold">● Đang ở mốc này</span>
                  ) : isReached ? (
                    <span className="text-emerald-400">✓ Đã đạt</span>
                  ) : (
                    <span className="text-slate-500">🔒 Chưa mở</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StudyPetWidget;
