'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
// MAIN PRICING CONTENT COMPONENT
// ============================================================================
function PricingContent() {
  const { showToast } = useToast();
  const [gateway, setGateway] = useState<Gateway>('payos');
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Coins-to-Cash state
  const [userCoins, setUserCoins] = useState<number>(3500);
  const [useCoinsDiscount, setUseCoinsDiscount] = useState<boolean>(true);

  // Modal "Nhờ Bố Mẹ Thanh Toán" (#C061 & #C062)
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

  // State mục tiêu của học sinh trong modal (#C061, #C062)
  const [studentTargetUni, setStudentTargetUni] = useState<string>(TARGET_UNIVERSITIES[0]);
  const [studentTargetScore, setStudentTargetScore] = useState<string>(TARGET_SCORES[1]); // 1450+ SAT

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
        'Truy cập đầy đủ kho đề thi chuẩn College Board 2026',
        'Gia sư AI chấm điểm & phân tích bẫy lỗi sai tức thì 24/7',
        'Tặng kèm Cổng Phụ Huynh theo dõi tiến độ học tập hàng tuần',
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
        showToast('Mở cổng VietQR chuyển khoản nhanh 1 chạm!', 'info');
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

  // Tạo bức thư gửi Bố Mẹ tự động (#C061, #C062)
  const generateParentLetter = () => {
    return (
      `Con chào Bố/Mẹ ạ!\n\n` +
      `Con đang tập trung cao độ ôn luyện Digital SAT để chuẩn bị cho đợt thi sắp tới, hướng tới mục tiêu điểm ${studentTargetScore} để xét tuyển thẳng vào trường ${studentTargetUni}.\n\n` +
      `Để bứt phá điểm số và khắc phục các dạng bài còn yếu, con xin phép Bố/Mẹ cho con đăng ký "${selectedParentPack.name}" trên hệ thống SAT.Guru (Nền tảng luyện thi Digital SAT ứng dụng AI có tích hợp giao diện Bluebook chuẩn College Board).\n\n` +
      `📌 THÔNG TIN THANH TOÁN:\n` +
      `• Học phí ưu đãi: ${formatVnd(selectedParentPack.priceVnd)}\n` +
      `• Ngân hàng: MB Bank (Ngân hàng Quân Đội)\n` +
      `• Số tài khoản: 0345678999\n` +
      `• Chủ tài khoản: SAT NGHIAGURU ACADEMY\n` +
      `• Cú pháp chuyển khoản: SATGURU ${selectedParentPack.code}\n\n` +
      `🎯 CAM KẾT CỦA CON:\n` +
      `Con cam kết sẽ học tập nghiêm túc tối thiểu 45 phút mỗi ngày, luyện tập đều đặn và quyết tâm đạt mục tiêu ${studentTargetScore}. Hệ thống có tặng kèm "Cổng Phụ Huynh" miễn phí để Bố/Mẹ có thể xem biểu đồ tiến độ và kết quả thi thử của con bất kỳ lúc nào.\n\n` +
      `Bố/Mẹ quét mã VietQR trong 30 giây hoặc chuyển khoản giúp con nhé ạ! Con cảm ơn Bố/Mẹ rất nhiều!`
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-24 text-slate-100 max-w-7xl mx-auto px-4 sm:px-6">
      <StatusBanner />

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
                    onClick={() => handleBuySprint(pack)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition"
                  >
                    🚀 Kích Hoạt Ngay Qua VietQR
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBuySprint(pack)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-sky-500/20 transition flex items-center justify-center gap-1.5"
                  >
                    <span>👨‍👩‍👧 Nhờ Bố Mẹ Thanh Toán (Zalo 1 Chạm)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. BẢNG SO SÁNH HIỆU QUẢ ĐẦU TƯ: AI vs. LỚP TRUYỀN THỐNG (#C063) */}
      {/* ==================================================================== */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-10 space-y-6">
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

        {/* Khung áp dụng Coupon & Xu Học Tập */}
        <div className="max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-2xl">🪙</span>
            <div>
              <div className="text-xs font-bold text-white">Xu Học Tập (Coins-to-Cash):</div>
              <div className="text-xs text-amber-300 font-mono">
                Bạn đang có: <strong>{userCoins.toLocaleString()} Xu</strong> (~{formatVnd(Math.floor(userCoins * 10))})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Nhập mã ưu đãi (VD: CHUYEN2026)"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 uppercase w-full sm:w-48"
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
                        onClick={() => {
                          const p = planFor(tierKey as PaidTier, period);
                          if (p) {
                            openParentModalForPlan(
                              `Gói ${meta.label} (${PERIOD_LABEL[period]})`,
                              PERIOD_LABEL[period],
                              p.priceVnd,
                              `${tierKey.toUpperCase()}_${period.toUpperCase()}`
                            );
                          }
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-sky-300 font-bold text-xs border border-sky-500/20 transition flex items-center justify-center gap-1.5"
                      >
                        <span>👨‍👩‍👧 Nhờ Bố Mẹ Thanh Toán (VietQR)</span>
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
        {/* #C065 */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 p-6 space-y-3">
          <div className="text-3xl">🛡️</div>
          <h3 className="text-base font-bold text-white">Cam Kết Đồng Hành Tăng Điểm</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Học sinh hoàn thành tối thiểu 80% lộ trình luyện tập được cam kết tăng từ <strong>100 – 250+ điểm SAT</strong> so với điểm khảo sát ban đầu. Hệ thống đồng hành sát sao đến khi bạn tự tin bước vào phòng thi thật.
          </p>
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
      {/* 7. KHỐI THÔNG TIN PHÁP LÝ & HỖ TRỢ KÍCH HOẠT CHUẨN PHÚ GIA (#C070) */}
      {/* ==================================================================== */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 p-8 sm:p-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <span>🏛️ THÔNG TIN PHÁP LÝ & ĐƠN VỊ VẬN HÀNH</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Hộ Kinh Doanh Phú Gia - Nội Thất & Xây Dựng
            </h3>
            <p className="text-xs text-slate-400">
              Thương hiệu phát triển: <strong className="text-slate-200">CÔNG TY CP PHÚ GIA VIỆT NAM / PG HOME LUXURY</strong>
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl font-bold shrink-0">
              📞
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Hotline Hỗ Trợ 24/7 (Zalo):</div>
              <a
                href="tel:0986722324"
                className="text-lg font-black text-emerald-400 hover:text-emerald-300 transition tracking-wide font-mono"
              >
                0986.722.324
              </a>
              <div className="text-[10px] text-slate-500">Kích hoạt tài khoản trong 3 phút</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300">
          <div className="space-y-1.5">
            <span className="font-bold text-slate-400 block">Mã số ĐKKD / Mã số thuế (MST):</span>
            <span className="font-mono font-bold text-amber-300 text-sm">042203002931</span>
            <p className="text-[11px] text-slate-500">Đăng ký lần đầu: 13/01/2025 • Đại diện: Nguyễn Trọng Nghĩa</p>
          </div>

          <div className="space-y-1.5">
            <span className="font-bold text-slate-400 block">Địa chỉ Giao dịch & Tổ hợp Nghiên cứu:</span>
            <span className="text-slate-200 font-medium leading-relaxed block">
              Ngõ 49 Trương Quốc Dụng, P. Thành Sen, TP. Hà Tĩnh
            </span>
            <p className="text-[11px] text-slate-500">
              ĐKKD: Số 01, Ngõ 53, Đường Trương Quốc Dụng, Phường Thành Sen, Tỉnh Hà Tĩnh
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="font-bold text-slate-400 block">Cam Kết Minh Bạch & An Toàn:</span>
            <ul className="space-y-1 text-[11px] text-slate-400">
              <li>✓ Hóa đơn & chứng từ thanh toán hợp lệ</li>
              <li>✓ Kích hoạt gói học tự động qua VietQR trong 10-30s</li>
              <li>✓ Hoàn tiền 100% nếu hệ thống phát sinh lỗi kỹ thuật</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 8. MODAL: NHỜ BỐ MẸ THANH TOÁN (VIETQR & ZALO 1 CHẠM) (#C061, #C062) */}
      {/* ==================================================================== */}
      {isParentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#111827] to-[#0b0f19] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 p-5 sm:p-6 text-white flex items-center justify-between border-b border-indigo-700/40">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👨‍👩‍👧</span>
                <div>
                  <h3 className="font-black text-base sm:text-lg">
                    Nhờ Bố Mẹ Thanh Toán (VietQR & Zalo 1 Chạm)
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Gửi thư lễ phép kèm VietQR tự điền để Bố Mẹ quét thanh toán nhanh trong 30 giây
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
              {/* Thông tin gói học được chọn */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Gói đã chọn:</span>
                  <h4 className="text-base font-bold text-white">{selectedParentPack.name}</h4>
                  <span className="text-xs text-slate-400">Thời hạn sử dụng: {selectedParentPack.duration}</span>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-400 block">Học phí:</span>
                  <span className="text-xl font-black text-emerald-400">
                    {formatVnd(selectedParentPack.priceVnd)}
                  </span>
                </div>
              </div>

              {/* Nhập Mục tiêu Trường ĐH & Điểm SAT (#C061, #C062) */}
              <div className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>🎯</span>
                  <span>CÁ NHÂN HÓA BỨC THƯ GỬI BỐ MẸ:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1.5">
                      1. Trường Đại Học Mục Tiêu Của Con:
                    </label>
                    <select
                      value={studentTargetUni}
                      onChange={(e) => setStudentTargetUni(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 text-xs"
                    >
                      {TARGET_UNIVERSITIES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1.5">
                      2. Điểm Số SAT Quyết Tâm Đạt Được:
                    </label>
                    <select
                      value={studentTargetScore}
                      onChange={(e) => setStudentTargetScore(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-400 text-xs"
                    >
                      {TARGET_SCORES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Khung Mã VietQR Động */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-2xl shrink-0 shadow-xl flex flex-col items-center">
                  <img
                    src={`https://img.vietqr.io/image/MB-0345678999-compact2.png?amount=${selectedParentPack.priceVnd}&addInfo=SATGURU%20${selectedParentPack.code}&accountName=SAT%20NGHIAGURU`}
                    alt="Mã VietQR Thanh Toán"
                    className="w-48 h-48 object-contain"
                    loading="lazy"
                  />
                  <span className="text-[10px] font-bold text-slate-700 mt-1">Quét mã bằng App Ngân Hàng</span>
                </div>

                <div className="space-y-2.5 text-xs w-full">
                  <div className="font-bold text-white text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span>Thông tin chuyển khoản nhanh:</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Tự động kích hoạt 24/7
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ngân hàng:</span>
                    <span className="font-bold text-white">MB Bank (Ngân Hàng Quân Đội)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Số tài khoản:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-300 text-sm">0345678999</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('0345678999');
                          showToast('Đã chép số tài khoản!', 'success');
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
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
                    <div className="flex items-center gap-2">
                      <span className="font-black text-emerald-400 text-sm">
                        {formatVnd(selectedParentPack.priceVnd)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(String(selectedParentPack.priceVnd));
                          showToast('Đã chép số tiền!', 'success');
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                      >
                        Chép
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Cú pháp CK:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-300 bg-sky-950/80 px-2.5 py-0.5 rounded border border-sky-500/40">
                        SATGURU {selectedParentPack.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`SATGURU ${selectedParentPack.code}`);
                          showToast('Đã chép cú pháp chuyển khoản!', 'success');
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                      >
                        Chép
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hướng Dẫn Quét VietQR 30 Giây */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-slate-300 block">⚡ Hướng dẫn Bố Mẹ thanh toán trong 3 bước:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-400">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">Bước 1: Mở App</span>
                    Mở ứng dụng Ngân hàng bất kỳ (VCB, Techcombank, MB, BIDV, v.v.).
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">Bước 2: Quét QR</span>
                    Chọn tính năng Quét QR và chiếu vào mã VietQR bên trên.
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">Bước 3: Hoàn tất</span>
                    Xác nhận chuyển khoản. Gói học tự động mở sau 10-30 giây!
                  </div>
                </div>
              </div>

              {/* Mẫu Thư Lễ Phép & Nút Gửi Zalo */}
              <div className="space-y-3">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] text-slate-300 space-y-1.5">
                  <span className="text-xs font-bold text-amber-300 block">
                    💌 Bức thư lễ phép tự động tạo gửi Bố Mẹ:
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
      )}
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
