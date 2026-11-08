'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PLANS,
  SPRINT_EXAM_PACKS,
  calculateCoinDiscount,
  validateCoupon,
  applyCouponPrice,
  type PaidTier,
  type BillingPeriod,
  type SprintExamPack,
} from '@/lib/subscription';
import { useToast } from '@/context/ToastContext';

// Cổng thanh toán: payOS (chuyển khoản QR, khuyên dùng VN cá nhân) + Stripe
// (thẻ quốc tế) + VNPay/MoMo (khi có creds doanh nghiệp).
type Gateway = 'payos' | 'stripe' | 'vnpay' | 'momo';

type GatewayMeta = { id: Gateway; label: string; note: string; enabled: boolean; reassurance: string };

const GATEWAYS: GatewayMeta[] = [
  { id: 'payos', label: '🏦 Chuyển khoản QR', note: 'payOS / VietQR (khuyên dùng)', enabled: true, reassurance: 'Thanh toán qua chuyển khoản QR/VietQR. Gói kích hoạt tự động sau khi webhook xác nhận.' },
  { id: 'stripe', label: '💳 Thẻ quốc tế', note: 'Stripe (Visa/Master)', enabled: true, reassurance: 'Thanh toán an toàn qua Stripe (thẻ quốc tế). Gói kích hoạt tự động sau khi thanh toán thành công.' },
  { id: 'vnpay', label: '🔗 VNPay', note: 'sắp có', enabled: false, reassurance: 'VNPay sẽ mở sau khi có thông tin doanh nghiệp/credentials.' },
  { id: 'momo', label: '📱 MoMo', note: 'sắp có', enabled: false, reassurance: 'MoMo sẽ mở sau khi có thông tin doanh nghiệp/credentials.' },
];

// 3 CỘT so sánh: free (miễn phí) + 2 gói trả phí. Free KHÔNG mua được (nút ẩn).
type Tier = 'free' | PaidTier;

const TIER_META: Record<Tier, { label: string; icon: string; tagline: string; accent: string; highlight?: boolean }> = {
  free: {
    label: 'Free',
    icon: '🎒',
    accent: 'from-slate-500 to-slate-600',
    tagline: 'Bắt đầu miễn phí — trải nghiệm lõi học tập',
  },
  premium: {
    label: 'Premium',
    icon: '⭐',
    accent: 'from-amber-400 to-orange-500',
    tagline: 'Full lộ trình học + full game loop',
    highlight: true, // cột nổi bật (khuyên dùng)
  },
  ultimate: {
    label: 'Ultimate',
    icon: '👑',
    accent: 'from-amber-500 to-yellow-600',
    tagline: 'Cá nhân hóa cấp mentor — cho mục tiêu 1500+',
  },
};

/**
 * MA TRẬN SO SÁNH TÍNH NĂNG — mỗi hàng 1 tính năng, 3 cột free/premium/ultimate.
 */
type CellValue = boolean | string;
interface FeatureRow { label: string; free: CellValue; premium: CellValue; ultimate: CellValue }
interface FeatureGroup { group: string; rows: FeatureRow[] }

const FEATURE_MATRIX: FeatureGroup[] = [
  {
    group: '📚 Học tập cốt lõi',
    rows: [
      { label: 'Diagnostic xếp lớp + điểm dự đoán tổng', free: true, premium: true, ultimate: true },
      { label: 'Luyện tập theo skill (Toán / Đọc-Viết / Từ vựng)', free: 'Domain miễn phí', premium: 'Toàn bộ', ultimate: 'Toàn bộ' },
      { label: 'Mở toàn bộ Cây Kỹ Năng + Cổng Khảo Thí', free: false, premium: true, ultimate: true },
      { label: 'Điểm dự đoán chi tiết theo môn + kỹ năng yếu', free: false, premium: true, ultimate: true },
      { label: 'Thi thử (mock) không giới hạn', free: 'Giới hạn', premium: 'Không giới hạn', ultimate: 'Không giới hạn' },
      { label: 'Thi Thật QAS full-length (đề mô phỏng sát thật)', free: false, premium: false, ultimate: true },
    ],
  },
  {
    group: '🤖 Gia sư AI',
    rows: [
      { label: 'Gia sư AI + sinh câu hỏi', free: 'Giới hạn lượt/ngày', premium: 'Không giới hạn', ultimate: 'Không giới hạn' },
      { label: 'Luyện thích ứng cá nhân hóa (adaptive) theo điểm yếu', free: false, premium: true, ultimate: true },
      { label: 'Giải thích sâu theo điểm yếu (model AI mạnh hơn)', free: false, premium: false, ultimate: true },
    ],
  },
  {
    group: '⚔️ RPG & động lực',
    rows: [
      { label: 'Kế hoạch hôm nay + đo tiến bộ (mastery delta)', free: true, premium: true, ultimate: true },
      { label: 'Hệ số xu RPG (tích lũy nhanh hơn)', free: '×1', premium: '×1.5', ultimate: '×2' },
      { label: 'Đấu trường Boss theo domain + leaderboard', free: true, premium: true, ultimate: true },
    ],
  },
  {
    group: '👨‍👩‍👧 Phụ huynh',
    rows: [
      { label: 'Báo cáo phụ huynh + xu hướng tiến bộ', free: false, premium: '30 ngày', ultimate: '90 ngày chuyên sâu' },
    ],
  },
];

const PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'semiannual', 'yearly'];

const PERIOD_LABEL: Record<BillingPeriod, string> =
  { monthly: 'Tháng', quarterly: '3 Tháng', semiannual: '6 Tháng', yearly: 'Năm' };

const PERIOD_SUFFIX: Record<BillingPeriod, string> =
  { monthly: '/tháng', quarterly: '/3 tháng', semiannual: '/6 tháng', yearly: '/năm' };

const PERIOD_SAVE: Record<BillingPeriod, string | null> =
  { monthly: null, quarterly: 'Tiết kiệm ~10%', semiannual: 'Tiết kiệm ~20%', yearly: 'Tiết kiệm ~33%' };

function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}

function planFor(tier: PaidTier, period: BillingPeriod) {
  return PLANS.find((p) => p.tier === tier && p.period === period);
}

function StatusBanner() {
  const params = useSearchParams();
  const status = params.get('status');
  if (!status) return null;

  const map: Record<string, { cls: string; msg: string }> = {
    paid: { cls: 'bg-[#064e3b] border-[#10b981] text-[#34d399]', msg: '🎉 Thanh toán thành công! Gói của bạn đã được kích hoạt.' },
    pending: { cls: 'bg-[#1e293b] border-[#3b82f6] text-[#93c5fd]', msg: '⏳ Đang xác nhận thanh toán. Gói sẽ kích hoạt ngay khi cổng xác nhận (thường trong ít phút).' },
    unknown: { cls: 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]', msg: '❌ Không tìm thấy giao dịch. Nếu đã bị trừ tiền, vui lòng liên hệ hỗ trợ.' },
  };
  const meta = map[status] ?? map.unknown;
  return <div className={`px-4 py-3 rounded-xl border-2 font-bold text-sm ${meta.cls}`}>{meta.msg}</div>;
}

/** Ô giá trị 1 tính năng trong cột: ✓ / ✗ / chuỗi mức. */
function FeatureCell({ value, tone }: { value: CellValue; tone: 'free' | 'paid' }) {
  if (value === true) return <span className="text-emerald-400 font-bold" aria-label="Có">✓</span>;
  if (value === false) return <span className="text-[#475569]" aria-label="Không">✗</span>;
  return <span className={`text-xs font-semibold ${tone === 'paid' ? 'text-[#e2e8f0]' : 'text-[#94a3b8]'}`}>{value}</span>;
}

function UpgradeContent() {
  const { showToast } = useToast();
  const [gateway, setGateway] = useState<Gateway>('payos');
  const [period, setPeriod] = useState<BillingPeriod>('yearly'); // mặc định năm (tiết kiệm nhất)
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Coins-to-Cash state
  const [userCoins, setUserCoins] = useState<number>(3500);
  const [useCoinsDiscount, setUseCoinsDiscount] = useState<boolean>(true);

  // Parent Payment Modal state
  const [isParentModalOpen, setIsParentModalOpen] = useState<boolean>(false);
  const [selectedParentPack, setSelectedParentPack] = useState<{
    name: string;
    duration: string;
    priceVnd: number;
    originalPriceVnd?: number;
    code: string;
    features: string[];
  }>({
    name: SPRINT_EXAM_PACKS[1].name,
    duration: '45 Ngày',
    priceVnd: SPRINT_EXAM_PACKS[1].priceVnd,
    originalPriceVnd: SPRINT_EXAM_PACKS[1].originalPriceVnd,
    code: 'SPRINT45D',
    features: SPRINT_EXAM_PACKS[1].features,
  });

  const selectedGateway = GATEWAYS.find((g) => g.id === gateway) ?? GATEWAYS[0];

  useEffect(() => {
    try {
      const stored =
        localStorage.getItem('sat_user_coins') ||
        localStorage.getItem('sat_coins') ||
        localStorage.getItem('user_coins');
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val > 0) setUserCoins(val);
      }
    } catch {}
  }, []);

  const handleApplyCoupon = () => {
    const check = validateCoupon(couponInput);
    if (check.valid) {
      setAppliedCoupon(check.code);
      setCouponInput(check.code);
      showToast(`🎁 Đã áp dụng mã ${check.code} — Giảm ${check.discountPercent}% học phí!`, 'success');
    } else {
      setAppliedCoupon(null);
      showToast('⚠️ Mã ưu đãi không hợp lệ hoặc đã hết hạn.', 'error');
    }
  };

  /**
   * Tính giá tiền sau khi áp dụng coupon và xu học tập (Coins-to-Cash)
   */
  const computePrice = (basePrice: number) => {
    const afterCoupon = applyCouponPrice(basePrice, appliedCoupon);
    if (!useCoinsDiscount) {
      return { finalPrice: afterCoupon, coinDiscountVnd: 0, coinsUsed: 0 };
    }
    const coinRes = calculateCoinDiscount(userCoins, afterCoupon);
    return {
      finalPrice: coinRes.finalPriceVnd,
      coinDiscountVnd: coinRes.discountVnd,
      coinsUsed: coinRes.coinsUsed,
    };
  };

  const openParentModalForPlan = (
    name: string,
    duration: string,
    basePrice: number,
    code: string,
    features?: string[]
  ) => {
    const pricing = computePrice(basePrice);
    setSelectedParentPack({
      name,
      duration,
      priceVnd: pricing.finalPrice,
      originalPriceVnd: basePrice,
      code,
      features: features || [
        'Truy cập đầy đủ kho đề thi chuẩn College Board',
        'Gia sư AI chấm điểm & phân tích bẫy lỗi sai tức thì',
        'Báo cáo tiến độ học tập gửi phụ huynh định kỳ',
      ],
    });
    setIsParentModalOpen(true);
  };

  const handleBuy = async (tier: PaidTier) => {
    const key = `${tier}-${period}`;
    if (loadingKey) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway,
          tier,
          period,
          ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
          ...(useCoinsDiscount ? { coinsRedeemed: userCoins } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.payUrl) {
        window.location.assign(data.payUrl);
        return;
      }
      const plan = planFor(tier, period);
      if (plan) {
        openParentModalForPlan(
          `Gói ${TIER_META[tier].label} (${PERIOD_LABEL[period]})`,
          PERIOD_LABEL[period],
          plan.priceVnd,
          `${tier.toUpperCase()}_${period.toUpperCase()}`
        );
        showToast('Mở VietQR chuyển khoản nhanh 1 chạm!', 'info');
      } else {
        showToast(`❌ ${data?.error ?? 'Không thể tạo giao dịch.'}`, 'error');
      }
    } catch {
      const plan = planFor(tier, period);
      if (plan) {
        openParentModalForPlan(
          `Gói ${TIER_META[tier].label} (${PERIOD_LABEL[period]})`,
          PERIOD_LABEL[period],
          plan.priceVnd,
          `${tier.toUpperCase()}_${period.toUpperCase()}`
        );
      } else {
        showToast('❌ Lỗi kết nối, vui lòng thử lại sau.', 'error');
      }
    } finally {
      setLoadingKey(null);
    }
  };

  const handleBuySprint = (pack: SprintExamPack) => {
    openParentModalForPlan(
      pack.name,
      `${pack.durationDays} Ngày`,
      pack.priceVnd,
      pack.id.toUpperCase(),
      pack.features
    );
  };

  const tiers: Tier[] = ['free', 'premium', 'ultimate'];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">💎</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #93c5fd, #c4b5fd)', WebkitBackgroundClip: 'text' }}>NÂNG CẤP GÓI HỌC SAT</h1>
            <p className="math-subtitle text-indigo-200">Gói Nước Rút 45 Ngày, Vé Ngày 24h & Gói Học Năm — Chinh phục mục tiêu 1450+ SAT cùng SAT.Guru!</p>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <StatusBanner />
      </Suspense>

      {/* KHỐI ĐỔI XU HỌC TẬP GIẢM GIÁ (Coins-to-Cash) */}
      <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-orange-500/15 border-2 border-amber-500/40 rounded-2xl p-4 md:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-2xl shrink-0 shadow-inner">
              🪙
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-amber-300">
                  Đổi Xu Học Tập Giảm Giá Học Phí (Coins-to-Cash)
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Tối đa giảm 15%
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Quy đổi: <strong className="text-white">100 Xu = 1.000₫</strong> (1 Xu = 10₫). Chăm chỉ làm đúng bài tập là học phí tự động giảm trực tiếp!
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
            <div className="bg-[#0f172a] px-3.5 py-2 rounded-xl border border-amber-500/30 text-right">
              <span className="text-[10px] text-slate-400 block font-semibold">Túi xu của bạn</span>
              <span className="text-sm font-black text-amber-400 flex items-center justify-end gap-1">
                🪙 {userCoins.toLocaleString('vi-VN')} Xu
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer bg-[#1b2533] px-3.5 py-2.5 rounded-xl border border-slate-700 hover:border-amber-400/60 transition select-none">
              <input
                type="checkbox"
                checked={useCoinsDiscount}
                onChange={(e) => setUseCoinsDiscount(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 focus:ring-offset-0 bg-[#0f172a] border-slate-600 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-white">
                {useCoinsDiscount ? '✓ Đang dùng Xu' : 'Bật dùng Xu'}
              </span>
            </label>
          </div>
        </div>

        {useCoinsDiscount && (
          <div className="mt-3 pt-3 border-t border-amber-500/20 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">✨ Quyền lợi kích hoạt:</span>
              <span>
                {userCoins.toLocaleString('vi-VN')} Xu hiện có quy đổi thành{' '}
                <strong className="text-emerald-300">{(userCoins * 10).toLocaleString('vi-VN')}₫</strong> tiền giảm trừ học phí (hệ thống tự động trừ tối đa 15% giá gói).
              </span>
            </div>
            <span className="text-[11px] text-slate-400 italic">
              * Tích lũy thêm xu mỗi ngày qua việc làm đúng bài tập, giữ streak và đấu boss.
            </span>
          </div>
        )}
      </div>

      {/* GÓI MÙA THI NƯỚC RÚT & SQUAD PASS (Sprint Exam Packs) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🚀</span>
              <h2 className="text-lg font-black text-white">
                GÓI NƯỚC RÚT MÙA THI & SQUAD PASS 2026
              </h2>
              <span className="text-[10px] font-black uppercase bg-gradient-to-r from-rose-500 to-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                Mới
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Linh hoạt theo nhu cầu: Luyện thi cấp tốc 24h, bứt tốc 45 ngày trước kỳ thi, hoặc lập nhóm cùng tiến trường chuyên giảm 30%.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SPRINT_EXAM_PACKS.map((pack) => {
            const pricing = computePrice(pack.priceVnd);
            return (
              <div
                key={pack.id}
                className={`rounded-2xl p-5 border flex flex-col justify-between transition-all relative ${
                  pack.id === 'sprint_45d'
                    ? 'bg-gradient-to-b from-[#1e293b] to-[#151e2b] border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/30'
                    : 'bg-[#1b2533] border-[#262730] hover:border-slate-600'
                }`}
              >
                {pack.badge && (
                  <div className="self-start mb-2 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 shadow-sm">
                    {pack.badge}
                  </div>
                )}

                <div>
                  <h3 className="text-base font-extrabold text-white">{pack.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 min-h-[36px]">{pack.description}</p>

                  <div className="my-4 p-3 rounded-xl bg-[#0f172a]/70 border border-slate-800">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-[#fbbf24]">
                        {formatVnd(pricing.finalPrice)}
                      </span>
                      {pack.originalPriceVnd && (
                        <span className="text-xs text-slate-500 line-through">
                          {formatVnd(pack.originalPriceVnd)}
                        </span>
                      )}
                    </div>
                    {pricing.coinDiscountVnd > 0 && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                        🪙 Đã giảm {formatVnd(pricing.coinDiscountVnd)} từ {pricing.coinsUsed.toLocaleString('vi-VN')} Xu!
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2 mb-5">
                    {pack.features.map((feat, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleBuySprint(pack)}
                    className="w-full py-2.5 px-3 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 hover:brightness-110 active:scale-[0.99] transition shadow-md"
                  >
                    ⚡ Đăng Ký Gói Này ({formatVnd(pricing.finalPrice)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openParentModalForPlan(
                        pack.name,
                        `${pack.durationDays} Ngày`,
                        pack.priceVnd,
                        pack.id.toUpperCase(),
                        pack.features
                      )
                    }
                    className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-slate-800/80 hover:bg-slate-700/80 text-sky-300 border border-sky-400/30 transition flex items-center justify-center gap-1.5"
                  >
                    <span>👨‍👩‍👧 Nhờ Phụ Huynh thanh toán VietQR</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chọn KỲ thanh toán (tháng / 3 tháng / 6 tháng / năm) */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <span className="text-[#94a3b8] text-sm font-bold">Kỳ thanh toán gói định kỳ:</span>
        <div className="inline-flex flex-wrap gap-1 bg-[#0f172a] p-1 rounded-xl border border-[#262730]">
          {PERIODS.map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors relative ${
                  active ? 'bg-[#1b2533] text-[#fbbf24] shadow' : 'text-[#94a3b8] hover:text-[#e2e8f0]'
                }`}
              >
                {PERIOD_LABEL[p]}
                {PERIOD_SAVE[p] && (
                  <span className="ml-1 text-[10px] font-bold text-emerald-400">{PERIOD_SAVE[p]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chọn cổng thanh toán & Mã ưu đãi KOL/Giáo viên */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[#94a3b8] text-sm font-bold">Cổng thanh toán:</span>
          {GATEWAYS.map((g) => {
            const active = gateway === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => { if (g.enabled) setGateway(g.id); }}
                disabled={!g.enabled}
                className={`px-4 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${
                  active
                    ? 'bg-[#1b2533] border-[#fbbf24] text-[#fbbf24]'
                    : g.enabled
                    ? 'bg-[#1b2533] border-[#262730] text-[#94a3b8] hover:border-[#3b82f6]'
                    : 'bg-[#0f172a] border-[#262730] text-[#64748b] cursor-not-allowed opacity-60'
                }`}
              >
                {g.label}
                <span className="block text-[10px] font-normal opacity-70">{g.note}</span>
              </button>
            );
          })}
        </div>

        {/* Ô nhập Mã ưu đãi / Affiliate Coupon */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0f172a] p-2 rounded-xl border border-[#262730]">
          <span className="text-xs font-bold text-[#94a3b8] pl-1">🎁 Mã giới thiệu:</span>
          <input
            type="text"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            placeholder="VD: NGHIAGURU10"
            className="bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-1.5 text-xs font-bold text-white placeholder-[#64748b] focus:outline-none focus:border-[#fbbf24] w-36 uppercase"
          />
          <button
            type="button"
            onClick={handleApplyCoupon}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-bold text-xs transition"
          >
            Áp dụng
          </button>
          {appliedCoupon && (
            <span className="text-[11px] font-bold text-emerald-400 px-1.5 flex items-center gap-1">
              ✓ Đã giảm 10% ({appliedCoupon})
              <button
                type="button"
                onClick={() => { setAppliedCoupon(null); setCouponInput(''); }}
                className="text-slate-400 hover:text-red-400 ml-1"
                title="Gỡ mã"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      </div>

      {/* BẢNG SO SÁNH 3 CỘT — free / premium / ultimate */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Hàng tiêu đề: tên gói + giá theo kỳ đã chọn + nút mua */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3">
            <div />
            {tiers.map((tier) => {
              const meta = TIER_META[tier];
              const plan = tier === 'free' ? null : planFor(tier, period);
              const pricing = plan ? computePrice(plan.priceVnd) : null;
              const key = tier === 'free' ? 'free' : `${tier}-${period}`;
              return (
                <div
                  key={tier}
                  className={`rounded-2xl p-4 border flex flex-col ${
                    meta.highlight
                      ? 'bg-[#1b2533] border-[#fbbf24] shadow-[0_0_25px_rgba(251,191,36,0.15)]'
                      : 'bg-[#1b2533] border-[#262730]'
                  }`}
                >
                  {meta.highlight && (
                    <div className="self-start mb-2 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 px-2 py-0.5 rounded-full">
                      Khuyên dùng
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{meta.icon}</span>
                    <h3 className="text-lg font-black text-white">{meta.label}</h3>
                  </div>
                  <p className="text-[11px] text-[#94a3b8] mt-1 min-h-[32px]">{meta.tagline}</p>

                  <div className="mt-3 mb-3">
                    {tier === 'free' ? (
                      <div>
                        <span className="text-2xl font-black text-[#e2e8f0]">Miễn phí</span>
                        <div className="text-[11px] text-[#94a3b8] mt-1">Không cần thẻ</div>
                      </div>
                    ) : plan && pricing ? (
                      <div>
                        {(appliedCoupon || pricing.coinDiscountVnd > 0) && (
                          <div className="text-xs text-[#64748b] line-through font-semibold">
                            {formatVnd(plan.priceVnd)}
                          </div>
                        )}
                        <span className="text-2xl font-black text-[#fbbf24]">
                          {formatVnd(pricing.finalPrice)}
                        </span>
                        <span className="text-[#94a3b8] text-xs">{PERIOD_SUFFIX[period]}</span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {PERIOD_SAVE[period] && (
                            <span className="text-[11px] text-emerald-400 font-bold">{PERIOD_SAVE[period]}</span>
                          )}
                          {appliedCoupon && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                              -10% Mã {appliedCoupon}
                            </span>
                          )}
                          {pricing.coinDiscountVnd > 0 && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                              -Xu {formatVnd(pricing.coinDiscountVnd)}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-[#94a3b8]">Không có gói kỳ này</span>
                    )}
                  </div>

                  {tier === 'free' ? (
                    <button
                      disabled
                      className="mt-auto w-full bg-[#0f172a] text-[#64748b] border border-[#262730] font-bold py-2.5 rounded-lg cursor-default text-sm"
                    >
                      Gói hiện tại
                    </button>
                  ) : (
                    <div className="mt-auto space-y-1.5">
                      <button
                        onClick={() => handleBuy(tier)}
                        disabled={loadingKey !== null || !plan}
                        className={`w-full bg-gradient-to-r ${meta.accent} text-white font-bold py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 text-sm`}
                      >
                        {loadingKey === key ? 'Đang chuyển...' : `Nâng cấp ${meta.label}`}
                      </button>
                      {plan && (
                        <button
                          type="button"
                          onClick={() =>
                            openParentModalForPlan(
                              `Gói ${meta.label} (${PERIOD_LABEL[period]})`,
                              PERIOD_LABEL[period],
                              plan.priceVnd,
                              `${tier.toUpperCase()}_${period.toUpperCase()}`
                            )
                          }
                          className="w-full text-[11px] font-bold text-sky-300 hover:text-sky-200 py-1.5 rounded-lg bg-sky-950/40 border border-sky-500/30 transition flex items-center justify-center gap-1"
                        >
                          👨‍👩‍👧 Nhờ Phụ Huynh thanh toán
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Các nhóm tính năng */}
          {FEATURE_MATRIX.map((grp) => (
            <div key={grp.group} className="mt-5">
              <div className="text-sm font-bold text-[#93c5fd] mb-1 px-1">{grp.group}</div>
              <div className="rounded-xl overflow-hidden border border-[#262730]">
                {grp.rows.map((row, i) => (
                  <div
                    key={row.label}
                    className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 items-center px-3 py-2.5 ${
                      i % 2 === 0 ? 'bg-[#1b2533]' : 'bg-[#151e2b]'
                    }`}
                  >
                    <div className="text-xs text-[#cbd5e1]">{row.label}</div>
                    <div className="text-center"><FeatureCell value={row.free} tone="free" /></div>
                    <div className="text-center"><FeatureCell value={row.premium} tone="paid" /></div>
                    <div className="text-center"><FeatureCell value={row.ultimate} tone="paid" /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* POINT 87: Bảng So sánh Chi phí & Quyền lợi Gói Học dành cho Phụ huynh (Parent ROI Matrix) */}
      <div className="bg-gradient-to-br from-[#1b2533] via-[#16202e] to-[#0f172a] border-2 border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👨‍👩‍👧</span>
              <h2 className="text-xl font-bold text-white">
                Bảng Đối Chiếu Chi Phí & Hiệu Quả Đầu Tư Dành Cho Phụ Huynh (ROI)
              </h2>
            </div>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              So sánh khách quan giữa việc học kèm gia sư truyền thống, trung tâm luyện thi offline và nền tảng SAT.Guru AI để bố mẹ có quyết định đầu tư tối ưu nhất cho con.
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/40 px-4 py-2 rounded-xl shrink-0 text-center">
            <span className="text-xs text-emerald-400 font-bold block">TIẾT KIỆM ĐẾN</span>
            <span className="text-xl font-black text-emerald-300">85% – 92%</span>
            <span className="text-[10px] text-slate-400 block">Ngân sách học thêm</span>
          </div>
        </div>

        {/* Bảng so sánh 3 phương thức */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-3 px-3 w-1/4">Tiêu chí so sánh</th>
                <th className="py-3 px-3 w-1/4">Gia sư 1-1 truyền thống</th>
                <th className="py-3 px-3 w-1/4">Lớp trung tâm Offline</th>
                <th className="py-3 px-3 w-1/4 bg-amber-500/10 text-amber-300 font-bold rounded-t-lg border-t-2 border-x-2 border-amber-400/50">
                  👑 SAT.Guru AI Academy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              <tr>
                <td className="py-3 px-3 font-semibold text-white">💰 Chi phí học tập thực tế</td>
                <td className="py-3 px-3 text-rose-300 font-medium">
                  500.000đ – 1.500.000đ / buổi<br />
                  <span className="text-[11px] text-slate-400">(40–80 triệu/khóa 6 tháng)</span>
                </td>
                <td className="py-3 px-3 text-amber-300 font-medium">
                  18.000.000đ – 35.000.000đ / khóa<br />
                  <span className="text-[11px] text-slate-400">(15–20 học sinh/lớp)</span>
                </td>
                <td className="py-3 px-3 bg-amber-500/5 border-x-2 border-amber-400/30 text-emerald-300 font-bold text-xs space-y-1">
                  <div>⚡ <span className="text-white font-black">29.000₫</span> / Vé Ngày 24h</div>
                  <div>🔥 <span className="text-amber-300 font-black">699.000₫</span> / Gói Nước Rút 45 Ngày</div>
                  <div>👥 <span className="text-sky-300 font-black">Squad Pass: Giảm 30%</span> (học nhóm 3-5 bạn)</div>
                  <div className="text-[11px] text-emerald-400 font-normal pt-1 border-t border-amber-400/20">
                    ⭐ Chỉ từ ~330.000đ/tháng (gói năm Premium) — Tiết kiệm đến 92%
                  </div>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-white">⏱️ Thời lượng & Tần suất</td>
                <td className="py-3 px-3">2-3 buổi/tuần (90 phút/buổi). Ngoài giờ không hỏi được.</td>
                <td className="py-3 px-3">Cố định theo lịch trung tâm, mất thời gian đưa đón 1-2h.</td>
                <td className="py-3 px-3 bg-amber-500/5 border-x-2 border-amber-400/30 font-medium text-white">
                  <strong>24/7 Không Giới Hạn</strong>. Bất cứ lúc nào con ngồi vào bàn học đều có AI kèm.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-white">🎯 Cá nhân hóa lộ trình</td>
                <td className="py-3 px-3">Phụ thuộc chủ quan vào kinh nghiệm của 1 giáo viên.</td>
                <td className="py-3 px-3">Theo giáo trình chung, con đuối dễ bị bỏ lại phía sau.</td>
                <td className="py-3 px-3 bg-amber-500/5 border-x-2 border-amber-400/30 font-medium text-white">
                  <strong>Thuật toán Thích Ứng (Adaptive)</strong>: Tự phát hiện lỗ hổng và luyện đúng điểm yếu.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-white">📝 Luyện đề & Chữa lỗi</td>
                <td className="py-3 px-3">Chấm tay, 2-3 ngày sau mới có kết quả, khó thống kê bẫy sai.</td>
                <td className="py-3 px-3">3-5 đề mock test toàn khóa, chữa lướt cho cả lớp.</td>
                <td className="py-3 px-3 bg-amber-500/5 border-x-2 border-amber-400/30 font-medium text-white">
                  <strong>Chấm tức thì</strong>, phân tích chi tiết từng bước, tự động ghi vào Sổ tay lỗi sai.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-white">👨‍👩‍👧 Minh bạch cho Phụ huynh</td>
                <td className="py-3 px-3">Trao đổi qua tin nhắn, phụ huynh khó nắm con học thực chất ra sao.</td>
                <td className="py-3 px-3">Nhận bảng điểm tổng kết sau khi kết thúc khóa học.</td>
                <td className="py-3 px-3 bg-amber-500/5 border-x-2 border-b-2 border-amber-400/30 font-medium text-white rounded-b-lg">
                  <strong>Cổng Báo Cáo Phụ Huynh (Zalo/QR)</strong>: Cập nhật minh bạch điểm dự kiến và biểu đồ mỗi tuần.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4 Cam kết giá trị thực tế mang lại cho gia đình */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60">
            <div className="text-amber-400 font-bold text-xs mb-1">🛡️ ĐẦU TƯ AN TÂM</div>
            <p className="text-[11px] text-slate-300">
              Chi phí hợp lý, không phát sinh phụ phí sách vở hay lệ phí thi thử nội bộ.
            </p>
          </div>
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60">
            <div className="text-emerald-400 font-bold text-xs mb-1">📈 ĐO LƯỜNG CHÍNH XÁC</div>
            <p className="text-[11px] text-slate-300">
              Biết con đang ở mức điểm nào (1300, 1400 hay 1500+) so với ngưỡng tuyển sinh đại học top đầu VN.
            </p>
          </div>
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60">
            <div className="text-sky-400 font-bold text-xs mb-1">⏰ TIẾT KIỆM THỜI GIAN</div>
            <p className="text-[11px] text-slate-300">
              Con tự học tại nhà an toàn, bố mẹ không mất công sức đưa đón giờ tan tầm tắc đường.
            </p>
          </div>
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60">
            <div className="text-purple-400 font-bold text-xs mb-1">🌱 TỰ GIÁC BỀN VỮNG</div>
            <p className="text-[11px] text-slate-300">
              Cơ chế nhiệm vụ RPG và chuỗi ngày học tạo động lực nội sinh giúp con tự giác ngồi vào bàn học.
            </p>
          </div>
        </div>

        {/* Banner Kêu gọi Phụ Huynh & Nút mở Modal 1 Chạm */}
        <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-purple-900/40 border border-sky-500/30 rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-base font-extrabold text-white flex items-center justify-center md:justify-start gap-2">
              <span>👨‍👩‍👧</span>
              <span>Bố Mẹ Đồng Hành — Con Bứt Phá Điểm Số SAT</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl">
              Học sinh có thể gửi thông tin gói học kèm lời cam kết điểm số về Zalo của Bố/Mẹ. Phụ huynh quét mã VietQR là gói học tự động kích hoạt ngay lập tức mà không cần tạo tài khoản phức tạp.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              openParentModalForPlan(
                'Chiến Binh Nước Rút 45 Ngày (Khuyên Dùng)',
                '45 Ngày',
                699_000,
                'SPRINT45D',
                SPRINT_EXAM_PACKS[1].features
              )
            }
            className="shrink-0 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg hover:shadow-emerald-500/25 transition active:scale-[0.99] flex items-center gap-2"
          >
            <span>👨‍👩‍👧 Mở VietQR Thanh Toán Cho Con (Zalo 1 Chạm)</span>
            <span>➔</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-[#64748b] text-center">
        {selectedGateway.reassurance}
      </p>

      {/* MODAL: NHỜ PHỤ HUYNH THANH TOÁN QUA ZALO / VIETQR 1 CHẠM */}
      {isParentModalOpen && selectedParentPack && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#131b26] border-2 border-amber-400/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1e3a8a] via-[#312e81] to-[#4c1d95] p-4 md:p-5 flex items-center justify-between border-b border-indigo-500/30">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👨‍👩‍👧</span>
                <div>
                  <h3 className="text-lg font-black text-white">
                    NHỜ PHỤ HUYNH THANH TOÁN (VIETQR 1 CHẠM)
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Gửi thông tin gói học và mã VietQR thanh toán nhanh qua Zalo cho Bố/Mẹ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsParentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 md:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Tóm tắt Gói học */}
              <div className="bg-[#1b2533] border border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                    Gói học sinh lựa chọn
                  </span>
                  <h4 className="text-base font-black text-white mt-0.5">
                    {selectedParentPack.name}
                  </h4>
                  <span className="text-xs text-slate-300">
                    Thời lượng: <strong>{selectedParentPack.duration}</strong>
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold">Số tiền phụ huynh thanh toán</span>
                  <div className="flex items-baseline sm:justify-end gap-2">
                    <span className="text-2xl font-black text-emerald-400">
                      {formatVnd(selectedParentPack.priceVnd)}
                    </span>
                    {selectedParentPack.originalPriceVnd && selectedParentPack.originalPriceVnd > selectedParentPack.priceVnd && (
                      <span className="text-xs text-slate-400 line-through">
                        {formatVnd(selectedParentPack.originalPriceVnd)}
                      </span>
                    )}
                  </div>
                  {useCoinsDiscount && (
                    <span className="text-[10px] text-amber-300 font-bold block">
                      🪙 Đã áp dụng giảm giá Xu học tập
                    </span>
                  )}
                </div>
              </div>

              {/* Lời cam kết mục tiêu điểm SAT của con gửi Bố/Mẹ */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <span>🎯</span>
                  <span>CAM KẾT CỦA CON GỬI BỐ MẸ:</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed italic">
                  &ldquo;Con cam kết học tập nghiêm túc tối thiểu 45 phút mỗi ngày, luyện tập đều đặn trên SAT.Guru và quyết tâm đạt mục tiêu điểm SAT <strong>1450+</strong> để tự tin xét tuyển thẳng Đại học và chinh phục học bổng du học! Bố/Mẹ có thể theo dõi biểu đồ tiến độ của con bất kỳ lúc nào qua Cổng Phụ Huynh.&rdquo;
                </p>
              </div>

              {/* Khung VietQR Động */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-xl shrink-0 shadow-lg flex flex-col items-center">
                  <img
                    src={`https://img.vietqr.io/image/MB-0345678999-compact2.png?amount=${selectedParentPack.priceVnd}&addInfo=SATGURU%20${selectedParentPack.code}&accountName=SAT%20NGHIAGURU`}
                    alt="Mã VietQR Thanh Toán"
                    className="w-48 h-48 object-contain"
                    loading="lazy"
                  />
                  <span className="text-[10px] font-bold text-slate-600 mt-1">Quét mã bằng App Ngân Hàng</span>
                </div>

                <div className="space-y-2.5 text-xs w-full">
                  <div className="font-bold text-white text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span>Thông tin chuyển khoản nhanh:</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Tự động kích hoạt 24/7
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ngân hàng:</span>
                    <span className="font-bold text-white">MB Bank (Quân Đội)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Số tài khoản:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-amber-300 text-sm">0345678999</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('0345678999');
                          showToast('Đã chép số tài khoản!', 'success');
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded"
                      >
                        Chép
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Chủ tài khoản:</span>
                    <span className="font-bold text-white">SAT NGHIAGURU ACADEMY</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Số tiền:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-emerald-400 text-sm">
                        {formatVnd(selectedParentPack.priceVnd)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(String(selectedParentPack.priceVnd));
                          showToast('Đã chép số tiền!', 'success');
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded"
                      >
                        Chép
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nội dung CK:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-500/30">
                        SATGURU {selectedParentPack.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`SATGURU ${selectedParentPack.code}`);
                          showToast('Đã chép nội dung chuyển khoản!', 'success');
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded"
                      >
                        Chép
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nút Sao chép tin nhắn gửi Zalo */}
              <div className="space-y-3 pt-2">
                <div className="bg-[#1b2533] border border-slate-700 rounded-xl p-3 text-[11px] text-slate-300 space-y-1">
                  <span className="text-xs font-bold text-white block">💬 Mẫu tin nhắn gửi Bố/Mẹ:</span>
                  <p className="italic text-slate-400">
                    &ldquo;Bố/Mẹ ơi, con xin phép đăng ký {selectedParentPack.name} tại SAT.Guru để kịp luyện thi SAT. Học phí là {formatVnd(selectedParentPack.priceVnd)}. Con cam kết học hành nghiêm túc và đạt mục tiêu 1450+! Bố/Mẹ quét VietQR hoặc bấm link thanh toán nhanh giúp con nhé: {typeof window !== 'undefined' ? window.location.origin : ''}/upgrade?status=pending&pack={selectedParentPack.code}&rdquo;
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      const message = `Bố/Mẹ ơi, con xin phép đăng ký ${selectedParentPack.name} tại SAT.Guru để kịp luyện thi SAT.\n- Học phí: ${formatVnd(selectedParentPack.priceVnd)}\n- STK MB Bank: 0345678999 (SAT NGHIAGURU)\n- Nội dung CK: SATGURU ${selectedParentPack.code}\nCon cam kết học hành nghiêm túc và đạt mục tiêu 1450+!\nBố/Mẹ bấm link sau để xem VietQR chuyển khoản nhanh giúp con nhé: ${origin}/upgrade?status=pending&pack=${selectedParentPack.code}`;
                      navigator.clipboard.writeText(message);
                      showToast('📋 Đã sao chép tin nhắn kèm link gửi Bố/Mẹ qua Zalo!', 'success');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    <span>📋 Sao Chép Tin Nhắn Gửi Zalo Cho Bố/Mẹ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.open('https://zalo.me', '_blank');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-[#0068FF] hover:bg-[#0055d4] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    <span>💬 Mở Zalo Gửi Ngay</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="text-center text-[#94a3b8] py-20">Đang tải...</div>}>
      <UpgradeContent />
    </Suspense>
  );
}
