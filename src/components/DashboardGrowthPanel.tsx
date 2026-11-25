'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TrapBreakdownItem {
  key: string;
  label: string;
  count: number;
  percent: number;
  adviceVi: string;
}

interface TrapsResponse {
  totalMistakes: number;
  box1UrgentCount: number;
  breakdown: TrapBreakdownItem[];
  weeklySummaryVi: string;
}

interface FreezeResponse {
  hasSubscription: boolean;
  tier?: string;
  expiresAt?: string;
  freezeUsed?: boolean;
  isFrozen?: boolean;
  frozenUntil?: string | null;
  frozenDays?: number;
  canFreeze?: boolean;
  reason?: string | null;
}

/**
 * DASHBOARD GROWTH & RETENTION PANEL (W2 #11, #20, #24, #25):
 * 1. Biểu đồ Phân Tích Mẫu Bẫy Tư Duy Hằng Tuần (Cognitive Trap Analytics — #11)
 * 2. Thẻ Ảnh Chia Sẻ Kết Quả Diagnostic lên Zalo/Facebook (#20)
 * 3. Đóng Băng / Bảo Lưu Gói Học 7–14 Ngày Mùa Thi Học Kỳ (#25)
 * 4. Mã Giới Thiệu Bạn Bè Thưởng +300 Xu Học Thuật (#24)
 */
export function DashboardGrowthPanel({
  totalScore,
  mathScore,
  rwScore,
  targetScore,
  weakLabels,
}: {
  totalScore: number;
  mathScore: number;
  rwScore: number;
  targetScore: number;
  weakLabels: string[];
}) {
  const [traps, setTraps] = useState<TrapsResponse | null>(null);
  const [freeze, setFreeze] = useState<FreezeResponse | null>(null);
  const [freezeDays, setFreezeDays] = useState<number>(7);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [freezeMsg, setFreezeMsg] = useState<string | null>(null);

  const [refCode, setRefCode] = useState('');
  const [refBusy, setRefBusy] = useState(false);
  const [refMsg, setRefMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedOg, setCopiedOg] = useState(false);

  useEffect(() => {
    fetch('/api/analytics/traps')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setTraps(d);
      })
      .catch(() => {});

    fetch('/api/subscription/freeze')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setFreeze(d);
      })
      .catch(() => {});
  }, []);

  const ogQuery = new URLSearchParams({
    total: String(totalScore || 1350),
    math: String(mathScore || 700),
    rw: String(rwScore || 650),
    target: String(targetScore || 1450),
    weak: (weakLabels.length > 0 ? weakLabels.slice(0, 3) : ['Linear Equations', 'Boundaries', 'Words in Context']).join('|'),
  }).toString();
  const ogCardUrl = `/api/og/diagnostic?${ogQuery}`;

  const handleFreeze = async () => {
    if (freezeBusy) return;
    setFreezeBusy(true);
    setFreezeMsg(null);
    try {
      const res = await fetch('/api/subscription/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: freezeDays }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setFreezeMsg(`✅ ${data.message}`);
        setFreeze((prev) =>
          prev
            ? {
                ...prev,
                canFreeze: false,
                freezeUsed: true,
                isFrozen: true,
                frozenDays: data.frozenDays,
                frozenUntil: data.frozenUntil,
                expiresAt: data.newExpiresAt,
              }
            : prev
        );
      } else {
        setFreezeMsg(`⚠️ ${data?.error || 'Không thể bảo lưu gói lúc này.'}`);
      }
    } catch {
      setFreezeMsg('⚠️ Lỗi kết nối tới máy chủ.');
    } finally {
      setFreezeBusy(false);
    }
  };

  const handleClaimReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refCode.trim() || refBusy) return;
    setRefBusy(true);
    setRefMsg(null);
    try {
      const res = await fetch('/api/referral/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: refCode.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setRefMsg({ ok: true, text: data.message });
        setRefCode('');
      } else {
        setRefMsg({ ok: false, text: data?.error || 'Không thể nhận thưởng mã giới thiệu.' });
      }
    } catch {
      setRefMsg({ ok: false, text: 'Lỗi kết nối.' });
    } finally {
      setRefBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Cognitive Trap Analytics (#11) */}
      <div className="bg-[#1b2533] p-5 rounded-xl border border-[#262730] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🧠</span> Phân Tích Mẫu Bẫy Tư Duy Tuần Này
            </h3>
            <p className="text-xs text-slate-400">
              Phân biệt rõ mất điểm do cẩu thả, bẫy thời gian hay hổng kiến thức cốt lõi.
            </p>
          </div>
          {traps && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
              {traps.box1UrgentCount} câu Hộp 1
            </span>
          )}
        </div>

        {traps && traps.totalMistakes > 0 ? (
          <div className="space-y-2.5">
            {traps.breakdown.slice(0, 4).map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-200 font-semibold">{item.label}</span>
                  <span className="text-amber-300 font-mono font-bold">
                    {item.count} câu ({item.percent}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full"
                    style={{ width: `${Math.max(4, item.percent)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-2.5">
              💡 {traps.weeklySummaryVi}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg p-4">
            Chưa ghi nhận câu sai tuần này. Khi bạn luyện bài, AI sẽ tự động phân loại bẫy tư duy tại đây.
          </div>
        )}
      </div>

      {/* 2. Diagnostic OG Share Card (#20) + Subscription Freeze (#25) + Referral Coins (#24) */}
      <div className="space-y-4">
        {/* Thẻ chia sẻ kết quả Diagnostic OG lên Zalo/Facebook */}
        <div className="bg-[#1b2533] p-5 rounded-xl border border-indigo-500/30 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🎨</span> Thẻ Điểm Dự Đoán Chia Sẻ Zalo / Facebook
            </h3>
            <a
              href={ogCardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-sky-400 hover:underline"
            >
              Xem ảnh HD ↗
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={ogCardUrl}
              download={`SAT-Guru-${totalScore || 1350}.svg`}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              ⬇️ Tải Thẻ Điểm ({totalScore || 1350}/1600)
            </a>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && navigator.clipboard) {
                  const full = `${window.location.origin}${ogCardUrl}`;
                  navigator.clipboard.writeText(full).then(() => {
                    setCopiedOg(true);
                    setTimeout(() => setCopiedOg(false), 2500);
                  });
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 transition"
            >
              {copiedOg ? '✓ Đã sao chép link ảnh OG!' : '📲 Copy Link Khoe Điểm Zalo'}
            </button>
          </div>
        </div>

        {/* Đóng băng gói học 7–14 ngày mùa thi học kỳ (#25) & Nhập mã giới thiệu (+300 Xu — #24) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#1b2533] p-4 rounded-xl border border-emerald-500/30 space-y-2.5">
            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <span>❄️</span> Bảo Lưu Gói Mùa Thi Học Kỳ
            </div>
            {freeze?.hasSubscription ? (
              <>
                <p className="text-[11px] text-slate-300">
                  Bận thi giữa kỳ/cuối kỳ? Đóng băng gói 7–14 ngày (1 lần/chu kỳ), ngày hết hạn tự động cộng dồn.
                </p>
                {freeze.canFreeze ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={freezeDays}
                      onChange={(e) => setFreezeDays(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      <option value={7}>7 ngày</option>
                      <option value={10}>10 ngày</option>
                      <option value={14}>14 ngày</option>
                    </select>
                    <button
                      type="button"
                      disabled={freezeBusy}
                      onClick={handleFreeze}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-60"
                    >
                      {freezeBusy ? '...' : 'Bảo lưu ngay'}
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-300">
                    {freeze.isFrozen
                      ? `Đang bảo lưu (${freeze.frozenDays} ngày).`
                      : freeze.reason || 'Bạn đã dùng quyền bảo lưu chu kỳ này.'}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[11px] text-slate-400">
                Đặc quyền gói Premium/Ultimate.{' '}
                <Link href="/pricing" className="text-amber-300 font-bold hover:underline">
                  Xem bảng giá →
                </Link>
              </p>
            )}
            {freezeMsg && <div className="text-[11px] text-slate-200">{freezeMsg}</div>}
          </div>

          <form
            onSubmit={handleClaimReferral}
            className="bg-[#1b2533] p-4 rounded-xl border border-amber-500/30 space-y-2.5"
          >
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <span>🎁</span> Nhập Mã Bạn Bè (+300 Xu)
            </div>
            <p className="text-[11px] text-slate-400">
              Hoàn thành Diagnostic + nhập mã giới thiệu để nhận 300 Xu học thuật đổi tài liệu/quà.
            </p>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                placeholder="SAT-XXXXXX"
                className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white uppercase"
              />
              <button
                type="submit"
                disabled={refBusy}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 disabled:opacity-60"
              >
                Nhận
              </button>
            </div>
            {refMsg && (
              <div className={`text-[11px] ${refMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                {refMsg.text}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
