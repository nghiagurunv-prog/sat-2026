'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CENTER_BULK_PLANS, SCORE_GUARANTEE_POLICY } from '@/lib/subscription';

/**
 * B2B CENTER / SCHOOL LICENSE, SCORE GUARANTEE & 14-DAY AUTO TRIAL (Mục #25, #27 & W3 #39).
 * Dùng chung cho cả `/upgrade` và `/pricing` (Single Source of Truth).
 */
export function B2bCenterPricingSection() {
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [centerName, setCenterName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialResult, setTrialResult] = useState<{
    demoClassroomCode: string;
    joinPath: string;
    seatLimit: number;
    trialDays: number;
    message: string;
  } | null>(null);

  const handleSubmitTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setTrialError(null);
    try {
      const res = await fetch('/api/b2b/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centerName, contactName, phone, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setTrialError(data?.error || 'Không thể khởi tạo lớp dùng thử lúc này.');
        return;
      }
      setTrialResult({
        demoClassroomCode: data.demoClassroomCode,
        joinPath: data.joinPath,
        seatLimit: data.seatLimit,
        trialDays: data.trialDays,
        message: data.message,
      });
    } catch {
      setTrialError('Lỗi kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-10 space-y-6">
      {/* Cam kết tăng +100 điểm SAT cho gói Ultimate */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-cyan-500/15 border border-amber-400/40 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            <span>🛡️</span>
            <span>Chính sách Bảo vệ Phụ huynh &amp; Học viên SAT.Guru</span>
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1f2d42] pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              🏫 Giải pháp B2B cho Giáo viên &amp; Trung tâm Luyện thi SAT
            </div>
            <h3 className="text-lg font-black text-white mt-0.5">
              Gói Bản Quyền Tổ Chức (Center / School Bulk Seats)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Tặng kèm Cổng Quản trị Giáo viên Supabase Realtime, Heatmap lỗ hổng lớp &amp; Báo cáo tuần tự động cho Phụ huynh
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setTrialError(null);
                setShowTrialModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs shadow transition-colors"
            >
              <span>🚀</span> Dùng Thử 14 Ngày Tự Động (10 HS)
            </button>
            <a
              href="tel:0986722324"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition-colors"
            >
              <span>📞</span> 0986.722.324
            </a>
          </div>
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
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setTrialError(null);
                    setShowTrialModal(true);
                  }}
                  className="w-full text-center py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-bold text-cyan-200 transition-colors"
                >
                  ⚡ Tạo Lớp Demo 14 Ngày Ngay
                </button>
                <a
                  href="https://zalo.me/0986722324"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Tư vấn gói {plan.seats} ghế qua Zalo
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal cấp tài khoản dùng thử Trung tâm 14 ngày tự động (W3 #39) */}
      {showTrialModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111927] border border-cyan-500/40 p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowTrialModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                B2B Self-Serve Trial • Không cần chờ duyệt
              </span>
              <h4 className="text-lg font-black text-white">
                Tạo Lớp Dùng Thử 14 Ngày (10 Học Sinh)
              </h4>
              <p className="text-xs text-slate-400">
                Hệ thống sinh ngay mã lớp demo + link mời học sinh 1-chạm để Giáo viên trải nghiệm Cổng Lớp Học &amp; Giao đề Bluebook.
              </p>
            </div>

            {trialResult ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 p-4 text-xs text-emerald-200 space-y-2">
                  <div className="font-bold">{trialResult.message}</div>
                  <div>
                    Mã lớp demo: <strong className="font-mono text-amber-300 text-sm">{trialResult.demoClassroomCode}</strong>
                  </div>
                  <div>
                    Link mời 10 học sinh: <code className="text-sky-300">{trialResult.joinPath}</code>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/teacher"
                    className="flex-1 text-center py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs"
                  >
                    Mở Cổng Giáo Viên Ngay →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowTrialModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitTrial} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Tên Trung Tâm / Lớp Học *</label>
                  <input
                    type="text"
                    required
                    value={centerName}
                    onChange={(e) => setCenterName(e.target.value)}
                    placeholder="VD: Lớp SAT 1500+ Cô Lan Anh"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Họ tên Giáo viên / Quản lý *</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="VD: Nguyễn Lan Anh"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">SĐT / Zalo *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09xxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Email (tùy chọn)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="gv@center.edu.vn"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>
                {trialError && (
                  <div className="rounded-lg bg-rose-950/50 border border-rose-500/40 p-2.5 text-rose-200">
                    ⚠️ {trialError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow disabled:opacity-60"
                >
                  {submitting ? '⏳ Đang khởi tạo lớp demo...' : '🚀 Kích Hoạt Ngay Lớp Demo 14 Ngày'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
