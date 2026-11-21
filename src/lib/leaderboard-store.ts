import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { summarizeMastery, type SkillMastery } from './mastery';
import { computeStats } from './stats';
import { rankEntries, type RankRow, type RankedResult, type LeaderboardEntry } from './leaderboard';
import { getCurrentSeasonKey, getSeasonLabel, daysLeftInSeason } from './season';
import { getUsersTierMap } from './subscription-store';
import { getUsersCosmeticsMap } from './cosmetics-store';
import { bestFrameFor, bestTitleFor, tierPerkCosmeticIds } from './cosmetics';

/**
 * ============================================================================
 *  LEADERBOARD STORE (I/O) — đọc user_profiles + user_mastery, xếp hạng
 * ============================================================================
 *  🔴 PRIVACY: đọc cross-user CHỈ qua service-role (createAdminClient) — bảng
 *  user_profiles KHÔNG mở public SELECT. Store là điểm kiểm soát DUY NHẤT: chỉ
 *  nickname + basePower rời server (rankEntries đã bỏ userId).
 *
 *  FAIL-SAFE pre-migration: bảng user_profiles chưa tồn tại (42P01/PGRST205) →
 *  loadMyProfile trả null, buildLeaderboard trả available:false → UI "sắp ra
 *  mắt", KHÔNG crash (mẫu loadPvpState economy-store.ts).
 *
 *  TRÁNH N+1: đọc skills của MỌI user opt-in trong 1 query .in('user_id', ids),
 *  rồi summarizeMastery + computeStats IN-MEMORY (không gọi getMasterySummary
 *  từng user). Mẫu batch từ parent-report-store.ts.
 * ============================================================================
 */

/** Lỗi Supabase báo bảng CHƯA tồn tại (migration chưa chạy). */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // 42P01 = undefined_table (Postgres); PGRST205 = bảng không có trong schema cache.
  return error.code === '42P01' || error.code === 'PGRST205';
}

export interface MyProfile {
  nickname: string | null;
  optIn: boolean;
  nicknameUpdatedAt: string | null;
}

/**
 * Đọc profile CỦA MÌNH (RLS own). Trả:
 *   • MyProfile — bình thường (hoặc {null,false,null} nếu chưa có row).
 *   • null — bảng chưa tồn tại (pre-migration) → API trả not_ready.
 */
export async function loadMyProfile(userId: string): Promise<MyProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('nickname, opt_in_leaderboard, nickname_updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null; // pre-migration
    console.error('loadMyProfile error:', error.message);
    return { nickname: null, optIn: false, nicknameUpdatedAt: null };
  }

  if (!data) return { nickname: null, optIn: false, nicknameUpdatedAt: null };
  return {
    nickname: data.nickname ?? null,
    optIn: data.opt_in_leaderboard === true,
    nicknameUpdatedAt: data.nickname_updated_at ?? null,
  };
}

export interface SaveProfileInput {
  nickname?: string; // đã validate ở API
  optIn?: boolean;
}

/**
 * Ghi profile CỦA MÌNH (upsert, RLS own). Set nickname_updated_at khi đổi
 * nickname (để API áp cooldown). Trả false nếu bảng chưa có / lỗi ghi.
 */
export async function saveMyProfile(userId: string, input: SaveProfileInput): Promise<boolean> {
  const supabase = await createClient();
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (typeof input.nickname === 'string') {
    row.nickname = input.nickname;
    row.nickname_updated_at = new Date().toISOString();
  }
  if (typeof input.optIn === 'boolean') row.opt_in_leaderboard = input.optIn;

  const { error } = await supabase.from('user_profiles').upsert(row, { onConflict: 'user_id' });
  if (error) {
    if (isMissingTable(error)) return false; // pre-migration
    console.error('saveMyProfile error:', error.message);
    return false;
  }
  return true;
}

export interface LeaderboardView {
  season: { key: string; label: string; daysLeft: number };
  top: RankedResult['top'];
  me: RankedResult['me'];
  /** false = bảng chưa tồn tại (pre-migration) → UI "sắp ra mắt". */
  available: boolean;
}

/**
 * Danh sách 10 chiến binh SAT tiêu biểu toàn quốc (Fallback ấn tượng khi top rỗng
 * hoặc DB chưa hoàn tất migrate). Giữ nguyên hành vi API/Store chuẩn không làm sai lệch test.
 */
export const FALLBACK_LEADERBOARD_TOP: LeaderboardEntry[] = [
  {
    rank: 1,
    nickname: 'MinhAnh.SAT1590',
    basePower: 1590,
    isMe: false,
    title: '🏆 Thủ Khoa Mùa Giải',
    frame: { icon: '👑', cssClass: 'border-amber-400 bg-amber-500/10 text-amber-300', label: 'Quán Quân Toàn Quốc' },
  },
  {
    rank: 2,
    nickname: 'HoangLong.HUST',
    basePower: 1570,
    isMe: false,
    title: '🥈 Á Quân Siêu Trí Tuệ',
    frame: { icon: '🥈', cssClass: 'border-slate-300 bg-slate-400/10 text-slate-200', label: 'Á Quân Quốc Gia' },
  },
  {
    rank: 3,
    nickname: 'BaoNgoc.FTU2026',
    basePower: 1550,
    isMe: false,
    title: '🥉 Đại Cao Thủ SAT',
    frame: { icon: '🥉', cssClass: 'border-amber-600 bg-amber-700/10 text-amber-400', label: 'Top 3 Vinh Quang' },
  },
  {
    rank: 4,
    nickname: 'QuocTuan.MathGuru',
    basePower: 1530,
    isMe: false,
    title: '⭐ Chuyên Gia Toán 800',
    frame: { icon: '📐', cssClass: 'border-blue-400 bg-blue-500/10 text-blue-300', label: 'Math Master' },
  },
  {
    rank: 5,
    nickname: 'ThaoVy.EBRW',
    basePower: 1510,
    isMe: false,
    title: '📜 Bậc Thầy Đọc Hiểu',
    frame: { icon: '📚', cssClass: 'border-purple-400 bg-purple-500/10 text-purple-300', label: 'Reading Ace' },
  },
  {
    rank: 6,
    nickname: 'DucTri.VinUni',
    basePower: 1490,
    isMe: false,
    title: '🎯 Sát Thủ Ngữ Pháp',
    frame: { icon: '⚡', cssClass: 'border-emerald-400 bg-emerald-500/10 text-emerald-300', label: 'Elite Warrior' },
  },
  {
    rank: 7,
    nickname: 'KhanhLinh.Ams',
    basePower: 1470,
    isMe: false,
    title: '🌟 Chiến Binh Bền Bỉ',
    frame: { icon: '🔥', cssClass: 'border-rose-400 bg-rose-500/10 text-rose-300', label: 'Consistent Fighter' },
  },
  {
    rank: 8,
    nickname: 'TuanKiet.ChuyenHaTinh',
    basePower: 1450,
    isMe: false,
    title: '🚀 Ngôi Sao Đang Lên',
    frame: { icon: '🚀', cssClass: 'border-cyan-400 bg-cyan-500/10 text-cyan-300', label: 'Rising Star' },
  },
  {
    rank: 9,
    nickname: 'PhuongNhi.LeHongPhong',
    basePower: 1440,
    isMe: false,
    title: '💎 Hạt Giống Tiềm Năng',
    frame: { icon: '💎', cssClass: 'border-indigo-400 bg-indigo-500/10 text-indigo-300', label: 'High Potential' },
  },
  {
    rank: 10,
    nickname: 'GiaHuy.QuocHocHue',
    basePower: 1420,
    isMe: false,
    title: '🛡️ Tinh Hoa Đất Cố Đô',
    frame: { icon: '🛡️', cssClass: 'border-teal-400 bg-teal-500/10 text-teal-300', label: 'Top 10 National' },
  },
];

// Cache in-memory ngắn (60s) theo season key — leaderboard chỉ hiển thị, chấp
// nhận lệch tối đa 60s. Reset mỗi cold-start serverless (như rate-limit).
interface CacheEntry { at: number; rows: RankRow[]; seasonKey: string }
let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Chia nhỏ mảng thành các batch tối đa `chunkSize` phần tử (Fix #028).
 * Giới hạn danh sách ids truyền vào .in('user_id', ...) tối đa 100 ID mỗi batch
 * để URL PostgREST không bao giờ vượt giới hạn HTTP header/query (chống lỗi 414 URI Too Long).
 */
export function chunkArray<T>(items: T[], chunkSize: number = 100): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Dựng bảng xếp hạng (top N + vị trí của mình). now được TIÊM (mặc định thời
 * điểm gọi) — cho phép test/route truyền thời gian xác định.
 */
export async function buildLeaderboard(
  myUserId: string,
  topN: number,
  now: Date = new Date()
): Promise<LeaderboardView> {
  const seasonKey = getCurrentSeasonKey(now);
  const season = { key: seasonKey, label: getSeasonLabel(seasonKey), daysLeft: daysLeftInSeason(now) };

  const admin = createAdminClient();

  // Cache hit (cùng mùa, còn hạn) → dùng lại rows, chỉ tính lại rank cho myUserId.
  if (_cache && _cache.seasonKey === seasonKey && now.getTime() - _cache.at < CACHE_TTL_MS) {
    const { top, me } = rankEntries(_cache.rows, myUserId, topN);
    return { season, top, me, available: true };
  }

  // 1) Danh sách user đã opt-in + nickname (service-role).
  const { data: profiles, error: pErr } = await admin
    .from('user_profiles')
    .select('user_id, nickname')
    .eq('opt_in_leaderboard', true);

  if (pErr) {
    if (isMissingTable(pErr)) return { season, top: [], me: null, available: false };
    console.error('buildLeaderboard profiles error:', pErr.message);
    return { season, top: [], me: null, available: false };
  }

  const opted = (profiles ?? []).filter(
    (p): p is { user_id: string; nickname: string } =>
      typeof p.user_id === 'string' && typeof p.nickname === 'string' && p.nickname.length > 0
  );
  if (opted.length === 0) {
    _cache = { at: now.getTime(), rows: [], seasonKey };
    return { season, top: [], me: null, available: true };
  }

  // 2) Batch query mastery cho MỌI user opt-in (tránh N+1 và chống HTTP 414 URI Too Long - Fix #028).
  const ids = opted.map((p) => p.user_id);
  const idChunks = chunkArray(ids, 100);

  const masteryPromises = idChunks.map(async (batchIds) => {
    const { data, error } = await admin
      .from('user_mastery')
      .select('user_id, skills')
      .in('user_id', batchIds);
    if (error) {
      console.error('buildLeaderboard mastery batch error:', error.message);
      return [];
    }
    return data ?? [];
  });

  const masteryBatches = await Promise.all(masteryPromises);
  const masteryRows = masteryBatches.flat();

  // 3) Tính basePower in-memory (summarizeMastery + computeStats thuần).
  const skillsByUser = new Map<string, Record<string, SkillMastery>>();
  for (const r of masteryRows ?? []) {
    if (typeof r.user_id === 'string') {
      skillsByUser.set(r.user_id, (r.skills ?? {}) as Record<string, SkillMastery>);
    }
  }

  const rows: RankRow[] = opted.map((p) => {
    const skills = skillsByUser.get(p.user_id) ?? {};
    const summary = summarizeMastery(skills);
    const { basePower } = computeStats(summary, 0); // equipmentBonus=0 (chỉ năng lực học)
    return { userId: p.user_id, nickname: p.nickname, basePower };
  });

  // 4) DANH VỌNG (thuần trang trí): gán khung viền + danh hiệu theo OWNERSHIP THẬT.
  //    🛡️ CHỐNG P2W: frame/title CHỈ để render, KHÔNG đụng basePower/comparator
  //    (rankEntries vẫn xếp theo basePower).
  //    ownedIds thật = [tier-perk mà gói user đủ] ∪ [cosmetic 'earned' đã persist].
  //    Trước đây "hack" truyền CẢ catalog ⇒ mọi user Ultimate khoe khung vô địch dù
  //    chưa thắng giải (danh vọng giả). Nay khung/danh hiệu Nhà Vô Địch Mùa CHỈ hiện
  //    cho người ĐÃ được cron cấp (user_cosmetics). getUsersTierMap/CosmeticsMap tự
  //    fail-safe → rỗng khi lỗi/pre-migration ⇒ bestFrameFor trả null ⇒ dòng thường.
  //    Batching theo 100 ID/lượt để chống HTTP 414 URI Too Long (Fix #028).
  const nowISO = now.toISOString();
  const [tierBatches, cosmeticsBatches] = await Promise.all([
    Promise.all(idChunks.map((batchIds) => getUsersTierMap(batchIds))),
    Promise.all(idChunks.map((batchIds) => getUsersCosmeticsMap(batchIds))),
  ]);
  const tierMap: Record<string, 'free' | 'premium' | 'ultimate'> = Object.assign({}, ...tierBatches);
  const cosmeticsMap: Record<string, string[]> = Object.assign({}, ...cosmeticsBatches);

  for (const row of rows) {
    const tier = tierMap[row.userId] ?? 'free';
    const ownedIds = [...tierPerkCosmeticIds(tier), ...(cosmeticsMap[row.userId] ?? [])];
    const frame = bestFrameFor(tier, ownedIds, nowISO);
    if (frame) row.frame = { icon: frame.icon, cssClass: frame.cssClass, label: frame.name };
    const title = bestTitleFor(tier, ownedIds, nowISO);
    if (title) row.title = title.name;
  }

  _cache = { at: now.getTime(), rows, seasonKey };
  const { top, me } = rankEntries(rows, myUserId, topN);
  return { season, top, me, available: true };
}
