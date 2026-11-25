'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { evaluateUniAdmission, type VnUniversityProfile } from '@/lib/uni-benchmarks';

export function UniAdmissionSlider({ uni }: { uni: VnUniversityProfile }) {
  const [satScore, setSatScore] = useState<number>(uni.safeSat);
  const result = useMemo(() => evaluateUniAdmission(uni, satScore), [uni, satScore]);

  const badgeTone =
    result.verdict === 'strong'
      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
      : result.verdict === 'safe'
      ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
      : result.verdict === 'borderline'
      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
      : 'bg-rose-500/20 border-rose-400/50 text-rose-200';

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-indigo-500/30 p-6 space-y-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
            🎚️ Thanh trượt quy đổi SAT tương tác 2026
          </span>
          <h2 className="text-lg font-black text-white mt-0.5">
            Dự đoán xác suất trúng tuyển {uni.shortName}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Điểm SAT của bạn</div>
          <div className="text-3xl font-black text-amber-300 font-mono">{result.satScore}</div>
        </div>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={800}
          max={1600}
          step={10}
          value={satScore}
          onChange={(e) => setSatScore(Number(e.target.value))}
          aria-label={`Chọn điểm SAT quy đổi vào ${uni.shortName}`}
          className="w-full accent-amber-400 cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
          <span>800</span>
          <span>Sàn: {uni.minSat}</span>
          <span>An toàn: {uni.safeSat}</span>
          <span>Ngành Top: {uni.topMajorSat}</span>
          <span>1600</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400">Điểm quy đổi thang {result.scale}</div>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
            {result.converted} / {result.scale}
          </div>
        </div>
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400">Cách mốc an toàn ({uni.safeSat})</div>
          <div className="text-2xl font-black text-white mt-1 font-mono">
            {result.gapToSafe === 0 ? 'Đã đạt ✓' : `+${result.gapToSafe}đ`}
          </div>
        </div>
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400">Cách ngành Top 1 ({uni.topMajorSat})</div>
          <div className="text-2xl font-black text-amber-300 mt-1 font-mono">
            {result.gapToTop === 0 ? 'Vượt trội 👑' : `+${result.gapToTop}đ`}
          </div>
        </div>
      </div>

      <div className={`rounded-xl border px-4 py-3 text-xs font-bold ${badgeTone}`}>
        🎯 Đánh giá: {result.verdictVi}
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <Link
          href="/diagnostic"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs shadow transition"
        >
          🚀 Làm Test Xếp Lớp SAT Miễn Phí (3 phút)
        </Link>
        <Link
          href="/pricing"
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition"
        >
          💎 Xem Lộ Trình Bứt Phá Vào {uni.code}
        </Link>
      </div>
    </div>
  );
}
