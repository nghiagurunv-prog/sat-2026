'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PLANS,
  SPRINT_EXAM_PACKS,
  validateCoupon,
  applyCouponPrice,
  type PaidTier,
  type BillingPeriod,
} from '@/lib/subscription';
import { useToast } from '@/context/ToastContext';
import { B2bCenterPricingSection } from '@/components/pricing/B2bCenterPricingSection';
import { VerifiedActivityTicker } from '@/components/VerifiedActivityTicker';

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
    processing: { cls: 'bg-[#1e293b] border-[#f59e0b] text-[#fcd34d]', msg: '🔄 Bạn vừa thoát trang thanh toán. Nếu đã chuyển khoản, hệ thống vẫn tự động đối soát webhook và kích hoạt gói (Hotline: 0986.722.324).' },
    cancelled: { cls: 'bg-[#3b1b1b] border-[#f97316] text-[#fdba74]', msg: '⚠️ Giao dịch đã bị hủy từ cổng thanh toán. Bạn có thể tạo đơn mới bất kỳ lúc nào.' },
    unknown: { cls: 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]', msg: '❌ Không tìm thấy giao dịch. Nếu đã bị trừ tiền, vui lòng liên hệ hỗ trợ 0986.722.324.' },
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
  const router = useRouter();
  const { showToast } = useToast();
  const [gateway, setGateway] = useState<Gateway>('payos');
  const [period, setPeriod] = useState<BillingPeriod>('yearly'); // mặc định năm (tiết kiệm nhất)
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Parent Payment Modal state (luôn gắn với đơn PayOS THẬT có orderId & payUrl duy nhất)
  const [isParentModalOpen, setIsParentModalOpen] = useState<boolean>(false);
  const [selectedParentPack, setSelectedParentPack] = useState<{
    name: string;
    duration: string;
    priceVnd: number;
    originalPriceVnd?: number;
    orderId: string;
    payUrl: string;
    features: string[];
  } | null>(null);

  const selectedGateway = GATEWAYS.find((g) => g.id === gateway) ?? GATEWAYS[0];

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
   * Tính giá hiển thị KHỚP 100% với server (/api/payment/create): chỉ áp dụng Coupon KOL.
   * Coins-to-Cash tạm tắt ở Launch v1 để tuyệt đối không lệch giá giữa UI và cổng PayOS/Stripe.
   */
  const computePrice = (basePrice: number) => {
    const afterCoupon = applyCouponPrice(basePrice, appliedCoupon);
    return { finalPrice: afterCoupon, coinDiscountVnd: 0, coinsUsed: 0 };
  };

  /**
   * Tạo đơn PayOS THẬT (có orderId & checkoutUrl duy nhất) rồi mở Modal gửi link VietQR cho Phụ huynh.
   * Tuyệt đối KHÔNG dùng STK tĩnh hay nội dung CK không có mã đơn.
   */
  const openParentPayosModal = async (tier: PaidTier, targetPeriod: BillingPeriod) => {
    const key = `parent-${tier}-${targetPeriod}`;
    if (loadingKey) return;
    const plan = planFor(tier, targetPeriod);
    if (!plan) {
      showToast('❌ Gói học chưa khả dụng cho chu kỳ này.', 'error');
      return;
    }

    setLoadingKey(key);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'payos',
          tier,
          period: targetPeriod,
          ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showToast('🔐 Vui lòng đăng nhập tài khoản học viên trước khi tạo mã thanh toán gửi Phụ huynh.', 'error');
        router.push('/login?next=/upgrade');
        return;
      }
      if (!res.ok || !data.success || !data.payUrl || !data.orderId) {
        showToast(
          `❌ ${data?.error ?? 'Cổng PayOS tạm bận, chưa tạo được mã VietQR.'} Hotline hỗ trợ: 0986.722.324.`,
          'error'
        );
        return;
      }

      const pricing = computePrice(plan.priceVnd);
      setSelectedParentPack({
        name: `Gói ${TIER_META[tier].label} (${PERIOD_LABEL[targetPeriod]})`,
        duration: PERIOD_LABEL[targetPeriod],
        priceVnd: typeof data.amountVnd === 'number' ? data.amountVnd : pricing.finalPrice,
        originalPriceVnd: plan.priceVnd,
        orderId: String(data.orderId),
        payUrl: String(data.payUrl),
        features: [
          'Truy cập đầy đủ kho đề thi chuẩn College Board',
          'Gia sư AI chấm điểm & phân tích bẫy lỗi sai tức thì',
          'Báo cáo tiến độ học tập gửi phụ huynh định kỳ',
        ],
      });
      setIsParentModalOpen(true);
    } catch {
      showToast('❌ Mất kết nối tới cổng thanh toán. Vui lòng thử lại hoặc gọi 0986.722.324.', 'error');
    } finally {
      setLoadingKey(null);
    }
  };

  /**
   * Tạo phiên thanh toán trực tiếp qua PayOS / Stripe — FAIL-CLOSED hoàn toàn,
   * tuyệt đối KHÔNG silent fallback sang chuyển khoản thủ công khi có lỗi.
   */
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showToast('🔐 Vui lòng đăng nhập tài khoản học viên trước khi nâng cấp gói.', 'error');
        router.push('/login?next=/upgrade');
        return;
      }
      if (res.ok && data.success && data.payUrl) {
        window.location.assign(data.payUrl);
        return;
      }
      showToast(
        `❌ ${data?.error ?? 'Không thể khởi tạo phiên thanh toán.'} Cần hỗ trợ gọi 0986.722.324.`,
        'error'
      );
    } catch {
      showToast('❌ Lỗi kết nối tới máy chủ thanh toán. Vui lòng thử lại sau.', 'error');
    } finally {
      setLoadingKey(null);
    }
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

      {/* THÔNG BÁO LAUNCH V1: Giá niêm yết đồng nhất 100% qua cổng tự động */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-800/40 to-sky-500/10 border border-amber-500/30 rounded-2xl p-4 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-xl shrink-0">
              🪙
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-amber-300">
                  Xu học tập &amp; Chính sách giá minh bạch
                </h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Coins-to-Cash: Sắp ra mắt
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Toàn bộ Xu bạn tích lũy vẫn được bảo lưu nguyên vẹn để đổi quà tại <Link href="/shop" className="text-amber-300 underline">Cửa hàng phần thưởng</Link>. Giá hiển thị bên dưới khớp 100% với số tiền cổng payOS / Stripe thu (hỗ trợ mã ưu đãi KOL).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* GÓI NƯỚC RÚT (Tạm đóng ở Launch v1 để đồng bộ thanh toán tự động 100% cho gói Premium & Ultimate) */}
      <div className="bg-[#151e2b] border border-[#262730] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">🚀</span>
            <h2 className="text-sm font-extrabold text-white">
              Gói Nước Rút 45 Ngày &amp; Squad Pass ({SPRINT_EXAM_PACKS.length} gói mùa thi)
            </h2>
            <span className="text-[10px] font-bold uppercase bg-slate-800 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Sắp mở thanh toán tự động
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Đợt mở bán hiện tại ưu tiên kích hoạt tự động 24/7 cho các gói <strong>Premium</strong> và <strong>Ultimate</strong> bên dưới qua payOS VietQR &amp; Stripe.
          </p>
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
                          disabled={loadingKey !== null}
                          onClick={() => void openParentPayosModal(tier, period)}
                          className="w-full text-[11px] font-bold text-sky-300 hover:text-sky-200 py-1.5 rounded-lg bg-sky-950/40 border border-sky-500/30 transition flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {loadingKey === `parent-${tier}-${period}`
                            ? '⏳ Đang tạo mã VietQR...'
                            : '👨‍👩‍👧 Nhờ Phụ Huynh thanh toán VietQR'}
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
            disabled={loadingKey !== null}
            onClick={() => void openParentPayosModal('premium', period)}
            className="shrink-0 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg hover:shadow-emerald-500/25 transition active:scale-[0.99] flex items-center gap-2 disabled:opacity-50"
          >
            <span>
              {loadingKey === `parent-premium-${period}`
                ? '⏳ Đang tạo link PayOS...'
                : '👨‍👩‍👧 Mở VietQR Thanh Toán Cho Con (Zalo 1 Chạm)'}
            </span>
            <span>➔</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-[#64748b] text-center">
        {selectedGateway.reassurance}
      </p>

      {/* Liên kết pháp lý minh bạch trước thanh toán */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 pt-1">
        <Link href="/terms" className="hover:text-white underline">Điều khoản sử dụng</Link>
        <Link href="/privacy" className="hover:text-white underline">Chính sách bảo mật</Link>
        <Link href="/refund" className="hover:text-white underline">Chính sách hoàn tiền 7 ngày</Link>
        <Link href="/contact" className="hover:text-amber-300 underline">Hotline hỗ trợ: 0986.722.324</Link>
      </div>

      {/* MODAL: NHỜ PHỤ HUYNH THANH TOÁN QUA LINK PAYOS VIETQR CHÍNH THỨC (CÓ MÃ ĐƠN RIÊNG) */}
      {isParentModalOpen && selectedParentPack && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#131b26] border-2 border-amber-400/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1e3a8a] via-[#312e81] to-[#4c1d95] p-4 md:p-5 flex items-center justify-between border-b border-indigo-500/30">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👨‍👩‍👧</span>
                <div>
                  <h3 className="text-lg font-black text-white">
                    NHỜ PHỤ HUYNH THANH TOÁN (PAYOS VIETQR CHÍNH THỨC)
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Đơn hàng #{selectedParentPack.orderId} đã khởi tạo — gửi link chính thức qua Zalo cho Bố/Mẹ
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
                    Mã đơn hàng đối soát tự động: #{selectedParentPack.orderId}
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
                </div>
              </div>

              {/* Lời cam kết mục tiêu điểm SAT của con gửi Bố/Mẹ */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <span>🎯</span>
                  <span>CAM KẾT CỦA CON GỬI BỐ MẸ:</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed italic">
                  &ldquo;Con cam kết học tập nghiêm túc tối thiểu 45 phút mỗi ngày, luyện tập đều đặn trên SAT.Guru và quyết tâm đạt mục tiêu điểm SAT <strong>1450+</strong> để tự tin xét tuyển thẳng Đại học! Bố/Mẹ có thể theo dõi biểu đồ tiến độ của con bất kỳ lúc nào qua Cổng Phụ Huynh.&rdquo;
                </p>
              </div>

              {/* Khung Link Cổng Thanh Toán payOS Chính Thức */}
              <div className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-white text-sm">🏦 Cổng thanh toán VietQR chính thức (payOS)</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Webhook đối soát &amp; kích hoạt tự động 24/7
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Bố/Mẹ bấm vào đường link thanh toán riêng cho đơn <strong>#{selectedParentPack.orderId}</strong> dưới đây để hiện mã VietQR chính xác đến từng đồng. Ngay khi ngân hàng xác nhận, tài khoản của con sẽ tự động lên VIP trong 10–30 giây.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <a
                    href={selectedParentPack.payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs text-center shadow-md transition"
                  >
                    🏦 Mở Trang Quét Mã VietQR Ngay ➔
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedParentPack.payUrl);
                      showToast('📋 Đã chép link thanh toán PayOS!', 'success');
                    }}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 font-bold text-xs transition"
                  >
                    🔗 Chép Link Thanh Toán
                  </button>
                </div>
              </div>

              {/* Nút Sao chép tin nhắn gửi Zalo */}
              <div className="space-y-3 pt-1">
                <div className="bg-[#1b2533] border border-slate-700 rounded-xl p-3 text-[11px] text-slate-300 space-y-1">
                  <span className="text-xs font-bold text-white block">💬 Mẫu tin nhắn gửi Bố/Mẹ qua Zalo:</span>
                  <p className="italic text-slate-400 break-all">
                    &ldquo;Bố/Mẹ ơi, con xin phép đăng ký {selectedParentPack.name} tại SAT.Guru để luyện thi Digital SAT. Học phí là {formatVnd(selectedParentPack.priceVnd)} (Mã đơn #{selectedParentPack.orderId}). Bố/Mẹ bấm link cổng VietQR chính thức sau để quét mã thanh toán tự động giúp con nhé: {selectedParentPack.payUrl}&rdquo;
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const message = `Bố/Mẹ ơi, con xin phép đăng ký ${selectedParentPack.name} tại SAT.Guru để luyện thi Digital SAT.\n- Học phí: ${formatVnd(selectedParentPack.priceVnd)}\n- Mã đơn hàng: #${selectedParentPack.orderId}\n- Link quét VietQR chính thức (tự động kích hoạt): ${selectedParentPack.payUrl}\nCần hỗ trợ Bố/Mẹ có thể gọi Hotline SAT.Guru: 0986.722.324 ạ!`;
                      navigator.clipboard.writeText(message);
                      showToast('📋 Đã sao chép tin nhắn kèm link PayOS gửi Bố/Mẹ qua Zalo!', 'success');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    <span>📋 Sao Chép Tin Nhắn Gửi Zalo Cho Bố/Mẹ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.open('https://zalo.me', '_blank', 'noopener,noreferrer');
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

      {/* W3 #27: Hoạt động thực tế đã xác thực từ DB (0 dữ liệu ảo) */}
      <VerifiedActivityTicker />

      {/* Mục #25 & #27: B2B Center License + Score Guarantee dùng chung 1 nguồn duy nhất */}
      <B2bCenterPricingSection />
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
