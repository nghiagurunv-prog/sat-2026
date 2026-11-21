import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

export interface ScholarshipMatchInput {
  sat: number;
  gpa?: number;
}

export interface UsScholarshipTier {
  id: string;
  minScore: number;
  maxScore: number;
  percentile: string;
  tierName: string;
  schools: string;
  scholarshipPerYearUsd: string;
  scholarshipPerYearVnd: string;
  fourYearTotalUsd: string;
  fourYearTotalVnd: string;
  policy: string;
  competitiveness: string;
  matched: boolean;
}

export interface VnScholarshipTier {
  id: string;
  university: string;
  program: string;
  minSat: number;
  minGpa?: number;
  scholarshipPercentage: string;
  awardPerYearVnd: string;
  awardPerYearUsd: string;
  fourYearTotalVnd: string;
  fourYearTotalUsd: string;
  criteria: string;
  matched: boolean;
}

/** Tỷ giá quy đổi tham chiếu (hỗ trợ override qua biến môi trường USD_TO_VND_RATE) */
const ENV_RATE = Number(process.env.USD_TO_VND_RATE);
const USD_TO_VND_RATE = Number.isFinite(ENV_RATE) && ENV_RATE > 10_000 ? ENV_RATE : 25_400;

const US_TIERS_DATA = [
  {
    id: 'us_ivy_top20',
    minScore: 1520,
    maxScore: 1600,
    percentile: 'Top 1% (99th Percentile)',
    tierName: 'Nhóm Tinh Hoa Ivy League & Top 20 Quốc Gia Hoa Kỳ',
    schools: 'Harvard, Stanford, MIT, Yale, Columbia, UPenn, Princeton, Duke, Northwestern',
    scholarshipPerYearUsd: '$55,000 – $88,000',
    scholarshipPerYearVnd: '1.40 – 2.24 tỷ VNĐ',
    fourYearTotalUsd: '$220,000 – $352,000',
    fourYearTotalVnd: '5.59 – 8.94 tỷ VNĐ',
    policy: 'Học bổng Toàn phần (Full-ride) & Need-based Hỗ trợ 100% tài chính',
    competitiveness: 'Xuất sắc tuyệt đối',
  },
  {
    id: 'us_top25_50',
    minScore: 1440,
    maxScore: 1519,
    percentile: 'Top 3% – 5% (95th – 97th Percentile)',
    tierName: 'Nhóm Đại Học Nghiên Cứu Top 25 – 50 US News',
    schools: 'NYU, Georgia Tech, UNC Chapel Hill, Boston University, Tufts, Rochester, Case Western',
    scholarshipPerYearUsd: '$35,000 – $60,000',
    scholarshipPerYearVnd: '889 triệu – 1.52 tỷ VNĐ',
    fourYearTotalUsd: '$140,000 – $240,000',
    fourYearTotalVnd: '3.56 – 6.10 tỷ VNĐ',
    policy: 'Học bổng Danh dự (Presidential & Merit Scholarships) 50% – 85% học phí',
    competitiveness: 'Rất cao',
  },
  {
    id: 'us_top50_90',
    minScore: 1350,
    maxScore: 1439,
    percentile: 'Top 10% – 12% (88th – 92nd Percentile)',
    tierName: 'Nhóm Bang Trọng Điểm & Top 50 – 90 US News',
    schools: 'Purdue, Penn State, Ohio State, Fordham, Syracuse, Drexel, UConn',
    scholarshipPerYearUsd: '$20,000 – $40,000',
    scholarshipPerYearVnd: '508 triệu – 1.02 tỷ VNĐ',
    fourYearTotalUsd: '$80,000 – $160,000',
    fourYearTotalVnd: '2.03 – 4.06 tỷ VNĐ',
    policy: 'Học bổng Khuyến học & Giảm trừ học phí sinh viên quốc tế (Out-of-state Waiver)',
    competitiveness: 'Thuận lợi',
  },
  {
    id: 'us_top100_150',
    minScore: 1250,
    maxScore: 1349,
    percentile: 'Top 20% – 25% (75th – 80th Percentile)',
    tierName: 'Nhóm Đại Học Đa Ngành & Khai Phóng (Top 100 – 150)',
    schools: 'Arizona State, Michigan State, Iowa State, UT Dallas, USF, Cincinnati',
    scholarshipPerYearUsd: '$12,000 – $25,000',
    scholarshipPerYearVnd: '305 – 635 triệu VNĐ',
    fourYearTotalUsd: '$48,000 – $100,000',
    fourYearTotalVnd: '1.22 – 2.54 tỷ VNĐ',
    policy: 'Học bổng Nhập học Tự động (Automatic Merit Award) dựa trên SAT + GPA',
    competitiveness: 'Cơ hội tốt',
  },
  {
    id: 'us_foundation',
    minScore: 400,
    maxScore: 1249,
    percentile: 'Dưới Top 30% (Foundation Level)',
    tierName: 'Giai Đoạn Nền Tảng & Chuẩn Bị Tăng Tốc',
    schools: 'Các trường Cao đẳng Cộng đồng (2+2 Transfer) hoặc Đại học Vùng Hoa Kỳ',
    scholarshipPerYearUsd: '$5,000 – $12,000',
    scholarshipPerYearVnd: '127 – 305 triệu VNĐ',
    fourYearTotalUsd: '$20,000 – $48,000',
    fourYearTotalVnd: '508 triệu – 1.22 tỷ VNĐ',
    policy: 'Cần củng cố kiến thức trọng điểm để bứt phá lên 1350+ mở rộng học bổng lớn',
    competitiveness: 'Cần nâng điểm',
  },
];

const VN_SCHOLARSHIPS_DATA = [
  {
    id: 'vn_vinuni_full',
    university: 'VinUniversity (VinUni)',
    program: 'Toàn bộ các ngành đào tạo đại học',
    minSat: 1520,
    minGpa: 9.0,
    scholarshipPercentage: '90% – 100% Học phí + Sinh hoạt phí',
    awardPerYearVnd: '815 triệu – 905 triệu VNĐ',
    awardPerYearUsd: '$32,000 – $35,600',
    fourYearTotalVnd: '3.26 – 3.62 tỷ VNĐ',
    fourYearTotalUsd: '$128,000 – $142,500',
    criteria: 'SAT ≥ 1520 & GPA ≥ 9.0 + Phỏng vấn tài năng xuất chúng với Hội đồng Học thuật',
  },
  {
    id: 'vn_vinuni_merit',
    university: 'VinUniversity (VinUni)',
    program: 'Khoa học Máy tính, Y khoa, QTKD',
    minSat: 1450,
    minGpa: 8.8,
    scholarshipPercentage: '50% – 80% Học phí',
    awardPerYearVnd: '407 triệu – 650 triệu VNĐ',
    awardPerYearUsd: '$16,000 – $25,600',
    fourYearTotalVnd: '1.63 – 2.60 tỷ VNĐ',
    fourYearTotalUsd: '$64,000 – $102,400',
    criteria: 'SAT ≥ 1450 & GPA ≥ 8.8 + Bài luận cá nhân xuất sắc',
  },
  {
    id: 'vn_fulbright_full',
    university: 'Fulbright University Vietnam (FUV)',
    program: 'Chương trình Cử nhân Khai phóng (Liberal Arts)',
    minSat: 1500,
    minGpa: 9.0,
    scholarshipPercentage: '100% Học phí + Hỗ trợ chỗ ở',
    awardPerYearVnd: '540 triệu – 600 triệu VNĐ',
    awardPerYearUsd: '$21,200 – $23,600',
    fourYearTotalVnd: '2.16 – 2.40 tỷ VNĐ',
    fourYearTotalUsd: '$85,000 – $94,500',
    criteria: 'SAT ≥ 1500 & GPA ≥ 9.0 + Hồ sơ hoạt động cộng đồng & Hồ sơ Financial Aid',
  },
  {
    id: 'vn_fulbright_aid',
    university: 'Fulbright University Vietnam (FUV)',
    program: 'Khoa học Máy tính, Kinh tế, Tâm lý học',
    minSat: 1420,
    minGpa: 8.8,
    scholarshipPercentage: '50% – 70% Học bổng & Hỗ trợ tài chính',
    awardPerYearVnd: '270 triệu – 380 triệu VNĐ',
    awardPerYearUsd: '$10,600 – $15,000',
    fourYearTotalVnd: '1.08 – 1.52 tỷ VNĐ',
    fourYearTotalUsd: '$42,500 – $60,000',
    criteria: 'SAT ≥ 1420 & GPA ≥ 8.8 + Xét duyệt hoàn cảnh tài chính gia đình minh bạch',
  },
  {
    id: 'vn_rmit_presidential',
    university: 'RMIT University Vietnam',
    program: 'Tất cả các ngành đào tạo tại Hà Nội & TP.HCM',
    minSat: 1400,
    minGpa: 8.5,
    scholarshipPercentage: '50% – 100% Học phí toàn khóa',
    awardPerYearVnd: '180 triệu – 360 triệu VNĐ',
    awardPerYearUsd: '$7,000 – $14,200',
    fourYearTotalVnd: '720 triệu – 1.44 tỷ VNĐ',
    fourYearTotalUsd: '$28,300 – $56,700',
    criteria: 'SAT ≥ 1400 + IELTS 7.0+ & Thành tích lãnh đạo trẻ nổi bật',
  },
  {
    id: 'vn_buv_talent',
    university: 'British University Vietnam (BUV)',
    program: 'Tài chính quốc tế, Khoa học Máy tính, Thiết kế Game',
    minSat: 1380,
    minGpa: 8.5,
    scholarshipPercentage: '50% – 100% Học phí đại học Anh Quốc',
    awardPerYearVnd: '175 triệu – 350 triệu VNĐ',
    awardPerYearUsd: '$6,900 – $13,800',
    fourYearTotalVnd: '700 triệu – 1.40 tỷ VNĐ',
    fourYearTotalUsd: '$27,500 – $55,100',
    criteria: 'SAT ≥ 1380 & GPA ≥ 8.5 + Bài luận học bổng Quán quân',
  },
];

async function handleScholarshipMatch(req: Request, rawSat: unknown, rawGpa: unknown) {
  // Xác thực (Hỗ trợ an toàn cả Khách & User đã đăng nhập)
  const user = await getCurrentUser().catch(() => ({ id: 'local-default-user', isAuthenticated: false }));

  // Rate limiting
  const rateLimitKey = getRateLimitKey(req, 'scholarship-match', user.isAuthenticated ? user.id : null);
  const rl = rateLimit(rateLimitKey, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  // Sanitize numeric inputs
  const numSat = typeof rawSat === 'number' ? rawSat : parseFloat(String(rawSat ?? '1420'));
  const numGpa = typeof rawGpa === 'number' ? rawGpa : parseFloat(String(rawGpa ?? '8.8'));

  const sat = Number.isFinite(numSat) ? Math.min(1600, Math.max(400, Math.round(numSat))) : 1420;
  const gpa = Number.isFinite(numGpa) ? Math.min(10.0, Math.max(0.0, Number(numGpa.toFixed(2)))) : 8.8;

  // Đánh giá US Tiers
  const usTiers: UsScholarshipTier[] = US_TIERS_DATA.map((t) => {
    const matched = sat >= t.minScore && sat <= t.maxScore;
    return {
      ...t,
      matched,
    };
  });

  const currentUsTier = usTiers.find((t) => t.matched) || usTiers[usTiers.length - 1];

  // Đánh giá VN Scholarships
  const vnScholarships: VnScholarshipTier[] = VN_SCHOLARSHIPS_DATA.map((t) => {
    const satOk = sat >= t.minSat;
    const gpaOk = !t.minGpa || gpa >= t.minGpa;
    const matched = satOk && gpaOk;
    return {
      ...t,
      matched,
    };
  });

  const matchedVnAwards = vnScholarships.filter((v) => v.matched);

  return NextResponse.json({
    success: true,
    input: { sat, gpa },
    currencyExchangeRate: {
      usdToVnd: USD_TO_VND_RATE,
      note: 'Tỷ giá tham chiếu 1 USD ≈ 25.400 VNĐ',
    },
    user: {
      id: user.id,
      isAuthenticated: user.isAuthenticated,
    },
    usScholarship: {
      currentTier: currentUsTier,
      allTiers: usTiers,
    },
    vietnamScholarship: {
      matchedAwards: matchedVnAwards,
      allAwards: vnScholarships,
      summary: {
        totalEligible: matchedVnAwards.length,
        maxPotentialVnd: matchedVnAwards.length > 0 ? matchedVnAwards[0].fourYearTotalVnd : '0 VNĐ',
      },
    },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawSat = url.searchParams.get('sat');
    const rawGpa = url.searchParams.get('gpa');

    return await handleScholarshipMatch(req, rawSat, rawGpa);
  } catch (error) {
    console.error('Lỗi API scholarship-match GET:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi máy chủ khi tính học bổng' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawSat = body?.sat ?? body?.satScore;
    const rawGpa = body?.gpa;

    return await handleScholarshipMatch(req, rawSat, rawGpa);
  } catch (error) {
    console.error('Lỗi API scholarship-match POST:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi máy chủ khi tính học bổng' }, { status: 500 });
  }
}
