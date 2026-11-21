'use client';

import React from 'react';
import { CENTER_BULK_PLANS, SCORE_GUARANTEE_POLICY } from '@/lib/subscription';

/**
 * B2B CENTER / SCHOOL LICENSE & SCORE GUARANTEE SECTION (Mục #25 & #27).
 * Dùng chung cho cả `/upgrade` và `/pricing` (Single Source of Truth, không lặp code).
 */
export function B2bCenterPricingSection() {
  return (
    <section className="mt-10 space-y-6">
      {/* Cam kết tăng +100 điểm SAT cho gói Ultimate */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-cyan-500/15 border border-amber-400/40 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            <span>🛡️</span>
            <span>Chính sách Bảo vệ Phụ huynh & Học viên SAT.Guru</span>
          </div>
          <h3 className="text-base md:text-lg font-black text-white">
            {SCORE_GUARANTEE_POLICY.headlineVi}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            {SCORE_GUARANTEE_POLICY.conditionVi}
          </p>
        </div>
        <div className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-center">
          <div className="text-xl font-black text-emerald-300">+{SCORE_GUARANTEE_POLICY.minGainPoints}đ</div>
          <div className="text-[10px] font-bold uppercase text-emerald-200">Score Guarantee</div>
        </div>
      </div>

      {/* Bảng gói B2B Giáo viên / Trung tâm Luyện thi */}
      <div className="rounded-2xl bg-[#111927] border border-[#24344d] p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1f2d42] pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              🏫 Giải pháp B2B cho Giáo viên & Trung tâm Luyện thi SAT
            </div>
            <h3 className="text-lg font-black text-white mt-0.5">
              Gói Bản Quyền Tổ Chức (Center / School Bulk Seats)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Tặng kèm Cổng Quản trị Giáo viên Supabase Realtime, Heatmap lỗ hổng lớp & Báo cáo tuần tự động cho Phụ huynh
            </p>
          </div>
          <a
            href="tel:0986722324"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-colors"
          >
            <span>📞</span> Tư vấn triển khai: 0986.722.324
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CENTER_BULK_PLANS.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl bg-[#0c1421] border border-[#253652] hover:border-cyan-400/60 p-5 flex flex-col justify-between gap-4 transition-all"
            >
              <div className="space-y-2.5">
                {plan.badge && (
                  <span className="inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                    {plan.badge}
                  </span>
                )}
                <h4 className="text-base font-black text-white">{plan.name}</h4>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-300">
                    {plan.totalPriceVnd.toLocaleString('vi-VN')}đ
                  </span>
                  <span className="text-[11px] text-slate-400">/ {plan.durationDays} ngày</span>
                </div>
                <div className="text-[11px] text-emerald-300 font-semibold">
                  Chỉ ~{plan.pricePerSeatVnd.toLocaleString('vi-VN')}đ / học sinh (Tiết kiệm {plan.discountPercent}%)
                </div>
                <ul className="space-y-1.5 pt-2 text-xs text-slate-300">
                  {plan.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 shrink-0">✓</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={`https://zalo.me/0986722324`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center py-2 rounded-lg bg-slate-800 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-400 text-xs font-bold text-cyan-200 transition-colors"
              >
                Đăng ký gói {plan.seats} ghế qua Zalo
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
