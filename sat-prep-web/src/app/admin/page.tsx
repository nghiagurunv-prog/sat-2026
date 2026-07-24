'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * ============================================================================
 *  ADMIN CONSOLE — trang quản trị (duyệt đổi quà + chi phí AI)
 * ============================================================================
 *  UI cho 2 API admin đã có: /api/admin/redemptions (duyệt phiếu đổi quà) +
 *  /api/admin/ai-cost (chi phí AI hôm nay). DUAL-AUTH (verifyAdminAccess):
 *   • Mặc định dùng SESSION-ADMIN — admin đăng nhập (role 'admin') → fetch kèm
 *     cookie tự động vào được, KHÔNG cần nhập gì.
 *   • Nếu API trả 403 (session chưa có role / chưa migrate) → hiện ô nhập
 *     ADMIN_SECRET làm đường dự phòng; secret gửi qua header x-admin-secret.
 *
 *  Trang này middleware để PUBLIC ('/admin' prefix) — nó KHÔNG lộ gì cho tới khi
 *  API (server-side gate) trả dữ liệu. Không có secret + không session-admin →
 *  API 403 → trang chỉ hiện form nhập secret.
 * ============================================================================
 */

interface Redemption {
  id: string;
  userId: string;
  rewardId: string;
  rewardName: string;
  costCoins: number;
  status: string;
  createdAt: string;
  fulfilledAt: string | null;
}

interface CostReport {
  date: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  budgetUsd: number;
  remainingUsd: number;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [needSecret, setNeedSecret] = useState(false); // true khi API 403 → yêu cầu secret
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [cost, setCost] = useState<CostReport | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null); // id phiếu đang xử lý

  /** Headers kèm secret (nếu có) — session-admin qua cookie tự động, secret là dự phòng. */
  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => {
      const h: Record<string, string> = { ...extra };
      if (secret) h['x-admin-secret'] = secret;
      return h;
    },
    [secret]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch('/api/admin/redemptions', { headers: authHeaders(), cache: 'no-store' }),
        fetch('/api/admin/ai-cost', { headers: authHeaders(), cache: 'no-store' }),
      ]);

      // 403 ở CẢ hai → chưa có quyền: yêu cầu secret (hoặc đăng nhập admin).
      if (rRes.status === 403 || cRes.status === 403) {
        setNeedSecret(true);
        setRedemptions([]);
        setCost(null);
        setError(
          secret
            ? 'Secret sai hoặc tài khoản không có quyền admin.'
            : 'Cần quyền admin: đăng nhập bằng tài khoản admin, hoặc nhập ADMIN_SECRET bên dưới.'
        );
        return;
      }
      if (rRes.status === 429 || cRes.status === 429) {
        setError('Quá nhiều lần thử. Vui lòng chờ 1 phút rồi thử lại.');
        return;
      }

      setNeedSecret(false);
      if (rRes.ok) {
        const d = await rRes.json();
        setRedemptions(Array.isArray(d.redemptions) ? d.redemptions : []);
      }
      if (cRes.ok) {
        setCost(await cRes.json());
      }
    } catch {
      setError('Lỗi kết nối. Kiểm tra mạng rồi thử lại.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, secret]);

  useEffect(() => {
    // Defer khỏi pha chạy đồng bộ của effect: load() gọi setLoading(true) ngay —
    // gọi trực tiếp sẽ vi phạm react-hooks/set-state-in-effect. queueMicrotask
    // đẩy setState sang tick sau (hành vi y hệt, chỉ lệch 1 microtask).
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // lần đầu thử session-admin (không secret)

  const act = async (id: string, action: 'fulfill' | 'cancel') => {
    const label = action === 'fulfill' ? 'GIAO quà (đánh dấu đã xử lý)' : 'HỦY phiếu (HOÀN xu cho user)';
    if (!window.confirm(`Xác nhận ${label} cho phiếu ${id}?`)) return;

    setRowBusy(id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/redemptions', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ redemptionId: id, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        const extra = action === 'cancel' && typeof d.coins === 'number' ? ` — số dư user: ${d.coins} xu` : '';
        setNotice(
          `✅ ${action === 'fulfill' ? 'Đã giao' : 'Đã hủy + hoàn xu'} phiếu ${id}${d.idempotent ? ' (đã ở trạng thái này)' : ''}${extra}`
        );
        // Bỏ phiếu khỏi danh sách pending (đã rời hàng đợi).
        setRedemptions((prev) => prev.filter((r) => r.id !== id));
      } else {
        setError(`❌ ${d.error ?? 'Không xử lý được phiếu.'}`);
      }
    } catch {
      setError('❌ Lỗi kết nối khi xử lý phiếu.');
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e1117] p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-amber-400">🛠️ Bảng điều khiển Admin</h1>
            <p className="text-sm text-slate-400">Duyệt phiếu đổi quà + theo dõi chi phí AI</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-sm font-bold transition hover:border-amber-400/50 disabled:opacity-50"
          >
            {loading ? 'Đang tải…' : '🔄 Làm mới'}
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-300">{error}</div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-300">{notice}</div>
        )}

        {/* Ô nhập secret — chỉ hiện khi API 403 (session chưa đủ quyền admin). */}
        {needSecret && (
          <div className="rounded-xl border border-amber-400/20 bg-slate-900/70 p-4">
            <label htmlFor="admin-secret" className="mb-2 block text-sm font-bold text-slate-300">
              🔑 ADMIN_SECRET (đường dự phòng nếu tài khoản chưa gán role admin)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="admin-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="Dán ADMIN_SECRET…"
                className="flex-1 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
              <button
                onClick={load}
                disabled={loading || !secret}
                className="rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-50"
              >
                Xác thực
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Khuyên dùng: đăng nhập bằng tài khoản đã gán role admin → không cần nhập secret.
            </p>
          </div>
        )}

        {/* Panel chi phí AI */}
        {cost && (
          <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
            <h2 className="mb-3 text-lg font-bold text-slate-200">
              💸 Chi phí AI hôm nay <span className="text-xs font-normal text-slate-500">({cost.date})</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Lượt gọi" value={cost.calls.toLocaleString('vi-VN')} />
              <Stat label="Token vào / ra" value={`${cost.tokensIn.toLocaleString('vi-VN')} / ${cost.tokensOut.toLocaleString('vi-VN')}`} />
              <Stat label="Đã tiêu" value={`$${cost.costUsd.toFixed(4)}`} />
              <Stat
                label="Còn lại / ngân sách"
                value={`$${cost.remainingUsd.toFixed(2)} / $${cost.budgetUsd.toFixed(2)}`}
                warn={cost.remainingUsd <= 0}
              />
            </div>
            {cost.remainingUsd <= 0 && (
              <p className="mt-3 text-sm font-medium text-red-300">
                ⚠️ Đã hết ngân sách AI hôm nay — kill-switch đang chặn gọi AI mới (generate-practice degrade về Question Bank).
              </p>
            )}
          </section>
        )}

        {/* Hàng đợi phiếu đổi quà */}
        <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
          <h2 className="mb-3 text-lg font-bold text-slate-200">
            🎁 Phiếu đổi quà chờ xử lý{' '}
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">{redemptions.length}</span>
          </h2>

          {!loading && redemptions.length === 0 && !needSecret && (
            <p className="py-8 text-center text-sm text-slate-500">✨ Không có phiếu nào chờ xử lý.</p>
          )}

          {redemptions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Quà</th>
                    <th className="py-2 pr-3">Giá (xu)</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Lúc</th>
                    <th className="py-2 pr-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((r) => (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="py-3 pr-3 font-semibold text-slate-100">{r.rewardName}</td>
                      <td className="py-3 pr-3 text-amber-300">{r.costCoins.toLocaleString('vi-VN')}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-slate-400" title={r.userId}>
                        {r.userId.slice(0, 8)}…
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-400">{fmtTime(r.createdAt)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => act(r.id, 'fulfill')}
                            disabled={rowBusy === r.id}
                            className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {rowBusy === r.id ? '…' : '✅ Giao'}
                          </button>
                          <button
                            onClick={() => act(r.id, 'cancel')}
                            disabled={rowBusy === r.id}
                            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                          >
                            {rowBusy === r.id ? '…' : '↩️ Hủy + hoàn xu'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-600">
          Hành động ở đây là server-authoritative: “Giao” đánh dấu đã xử lý (không hoàn xu), “Hủy” hoàn xu cho user (idempotent, không hoàn 2 lần).
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? 'border-red-500/40 bg-red-500/10' : 'border-white/10 bg-slate-800/40'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-base font-bold ${warn ? 'text-red-300' : 'text-slate-100'}`}>{value}</div>
    </div>
  );
}
