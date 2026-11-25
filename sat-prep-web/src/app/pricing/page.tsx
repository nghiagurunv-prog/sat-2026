'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PLANS,
  SPRINT_EXAM_PACKS,
  STUDY_SQUAD_PACKS,
  SCORE_ASSURANCE_POLICY,
  OFFICIAL_SUPPORT_HOTLINE,
  validateCoupon,
  applyCouponPrice,
  type PaidTier,
  type BillingPeriod,
  type SprintExamPack,
  type StudySquadPack,
} from '@/lib/subscription';
import { encodeQrMatrix, qrMatrixToSvgPath } from '@/lib/qr-svg';
import { useToast } from '@/context/ToastContext';
import { B2bCenterPricingSection } from '@/components/pricing/B2bCenterPricingSection';
import { VerifiedActivityTicker } from '@/components/VerifiedActivityTicker';

// ============================================================================
// CỔNG THANH TOÁN & METADATA
// ============================================================================
type Gateway = 'payos' | 'stripe' | 'vnpay' | 'momo';

interface GatewayMeta {
  id: Gateway;
  label: string;
  note: string;
  enabled: boolean;
  reassurance: string;
}

const GATEWAYS: GatewayMeta[] = [
  {
    id: 'payos',
    label: '🏦 Chuyển khoản VietQR',
    note: 'VietQR / Quét mã 30s (Khuyên dùng)',
    enabled: true,
    reassurance: 'Tự động kích hoạt sau 10-30 giây qua cổng thanh toán liên ngân hàng Napas/VietQR.',
  },
  {
    id: 'stripe',
    label: '💳 Thẻ quốc tế',
    note: 'Stripe (Visa / MasterCard)',
    enabled: true,
    reassurance: 'Bảo mật tiêu chuẩn quốc tế PCI-DSS qua Stripe. Hỗ trợ thẻ tín dụng và ghi nợ.',
  },
  {
    id: 'vnpay',
    label: '🔗 VNPay QR',
    note: 'Cổng thanh toán VNPay',
    enabled: false,
    reassurance: 'Sắp mở cổng tích hợp doanh nghiệp VNPay.',
  },
  {
    id: 'momo',
    label: '📱 Ví MoMo',
    note: 'Ví điện tử MoMo',
    enabled: false,
    reassurance: 'Sắp mở cổng thanh toán qua ví MoMo.',
  },
];

type Tier = 'free' | PaidTier;

const TIER_META: Record<Tier, { label: string; icon: string; tagline: string; accent: string; highlight?: boolean }> = {
  free: {
    label: 'Khởi Động (Free)',
    icon: '🎒',
    accent: 'from-slate-600 to-slate-700',
    tagline: 'Bắt đầu miễn phí — Đánh giá năng lực & làm quen Digital SAT',
  },
  premium: {
    label: 'Chiến Binh (Premium)',
    icon: '⭐',
    accent: 'from-amber-500 to-orange-600',
    tagline: 'Mở full Cây Kỹ Năng + Gia sư AI Adaptive 24/7 (Phổ biến nhất)',
    highlight: true,
  },
  ultimate: {
    label: 'Thủ Khoa (Ultimate)',
    icon: '👑',
    accent: 'from-amber-400 to-yellow-500',
    tagline: 'Lộ trình Mentor 1-1 + Thi Thật QAS full-length cho mục tiêu 1500+',
  },
};

const PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'semiannual', 'yearly'];

const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: '1 Tháng',
  quarterly: '3 Tháng',
  semiannual: '6 Tháng',
  yearly: '1 Năm (365 Ngày)',
};

const PERIOD_SAVE: Record<BillingPeriod, string | null> = {
  monthly: null,
  quarterly: 'Tiết kiệm ~10%',
  semiannual: 'Tiết kiệm ~20%',
  yearly: '🔥 Tiết kiệm ~33% + Tặng Cổng Phụ Huynh',
};

// Dòng quy đổi chi phí siêu nhỏ (#C068)
const PERIOD_DAILY_COST: Record<BillingPeriod, string> = {
  monthly: '~19.000đ/ngày',
  quarterly: '~14.000đ/ngày',
  semiannual: '~9.500đ/ngày',
  yearly: '🔥 Chỉ từ ~5.400đ/ngày',
};

function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}

function planFor(tier: PaidTier, period: BillingPeriod) {
  return PLANS.find((p) => p.tier === tier && p.period === period);
}

// ============================================================================
// TRƯỜNG ĐH MỤC TIÊU & ĐIỂM SỐ MỤC TIÊU CHO HỌC SINH (#C061, #C062)
// ============================================================================
const TARGET_UNIVERSITIES = [
  'ĐH Ngoại Thương (FTU)',
  'ĐH Kinh Tế Quốc Dân (NEU)',
  'ĐH Bách Khoa Hà Nội (HUST)',
  'Đại học Quốc Gia (VNU / VNU-HCM)',
  'VinUni / Fulbright University',
  'Du học Mỹ & Quốc tế (Top 50-100)',
];

const TARGET_SCORES = ['1400+ SAT', '1450+ SAT', '1500+ SAT', '1550+ SAT'];

function StatusBanner() {
  const params = useSearchParams();
  const status = params.get('status');
  if (!status) return null;

  const map: Record<string, { cls: string; msg: string }> = {
    paid: {
      cls: 'bg-[#064e3b] border-[#10b981] text-[#34d399]',
      msg: '🎉 Thanh toán thành công! Gói luyện thi SAT.Guru của bạn đã được kích hoạt tức thì.',
    },
    pending: {
      cls: 'bg-[#1e293b] border-[#3b82f6] text-[#93c5fd]',
      msg: '⏳ Đang xác nhận thanh toán. Gói học sẽ tự động mở sau 10-30 giây khi ngân hàng xử lý xong.',
    },
    unknown: {
      cls: 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]',
      msg: '❌ Chưa nhận diện được giao dịch. Nếu quý khách đã chuyển khoản, xin liên hệ Hotline 0986.722.324 để kích hoạt ngay!',
    },
  };
  const meta = map[status] ?? map.unknown;
  return <div className={`px-4 py-3 rounded-xl border-2 font-bold text-sm ${meta.cls}`}>{meta.msg}</div>;
}

// ============================================================================
// MAIN PRICING CONTENT COMPONENT (Hợp nhất 100% PayOS động & bảng giá từ PLANS)
// ============================================================================
function PricingContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const [gateway, setGateway] = useState<Gateway>('payos');
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Tương tác ROI Calculator cho phụ huynh (#34)
  const [roiUni, setRoiUni] = useState<string>(TARGET_UNIVERSITIES[0]);

  // Modal "Nhờ Bố Mẹ Thanh Toán" (100% PayOS động thật có orderId & payUrl — vá #1, #5, #6, #21)
  const [isParentModalOpen, setIsParentModalOpen] = useState<boolean>(false);
  const [selectedParentPack, setSelectedParentPack] = useState<{
    name: string;
    duration: string;
    priceVnd: number;
    originalPriceVnd?: number;
    orderId: string;
    payUrl: string;
    qrPayload: string;
    expiredAt: number;
    features: string[];
  } | null>(null);
  const [qrCountdownSec, setQrCountdownSec] = useState<number>(900);

  // State mục tiêu của học sinh trong modal (#C061, #C062)
  const [studentTargetUni, setStudentTargetUni] = useState<string>(TARGET_UNIVERSITIES[0]);
  const [studentTargetScore, setStudentTargetScore] = useState<string>(TARGET_SCORES[1]); // 1450+ SAT

  useEffect(() => {
    if (!isParentModalOpen || !selectedParentPack?.expiredAt) return;
    const tick = () => {
      const left = Math.max(0, selectedParentPack.expiredAt - Math.floor(Date.now() / 1000));
      setQrCountdownSec(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isParentModalOpen, selectedParentPack?.expiredAt]);

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
   * Giá hiển thị KHỚP 100% với server (/api/payment/create) và /upgrade (vá #6, #22):
   * Chỉ áp dụng Coupon KOL (đã tắt Coins-to-Cash để không lệch giá khi sang cổng PayOS/Stripe).
   */
  const computePrice = (basePrice: number) => {
    const afterCoupon = applyCouponPrice(basePrice, appliedCoupon);
    return { finalPrice: afterCoupon, coinDiscountVnd: 0, coinsUsed: 0 };
  };

  /**
   * Tạo phiên thanh toán PayOS THẬT (có orderId, checkoutUrl & expiredAt 15 phút) rồi mở Modal gửi Bố Mẹ.
   * Tuyệt đối KHÔNG dùng STK tĩnh hay ảnh img.vietqr.io.
   */
  const openParentPayosModal = async (spec: {
    key: string;
    name: string;
    duration: string;
    basePrice: number;
    planId?: string;
    tier?: PaidTier;
    targetPeriod?: BillingPeriod;
    features?: string[];
    allowCoupon?: boolean;
  }) => {
    if (loadingKey) return;
    setLoadingKey(spec.key);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'payos',
          ...(spec.planId ? { planId: spec.planId } : { tier: spec.tier, period: spec.targetPeriod }),
          ...(spec.allowCoupon !== false && appliedCoupon ? { couponCode: appliedCoupon } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showToast('🔐 Vui lòng đăng nhập tài khoản học viên để tạo mã VietQR PayOS động.', 'error');
        router.push('/login?next=/pricing');
        return;
      }
      if (!res.ok || !data.success || !data.payUrl || !data.orderId) {
        showToast(
          `❌ ${data?.error ?? 'Cổng PayOS tạm bận, chưa tạo được mã VietQR.'} Hotline hỗ trợ: ${OFFICIAL_SUPPORT_HOTLINE}.`,
          'error'
        );
        return;
      }
      const pricing = spec.allowCoupon === false ? { finalPrice: spec.basePrice } : computePrice(spec.basePrice);
      const expiredAt = typeof data.expiredAt === 'number' ? data.expiredAt : Math.floor(Date.now() / 1000) + 900;
      setSelectedParentPack({
        name: spec.name,
        duration: spec.duration,
        priceVnd: typeof data.amountVnd === 'number' ? data.amountVnd : pricing.finalPrice,
        originalPriceVnd: spec.basePrice,
        orderId: String(data.orderId),
        payUrl: String(data.payUrl),
        qrPayload: typeof data.qrCode === 'string' && data.qrCode ? data.qrCode : String(data.payUrl),
        expiredAt,
        features: spec.features || [
          'Truy cập đầy đủ kho đề thi chuẩn College Board 2026',
          'Gia sư AI chấm điểm & phân tích bẫy lỗi sai tức thì 24/7',
          'Tặng kèm Cổng Phụ Huynh theo dõi tiến độ học tập hàng tuần',
        ],
      });
      setIsParentModalOpen(true);
    } catch {
      showToast(`❌ Mất kết nối tới cổng thanh toán. Vui lòng thử lại hoặc gọi ${OFFICIAL_SUPPORT_HOTLINE}.`, 'error');
    } finally {
      setLoadingKey(null);
    }
  };

  /** Thanh toán trực tiếp gói Standard (Premium/Ultimate) — FAIL-CLOSED hoàn toàn, không silent fallback. */
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
        router.push('/login?next=/pricing');
        return;
      }
      if (res.ok && data.success && data.payUrl) {
        window.location.assign(data.payUrl);
        return;
      }
      showToast(
        `❌ ${data?.error ?? 'Không thể khởi tạo giao dịch thanh toán.'} Hotline hỗ trợ: ${OFFICIAL_SUPPORT_HOTLINE}.`,
        'error'
      );
    } catch {
      showToast(`❌ Lỗi kết nối tới cổng thanh toán. Vui lòng thử lại hoặc gọi ${OFFICIAL_SUPPORT_HOTLINE}.`, 'error');
    } finally {
      setLoadingKey(null);
    }
  };

  /** Thanh toán Sprint Pack qua PayOS động thật (vá #5 & #21) */
  const handleBuySprint = async (pack: SprintExamPack, openForParent = false) => {
    if (openForParent) {
      await openParentPayosModal({
        key: `parent-${pack.id}`,
        name: pack.name,
        duration: `${pack.durationDays} Ngày`,
        basePrice: pack.priceVnd,
        planId: pack.id,
        features: pack.features,
      });
      return;
    }
    const key = `sprint-${pack.id}`;
    if (loadingKey) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway,
          planId: pack.id,
          ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showToast('🔐 Vui lòng đăng nhập trước khi kích hoạt gói nước rút.', 'error');
        router.push('/login?next=/pricing');
        return;
      }
      if (res.ok && data.success && data.payUrl) {
        window.location.assign(data.payUrl);
        return;
      }
      showToast(
        `❌ ${data?.error ?? 'Không thể tạo phiên PayOS cho gói Sprint.'} Hotline: ${OFFICIAL_SUPPORT_HOTLINE}.`,
        'error'
      );
    } catch {
      showToast(`❌ Lỗi kết nối tới cổng PayOS. Vui lòng thử lại hoặc gọi ${OFFICIAL_SUPPORT_HOTLINE}.`, 'error');
    } finally {
      setLoadingKey(null);
    }
  };

  /** Thanh toán gói Mua Chung Study Squad 2–3 người qua PayOS động (#23) */
  const handleBuySquad = async (pack: StudySquadPack) => {
    const key = `squad-${pack.id}`;
    if (loadingKey) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: 'payos', planId: pack.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showToast('🔐 Vui lòng đăng nhập để tạo đơn Mua Chung (Study Squad).', 'error');
        router.push('/login?next=/pricing');
        return;
      }
      if (res.ok && data.success && data.payUrl) {
        window.location.assign(data.payUrl);
        return;
      }
      showToast(`❌ ${data?.error ?? 'Không thể tạo phiên PayOS.'} Hotline: ${OFFICIAL_SUPPORT_HOTLINE}.`, 'error');
    } catch {
      showToast(`❌ Lỗi kết nối. Hotline hỗ trợ: ${OFFICIAL_SUPPORT_HOTLINE}.`, 'error');
    } finally {
      setLoadingKey(null);
    }
  };

  // Tạo bức thư gửi Bố Mẹ tự động đính kèm LINK PAYOS ĐỘNG duy nhất (0 STK tĩnh — vá #1)
  const generateParentLetter = () => {
    if (!selectedParentPack) return '';
    return (
      `Con chào Bố/Mẹ ạ!\n\n` +
      `Con đang tập trung cao độ ôn luyện Digital SAT để chuẩn bị cho đợt thi sắp tới, hướng tới mục tiêu điểm ${studentTargetScore} để xét tuyển thẳng vào trường ${studentTargetUni}.\n\n` +
      `Con xin phép Bố/Mẹ tài trợ "${selectedParentPack.name}" trên SAT.Guru (Nền tảng luyện thi Digital SAT AI có phòng thi Bluebook chuẩn College Board & máy tính Desmos).\n\n` +
      `📌 THÔNG TIN ĐƠN HÀNG PAYOS CHÍNH THỨC (TỰ ĐỘNG KÍCH HOẠT 10–30s):\n` +
      `• Mã đơn đối soát: #${selectedParentPack.orderId}\n` +
      `• Học phí chính xác: ${formatVnd(selectedParentPack.priceVnd)}\n` +
      `• Link mở mã VietQR ngân hàng tự động: ${selectedParentPack.payUrl}\n` +
      `• Hotline hỗ trợ Thầy Nghĩa Guru: ${OFFICIAL_SUPPORT_HOTLINE}\n\n` +
      `🎯 CAM KẾT CỦA CON:\n` +
      `Con cam kết học đều tối thiểu 45 phút mỗi ngày và hoàn thành lộ trình đạt ${studentTargetScore}. Hệ thống tặng kèm "Cổng Phụ Huynh" để Bố/Mẹ xem báo cáo tiến độ của con hàng tuần.\n\n` +
      `Bố/Mẹ bấm vào link VietQR chính thức bên trên để thanh toán giúp con trong 30 giây nhé ạ! Con cảm ơn Bố/Mẹ rất nhiều!`
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-24 text-slate-100 max-w-7xl mx-auto px-4 sm:px-6">
      <StatusBanner />
      <VerifiedActivityTicker />

      {/* ==================================================================== */}
      {/* 1. HERO HEADER: BÙNG NỔ CAM KẾT & CHI PHÍ QUY ĐỔI (#C064, #C068) */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border border-indigo-800/40 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <span>🔥 Lộ trình Nước rút Kỳ thi Tháng 8 / 10 / 12 — SAT 2026</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Đầu Tư Thông Minh Cho Tương Lai — Chinh Phục{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200">
              SAT 1500+
            </span>{' '}
            Cùng AI Mentor
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-medium">
            Tiết kiệm hơn 90% chi phí so với các lớp học offline truyền thống. Luyện đề trên giao diện Bluebook chuẩn College Board 100%, phân tích bẫy lỗi sai tức thì cùng Gia sư AI 24/7.
          </p>

          {/* Dòng quy đổi chi phí siêu nhỏ (#C068) */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 rounded-xl text-emerald-300 font-extrabold text-sm sm:text-base">
              <span>☕ Chỉ từ ~5.400đ/ngày</span>
              <span className="text-slate-300 font-normal text-xs sm:text-sm">
                — Rẻ hơn 1 cốc trà đá, mở toang cánh cửa tuyển thẳng Đại học Top đầu!
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. GÓI MÙA THI NƯỚC RÚT (SPRINT EXAM PACKS) (#C064) */}
      {/* ==================================================================== */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              <span>⚡ Dành riêng cho học sinh sắp thi</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Gói Mùa Thi Nước Rút (Sprint Pass 2026)
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Phù hợp tuyệt đối cho đợt thi tháng 8, 10, 12 năm 2026. Luyện cấp tốc, lấp lỗ hổng kiến thức thần tốc.
            </p>
          </div>
          <div className="shrink-0">
            <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg">
              ✨ Tặng Cổng Phụ Huynh đi kèm
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SPRINT_EXAM_PACKS.map((pack) => {
            const isBestSeller = pack.id === 'sprint_45d';
            return (
              <div
                key={pack.id}
                className={`relative rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between ${
                  isBestSeller
                    ? 'bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 border-2 border-amber-400/80 shadow-xl shadow-amber-500/10 scale-105 z-10'
                    : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {pack.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                    {pack.badge}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{pack.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[36px]">{pack.description}</p>
                  </div>

                  <div className="border-t border-b border-slate-800 py-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                        {formatVnd(pack.priceVnd)}
                      </span>
                      {pack.originalPriceVnd && (
                        <span className="text-xs text-slate-500 line-through">
                          {formatVnd(pack.originalPriceVnd)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">Thời hạn: {pack.durationDays} ngày truy cập full</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300">
                    {pack.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 pt-6 mt-6 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={loadingKey !== null}
                    onClick={() => handleBuySprint(pack, false)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition disabled:opacity-60"
                  >
                    {loadingKey === `sprint-${pack.id}` ? '⏳ Đang tạo mã PayOS...' : '🚀 Kích Hoạt Tự Động Qua PayOS VietQR'}
                  </button>

                  <button
                    type="button"
                    disabled={loadingKey !== null}
                    onClick={() => handleBuySprint(pack, true)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-sky-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <span>👨‍👩‍👧 Nhờ Bố Mẹ Thanh Toán (Link PayOS & Zalo)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2B. GÓI MUA CHUNG "BẠN CÙNG TIẾN" (STUDY SQUAD 2–3 NGƯỜI — #23)      */}
      {/* ==================================================================== */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              👯 Rủ bạn cùng trường — Chia nhỏ học phí tới 35%
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Gói Mua Chung &ldquo;Bạn Cùng Tiến&rdquo; (Study Squad 2–3 Người)
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              1 giao dịch PayOS duy nhất tự động cấp 2–3 tài khoản Premium 90 ngày độc lập, dễ xin phụ huynh duyệt chung.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STUDY_SQUAD_PACKS.map((sq) => (
            <div
              key={sq.id}
              className="rounded-2xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 border border-emerald-500/40 p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {sq.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">{sq.seats} tài khoản • {sq.durationDays} ngày</span>
                </div>
                <h3 className="text-xl font-black text-white">{sq.name}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{sq.description}</p>
                <div className="flex items-baseline gap-3 py-2 border-y border-slate-800">
                  <span className="text-2xl font-black text-emerald-400">{formatVnd(sq.priceVnd)}</span>
                  <span className="text-xs text-slate-500 line-through">{formatVnd(sq.originalPriceVnd)}</span>
                  <span className="text-xs font-bold text-amber-300 ml-auto">≈ {formatVnd(sq.pricePerSeatVnd)}/bạn</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {sq.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                disabled={loadingKey !== null}
                onClick={() => handleBuySquad(sq)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition disabled:opacity-60"
              >
                {loadingKey === `squad-${sq.id}` ? '⏳ Đang tạo mã PayOS...' : `🤝 Đăng Ký Nhóm ${sq.seats} Người Qua PayOS`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. BẢNG SO SÁNH HIỆU QUẢ ĐẦU TƯ TƯƠNG TÁC: AI vs. LỚP OFFLINE (#34)  */}
      {/* ==================================================================== */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-400 uppercase">🧮 Công Cụ Tính ROI Nhanh Cho Phụ Huynh</div>
            <p className="text-xs text-slate-300">
              Chọn trường mục tiêu của con để đối chiếu chi phí/ngày với giá trị học bổng &amp; lớp học offline 30–50 triệu:
            </p>
          </div>
          <select
            value={roiUni}
            onChange={(e) => setRoiUni(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
          >
            {TARGET_UNIVERSITIES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-400">Trường mục tiêu</div>
            <div className="text-sm font-black text-white mt-1">{roiUni}</div>
            <div className="text-[11px] text-amber-300 mt-0.5">
              Ngưỡng an toàn: {roiUni.includes('Du học') || roiUni.includes('VinUni') ? '1450–1550+ SAT' : '1380–1450+ SAT'}
            </div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-400">Chi phí SAT.Guru (Premium 1 Năm)</div>
            <div className="text-sm font-black text-emerald-400 mt-1">~10.900₫ / ngày</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tiết kiệm ~36.000.000₫ so với trung tâm offline</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-400">Giá trị học bổng / ROI dự kiến</div>
            <div className="text-sm font-black text-amber-300 mt-1">
              {roiUni.includes('Du học') ? '800 Triệu – 2.5 Tỷ VNĐ' : roiUni.includes('VinUni') ? '350 – 900 Triệu VNĐ' : 'Tuyển thẳng + 50–150tr tiết kiệm luyện thi'}
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">ROI gấp 30× – 200× mức đầu tư</div>
          </div>
        </div>
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <span>📊 Phân Tích ROI (Hiệu Quả Đầu Tư Giáo Dục)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            SAT.Guru AI 24/7 vs. Lớp Học Offline Truyền Thống
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Tại sao hàng ngàn học sinh trường chuyên và phụ huynh thông thái lựa chọn giải pháp ôn thi công nghệ cao?
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-4 px-4 w-1/4">Tiêu Chí So Sánh</th>
                <th className="py-4 px-4 w-3/8 text-rose-400 bg-rose-950/20 rounded-t-xl">
                  ❌ Lớp Offline Truyền Thống
                </th>
                <th className="py-4 px-4 w-3/8 text-emerald-300 bg-emerald-950/30 rounded-t-xl border-t-2 border-x-2 border-emerald-500/50">
                  ⭐ SAT.Guru AI Mentor 24/7
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-4 px-4 font-bold text-white">Chi Phí Đầu Tư</td>
                <td className="py-4 px-4 text-slate-300 bg-rose-950/10">
                  <span className="font-bold text-rose-400">30.000.000đ – 50.000.000đ</span> / khóa (4–6 tháng)
                </td>
                <td className="py-4 px-4 text-emerald-200 bg-emerald-950/20 border-x-2 border-emerald-500/40 font-bold">
                  Chỉ từ 699.000đ – 1.999.000đ{' '}
                  <span className="text-emerald-400 underline decoration-emerald-400 font-black">
                    (Tiết kiệm &gt;90% ngân sách)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-bold text-white">Thời Lượng & Địa Điểm</td>
                <td className="py-4 px-4 text-slate-300 bg-rose-950/10">
                  Cố định 2–3 buổi/tuần; mất 1–2h di chuyển nắng mưa, kẹt xe
                </td>
                <td className="py-4 px-4 text-slate-200 bg-emerald-950/20 border-x-2 border-emerald-500/40">
                  Học mọi lúc mọi nơi 24/7 trên Laptop, iPad hoặc Smartphone
                </td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-bold text-white">Giải Đáp Câu Sai & Bẫy Đề</td>
                <td className="py-4 px-4 text-slate-300 bg-rose-950/10">
                  Phải đợi đến buổi sau; ngại hỏi trước lớp đông 20–30 bạn
                </td>
                <td className="py-4 px-4 text-slate-200 bg-emerald-950/20 border-x-2 border-emerald-500/40">
                  Gia sư AI giải thích tức thì trong 3 giây theo phương pháp Socratic gợi mở tư duy
                </td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-bold text-white">Cá Nhân Hóa Lộ Trình (Adaptive)</td>
                <td className="py-4 px-4 text-slate-300 bg-rose-950/10">
                  Chung 1 giáo trình đại trà cho cả lớp, không tập trung vào đúng lỗ hổng của riêng bạn
                </td>
                <td className="py-4 px-4 text-slate-200 bg-emerald-950/20 border-x-2 border-emerald-500/40">
                  Thuật toán IRT & Adaptive tự động phát hiện micro-skill yếu và luyện đúng dạng bài cần bù đắp
                </td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-bold text-white">Giao Diện Phòng Thi Thật</td>
                <td className="py-4 px-4 text-slate-300 bg-rose-950/10">
                  Đề in giấy hoặc file PDF scan rời rạc, không quen áp lực đồng hồ thi Digital SAT
                </td>
                <td className="py-4 px-4 text-slate-200 bg-emerald-950/20 border-x-2 border-emerald-500/40">
                  Chuẩn xác 100% giao diện Bluebook College Board, tích hợp máy tính đồ thị Desmos chính thức
                </td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-bold text-white">Minh Bạch Cho Phụ Huynh</td>
                <td className="py-4 px-4 text-slate-300 bg-rose-950/10">
                  Phụ huynh không nắm được con học tiến bộ ra sao ngoài điểm tổng kết cuối khóa
                </td>
                <td className="py-4 px-4 text-slate-200 bg-emerald-950/20 border-x-2 border-b-2 border-emerald-500/40 rounded-b-xl">
                  Cổng Phụ Huynh riêng biệt, xem biểu đồ tiến độ & dự đoán điểm thi thật theo tuần qua Zalo
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. CHỌN CHU KỲ & CÁC GÓI THÀNH VIÊN DÀI HẠN (PREMIUM & ULTIMATE) */}
      {/* ==================================================================== */}
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Gói Đào Tạo Dài Hạn & Toàn Diện
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Lựa chọn chu kỳ linh hoạt. Đăng ký theo năm để nhận mức ưu đãi cao nhất và cam kết đồng hành tới ngày thi.
          </p>

          {/* Switch Period */}
          <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-2xl max-w-full overflow-x-auto">
            {PERIODS.map((p) => {
              const active = period === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {PERIOD_LABEL[p]}
                  {PERIOD_SAVE[p] && (
                    <span className="block text-[10px] font-extrabold opacity-90">
                      {PERIOD_SAVE[p]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Khung chọn cổng thanh toán & Mã ưu đãi KOL (Đồng bộ 100% với /upgrade — vá #6 & #22) */}
        <div className="max-w-3xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {GATEWAYS.filter((g) => g.enabled).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGateway(g.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  gateway === g.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Nhập mã ưu đãi (VD: NGHIAGURU10)"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 uppercase w-full sm:w-52"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-600 transition shrink-0"
            >
              Áp Dụng
            </button>
          </div>
        </div>

        {/* Cards các gói Free / Premium / Ultimate */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {(['free', 'premium', 'ultimate'] as Tier[]).map((tierKey) => {
            const meta = TIER_META[tierKey];
            const isFree = tierKey === 'free';
            const plan = !isFree ? planFor(tierKey as PaidTier, period) : null;
            const priceCalc = plan ? computePrice(plan.priceVnd) : null;

            return (
              <div
                key={tierKey}
                className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all ${
                  meta.highlight
                    ? 'bg-gradient-to-b from-indigo-950/90 via-slate-900 to-slate-950 border-2 border-amber-400 shadow-2xl shadow-amber-500/10 scale-105 z-10'
                    : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {meta.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">
                    ⭐ Được Lựa Chọn Nhiều Nhất
                  </div>
                )}

                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{meta.icon}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {PERIOD_DAILY_COST[period]}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white">{meta.label}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[34px]">{meta.tagline}</p>
                  </div>

                  {/* Giá tiền */}
                  <div className="border-t border-b border-slate-800 py-4">
                    {isFree ? (
                      <div>
                        <span className="text-3xl font-black text-white">0₫</span>
                        <span className="text-xs text-slate-400 ml-2">Miễn phí vĩnh viễn</span>
                      </div>
                    ) : plan && priceCalc ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-emerald-400">
                            {formatVnd(priceCalc.finalPrice)}
                          </span>
                          {priceCalc.finalPrice < plan.priceVnd && (
                            <span className="text-xs text-slate-500 line-through">
                              {formatVnd(plan.priceVnd)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {PERIOD_LABEL[period]} truy cập không giới hạn
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Đặc quyền gói */}
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    {isFree && (
                      <>
                        <li className="flex items-center gap-2">✓ Thi thử Diagnostic xếp lớp ban đầu</li>
                        <li className="flex items-center gap-2">✓ Luyện tập một số domain toán cơ bản</li>
                        <li className="flex items-center gap-2">✓ Xem điểm dự đoán tổng quát</li>
                        <li className="flex items-center gap-2 text-slate-500">✗ Mở khóa toàn bộ Cây Kỹ Năng</li>
                        <li className="flex items-center gap-2 text-slate-500">✗ Gia sư AI Adaptive 24/7</li>
                      </>
                    )}
                    {tierKey === 'premium' && (
                      <>
                        <li className="flex items-center gap-2 font-bold text-white">
                          <span className="text-amber-400">✓</span> Mở full 100% Cây Kỹ Năng Toán & Đọc-Viết
                        </li>
                        <li className="flex items-center gap-2 font-bold text-white">
                          <span className="text-amber-400">✓</span> Gia sư AI Mentor 24/7 giải thích mọi câu sai
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Luyện tập thích ứng Adaptive theo điểm yếu
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Thi thử Mock test không giới hạn
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Báo cáo Cổng Phụ Huynh định kỳ 30 ngày
                        </li>
                      </>
                    )}
                    {tierKey === 'ultimate' && (
                      <>
                        <li className="flex items-center gap-2 font-bold text-amber-300">
                          <span className="text-amber-300">👑</span> Toàn bộ đặc quyền của gói Premium
                        </li>
                        <li className="flex items-center gap-2 font-bold text-white">
                          <span className="text-amber-400">✓</span> Kho Đề Thi Thật QAS full-length sát đề College Board
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Model AI giải thích chuyên sâu (cấp độ Mentor 1500+)
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Báo cáo Phụ huynh 90 ngày chuyên sâu & ROI đại học
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Nhân đôi hệ số xu RPG (x2 Coins)
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Nút hành động */}
                <div className="pt-6 mt-6 border-t border-slate-800 space-y-2">
                  {isFree ? (
                    <Link
                      href="/diagnostic"
                      className="block w-full text-center py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
                    >
                      Bắt Đầu Miễn Phí
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleBuy(tierKey as PaidTier)}
                        className={`w-full py-2.5 px-4 rounded-xl font-black text-xs shadow-md transition ${
                          meta.highlight
                            ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950'
                            : 'bg-white hover:bg-slate-100 text-slate-950'
                        }`}
                      >
                        Đăng Ký Gói Này
                      </button>

                      <button
                        type="button"
                        disabled={loadingKey !== null}
                        onClick={() => {
                          const p = planFor(tierKey as PaidTier, period);
                          if (p) {
                            void openParentPayosModal({
                              key: `parent-${tierKey}-${period}`,
                              name: `Gói ${meta.label} (${PERIOD_LABEL[period]})`,
                              duration: PERIOD_LABEL[period],
                              basePrice: p.priceVnd,
                              tier: tierKey as PaidTier,
                              targetPeriod: period,
                            });
                          }
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-sky-300 font-bold text-xs border border-sky-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <span>{loadingKey === `parent-${tierKey}-${period}` ? '⏳ Đang tạo link PayOS...' : '👨‍👩‍👧 Nhờ Bố Mẹ Thanh Toán (PayOS VietQR)'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. BỘ 3 THẺ CAM KẾT & QUYỀN LỢI PHỤ HUYNH (#C065, #C066, #C067) */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* #C065 + #28: Chính sách Bảo lãnh tiến bộ điểm số minh bạch */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 p-6 space-y-3">
          <div className="text-3xl">🛡️</div>
          <h3 className="text-base font-bold text-white">Bảo Lãnh Tiến Bộ Điểm Số (Score Assurance)</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {SCORE_ASSURANCE_POLICY.summaryVi}{' '}
            <strong className="text-emerald-300">{SCORE_ASSURANCE_POLICY.remedyVi}</strong>
          </p>
          <Link href="/refund" className="inline-block text-[11px] font-bold text-amber-300 hover:underline">
            Xem điều khoản bảo lãnh chi tiết →
          </Link>
        </div>

        {/* #C066 */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-950/60 to-slate-900 border border-purple-500/30 p-6 space-y-3">
          <div className="text-3xl">👨‍👩‍👧</div>
          <h3 className="text-base font-bold text-white">Tặng Kèm Cổng Phụ Huynh Miễn Phí</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Trị giá 500.000đ — Phụ huynh nhận link giám sát độc lập, theo dõi thời lượng học hàng ngày, biểu đồ tiến bộ kỹ năng và điểm thi thử cập nhật tự động theo tuần qua Zalo mà không tốn thêm bất kỳ chi phí nào.
          </p>
        </div>

        {/* #C067 */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 p-6 space-y-3">
          <div className="text-3xl">⏸️</div>
          <h3 className="text-base font-bold text-white">Bảo Lưu & Dời Kỳ Thi Linh Hoạt</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Nếu học sinh bận thi học kỳ THPT hoặc có kế hoạch dời ngày thi SAT chính thức của College Board, hệ thống hỗ trợ bảo lưu thời hạn gói học tối đa 30 ngày hoàn toàn miễn phí.
          </p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 6. HỌC SINH TRƯỜNG CHUYÊN NÓI GÌ (#C069) */}
      {/* ==================================================================== */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 sm:p-10 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <span>🌟 Người Thật — Điểm Thật</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Học Sinh Trường Chuyên & Top THPT Nói Gì Về SAT.Guru?
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Hơn 2.500+ học sinh từ các trường chuyên danh tiếng đã bứt phá điểm số và chạm tay vào tấm vé tuyển thẳng Đại học Top đầu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center font-bold text-slate-950 text-sm">
                MA
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Nguyễn Minh Anh</h4>
                <p className="text-[11px] text-amber-300 font-semibold">Chuyên Toán — THPT Chuyên Hà Tĩnh</p>
              </div>
            </div>
            <div className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-bold">
              SAT 1520 (Tăng +180 điểm) • Tuyển thẳng FTU
            </div>
            <p className="text-xs text-slate-300 italic leading-relaxed">
              &ldquo;Nhờ hệ thống AI phân tích lỗi sai và luyện đề Bluebook của SAT.Guru, em đã tăng từ 1340 lên 1520 chỉ sau 2 tháng và xuất sắc đỗ diện tuyển thẳng sớm vào ĐH Ngoại Thương Hà Nội!&rdquo;
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center font-bold text-slate-950 text-sm">
                HN
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Lê Hoàng Nam</h4>
                <p className="text-[11px] text-sky-300 font-semibold">Chuyên Anh — THPT Chuyên Lam Sơn</p>
              </div>
            </div>
            <div className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-bold">
              SAT 1540 • Học bổng Đại học Mỹ
            </div>
            <p className="text-xs text-slate-300 italic leading-relaxed">
              &ldquo;Gói nước rút cực kỳ đáng tiền, tính ra chỉ vài nghìn một ngày mà AI giảng giải chi tiết hơn cả đi học thêm 40 triệu ở trung tâm. Giao diện Desmos xịn như thi thật.&rdquo;
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-400 to-pink-500 flex items-center justify-center font-bold text-slate-950 text-sm">
                TL
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Trần Thảo Linh</h4>
                <p className="text-[11px] text-purple-300 font-semibold">THPT Chuyên Ngoại Ngữ Hà Nội</p>
              </div>
            </div>
            <div className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-bold">
              SAT 1490 • Xét tuyển Kinh Tế Quốc Dân (NEU)
            </div>
            <p className="text-xs text-slate-300 italic leading-relaxed">
              &ldquo;Bố mẹ em rất yên tâm vì có Cổng Phụ Huynh gửi thông báo kết quả thi thử qua Zalo mỗi tuần. Mẹ bảo đầu tư gói học này là quyết định đúng đắn nhất năm lớp 11 của em!&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 7. KHỐI THÔNG TIN NỀN TẢNG & HỖ TRỢ KÍCH HOẠT SAT.GURU (#C070)       */}
      {/* ==================================================================== */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 p-8 sm:p-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <span>🎓 NỀN TẢNG LUYỆN THI DIGITAL SAT ĐỘC LẬP</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              SAT.Guru — Hệ Thống Luyện Thi Digital SAT AI
            </h3>
            <p className="text-xs text-slate-400">
              Phụ trách học thuật &amp; Cố vấn chiến lược: <strong className="text-slate-200">Thầy Nghĩa Guru (Nguyễn Viết Nghĩa)</strong>
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl font-bold shrink-0">
              📞
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Hotline / Zalo Tư Vấn 24/7:</div>
              <a
                href="tel:0986722324"
                className="text-lg font-black text-emerald-400 hover:text-emerald-300 transition tracking-wide font-mono"
              >
                0986.722.324
              </a>
              <div className="text-[10px] text-slate-500">Kích hoạt tài khoản tự động trong 30 giây</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300">
          <div className="space-y-1.5">
            <span className="font-bold text-slate-400 block">Đối Tượng Phục Vụ:</span>
            <span className="text-amber-300 font-bold text-sm block">Học sinh THPT Việt Nam (Lớp 10–12)</span>
            <p className="text-[11px] text-slate-500">Mục tiêu 1300–1550+ xét tuyển FTU, NEU, HUST, VNU, VinUni, Fulbright &amp; Du học Mỹ</p>
          </div>

          <div className="space-y-1.5">
            <span className="font-bold text-slate-400 block">Chuẩn Khảo Thí &amp; Công Nghệ:</span>
            <span className="text-slate-200 font-medium leading-relaxed block">
              Mô phỏng Bluebook Adaptive • Máy tính Desmos • Gia sư AI Socratic song ngữ
            </span>
            <p className="text-[11px] text-slate-500">
              Cổng báo cáo tiến độ minh bạch riêng dành cho Phụ huynh &amp; Giáo viên
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="font-bold text-slate-400 block">Cam Kết Minh Bạch &amp; An Toàn:</span>
            <ul className="space-y-1 text-[11px] text-slate-400">
              <li>✓ Minh bạch học phí, không phí ẩn tự động gia hạn</li>
              <li>✓ Kích hoạt gói học tự động qua VietQR trong 10–30s</li>
              <li>✓ Hoàn tiền 100% nếu hệ thống phát sinh lỗi kỹ thuật</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 8. MODAL: NHỜ BỐ MẸ THANH TOÁN (100% PAYOS ĐỘNG + NATIVE SVG QR)     */}
      {/* ==================================================================== */}
      {isParentModalOpen && selectedParentPack && (() => {
        const qrMatrix = encodeQrMatrix(selectedParentPack.qrPayload);
        const qrSvg = qrMatrixToSvgPath(qrMatrix);
        const mins = Math.floor(qrCountdownSec / 60);
        const secs = qrCountdownSec % 60;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#111827] to-[#0b0f19] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-8">
            <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 p-5 sm:p-6 text-white flex items-center justify-between border-b border-indigo-700/40">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👨‍👩‍👧</span>
                <div>
                  <h3 className="font-black text-base sm:text-lg">
                    Nhờ Bố Mẹ Thanh Toán (PayOS VietQR Động — Tự Kích Hoạt 10–30s)
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Đơn hàng thật có mã đối soát #{selectedParentPack.orderId} • Hết hạn sau {mins}:{secs.toString().padStart(2, '0')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsParentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Gói đã chọn:</span>
                  <h4 className="text-base font-bold text-white">{selectedParentPack.name}</h4>
                  <span className="text-xs text-slate-400">Thời hạn: {selectedParentPack.duration} • Mã đơn: #{selectedParentPack.orderId}</span>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-400 block">Học phí chính xác:</span>
                  <span className="text-xl font-black text-emerald-400">
                    {formatVnd(selectedParentPack.priceVnd)}
                  </span>
                </div>
              </div>

              <div className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>🎯</span>
                  <span>CÁ NHÂN HÓA BỨC THƯ GỬI BỐ MẸ:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1.5">1. Trường Đại Học Mục Tiêu:</label>
                    <select
                      value={studentTargetUni}
                      onChange={(e) => setStudentTargetUni(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 text-xs"
                    >
                      {TARGET_UNIVERSITIES.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1.5">2. Điểm SAT Quyết Tâm Đạt:</label>
                    <select
                      value={studentTargetScore}
                      onChange={(e) => setStudentTargetScore(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-400 text-xs"
                    >
                      {TARGET_SCORES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Khung PayOS Động Native SVG QR (0 STK tĩnh, 0 img.vietqr.io) */}
              <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-2xl shrink-0 shadow-xl flex flex-col items-center">
                  <svg
                    viewBox={`0 0 ${qrSvg.viewBox} ${qrSvg.viewBox}`}
                    className="w-44 h-44"
                    role="img"
                    aria-label="Mã QR PayOS Thanh Toán Động"
                  >
                    <rect width={qrSvg.viewBox} height={qrSvg.viewBox} fill="#ffffff" />
                    <path d={qrSvg.path} fill="#0f172a" />
                  </svg>
                  <span className="text-[10px] font-bold text-slate-700 mt-1">
                    Quét QR hoặc mở cổng PayOS
                  </span>
                </div>

                <div className="space-y-3 text-xs w-full">
                  <div className="font-bold text-white text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span>Cổng PayOS Napas/VietQR Chính Thức</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Hiệu lực {mins}:{secs.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Mỗi đơn hàng được PayOS cấp 1 mã VietQR động riêng biệt. Ngay khi Bố Mẹ xác nhận chuyển khoản trên app ngân hàng, hệ thống webhook tự động mở khóa tài khoản sau <strong className="text-emerald-300">10–30 giây</strong>.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={selectedParentPack.payUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition"
                    >
                      🏦 Mở Cổng PayOS VietQR Ngay
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedParentPack.payUrl);
                        showToast('✅ Đã chép link PayOS gửi Bố Mẹ!', 'success');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-slate-700"
                    >
                      📋 Chép Link PayOS
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Cần hỗ trợ trực tiếp: Hotline/Zalo Thầy Nghĩa Guru{' '}
                    <strong className="text-amber-300 font-mono">{OFFICIAL_SUPPORT_HOTLINE}</strong>.
                  </div>
                </div>
              </div>

              {/* Mẫu Thư Lễ Phép & Nút Gửi Zalo */}
              <div className="space-y-3">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] text-slate-300 space-y-1.5">
                  <span className="text-xs font-bold text-amber-300 block">
                    💌 Bức thư lễ phép kèm link PayOS tự động gửi Bố Mẹ:
                  </span>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto whitespace-pre-wrap font-sans text-slate-300 leading-relaxed">
                    {generateParentLetter()}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generateParentLetter());
                      showToast('📋 Đã sao chép toàn bộ bức thư gửi Bố Mẹ!', 'success');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    <span>📋 Sao Chép Bức Thư Gửi Zalo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.open('https://zalo.me', '_blank');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-[#0068FF] hover:bg-[#0055d4] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    <span>💬 Mở Zalo Gửi Bố Mẹ Ngay</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Mục #25 & #27: B2B Center License + Score Guarantee dùng chung 1 nguồn duy nhất */}
      <B2bCenterPricingSection />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-400 py-24">Đang tải bảng giá học phí...</div>}>
      <PricingContent />
    </Suspense>
  );
}
