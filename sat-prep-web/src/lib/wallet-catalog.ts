/**
 * ============================================================================
 *  UNIFIED WALLET CATALOG — HỆ SINH THÁI AIONTHI.COM (4 APP + COMBO)
 * ============================================================================
 *  Nguồn sự thật DUY NHẤT về danh mục gói học & giá VNĐ cho Ví Tài Khoản Chung.
 *  Client CHỈ gửi `itemId` — Server tra giá ở đây trước khi trừ Ví nguyên tử.
 * ============================================================================
 */

export type EcosystemAppCode = 'sat' | 'ielts' | 'thcs' | 'thpt';

export interface EcosystemAppMeta {
  code: EcosystemAppCode;
  name: string;
  shortName: string;
  icon: string;
  subdomain: string;
  url: string;
  tagline: string;
  accent: string;
}

export const ECOSYSTEM_APPS: Record<EcosystemAppCode, EcosystemAppMeta> = {
  sat: {
    code: 'sat',
    name: 'Digital SAT AI',
    shortName: 'SAT',
    icon: '🎓',
    subdomain: 'sat.aionthi.com',
    url: 'https://sat.aionthi.com',
    tagline: 'Luyện thi Digital SAT 1450–1550+ chuẩn Bluebook + Gia sư AI Socratic',
    accent: 'from-amber-400 to-orange-500',
  },
  ielts: {
    code: 'ielts',
    name: 'IELTS AI Mastery',
    shortName: 'IELTS',
    icon: '🇬🇧',
    subdomain: 'ielts.aionthi.com',
    url: 'https://ielts.aionthi.com',
    tagline: 'Chấm Writing & Speaking AI chuẩn Band 7.0–8.5+, luyện Reading/Listening',
    accent: 'from-sky-400 to-blue-600',
  },
  thcs: {
    code: 'thcs',
    name: 'Ôn Thi Cấp II (THCS)',
    shortName: 'Cấp II',
    icon: '📘',
    subdomain: 'thcs.aionthi.com',
    url: 'https://thcs.aionthi.com',
    tagline: 'Toán – Văn – Anh lớp 6–9 & Chinh phục kỳ thi tuyển sinh vào lớp 10 Chuyên',
    accent: 'from-emerald-400 to-teal-600',
  },
  thpt: {
    code: 'thpt',
    name: 'Ôn Thi Cấp III (THPT)',
    shortName: 'Cấp III',
    icon: '📕',
    subdomain: 'thpt.aionthi.com',
    url: 'https://thpt.aionthi.com',
    tagline: 'Luyện thi Tốt nghiệp THPT Quốc gia & Đánh giá Năng lực (HSA / V-ACT)',
    accent: 'from-purple-400 to-indigo-600',
  },
};

export interface WalletCatalogItem {
  id: string;
  category: EcosystemAppCode | 'combo';
  appCodes: EcosystemAppCode[];
  tier: 'pro' | 'premium' | 'ultimate';
  period: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
  durationDays: number;
  name: string;
  durationLabel: string;
  priceVnd: number;
  originalPriceVnd?: number;
  badge?: string;
  features: string[];
}

export const MIN_TOPUP_VND = 10_000;
export const MAX_TOPUP_VND = 50_000_000;
export const TOPUP_PRESETS_VND = [100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000] as const;

export const WALLET_CATALOG: WalletCatalogItem[] = [
  // --- DIGITAL SAT (Khớp 100% bảng giá PLANS trong subscription.ts) ---
  {
    id: 'sat_premium_monthly',
    category: 'sat',
    appCodes: ['sat'],
    tier: 'premium',
    period: 'monthly',
    durationDays: 30,
    name: 'SAT Premium — 1 Tháng',
    durationLabel: '30 ngày',
    priceVnd: 499_000,
    features: ['Full đề thi thử Bluebook không giới hạn', 'Gia sư AI không giới hạn lượt hỏi', 'Báo cáo phụ huynh 30 ngày'],
  },
  {
    id: 'sat_premium_quarterly',
    category: 'sat',
    appCodes: ['sat'],
    tier: 'premium',
    period: 'quarterly',
    durationDays: 90,
    name: 'SAT Premium — 3 Tháng',
    durationLabel: '90 ngày',
    priceVnd: 1_350_000,
    originalPriceVnd: 1_497_000,
    badge: 'Tiết kiệm 10%',
    features: ['Full đề thi thử Bluebook không giới hạn', 'Luyện thích ứng theo điểm yếu', 'Mở toàn bộ Cây Năng Lực & Cổng Khảo Thí'],
  },
  {
    id: 'sat_premium_yearly',
    category: 'sat',
    appCodes: ['sat'],
    tier: 'premium',
    period: 'yearly',
    durationDays: 365,
    name: 'SAT Premium — 1 Năm',
    durationLabel: '365 ngày',
    priceVnd: 3_990_000,
    originalPriceVnd: 5_988_000,
    badge: 'Phổ biến nhất',
    features: ['Chỉ ~332k/tháng — tiết kiệm 33%', 'Full kho đề thích ứng + Gia sư AI 24/7', 'Đồng bộ bảng điểm phụ huynh trọn năm'],
  },
  {
    id: 'sat_ultimate_monthly',
    category: 'sat',
    appCodes: ['sat'],
    tier: 'ultimate',
    period: 'monthly',
    durationDays: 30,
    name: 'SAT Ultimate 1500+ — 1 Tháng',
    durationLabel: '30 ngày',
    priceVnd: 990_000,
    features: ['Mở kho đề thi thật QAS full-length', 'AI model cao cấp phân tích bẫy chuyên sâu', 'Hệ số Xu RPG ×2 + Báo cáo PH 90 ngày'],
  },
  {
    id: 'sat_ultimate_yearly',
    category: 'sat',
    appCodes: ['sat'],
    tier: 'ultimate',
    period: 'yearly',
    durationDays: 365,
    name: 'SAT Ultimate 1500+ — 1 Năm',
    durationLabel: '365 ngày',
    priceVnd: 7_990_000,
    originalPriceVnd: 11_880_000,
    badge: 'Mục tiêu 1500+',
    features: ['Full đề QAS + Gia sư AI chuyên sâu', 'Báo cáo tuần tự động gửi Phụ huynh', 'Tiết kiệm 33% so với đóng theo tháng'],
  },

  // --- IELTS (ielts.aionthi.com) ---
  {
    id: 'ielts_pro_monthly',
    category: 'ielts',
    appCodes: ['ielts'],
    tier: 'pro',
    period: 'monthly',
    durationDays: 30,
    name: 'IELTS AI Pro — 1 Tháng',
    durationLabel: '30 ngày',
    priceVnd: 399_000,
    features: ['Chấm bài Writing Task 1 & 2 theo 4 tiêu chí', 'Phòng luyện Speaking AI phản hồi phát âm', 'Full bộ đề Cambridge & Reading/Listening'],
  },
  {
    id: 'ielts_pro_quarterly',
    category: 'ielts',
    appCodes: ['ielts'],
    tier: 'pro',
    period: 'quarterly',
    durationDays: 90,
    name: 'IELTS AI Pro — 3 Tháng',
    durationLabel: '90 ngày',
    priceVnd: 1_090_000,
    originalPriceVnd: 1_197_000,
    badge: 'Bứt tốc Band +1.0',
    features: ['Lộ trình tăng 1.0 Band trong 90 ngày', 'Không giới hạn chấm chữa Writing/Speaking AI', 'Từ vựng học thuật SRS theo chủ đề'],
  },
  {
    id: 'ielts_pro_yearly',
    category: 'ielts',
    appCodes: ['ielts'],
    tier: 'pro',
    period: 'yearly',
    durationDays: 365,
    name: 'IELTS AI Pro — 1 Năm',
    durationLabel: '365 ngày',
    priceVnd: 2_990_000,
    originalPriceVnd: 4_788_000,
    badge: 'Tiết kiệm 37%',
    features: ['Trọn bộ 4 kỹ năng Listening/Reading/Writing/Speaking', 'Cập nhật liên tục Forecast theo quý', 'Báo cáo tiến độ cho phụ huynh'],
  },

  // --- CẤP II / THCS (thcs.aionthi.com) ---
  {
    id: 'thcs_pro_monthly',
    category: 'thcs',
    appCodes: ['thcs'],
    tier: 'pro',
    period: 'monthly',
    durationDays: 30,
    name: 'Ôn Thi Cấp II & Vào 10 — 1 Tháng',
    durationLabel: '30 ngày',
    priceVnd: 199_000,
    features: ['Toán – Văn – Anh bám sát chương trình mới lớp 6–9', 'Kho đề thi vào lớp 10 các tỉnh & trường Chuyên', 'Gia sư AI hướng dẫn giải từng bước dễ hiểu'],
  },
  {
    id: 'thcs_pro_semiannual',
    category: 'thcs',
    appCodes: ['thcs'],
    tier: 'pro',
    period: 'semiannual',
    durationDays: 180,
    name: 'Ôn Thi Cấp II & Vào 10 — 6 Tháng',
    durationLabel: '180 ngày',
    priceVnd: 990_000,
    originalPriceVnd: 1_194_000,
    badge: 'Trọn 1 Học Kỳ',
    features: ['Tổng ôn & luyện đề thi thử vào 10', 'Sổ tay lỗi sai thông minh theo chương', 'Báo cáo tình hình học gửi Bố/Mẹ'],
  },
  {
    id: 'thcs_pro_yearly',
    category: 'thcs',
    appCodes: ['thcs'],
    tier: 'pro',
    period: 'yearly',
    durationDays: 365,
    name: 'Ôn Thi Cấp II & Vào 10 — 1 Năm',
    durationLabel: '365 ngày',
    priceVnd: 1_690_000,
    originalPriceVnd: 2_388_000,
    badge: 'Tiết kiệm 29%',
    features: ['Trọn năm học lớp 6–9 + ôn thi vào 10', 'Chữa bài tự luận & trắc nghiệm AI 24/7', 'Chỉ ~140k/tháng cho cả 3 môn chính'],
  },

  // --- CẤP III / THPT (thpt.aionthi.com) ---
  {
    id: 'thpt_pro_monthly',
    category: 'thpt',
    appCodes: ['thpt'],
    tier: 'pro',
    period: 'monthly',
    durationDays: 30,
    name: 'Luyện Thi Cấp III & ĐGNL — 1 Tháng',
    durationLabel: '30 ngày',
    priceVnd: 249_000,
    features: ['Đề thi cấu trúc Tốt nghiệp THPT mới (đúng/sai, trả lời ngắn)', 'Ngân hàng đề Đánh giá năng lực HSA / V-ACT', 'Gia sư AI giải chi tiết công thức & mẹo bấm máy'],
  },
  {
    id: 'thpt_pro_semiannual',
    category: 'thpt',
    appCodes: ['thpt'],
    tier: 'pro',
    period: 'semiannual',
    durationDays: 180,
    name: 'Luyện Thi Cấp III & ĐGNL — 6 Tháng',
    durationLabel: '180 ngày',
    priceVnd: 1_290_000,
    originalPriceVnd: 1_494_000,
    badge: 'Giai đoạn về đích',
    features: ['Luyện đề thực chiến Tốt nghiệp THPT & ĐGNL', 'Phân tích lỗ hổng kiến thức theo chuyên đề', 'Dự đoán tổ hợp điểm xét tuyển ĐH'],
  },
  {
    id: 'thpt_pro_yearly',
    category: 'thpt',
    appCodes: ['thpt'],
    tier: 'pro',
    period: 'yearly',
    durationDays: 365,
    name: 'Luyện Thi Cấp III & ĐGNL — 1 Năm',
    durationLabel: '365 ngày',
    priceVnd: 2_190_000,
    originalPriceVnd: 2_988_000,
    badge: 'Tiết kiệm 27%',
    features: ['Trọn năm học lớp 10–12 + ĐGNL ĐHQG', 'Không giới hạn đề thi thử & Gia sư AI', 'Chỉ ~182k/tháng'],
  },

  // --- COMBO ALL-IN-ONE 4 APP ---
  {
    id: 'combo_all_quarterly',
    category: 'combo',
    appCodes: ['sat', 'ielts', 'thcs', 'thpt'],
    tier: 'premium',
    period: 'quarterly',
    durationDays: 90,
    name: 'Combo 4 App (SAT + IELTS + Cấp II + Cấp III) — 3 Tháng',
    durationLabel: '90 ngày',
    priceVnd: 1_990_000,
    originalPriceVnd: 3_490_000,
    badge: 'Siêu Tiết Kiệm 43%',
    features: ['Mở khóa cùng lúc 4 nền tảng trên 1 tài khoản aionthi.com', 'Bao gồm SAT Premium + IELTS Pro + THCS + THPT', 'Phù hợp học sinh ôn song song THPT + IELTS/SAT'],
  },
  {
    id: 'combo_all_yearly',
    category: 'combo',
    appCodes: ['sat', 'ielts', 'thcs', 'thpt'],
    tier: 'ultimate',
    period: 'yearly',
    durationDays: 365,
    name: 'Combo VIP Toàn Hệ Sinh Thái 4 App — 1 Năm',
    durationLabel: '365 ngày',
    priceVnd: 5_990_000,
    originalPriceVnd: 11_860_000,
    badge: 'Best Value — Giảm 50%',
    features: ['Mở khóa trọn gói SAT Ultimate + IELTS Pro + Cấp II + Cấp III', '1 tài khoản duy nhất dùng chung 4 tên miền *.aionthi.com', 'Tiết kiệm gần 6 triệu/năm cho cả lộ trình cấp 2 → Đại học'],
  },
];

export function getWalletCatalogItem(itemId: unknown): WalletCatalogItem | null {
  if (typeof itemId !== 'string' || !itemId.trim()) return null;
  return WALLET_CATALOG.find((item) => item.id === itemId.trim()) ?? null;
}

export function validateTopupAmount(raw: unknown): { ok: true; amountVnd: number } | { ok: false; error: string } {
  const num = Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return { ok: false, error: 'Số tiền nạp phải là số nguyên VNĐ hợp lệ.' };
  }
  if (num < MIN_TOPUP_VND) {
    return { ok: false, error: `Số tiền nạp tối thiểu là ${MIN_TOPUP_VND.toLocaleString('vi-VN')}₫.` };
  }
  if (num > MAX_TOPUP_VND) {
    return { ok: false, error: `Số tiền nạp tối đa mỗi lần là ${MAX_TOPUP_VND.toLocaleString('vi-VN')}₫.` };
  }
  if (num % 1000 !== 0) {
    return { ok: false, error: 'Số tiền nạp phải là bội số của 1.000₫.' };
  }
  return { ok: true, amountVnd: num };
}
