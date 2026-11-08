import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { buildLeaderboard } from '@/lib/leaderboard-store';

/**
 * LEADERBOARD & INTER-SCHOOL CHAMPIONSHIP API
 *
 * GET → {
 *   season,
 *   top,
 *   me,
 *   available,
 *   schoolRankings,
 *   userSchool,
 *   referralStats
 * }
 *
 * POST → Cập nhật trường THPT (schoolName) & Mục tiêu điểm SAT (targetScore).
 */

const TOP_N = 50;

export interface SchoolRankingItem {
  id: string;
  rank: number;
  name: string;
  shortName: string;
  province: string;
  region: 'North' | 'Central' | 'South';
  totalWarriors: number;
  avgSatScore: number;
  totalPower: number;
  target1500PlusRate: number;
  badge: string;
  motto: string;
  isMySchool?: boolean;
}

export interface UserSchoolProfile {
  schoolName: string;
  targetScore: number;
  updatedAt: string;
}

// Global in-memory storage cho School Profiles
declare global {
  // eslint-disable-next-line no-var
  var __SAT_USER_SCHOOL_PROFILES__: Map<string, UserSchoolProfile> | undefined;
}

const userSchoolMap: Map<string, UserSchoolProfile> =
  globalThis.__SAT_USER_SCHOOL_PROFILES__ ??
  (globalThis.__SAT_USER_SCHOOL_PROFILES__ = new Map());

// Danh sách trường THPT Chuyên mẫu chuẩn toàn quốc với các chỉ số học thuật ấn tượng
const INITIAL_SCHOOL_RANKINGS: Omit<SchoolRankingItem, 'rank' | 'isMySchool'>[] = [
  {
    id: 'ams',
    name: 'THPT Chuyên Hà Nội - Amsterdam',
    shortName: 'Amsers',
    province: 'Hà Nội',
    region: 'North',
    totalWarriors: 412,
    avgSatScore: 1520,
    totalPower: 124500,
    target1500PlusRate: 58,
    badge: '👑 Đương Kim Vô Địch',
    motto: 'Amser một ngày, Amser mãi mãi',
  },
  {
    id: 'cnn',
    name: 'THPT Chuyên Ngoại Ngữ - ĐHQGHN',
    shortName: 'CNNers',
    province: 'Hà Nội',
    region: 'North',
    totalWarriors: 385,
    avgSatScore: 1505,
    totalPower: 118200,
    target1500PlusRate: 52,
    badge: '⚡ Thần Tốc RW 800',
    motto: 'Cháy hết mình cùng đam mê ngôn ngữ',
  },
  {
    id: 'lhp_hcm',
    name: 'THPT Chuyên Lê Hồng Phong',
    shortName: 'LHPers Sài Gòn',
    province: 'TP. Hồ Chí Minh',
    region: 'South',
    totalWarriors: 376,
    avgSatScore: 1495,
    totalPower: 114600,
    target1500PlusRate: 49,
    badge: '🔥 Hào Khí Phương Nam',
    motto: 'Kỷ luật - Trí tuệ - Tự hào',
  },
  {
    id: 'khtn',
    name: 'THPT Chuyên Khoa Học Tự Nhiên - ĐHQGHN',
    shortName: 'HUSers',
    province: 'Hà Nội',
    region: 'North',
    totalWarriors: 320,
    avgSatScore: 1515,
    totalPower: 112800,
    target1500PlusRate: 55,
    badge: '📐 Thần Toán Desmos 800',
    motto: 'Đỉnh cao khoa học và logic',
  },
  {
    id: 'ptnk',
    name: 'Trường Phổ Thông Năng Khiếu - ĐHQG TP.HCM',
    shortName: 'PTNKers',
    province: 'TP. Hồ Chí Minh',
    region: 'South',
    totalWarriors: 310,
    avgSatScore: 1490,
    totalPower: 108500,
    target1500PlusRate: 47,
    badge: '🌟 Thủ Phủ Học Bổng Mỹ',
    motto: 'Khai phóng tiềm năng vô tận',
  },
  {
    id: 'csp',
    name: 'THPT Chuyên Đại Học Sư Phạm Hà Nội',
    shortName: 'CSPers',
    province: 'Hà Nội',
    region: 'North',
    totalWarriors: 288,
    avgSatScore: 1485,
    totalPower: 99400,
    target1500PlusRate: 44,
    badge: '📚 Cỗ Máy Luyện Đề',
    motto: 'Vững nền tảng, sáng tương lai',
  },
  {
    id: 'pbc_na',
    name: 'THPT Chuyên Phan Bội Châu',
    shortName: 'Trường Phan',
    province: 'Nghệ An',
    region: 'Central',
    totalWarriors: 265,
    avgSatScore: 1480,
    totalPower: 95300,
    target1500PlusRate: 41,
    badge: '🦁 Chiến Binh Đất Nghệ',
    motto: 'Kiên cường bứt phá đỉnh cao',
  },
  {
    id: 'qh_hue',
    name: 'THPT Chuyên Quốc Học Huế',
    shortName: 'Quốc Học',
    province: 'Thừa Thiên Huế',
    region: 'Central',
    totalWarriors: 242,
    avgSatScore: 1475,
    totalPower: 89700,
    target1500PlusRate: 39,
    badge: '🏛️ Trí Tuệ Cố Đô',
    motto: 'Tinh hoa trăm năm lịch sử',
  },
  {
    id: 'lamson',
    name: 'THPT Chuyên Lam Sơn',
    shortName: 'Lam Sơn',
    province: 'Thanh Hóa',
    region: 'Central',
    totalWarriors: 228,
    avgSatScore: 1470,
    totalPower: 86100,
    target1500PlusRate: 38,
    badge: '⚔️ Đội Quân Bất Bại',
    motto: 'Rạng danh đất Lam Sơn',
  },
  {
    id: 'tranphu_hp',
    name: 'THPT Chuyên Trần Phú',
    shortName: 'Trần Phú HP',
    province: 'Hải Phòng',
    region: 'North',
    totalWarriors: 215,
    avgSatScore: 1465,
    totalPower: 83200,
    target1500PlusRate: 36,
    badge: '⚓ Đất Cảng Kiêu Hùng',
    motto: 'Sóng gió tôi luyện bản lĩnh',
  },
  {
    id: 'cva_hn',
    name: 'THPT Chu Văn An',
    shortName: 'Bưởi - CVA',
    province: 'Hà Nội',
    region: 'North',
    totalWarriors: 230,
    avgSatScore: 1472,
    totalPower: 85400,
    target1500PlusRate: 37,
    badge: '🍃 Cổ Kính Tây Hồ',
    motto: 'Tự hào truyền thống Trường Bưởi',
  },
  {
    id: 'nguyenhue_hn',
    name: 'THPT Chuyên Nguyễn Huệ',
    shortName: 'CNH Hà Đông',
    province: 'Hà Nội',
    region: 'North',
    totalWarriors: 198,
    avgSatScore: 1460,
    totalPower: 76800,
    target1500PlusRate: 33,
    badge: '🚀 Vút Bay Hà Tây',
    motto: 'Đoàn kết và không ngừng tiến bước',
  },
];

// Helper bảo vệ PII: Che email nếu displayName/name chứa ký tự '@'
function maskEmailOrName(str?: string | null): string {
  if (!str) return 'Học viên SAT';
  const trimmed = str.trim();
  if (trimmed.includes('@')) {
    const localPart = trimmed.split('@')[0];
    return localPart.length <= 2 ? `${localPart}***` : `${localPart.slice(0, 3)}***`;
  }
  return trimmed;
}

// Helper loại bỏ trường email nhạy cảm khỏi bảng xếp hạng công khai
function sanitizeLeaderboardEntry<T extends Record<string, any>>(entry: T): T {
  if (!entry || typeof entry !== 'object') return entry;
  const { email: _removedEmail, ...rest } = entry;
  const sanitized: Record<string, any> = { ...rest };

  if (typeof sanitized.nickname === 'string') {
    sanitized.nickname = maskEmailOrName(sanitized.nickname);
  }
  if (typeof sanitized.name === 'string') {
    sanitized.name = maskEmailOrName(sanitized.name);
  }
  if (typeof sanitized.displayName === 'string') {
    sanitized.displayName = maskEmailOrName(sanitized.displayName);
  }

  return sanitized as T;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  const rl = rateLimit(`leaderboard:${user.id}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  // Sanitize query params (limit & classCode an toàn, chống DoS / injection)
  const searchParams = request.nextUrl.searchParams;
  const rawLimit = parseInt(searchParams.get('limit') || `${TOP_N}`, 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? TOP_N : rawLimit), 100);

  const rawClassCode = searchParams.get('classCode');
  const classCode = rawClassCode ? rawClassCode.trim().toUpperCase().slice(0, 30) : undefined;

  try {
    const view = await (buildLeaderboard as (userId: string, limit?: number, classCode?: string) => Promise<any>)(
      user.id,
      limit,
      classCode
    );
    const userSchool = userSchoolMap.get(user.id) || null;

    // Tính toán bảng xếp hạng trường có tính thêm lực chiến của user
    const schoolList: SchoolRankingItem[] = INITIAL_SCHOOL_RANKINGS.map((item, idx) => {
      const isMySchool = userSchool ? item.name.toLowerCase().includes(userSchool.schoolName.toLowerCase()) || userSchool.schoolName.toLowerCase().includes(item.shortName.toLowerCase()) : false;
      const extraPower = isMySchool && view.me ? view.me.basePower : 0;
      const extraWarriors = isMySchool ? 1 : 0;

      return {
        ...item,
        rank: idx + 1,
        totalPower: item.totalPower + extraPower,
        totalWarriors: item.totalWarriors + extraWarriors,
        isMySchool,
      };
    });

    // Sắp xếp lại theo tổng lực chiến
    schoolList.sort((a, b) => b.totalPower - a.totalPower);
    schoolList.forEach((s, i) => {
      s.rank = i + 1;
    });

    // Sinh mã referral dựa trên user id
    const cleanId = (user.id || 'GUEST').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    const referralCode = `SAT-${cleanId || 'GURU26'}`;

    // Bảo vệ PII (#027): Xoá email, che nickname/name nếu chứa @
    const sanitizedTop = Array.isArray(view.top) ? view.top.map(sanitizeLeaderboardEntry) : [];
    const sanitizedMe = view.me ? sanitizeLeaderboardEntry(view.me) : null;

    return NextResponse.json({
      ...view,
      top: sanitizedTop,
      me: sanitizedMe,
      classCode: classCode || (view.classCode ?? null),
      schoolRankings: schoolList,
      userSchool,
      referralStats: {
        code: referralCode,
        invitedCount: 3,
        bonusDaysPro: 21,
        bonusCoins: 1500,
        referralUrl: `https://satguru.edu.vn/auth/register?ref=${referralCode}`,
        challengeUrl: `https://satguru.edu.vn/arena?challenger=${referralCode}&mode=speed5`,
      },
    });
  } catch (error) {
    console.error('Lỗi leaderboard:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  const rl = rateLimit(`leaderboard-post:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Thao tác quá nhanh. Vui lòng chờ giây lát.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { schoolName, targetScore } = body;

    if (!schoolName || typeof schoolName !== 'string' || schoolName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Tên trường không hợp lệ (tối thiểu 2 ký tự).' },
        { status: 400 }
      );
    }

    const parsedScore = Number(targetScore) || 1450;
    if (parsedScore < 400 || parsedScore > 1600) {
      return NextResponse.json(
        { error: 'Mục tiêu điểm SAT phải từ 400 đến 1600.' },
        { status: 400 }
      );
    }

    const profile: UserSchoolProfile = {
      schoolName: schoolName.trim(),
      targetScore: parsedScore,
      updatedAt: new Date().toISOString(),
    };

    userSchoolMap.set(user.id, profile);

    return NextResponse.json({
      success: true,
      profile,
      message: `🎉 Đã ghi danh thành công cho trường ${profile.schoolName}! Điểm lực chiến của bạn sẽ cống hiến cho trường!`,
    });
  } catch (error) {
    console.error('Lỗi cập nhật trường:', error);
    return NextResponse.json({ error: 'Lỗi khi cập nhật thông tin trường.' }, { status: 500 });
  }
}
