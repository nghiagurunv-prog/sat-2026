import type { AiTier } from './ai-quota';

/**
 * ============================================================================
 *  SUBSCRIPTION TIER (Phase 2 — nền tảng gói trả phí)
 * ============================================================================
 *  Nguồn sự thật về GÓI (tier) của user. Trước Phase 2, mọi route AI hardcode
 *  tier:'free'. Nay chat/route.ts và generate-practice/route.ts đã tra tier THẬT
 *  qua getUserTier() (fail-safe → 'free' khi lỗi/không có gói) — module này giữ
 *  logic thuần tier + gate quota, đọc từ bảng `user_subscriptions`.
 *
 *  Phạm vi: nền tảng tier + gate AI quota. Cổng thanh toán Stripe đã nối:
 *  việc cấp/gia hạn gói do RPC `confirm_payment` làm ATOMIC cùng lúc xác nhận đơn
 *  (migration_a2_atomic_grant.sql), KHÔNG qua hàm grant riêng. Billing:
 *  Monthly/Quarterly/Semiannual/Yearly.
 *
 *  ⚠️ THUẦN (pure) — không I/O. "now" được TIÊM vào để unit-test xác định (theo
 *  mẫu economy.ts/gate-exam.ts). Tầng I/O + Supabase nằm ở subscription-store.ts.
 *
 *  ⚠️ GIÁ (priceVnd) = GIÁ NIÊM YẾT (list price) đã CHỐT với user 2026-07-06,
 *  mức "Premium-elite" — neo cao cho tệp học sinh du học có điều kiện + chừa
 *  headroom cho affiliate/KOL chiết khấu 30-40% (buyer nhập mã KOL → thực thu
 *  ~65% list, vẫn lãi vì sàn chi phí AI thấp). Giá chỉ là dữ liệu bảng, KHÔNG
 *  ảnh hưởng logic tier/quota. Chốt giá cuối xem TODO_USER.md.
 *
 *  KHÁC BIỆT GÓI: cả Premium & Ultimate đều ∞ AI (DAILY_LIMITS KHÔNG đổi) → phân
 *  tầng bằng RPG (hệ số xu, đề độc quyền) + chương trình học (skill-tree/adaptive/
 *  thi thật) + mentor (report 90d, model AI xịn), KHÔNG bằng quota AI.
 *
 *  ⏳ Affiliate/coupon (referral tracking + áp discount ở payment/create + payout
 *  hoa hồng) là Wave 2, cần migration DB — CHƯA xây. payment/create hiện chốt
 *  giá cứng từ PLANS, chưa nhận coupon.
 * ============================================================================
 */

/** Hằng số thương hiệu & CSKH chính thức duy nhất của SAT.Guru (độc lập 100%, không dùng STK tĩnh). */
export const OFFICIAL_BRAND_NAME = 'SAT.Guru — Thầy Nghĩa Guru';
export const OFFICIAL_SUPPORT_HOTLINE = '0986.722.324';
export const OFFICIAL_SUPPORT_TEL = '0986722324';
export const OFFICIAL_SITE_URL = 'https://satguru.edu.vn';

/** Gói trả phí (không gồm 'free'). */
export type PaidTier = 'premium' | 'ultimate';
export type SubscriptionTier = PaidTier | 'free' | 'pro';
export type BillingCycle = BillingPeriod;

/** 12-hour grace period so students are never cut off mid-exam (#032) */
export const SUBSCRIPTION_GRACE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 hours grace period so students are never cut off mid-exam

/** Thứ tự ưu tiên gói subscription: ultimate > premium > pro > free (#005) */
export const TIER_PRIORITY: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
  ultimate: 3,
};

/**
 * ============================================================================
 *  GÓI MÙA THI NƯỚC RÚT & SQUAD PASS (Sprint Exam Packs 2026)
 * ============================================================================
 */
export interface SprintExamPack {
  id: string;
  name: string;
  durationDays: number;
  priceVnd: number;
  originalPriceVnd?: number;
  badge?: string;
  description: string;
  features: string[];
}

export const SPRINT_EXAM_PACKS: SprintExamPack[] = [
  {
    id: 'sprint_24h',
    name: 'Vé Ngày 24h (Sprint Pass 24h)',
    durationDays: 1,
    priceVnd: 29_000,
    originalPriceVnd: 59_000,
    badge: '⚡ Cấp cứu 24h',
    description: 'Mở khóa toàn bộ đề thi & gia sư AI không giới hạn trong 24 giờ. Cực kỳ thích hợp để tổng ôn đêm trước ngày thi.',
    features: [
      'Luyện đề & giải thích AI 24h không giới hạn',
      'Đề thi thử QAS sát đề College Board',
      'Chấm điểm dự đoán & phân tích bẫy tức thì',
    ],
  },
  {
    id: 'sprint_45d',
    name: 'Chiến Binh Nước Rút 45 Ngày',
    durationDays: 45,
    priceVnd: 699_000,
    originalPriceVnd: 1_200_000,
    badge: '🔥 Bán chạy nhất mùa thi',
    description: 'Lộ trình bứt tốc 45 ngày trước kỳ thi SAT chính thức. Cam kết tăng 150-250+ điểm với AI kèm sát lỗ hổng kiến thức.',
    features: [
      'Full kho đề QAS và Cây Kỹ Năng Đọc - Viết - Toán',
      'Gia sư AI Mentor 1-1 phân tích sâu điểm yếu',
      'Báo cáo phụ huynh & phân tích xác suất vào trường top',
      'Tặng ngân hàng 5.000 câu hỏi độc quyền có video hướng dẫn',
    ],
  },
  {
    id: 'sprint_squad',
    name: 'Gói Đồng Đội (Squad Pass 3-5 bạn)',
    durationDays: 90,
    priceVnd: 1_399_000,
    originalPriceVnd: 1_999_000,
    badge: '👥 Giảm 30% nhóm trường chuyên',
    description: 'Dành riêng cho nhóm học sinh cùng lớp/trường chuyên (3-5 bạn). Cùng học, cùng so tài và tiết kiệm học phí tối đa.',
    features: [
      '3-5 tài khoản Premium độc lập (90 ngày)',
      'Bảng xếp hạng Squad thi đua nội bộ nhóm',
      'Tiết kiệm 30% so với đăng ký đơn lẻ',
      'Ưu tiên giải đáp thắc mắc từ đội ngũ học thuật',
    ],
  },
];

/**
 * Kết quả tính giảm giá từ Xu học tập (Coins-to-Cash)
 * Quy đổi: 100 Xu = 1.000đ (1 Xu = 10đ), tối đa giảm 15% giá gói.
 */
export interface CoinDiscountResult {
  coinsUsed: number;
  discountVnd: number;
  finalPriceVnd: number;
  maxDiscountVnd: number;
  maxCoinsRedeemable: number;
}

/**
 * Helper tính giảm giá bằng Xu học tập (thuần, không I/O).
 * 100 Xu = 1.000 VNĐ (tương đương 1 Xu = 10 VNĐ).
 * Giới hạn tối đa 15% trên giá gốc gói học.
 */
export function calculateCoinDiscount(coins: number, basePriceVnd: number): CoinDiscountResult {
  const safeCoins = Math.max(0, Math.floor(coins || 0));
  const safeBasePrice = Math.max(0, Math.round(basePriceVnd || 0));
  const maxDiscountVnd = Math.round(safeBasePrice * 0.15); // Tối đa 15%
  const maxCoinsRedeemable = Math.floor(maxDiscountVnd / 10);

  const discountFromCoins = safeCoins * 10;
  const discountVnd = Math.min(discountFromCoins, maxDiscountVnd);
  const coinsUsed = Math.floor(discountVnd / 10);
  const finalPriceVnd = Math.max(0, safeBasePrice - discountVnd);

  return {
    coinsUsed,
    discountVnd,
    finalPriceVnd,
    maxDiscountVnd,
    maxCoinsRedeemable,
  };
}

/**
 * HỆ SỐ NHÂN XU theo gói (phễu RPG 2026-07-06): người mua gói kiếm xu nhanh hơn
 * cho CÙNG một câu đúng → lên đồ/pet/tháp nhanh hơn (cảm giác "đáng tiền"), mà xu
 * vẫn kiếm từ HỌC THẬT. CHỈ nhân xu (coins) — KHÔNG nhân XP. Áp ĐỒNG BỘ ở mọi
 * faucet server (grade/exams-grade/vocab/quest/spin/pvp) qua economy.ts.
 * ⚠️ Xu đổi được quà thật (reward-to-real) → paid chạm ngưỡng đổi quà nhanh hơn
 * (chủ ý, phần "tự hoàn vốn"); admin vẫn fulfill thủ công nên không rủi ro faucet.
 */
export const TIER_COIN_MULTIPLIER: Record<AiTier, number> = {
  free: 1,
  premium: 1.5,
  ultimate: 2,
};

/**
 * Cap PvP/trận-đấu mỗi ngày theo gói (Wave 2 — 2026-07-21). Free ít hơn để giảm
 * farm xu lặp trên account miễn phí; premium/ultimate nhiều hơn (đã trả tiền).
 * Route /api/economy action 'pvp' kẹp thêm cap này TRƯỚC khi tiêu suất trận,
 * song song với PVP_MAX_FIGHTS_PER_DAY (cap tuyệt đối) — lấy MIN hai giá trị.
 * Thuần, không I/O; route tự tra tier rồi áp.
 */
export const TIER_PVP_CAP_PER_DAY: Record<AiTier, number> = {
  free: 3,
  premium: 10,
  ultimate: 20,
};

/**
 * Cap số tầng Tháp Vô Tận mỗi ngày theo gói (Wave 2). Free bị giới hạn để tạo
 * thói quen ngắn; paid leo thoải mái. Route /api/tower/question kẹp theo floor
 * đã leo trong ngày (chưa có cột DB → tạm chỉ ghi nhận ý định; khi có cột tower_*
 * sẽ enforce thật). Giá trị dùng cho UI hiển thị cap + route gate khi có DB.
 */
export const TIER_TOWER_CAP_PER_DAY: Record<AiTier, number> = {
  free: 5,
  premium: 20,
  ultimate: 50,
};

/** Chu kỳ thanh toán. */
export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export interface Plan {
  tier: PaidTier;
  period: BillingPeriod;
  /** Giá theo VND (placeholder — chốt trước khi nối cổng thanh toán). */
  priceVnd: number;
  /** Số ngày hiệu lực kể từ lúc kích hoạt. */
  durationDays: number;
}

/**
 * Bảng gói cố định ở SERVER. Giá do server quyết (client KHÔNG gửi số tiền),
 * cùng nguyên tắc server-authoritative của economy (§9.1). Yearly ≈ 8 tháng
 * (giảm ~4 tháng) để khuyến khích trả năm.
 */
export const PLANS: Plan[] = [
  { tier: 'premium', period: 'monthly', priceVnd: 499_000, durationDays: 30 },
  { tier: 'premium', period: 'quarterly', priceVnd: 1_350_000, durationDays: 90 },
  { tier: 'premium', period: 'semiannual', priceVnd: 2_400_000, durationDays: 180 },
  { tier: 'premium', period: 'yearly', priceVnd: 3_990_000, durationDays: 365 },
  { tier: 'ultimate', period: 'monthly', priceVnd: 990_000, durationDays: 30 },
  { tier: 'ultimate', period: 'quarterly', priceVnd: 2_670_000, durationDays: 90 },
  { tier: 'ultimate', period: 'semiannual', priceVnd: 4_740_000, durationDays: 180 },
  { tier: 'ultimate', period: 'yearly', priceVnd: 7_990_000, durationDays: 365 },
];

/** Tra 1 gói theo (tier, period). undefined nếu tổ hợp không hợp lệ. */
export function getPlan(tier: PaidTier, period: BillingPeriod): Plan | undefined {
  return PLANS.find((p) => p.tier === tier && p.period === period);
}

/** Tra gói hoặc Sprint Pack theo planId (dạng `premium_monthly`, `sprint_24h`, v.v.). */
export function getPlanById(planId: string): (Plan | SprintExamPack) | undefined {
  if (!planId) return undefined;
  const sprint = SPRINT_EXAM_PACKS.find((p) => p.id === planId);
  if (sprint) return sprint;
  const [tier, period] = planId.split('_') as [PaidTier, BillingPeriod];
  return getPlan(tier, period) ?? PLANS.find((p) => p.tier === (planId as PaidTier));
}

export interface SubscriptionRecord {
  tier: PaidTier | 'pro';
  period: BillingPeriod;
  /** ISO timestamp lúc kích hoạt. */
  startedAt: string;
  /** ISO timestamp hết hạn. */
  expiresAt: string;
}

/**
 * Ngày hết hạn = start + durationDays. start được TIÊM (ISO string) → thuần.
 * Dùng UTC để tránh lệch múi giờ giữa server/DB.
 */
export function computeExpiry(startISO: string, durationDays: number): string {
  const d = new Date(startISO);
  d.setUTCDate(d.getUTCDate() + durationDays);
  return d.toISOString();
}

/** Gói còn hiệu lực tại thời điểm `nowISO` không (mặc định kiểm tra chặt `expiresAt > nowISO`; truyền `gracePeriodMs` nếu cần grace period #032). */
export function isActive(sub: SubscriptionRecord | null, nowISO: string, gracePeriodMs = 0): boolean {
  if (!sub || !sub.expiresAt) return false;
  return new Date(sub.expiresAt).getTime() + gracePeriodMs > new Date(nowISO).getTime();
}

/**
 * Tier HIỆU LỰC của user tại `nowISO`: tier của gói nếu còn hạn (tính cả 12-hour grace period),
 * ngược lại 'free' (Fix #032). Đây là hàm quyết định quyền lợi (nối vào ai-quota qua store).
 */
export function getEffectiveTier(sub: SubscriptionRecord | null, nowISO: string = new Date().toISOString()): SubscriptionTier {
  if (!sub || !sub.expiresAt) return 'free';
  if (new Date(sub.expiresAt).getTime() + SUBSCRIPTION_GRACE_PERIOD_MS < new Date(nowISO).getTime()) {
    return 'free';
  }
  return sub.tier;
}

/**
 * Tier HIỆU LỰC của user tại `nowISO`: tier của gói nếu còn hạn, ngược lại
 * 'free'. Đây là hàm quyết định quyền lợi (nối vào ai-quota qua store).
 */
export function resolveTier(sub: SubscriptionRecord | null, nowISO: string): AiTier {
  if (!isActive(sub, nowISO) || !sub) return 'free';
  return (sub.tier as string) === 'pro' ? 'premium' : (sub.tier as AiTier);
}

/** Phần trăm giảm giá mặc định cho học sinh nhập mã giới thiệu KOL / Giáo viên. */
export const AFFILIATE_DISCOUNT_PERCENT = 10;

/** Danh sách mã giảm giá KOL / Giáo viên mặc định (in hoa). */
export const DEFAULT_AFFILIATE_COUPONS: readonly string[] = [
  'NGHIAGURU10',
  'SAT2026',
  'VIP10',
  'CHIENBINH10',
];

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountPercent: number;
}

/**
 * Kiểm tra mã giảm giá (thuần, không I/O). Có thể truyền thêm danh sách mã mở rộng
 * từ biến môi trường `AFFILIATE_COUPONS` (phân cách bằng dấu phẩy).
 */
export function validateCoupon(
  rawCode?: string | null,
  extraCodes?: readonly string[]
): CouponValidationResult {
  const normalized = (rawCode ?? '').trim().toUpperCase();
  if (!normalized) {
    return { valid: false, code: '', discountPercent: 0 };
  }
  const allowed = new Set<string>(DEFAULT_AFFILIATE_COUPONS);
  if (extraCodes) {
    for (const c of extraCodes) {
      const clean = c.trim().toUpperCase();
      if (clean) allowed.add(clean);
    }
  }
  if (allowed.has(normalized)) {
    return {
      valid: true,
      code: normalized,
      discountPercent: AFFILIATE_DISCOUNT_PERCENT,
    };
  }
  return { valid: false, code: normalized, discountPercent: 0 };
}

/**
 * Tính giá VND sau khi áp dụng mã giảm giá hợp lệ (làm tròn đến đồng).
 * Nếu mã không hợp lệ hoặc để trống → giữ nguyên `priceVnd`.
 */
export function applyCouponPrice(
  priceVnd: number,
  rawCode?: string | null,
  extraCodes?: readonly string[]
): number {
  const check = validateCoupon(rawCode, extraCodes);
  if (!check.valid || check.discountPercent <= 0) return priceVnd;
  return Math.round((priceVnd * (100 - check.discountPercent)) / 100);
}

/**
 * ============================================================================
 *  B2B CENTER / SCHOOL LICENSE & SCORE GUARANTEE POLICY (Mục #25)
 * ============================================================================
 */
export interface CenterBulkPlan {
  id: 'center_10' | 'center_30' | 'center_50';
  name: string;
  seats: number;
  durationDays: number;
  discountPercent: number;
  pricePerSeatVnd: number;
  totalPriceVnd: number;
  badge?: string;
  highlights: string[];
}

export const CENTER_BULK_PLANS: readonly CenterBulkPlan[] = [
  {
    id: 'center_10',
    name: 'Gói Lớp Nhỏ — 10 Học sinh',
    seats: 10,
    durationDays: 90,
    discountPercent: 30,
    pricePerSeatVnd: 245_000,
    totalPriceVnd: 2_450_000,
    badge: 'Giảm 30% cho Giáo viên',
    highlights: [
      '10 tài khoản Premium + 1 Cổng Quản trị Giáo viên Supabase Realtime',
      'Heatmap lỗ hổng kỹ năng cả lớp & giao bài biến thể AI 1-chạm',
      'Xuất báo cáo tuần cá nhân hóa gửi Phụ huynh qua Zalo',
    ],
  },
  {
    id: 'center_30',
    name: 'Gói Trung Tâm — 30 Học sinh',
    seats: 30,
    durationDays: 180,
    discountPercent: 38,
    pricePerSeatVnd: 390_000,
    totalPriceVnd: 11_700_000,
    badge: 'Phổ biến nhất B2B',
    highlights: [
      '30 tài khoản Ultimate (6 tháng) + 3 tài khoản Giáo viên/Trợ giảng',
      'Chấm điểm chuẩn IRT 2PL & ngân hàng đề QAS mở khóa 100%',
      'Hỗ trợ thiết lập lộ trình nước rút riêng cho từng khóa thi SAT',
    ],
  },
  {
    id: 'center_50',
    name: 'Gói Trường Chuyên / Học Viện — 50+ Ghế',
    seats: 50,
    durationDays: 365,
    discountPercent: 45,
    pricePerSeatVnd: 620_000,
    totalPriceVnd: 31_000_000,
    badge: 'Tiết kiệm tối đa 45%',
    highlights: [
      '50 tài khoản Ultimate trọn năm + không giới hạn lớp học',
      'Báo cáo tiến độ tự động hàng tuần qua ZNS/Webhook cho Phụ huynh',
      'Hỗ trợ kỹ thuật ưu tiên từ đội ngũ học thuật SAT.Guru',
    ],
  },
];

export const SCORE_GUARANTEE_POLICY = {
  minGainPoints: 100,
  requiredCompletionPct: 90,
  eligibleTiers: ['ultimate'] as readonly SubscriptionTier[],
  headlineVi: 'Cam kết tăng tối thiểu +100 điểm SAT hoặc hoàn 100% học phí',
  conditionVi:
    'Áp dụng cho học viên gói Ultimate hoàn thành >= 90% lộ trình Sprint & tối thiểu 6 đề thi thử Full-length Bluebook trên SAT.Guru.',
} as const;

/**
 * ============================================================================
 *  GÓI MUA CHUNG "BẠN CÙNG TIẾN" (Study Squad 2–3 người — Mục #23)
 * ============================================================================
 *  1 đơn PayOS duy nhất tự động sinh 2–3 mã kích hoạt Premium 90 ngày (mỗi người
 *  dùng 1 tài khoản độc lập). Giảm 25% cho nhóm 2 và 35% cho nhóm 3 so với giá lẻ
 *  Premium Quarterly (1.350.000₫/người).
 */
export interface StudySquadPack {
  id: 'squad_2' | 'squad_3';
  name: string;
  seats: number;
  tier: PaidTier;
  period: BillingPeriod;
  durationDays: number;
  discountPercent: number;
  pricePerSeatVnd: number;
  priceVnd: number;
  originalPriceVnd: number;
  badge: string;
  description: string;
  features: string[];
}

export const STUDY_SQUAD_PACKS: readonly StudySquadPack[] = [
  {
    id: 'squad_2',
    name: 'Bạn Cùng Tiến — Nhóm 2 Người (90 Ngày)',
    seats: 2,
    tier: 'premium',
    period: 'quarterly',
    durationDays: 90,
    discountPercent: 25,
    pricePerSeatVnd: 1_012_500,
    priceVnd: 2_025_000,
    originalPriceVnd: 2_700_000,
    badge: '👯 Tiết kiệm 25% / bạn',
    description: 'Rủ 1 bạn cùng lớp/trường chuyên đăng ký chung — 1 giao dịch PayOS nhận ngay 2 mã kích hoạt Premium 90 ngày độc lập.',
    features: [
      '2 tài khoản Premium độc lập 90 ngày (1.012.500₫/bạn)',
      'Sinh 2 mã kích hoạt ngay sau khi PayOS xác nhận',
      'Full Cây Kỹ Năng + Gia sư AI Socratic + Cổng Phụ Huynh riêng cho từng bạn',
    ],
  },
  {
    id: 'squad_3',
    name: 'Tam Mã Trường Chuyên — Nhóm 3 Người (90 Ngày)',
    seats: 3,
    tier: 'premium',
    period: 'quarterly',
    durationDays: 90,
    discountPercent: 35,
    pricePerSeatVnd: 877_500,
    priceVnd: 2_632_500,
    originalPriceVnd: 4_050_000,
    badge: '🔥 Tiết kiệm 35% • Rẻ nhất nhóm',
    description: 'Bộ 3 đồng đội cùng cày SAT 1450+ — 1 giao dịch PayOS duy nhất tự động sinh 3 mã kích hoạt Premium 90 ngày.',
    features: [
      '3 tài khoản Premium độc lập 90 ngày (chỉ 877.500₫/bạn)',
      'Tự động cấp 3 mã kích hoạt dùng ngay trên /upgrade',
      'Thi đua BXH Liên Trường + Báo cáo Phụ Huynh từng học sinh',
    ],
  },
];

export interface CheckoutPlanSpec {
  planId: string;
  tier: PaidTier;
  period: BillingPeriod;
  priceVnd: number;
  durationDays: number;
  label: string;
  seats: number;
  kind: 'standard' | 'sprint' | 'squad';
}

/**
 * Tra cứu hợp nhất 100% mọi gói hợp lệ cho /api/payment/create (Server-Authoritative):
 * - Standard PLANS (`premium`/`ultimate` × `monthly`/`quarterly`/`semiannual`/`yearly`)
 * - Sprint Packs (`sprint_24h`, `sprint_45d`, `sprint_squad`)
 * - Study Squad Packs (`squad_2`, `squad_3`)
 */
export function resolveCheckoutPlan(args: {
  planId?: string | null;
  tier?: string | null;
  period?: string | null;
}): CheckoutPlanSpec | undefined {
  const cleanPlanId = typeof args.planId === 'string' ? args.planId.trim().toLowerCase() : '';
  if (cleanPlanId) {
    const sprint = SPRINT_EXAM_PACKS.find((p) => p.id === cleanPlanId);
    if (sprint) {
      const period: BillingPeriod =
        sprint.durationDays >= 90 ? 'quarterly' : 'monthly';
      return {
        planId: sprint.id,
        tier: 'premium',
        period,
        priceVnd: sprint.priceVnd,
        durationDays: sprint.durationDays,
        label: sprint.name,
        seats: sprint.id === 'sprint_squad' ? 3 : 1,
        kind: 'sprint',
      };
    }

    const squad = STUDY_SQUAD_PACKS.find((p) => p.id === cleanPlanId);
    if (squad) {
      return {
        planId: squad.id,
        tier: squad.tier,
        period: squad.period,
        priceVnd: squad.priceVnd,
        durationDays: squad.durationDays,
        label: squad.name,
        seats: squad.seats,
        kind: 'squad',
      };
    }

    const parts = cleanPlanId.split('_');
    if (parts.length === 2) {
      const std = getPlan(parts[0] as PaidTier, parts[1] as BillingPeriod);
      if (std) {
        return {
          planId: `${std.tier}_${std.period}`,
          tier: std.tier,
          period: std.period,
          priceVnd: std.priceVnd,
          durationDays: std.durationDays,
          label: `${std.tier === 'ultimate' ? 'Ultimate' : 'Premium'} (${std.period})`,
          seats: 1,
          kind: 'standard',
        };
      }
    }
    return undefined;
  }

  if (args.tier && args.period) {
    const std = getPlan(args.tier as PaidTier, args.period as BillingPeriod);
    if (std) {
      return {
        planId: `${std.tier}_${std.period}`,
        tier: std.tier,
        period: std.period,
        priceVnd: std.priceVnd,
        durationDays: std.durationDays,
        label: `${std.tier === 'ultimate' ? 'Ultimate' : 'Premium'} (${std.period})`,
        seats: 1,
        kind: 'standard',
      };
    }
  }
  return undefined;
}

/**
 * ============================================================================
 *  BẢO LƯU GÓI HỌC MÙA THI HỌC KỲ (Subscription Freeze — Mục #25, chuẩn #G8)
 * ============================================================================
 *  Thuần khiết (0 I/O), tiêm `nowISO` để unit-test xác định.
 *  Cho phép bảo lưu 1 lần (7–14 ngày) khi học sinh bận thi giữa kỳ/cuối kỳ THPT;
 *  hạn sử dụng mới được cộng dồn chính xác số ngày bảo lưu.
 */
export const SUBSCRIPTION_FREEZE_MIN_DAYS = 7;
export const SUBSCRIPTION_FREEZE_MAX_DAYS = 14;

export interface SubscriptionFreezeState {
  freezeUsed?: boolean;
  frozenFrom?: string | null;
  frozenUntil?: string | null;
  frozenDays?: number;
}

export interface FreezableSubscription extends SubscriptionRecord, SubscriptionFreezeState {}

export function isSubscriptionFrozen(
  sub: FreezableSubscription | null,
  nowISO: string
): boolean {
  if (!sub?.frozenFrom || !sub?.frozenUntil) return false;
  const nowMs = Date.parse(nowISO);
  const fromMs = Date.parse(sub.frozenFrom);
  const untilMs = Date.parse(sub.frozenUntil);
  if (Number.isNaN(nowMs) || Number.isNaN(fromMs) || Number.isNaN(untilMs)) return false;
  return nowMs >= fromMs && nowMs < untilMs;
}

export function canFreezeSubscription(
  sub: FreezableSubscription | null,
  days: number,
  nowISO: string
): { allowed: boolean; reason?: string } {
  if (!sub || !isActive(sub, nowISO, 0)) {
    return { allowed: false, reason: 'Gói học hiện không còn hiệu lực để bảo lưu.' };
  }
  if (sub.freezeUsed) {
    return { allowed: false, reason: 'Bạn đã sử dụng quyền bảo lưu 1 lần cho chu kỳ gói hiện tại.' };
  }
  if (isSubscriptionFrozen(sub, nowISO)) {
    return { allowed: false, reason: 'Gói học hiện đang trong trạng thái bảo lưu.' };
  }
  const intDays = Math.floor(days);
  if (!Number.isFinite(intDays) || intDays < SUBSCRIPTION_FREEZE_MIN_DAYS || intDays > SUBSCRIPTION_FREEZE_MAX_DAYS) {
    return {
      allowed: false,
      reason: `Thời gian bảo lưu hợp lệ từ ${SUBSCRIPTION_FREEZE_MIN_DAYS} đến ${SUBSCRIPTION_FREEZE_MAX_DAYS} ngày.`,
    };
  }
  return { allowed: true };
}

export function applySubscriptionFreeze(
  sub: FreezableSubscription,
  days: number,
  nowISO: string
): { ok: true; updated: FreezableSubscription } | { ok: false; reason: string } {
  const check = canFreezeSubscription(sub, days, nowISO);
  if (!check.allowed) {
    return { ok: false, reason: check.reason ?? 'Không đủ điều kiện bảo lưu.' };
  }
  const intDays = Math.floor(days);
  const frozenUntil = computeExpiry(nowISO, intDays);
  const newExpiresAt = computeExpiry(sub.expiresAt, intDays);
  return {
    ok: true,
    updated: {
      ...sub,
      expiresAt: newExpiresAt,
      freezeUsed: true,
      frozenFrom: nowISO,
      frozenUntil,
      frozenDays: intDays,
    },
  };
}

/**
 * Chính sách Bảo Lãnh Tiến Bộ Điểm Số Minh Bạch (Score Assurance — Mục #28).
 */
export const SCORE_ASSURANCE_POLICY = {
  minSkillTreeCompletionPct: 80,
  minStreakDays: 45,
  minFullMocksCompleted: 4,
  minGainPoints: 100,
  remedyVi: 'Gia hạn miễn phí 60 ngày gói tương đương hoặc hoàn 100% học phí theo yêu cầu phụ huynh.',
  summaryVi:
    'Hoàn thành >= 80% Cây Kỹ Năng + duy trì streak >= 45 ngày + làm đủ >= 4 đề thi thử Full-length Bluebook mà điểm thi thật tăng dưới +100 điểm so với Diagnostic đầu vào.',
} as const;
