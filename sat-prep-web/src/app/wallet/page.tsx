'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/context/ToastContext';
import {
  ECOSYSTEM_APPS,
  TOPUP_PRESETS_VND,
  WALLET_CATALOG,
  MIN_TOPUP_VND,
  type EcosystemAppCode,
  type WalletCatalogItem,
} from '@/lib/wallet-catalog';

interface WalletSummaryState {
  authenticated: boolean;
  user: { id: string; email: string | null } | null;
  wallet: {
    balanceVnd: number;
    totalDepositedVnd: number;
    totalSpentVnd: number;
    updatedAt: string | null;
  };
  entitlements: Array<{
    appCode: EcosystemAppCode;
    tier: string;
    period: string;
    startedAt: string;
    expiresAt: string;
    active: boolean;
  }>;
  ledger: Array<{
    id: string;
    entryType: 'topup' | 'purchase' | 'refund' | 'admin_adjust';
    amountVnd: number;
    balanceAfterVnd: number;
    refId: string | null;
    appCode: string | null;
    description: string;
    createdAt: string;
  }>;
  topups: Array<{
    orderId: string;
    gateway: string;
    amountVnd: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }>;
}

function fmtVnd(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('vi-VN') + '₫';
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function WalletStatusBanner() {
  const params = useSearchParams();
  const status = params.get('status');
  const order = params.get('order');
  if (!status) return null;

  const meta: Record<string, { cls: string; msg: string }> = {
    paid: {
      cls: 'bg-emerald-950/80 border-emerald-500 text-emerald-200',
      msg: `🎉 Nạp tiền thành công${order ? ` (Đơn #${order})` : ''}! Số dư Ví đã được cộng tự động — bạn có thể chọn mua bất kỳ gói học nào bên dưới ngay lập tức.`,
    },
    processing: {
      cls: 'bg-sky-950/80 border-sky-500 text-sky-200',
      msg: `⏳ Đang chờ ngân hàng xác nhận giao dịch${order ? ` #${order}` : ''}. Số dư Ví sẽ tự động cập nhật trong 10–30 giây (bấm Làm mới số dư nếu chưa thấy).`,
    },
    pending: {
      cls: 'bg-sky-950/80 border-sky-500 text-sky-200',
      msg: `⏳ Giao dịch${order ? ` #${order}` : ''} đang chờ hoàn tất. Sau khi chuyển khoản, Ví sẽ tự cộng tiền 24/7.`,
    },
    cancelled: {
      cls: 'bg-amber-950/70 border-amber-500 text-amber-200',
      msg: '⚠️ Bạn đã hủy giao dịch nạp tiền. Bạn có thể tạo lại lệnh nạp bất cứ lúc nào.',
    },
    failed: {
      cls: 'bg-rose-950/80 border-rose-500 text-rose-200',
      msg: '❌ Giao dịch nạp tiền chưa thành công. Nếu đã bị trừ tiền ngân hàng, vui lòng liên hệ Zalo 0986.722.324 để đối soát ngay.',
    },
  };

  const view = meta[status] ?? meta.pending;
  return <div className={`px-4 py-3 rounded-xl border-2 text-sm font-bold ${view.cls}`}>{view.msg}</div>;
}

function WalletHubContent() {
  const { showToast } = useToast();
  const topupSectionRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<WalletSummaryState>({
    authenticated: false,
    user: null,
    wallet: { balanceVnd: 0, totalDepositedVnd: 0, totalSpentVnd: 0, updatedAt: null },
    entitlements: [],
    ledger: [],
    topups: [],
  });
  const [loading, setLoading] = useState(true);

  // Auth inline state (Tạo TK / Đăng nhập ngay trên 1 trang)
  const [authTab, setAuthTab] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Topup state
  const [topupAmount, setTopupAmount] = useState<number>(500_000);
  const [topupGateway, setTopupGateway] = useState<'payos' | 'stripe'>('payos');
  const [topupBusy, setTopupBusy] = useState(false);

  // Catalog & Purchase state
  const [activeCategory, setActiveCategory] = useState<'all' | EcosystemAppCode | 'combo'>('all');
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wallet', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData({
          authenticated: Boolean(json.authenticated),
          user: json.user ?? null,
          wallet: json.wallet ?? { balanceVnd: 0, totalDepositedVnd: 0, totalSpentVnd: 0, updatedAt: null },
          entitlements: Array.isArray(json.entitlements) ? json.entitlements : [],
          ledger: Array.isArray(json.ledger) ? json.ledger : [],
          topups: Array.isArray(json.topups) ? json.topups : [],
        });
      }
    } catch {
      // ignore transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password || password.length < 6) {
      showToast('⚠️ Vui lòng nhập email hợp lệ và mật khẩu tối thiểu 6 ký tự.', 'error');
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const supabase = createClient();
      if (authTab === 'signup') {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: fullName.trim() ? { full_name: fullName.trim() } : undefined,
            emailRedirectTo:
              typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/wallet` : undefined,
          },
        });
        if (error) {
          showToast(`❌ ${error.message}`, 'error');
          return;
        }
        if (signUpData.session) {
          showToast('🎉 Tạo tài khoản & đăng nhập thành công! Bạn có thể nạp tiền ngay.', 'success');
          await fetchWallet();
        } else {
          setAuthMessage(
            '✅ Đã tạo tài khoản! Vui lòng mở hộp thư email để bấm link xác nhận, sau đó quay lại đây đăng nhập nạp tiền.'
          );
          showToast('📧 Kiểm tra email để xác thực tài khoản!', 'info');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          showToast(`❌ Sai email hoặc mật khẩu (${error.message})`, 'error');
          return;
        }
        showToast('✅ Đăng nhập thành công! Đã mở Ví tài khoản chung.', 'success');
        await fetchWallet();
      }
    } catch {
      showToast('❌ Lỗi kết nối tới hệ thống đăng nhập.', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topupBusy) return;
    if (!data.authenticated) {
      showToast('🔐 Vui lòng tạo tài khoản hoặc đăng nhập ở bước 1 trước khi nạp tiền.', 'error');
      return;
    }
    if (!Number.isFinite(topupAmount) || topupAmount < MIN_TOPUP_VND || topupAmount % 1000 !== 0) {
      showToast(`⚠️ Số tiền nạp tối thiểu ${fmtVnd(MIN_TOPUP_VND)} và là bội số của 1.000₫.`, 'error');
      return;
    }

    setTopupBusy(true);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: topupGateway, amountVnd: topupAmount }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.payUrl) {
        window.location.assign(json.payUrl);
        return;
      }
      showToast(`❌ ${json.error ?? 'Không thể tạo mã nạp tiền. Liên hệ Hotline 0986.722.324.'}`, 'error');
    } catch {
      showToast('❌ Lỗi kết nối cổng nạp tiền. Vui lòng thử lại sau.', 'error');
    } finally {
      setTopupBusy(false);
    }
  };

  const handleBuyFromWallet = async (item: WalletCatalogItem) => {
    if (buyingItemId) return;
    if (!data.authenticated) {
      showToast('🔐 Hãy tạo tài khoản / đăng nhập ở trên trước khi mua gói nhé!', 'error');
      topupSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (data.wallet.balanceVnd < item.priceVnd) {
      const shortfall = item.priceVnd - data.wallet.balanceVnd;
      const suggested = Math.max(MIN_TOPUP_VND, Math.ceil(shortfall / 1000) * 1000);
      setTopupAmount(suggested);
      showToast(`💳 Ví còn thiếu ${fmtVnd(shortfall)}. Em đã điền sẵn ${fmtVnd(suggested)} vào ô Nạp tiền ở trên!`, 'info');
      topupSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (
      !window.confirm(
        `Xác nhận trừ ${fmtVnd(item.priceVnd)} từ Ví để kích hoạt ngay "${item.name}" (${item.durationLabel})?`
      )
    ) {
      return;
    }

    setBuyingItemId(item.id);
    try {
      const res = await fetch('/api/wallet/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 402) {
        const shortfall = Number(json.shortfallVnd ?? item.priceVnd);
        setTopupAmount(Math.max(MIN_TOPUP_VND, Math.ceil(shortfall / 1000) * 1000));
        showToast(`💳 ${json.error}`, 'error');
        topupSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (!res.ok || !json.success) {
        showToast(`❌ ${json.error ?? 'Không thể hoàn tất mua gói.'}`, 'error');
        return;
      }

      setData((prev) => ({
        ...prev,
        wallet: json.wallet ?? { ...prev.wallet, balanceVnd: Number(json.balanceVnd ?? prev.wallet.balanceVnd) },
        entitlements: Array.isArray(json.entitlements) ? json.entitlements : prev.entitlements,
        ledger: Array.isArray(json.ledger) ? json.ledger : prev.ledger,
      }));
      showToast(`🎉 Kích hoạt thành công "${item.name}"! Quyền học đã mở tức thì.`, 'success');
    } catch {
      showToast('❌ Lỗi kết nối khi mua gói từ Ví.', 'error');
    } finally {
      setBuyingItemId(null);
    }
  };

  const filteredCatalog =
    activeCategory === 'all'
      ? WALLET_CATALOG
      : WALLET_CATALOG.filter((item) => item.category === activeCategory);

  const activeEntitlementMap = new Map(data.entitlements.filter((e) => e.active).map((e) => [e.appCode, e]));

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      {/* Header Hệ sinh thái aionthi.com */}
      <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-[#0f294a] via-[#1b2149] to-[#2e1065] border border-indigo-400/30 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
              <span>⚡ Hệ Sinh Thái Luyện Thi AI • aionthi.com</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              1 Tài Khoản — 1 Ví Chung — Học Cả 4 Nền Tảng
            </h1>
            <p className="text-xs md:text-sm text-indigo-100/80 max-w-2xl">
              Tạo tài khoản nhanh, nạp tiền vào Ví qua PayOS VietQR tự động 24/7 (từ 10.000₫), sau đó thích mở khóa gói <strong>Digital SAT</strong>, <strong>IELTS</strong>, <strong>Cấp II (THCS)</strong> hay <strong>Cấp III (THPT)</strong> bất cứ lúc nào chỉ bằng 1 chạm!
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {Object.values(ECOSYSTEM_APPS).map((app) => (
              <span
                key={app.code}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-white flex items-center gap-1.5"
              >
                <span>{app.icon}</span>
                <span>{app.shortName}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <WalletStatusBanner />
      </Suspense>

      {/* BƯỚC 1 & 2: TẠO TÀI KHOẢN / SỐ DƯ VÍ & NẠP TIỀN */}
      <div ref={topupSectionRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái: Tài khoản hoặc Số dư Ví */}
        <div className="lg:col-span-5 bg-[#151e2b] border border-slate-700/80 rounded-2xl p-5 md:p-6 space-y-4 shadow-xl">
          {!data.authenticated ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-white">Bước 1: Tạo Tài Khoản / Đăng Nhập</h2>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Dùng chung 4 App
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-[#0f172a] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAuthTab('signup')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    authTab === 'signup' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ✨ Tạo tài khoản mới
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('login')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    authTab === 'login' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔐 Đã có tài khoản
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {authTab === 'signup' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Họ tên Học sinh / Phụ huynh</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="VD: Nguyễn Minh Anh"
                      className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Email đăng nhập</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hocsinh@gmail.com"
                    className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Mật khẩu (tối thiểu 6 ký tự)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110 transition disabled:opacity-50 shadow-lg"
                >
                  {authBusy
                    ? 'Đang xử lý...'
                    : authTab === 'signup'
                    ? '🚀 Tạo Tài Khoản & Mở Ví Miễn Phí'
                    : '🔐 Đăng Nhập Vào Ví Chung'}
                </button>
              </form>

              {authMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-xs text-emerald-200 leading-relaxed">
                  {authMessage}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase text-emerald-400 block">✓ Đã đăng nhập SSO</span>
                  <div className="text-sm font-bold text-white truncate max-w-[240px]">
                    {data.user?.email || `Tài khoản #${data.user?.id.slice(0, 8)}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchWallet()}
                  disabled={loading}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition"
                >
                  🔄 Làm mới
                </button>
              </div>

              <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-950/80 via-[#0f172a] to-[#0f172a] border-2 border-emerald-500/40 space-y-2">
                <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Số dư Ví aionthi.com</div>
                <div className="text-3xl md:text-4xl font-black text-white tracking-tight">
                  {fmtVnd(data.wallet.balanceVnd)}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block">Tổng đã nạp</span>
                    <span className="font-bold text-emerald-300">{fmtVnd(data.wallet.totalDepositedVnd)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tổng đã mua gói</span>
                    <span className="font-bold text-amber-300">{fmtVnd(data.wallet.totalSpentVnd)}</span>
                  </div>
                </div>
              </div>

              {/* Trạng thái mở khóa 4 App */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase">Quyền học trên 4 App của bạn</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(ECOSYSTEM_APPS).map((app) => {
                    const ent = activeEntitlementMap.get(app.code);
                    return (
                      <a
                        key={app.code}
                        href={app.code === 'sat' ? '/' : app.url}
                        target={app.code === 'sat' ? undefined : '_blank'}
                        rel={app.code === 'sat' ? undefined : 'noopener noreferrer'}
                        className={`p-2.5 rounded-xl border text-xs transition block ${
                          ent
                            ? 'bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-400'
                            : 'bg-[#0f172a] border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">
                            {app.icon} {app.shortName}
                          </span>
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              ent ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {ent ? ent.tier.toUpperCase() : 'FREE'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {ent ? `HSD: ${fmtDate(ent.expiresAt)}` : app.subdomain}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Nạp tiền vào Ví chung */}
        <div className="lg:col-span-7 bg-[#151e2b] border border-slate-700/80 rounded-2xl p-5 md:p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-black text-white">Bước 2: Nạp Tiền Vào Ví Chung (Tự Động 24/7)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tiền vào Ví không hết hạn — nạp 1 lần, thích mua gói SAT, IELTS, Cấp II hay Cấp III lúc nào cũng được.
              </p>
            </div>
            <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
              ⚡ Cộng số dư sau 10–30 giây
            </span>
          </div>

          <form onSubmit={handleTopup} className="space-y-4">
            {/* Mệnh giá chọn nhanh */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2">Chọn nhanh mệnh giá nạp:</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {TOPUP_PRESETS_VND.map((amt) => {
                  const selected = topupAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopupAmount(amt)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border-2 transition ${
                        selected
                          ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                          : 'bg-[#0f172a] border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {amt >= 1_000_000 ? `${amt / 1_000_000}Tr` : `${amt / 1_000}k`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nhập số tiền tùy chọn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Hoặc nhập số tiền muốn nạp (VNĐ):
                </label>
                <input
                  type="number"
                  min={MIN_TOPUP_VND}
                  step={1000}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-3.5 py-2.5 text-base font-black text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Tối thiểu 10.000₫ (bội số 1.000₫) — Không mất phí giao dịch.
                </span>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-300 mb-1.5">Chọn cổng nạp tự động:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTopupGateway('payos')}
                    className={`p-2.5 rounded-xl border-2 text-left transition ${
                      topupGateway === 'payos'
                        ? 'bg-emerald-500/10 border-emerald-400 text-white'
                        : 'bg-[#0f172a] border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-black">🏦 PayOS VietQR</div>
                    <div className="text-[10px] opacity-80">Quét QR mọi ngân hàng VN</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopupGateway('stripe')}
                    className={`p-2.5 rounded-xl border-2 text-left transition ${
                      topupGateway === 'stripe'
                        ? 'bg-sky-500/10 border-sky-400 text-white'
                        : 'bg-[#0f172a] border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-black">💳 Thẻ Quốc Tế</div>
                    <div className="text-[10px] opacity-80">Visa / MasterCard (Stripe)</div>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={topupBusy || !data.authenticated}
              className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg transition disabled:opacity-50"
            >
              {!data.authenticated
                ? '🔒 Tạo tài khoản / Đăng nhập ở Bước 1 để Nạp Tiền'
                : topupBusy
                ? '⏳ Đang mở cổng thanh toán...'
                : `💳 Nạp Ngay ${fmtVnd(topupAmount)} Vào Ví (${topupGateway === 'payos' ? 'PayOS VietQR' : 'Stripe'}) ➔`}
            </button>
          </form>
        </div>
      </div>

      {/* BƯỚC 3: CHỌN MUA BẤT KỲ GÓI NÀO CỦA 4 APP TỪ SỐ DƯ VÍ */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Bước 3: Thích Gói Nào Mua Gói Đó (Trừ Thẳng Từ Ví)</h2>
            <p className="text-xs text-slate-400">
              Kích hoạt tức thì chỉ với 1 chạm — có thể mua nhiều app trên cùng 1 tài khoản, tự động cộng dồn ngày nếu gia hạn.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-[#0f172a] p-1 rounded-xl border border-slate-800">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'sat', label: '🎓 SAT' },
                { id: 'ielts', label: '🇬🇧 IELTS' },
                { id: 'thcs', label: '📘 Cấp II' },
                { id: 'thpt', label: '📕 Cấp III' },
                { id: 'combo', label: '👑 Combo 4 App' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeCategory === tab.id
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCatalog.map((item) => {
            const enoughBalance = data.authenticated && data.wallet.balanceVnd >= item.priceVnd;
            const shortfall = Math.max(0, item.priceVnd - data.wallet.balanceVnd);
            const isCombo = item.category === 'combo';
            return (
              <div
                key={item.id}
                className={`rounded-2xl p-5 border flex flex-col justify-between transition ${
                  isCombo
                    ? 'bg-gradient-to-b from-[#1e2645] to-[#131a2b] border-amber-400/70 shadow-[0_0_25px_rgba(251,191,36,0.12)]'
                    : 'bg-[#151e2b] border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.appCodes.map((code) => (
                        <span
                          key={code}
                          className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700"
                        >
                          {ECOSYSTEM_APPS[code].icon} {ECOSYSTEM_APPS[code].shortName}
                        </span>
                      ))}
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-white">{item.name}</h3>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="text-2xl font-black text-amber-300">{fmtVnd(item.priceVnd)}</span>
                      {item.originalPriceVnd && (
                        <span className="text-xs text-slate-500 line-through">{fmtVnd(item.originalPriceVnd)}</span>
                      )}
                      <span className="text-xs text-slate-400">/ {item.durationLabel}</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {item.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={buyingItemId !== null}
                    onClick={() => void handleBuyFromWallet(item)}
                    className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs transition disabled:opacity-50 ${
                      enoughBalance
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110 shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {buyingItemId === item.id
                      ? '⏳ Đang kích hoạt...'
                      : !data.authenticated
                      ? '🔐 Đăng nhập để mua gói này'
                      : enoughBalance
                      ? `⚡ Mua Ngay Từ Ví (${fmtVnd(item.priceVnd)})`
                      : `➕ Nạp thêm ${fmtVnd(shortfall)} để mua`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BƯỚC 4: SAO KÊ GIAO DỊCH VÍ MINH BẠCH */}
      {data.authenticated && (
        <div className="bg-[#151e2b] border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white">📜 Lịch Sử Nạp Tiền &amp; Mua Gói (Sao Kê Minh Bạch)</h2>
            <span className="text-xs text-slate-400">{data.ledger.length} giao dịch gần nhất</span>
          </div>

          {data.ledger.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              Chưa có giao dịch nào. Sau khi nạp tiền vào Ví hoặc mua gói, toàn bộ lịch sử đối soát sẽ hiển thị minh bạch tại đây.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 pr-3">Thời gian</th>
                    <th className="py-2 pr-3">Nội dung giao dịch</th>
                    <th className="py-2 pr-3 text-right">Biến động</th>
                    <th className="py-2 text-right">Số dư sau GD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {data.ledger.map((row) => (
                    <tr key={row.id} className="text-slate-200">
                      <td className="py-2.5 pr-3 text-slate-400 whitespace-nowrap">{fmtDateTime(row.createdAt)}</td>
                      <td className="py-2.5 pr-3 font-medium">{row.description}</td>
                      <td
                        className={`py-2.5 pr-3 text-right font-black whitespace-nowrap ${
                          row.amountVnd >= 0 ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {row.amountVnd >= 0 ? '+' : ''}
                        {fmtVnd(row.amountVnd)}
                      </td>
                      <td className="py-2.5 text-right font-bold text-white whitespace-nowrap">
                        {fmtVnd(row.balanceAfterVnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Liên kết pháp lý & Hỗ trợ */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 pt-2">
        <Link href="/terms" className="hover:text-white underline">Điều khoản sử dụng</Link>
        <Link href="/privacy" className="hover:text-white underline">Chính sách bảo mật</Link>
        <Link href="/refund" className="hover:text-white underline">Chính sách hoàn tiền</Link>
        <Link href="/contact" className="hover:text-amber-300 underline">Hotline / Zalo CSKH: 0986.722.324</Link>
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-400 py-20">Đang tải Ví tài khoản chung...</div>}>
      <WalletHubContent />
    </Suspense>
  );
}
