import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AiTier } from './ai-quota';
import {
  resolveTier,
  SUBSCRIPTION_GRACE_PERIOD_MS,
  TIER_PRIORITY,
  type BillingPeriod,
  type PaidTier,
  type SubscriptionRecord,
  type SubscriptionTier,
} from './subscription';

/**
 * ============================================================================
 *  SUBSCRIPTION STORE (Supabase Postgres) — Phase 2
 * ============================================================================
 *  Đọc/ghi gói trả phí của user từ bảng `user_subscriptions`.
 *
 *  Theo mẫu ROOT E (2026-07-03): ĐỌC qua client per-request (RLS auth.uid()).
 *  GHI (cấp/gia hạn gói) nay do RPC `confirm_payment` làm ATOMIC cùng lúc lật đơn
 *  pending→paid (migration_a2_atomic_grant.sql) — server-authoritative, client
 *  KHÔNG tự cấp gói. File này chỉ còn đường ĐỌC tier.
 *
 *  FAIL-SAFE: bảng chưa tồn tại / lỗi đọc → coi như KHÔNG có gói → tier 'free'.
 *  Đây là hướng AN TOÀN: lỗi hạ tầng KHÔNG vô tình mở khóa quyền lợi trả phí.
 * ============================================================================
 */

/**
 * Helper lọc & sắp xếp danh sách subscription:
 * 1. Lọc dòng còn hạn (tính cả 12-hour grace period, và status='active' nếu có cột status).
 * 2. Ưu tiên TIER_PRIORITY cao nhất: ultimate > premium > pro > free.
 * 3. Nếu cùng tier, ưu tiên expires_at xa nhất.
 */
function selectBestSubscription(rows: Array<Record<string, unknown>>): SubscriptionRecord | null {
  const activeRows = rows
    .filter((row) => {
      if ('status' in row && row.status && row.status !== 'active') return false;
      const exp = row.expires_at as string;
      if (!exp) return false;
      return new Date(exp).getTime() + SUBSCRIPTION_GRACE_PERIOD_MS > Date.now();
    })
    .sort((a, b) => {
      const tierA = (a.tier as SubscriptionTier) || 'free';
      const tierB = (b.tier as SubscriptionTier) || 'free';
      const priorityDiff = (TIER_PRIORITY[tierB] ?? 0) - (TIER_PRIORITY[tierA] ?? 0);
      if (priorityDiff !== 0) return priorityDiff;

      const expA = new Date((a.expires_at as string) || 0).getTime();
      const expB = new Date((b.expires_at as string) || 0).getTime();
      return expB - expA;
    });

  const best = activeRows[0];
  if (!best) return null;

  return {
    tier: best.tier as PaidTier,
    period: best.period as BillingPeriod,
    startedAt: (best.started_at as string) ?? '',
    expiresAt: (best.expires_at as string) ?? '',
  };
}

/**
 * Đọc gói còn-hạn tốt nhất của user (Fix #005: Multi-Tier Hierarchy & Fix #032: 12-Hour Grace Period).
 * Ưu tiên bậc cao nhất: ultimate > premium > pro > free.
 * Nếu cùng bậc, ưu tiên gói có expires_at xa nhất.
 */
export async function getActiveSubscription(userId: string): Promise<SubscriptionRecord | null> {
  const supabase = await createClient();
  const minValidExpiresAt = new Date(Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS).toISOString();

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('tier, period, started_at, expires_at')
    .eq('user_id', userId)
    .gte('expires_at', minValidExpiresAt);

  if (error || !data || data.length === 0) return null;
  return selectBestSubscription(data as Array<Record<string, unknown>>);
}

/** Alias getActiveSubscriptionFromDb cho getActiveSubscription */
export const getActiveSubscriptionFromDb = getActiveSubscription;

/**
 * Tier HIỆU LỰC của user (nối vào ai-quota). FAIL-SAFE → 'free' khi lỗi/không có.
 * Đây là hàm 2 route AI gọi thay cho hardcode 'free'.
 */
export async function getUserTier(userId: string): Promise<AiTier> {
  try {
    const sub = await getActiveSubscription(userId);
    return resolveTier(sub, new Date().toISOString());
  } catch (e) {
    console.error('getUserTier lỗi (fail-safe → free):', e);
    return 'free';
  }
}

/**
 * Tier HIỆU LỰC của user đọc qua SERVICE-ROLE (bypass RLS). Dùng cho đường KHÔNG
 * có session của user đó — cụ thể báo cáo phụ huynh (phụ huynh không auth, cần
 * biết tier của CON để phân tầng report). FAIL-SAFE → 'free'.
 */
export async function getUserTierAdmin(userId: string): Promise<AiTier> {
  try {
    const admin = createAdminClient();
    const minValidExpiresAt = new Date(Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS).toISOString();

    const { data, error } = await admin
      .from('user_subscriptions')
      .select('tier, period, started_at, expires_at')
      .eq('user_id', userId)
      .gte('expires_at', minValidExpiresAt);

    if (error || !data || data.length === 0) return 'free';
    const sub = selectBestSubscription(data as Array<Record<string, unknown>>);
    return resolveTier(sub, new Date().toISOString());
  } catch (e) {
    console.error('getUserTierAdmin lỗi (fail-safe → free):', e);
    return 'free';
  }
}

/**
 * Tier HIỆU LỰC của NHIỀU user cùng lúc (đọc SERVICE-ROLE, tránh N+1). Dùng cho
 * leaderboard/giải đấu: cần biết tier của mọi user để gán khung/danh hiệu cosmetic
 * (danh vọng) — KHÔNG đổi thứ hạng. Mẫu batch .in('user_id', ids) như
 * leaderboard-store.ts. Với mỗi user lấy gói CÒN-HẠN-MỚI-NHẤT rồi resolveTier.
 *
 * FAIL-SAFE: userIds rỗng → {}; bảng chưa tồn tại / lỗi đọc → map RỖNG (mọi user
 * coi 'free') — hướng an toàn: lỗi hạ tầng KHÔNG vô tình mở quyền lợi trả phí.
 * User không có gói → 'free'.
 */
export async function getUsersTierMap(
  userIds: string[]
): Promise<Record<string, 'free' | 'premium' | 'ultimate'>> {
  const result: Record<string, 'free' | 'premium' | 'ultimate'> = {};
  const ids = Array.from(new Set(userIds.filter((id) => typeof id === 'string' && id.length > 0)));
  if (ids.length === 0) return result;

  try {
    const admin = createAdminClient();
    const nowISO = new Date().toISOString();
    const minValidExpiresAt = new Date(Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS).toISOString();

    const { data, error } = await admin
      .from('user_subscriptions')
      .select('user_id, tier, period, started_at, expires_at')
      .in('user_id', ids)
      .gte('expires_at', minValidExpiresAt);

    if (error || !data) return result; // fail-safe: map rỗng → mọi user 'free'

    // Gom nhóm theo user_id
    const userRows: Record<string, Array<Record<string, unknown>>> = {};
    for (const row of data as Array<Record<string, unknown>>) {
      const uid = typeof row.user_id === 'string' ? row.user_id : null;
      if (!uid) continue;
      if (!userRows[uid]) userRows[uid] = [];
      userRows[uid].push(row);
    }

    // Chọn gói tốt nhất cho từng user
    for (const uid of ids) {
      const rows = userRows[uid];
      if (!rows || rows.length === 0) continue;
      const sub = selectBestSubscription(rows);
      result[uid] = resolveTier(sub, nowISO);
    }
    return result;
  } catch (e) {
    console.error('getUsersTierMap lỗi (fail-safe → map rỗng):', e);
    return result;
  }
}

/*
 * (Đã gỡ) grantSubscription() — trước đây là đường GHI cấp/gia hạn gói. Sau khi
 * gộp việc cấp gói vào RPC `confirm_payment` cho ATOMIC (migration_a2_atomic_grant.sql,
 * 2026-07-10), hàm này thành mồ côi (0 caller). Gỡ để tránh dùng nhầm → double-grant
 * ngoài transaction xác nhận đơn. Cấp gói duy nhất qua confirm_payment.
 */

/**
 * Kích hoạt / gia hạn gói trả phí cho trường hợp Admin duyệt đơn thủ công (`/api/admin/orders`).
 * Luôn cộng dồn thời hạn (`expires_at`) nếu user đang có gói còn hạn và giữ bậc cao nhất (`ultimate > premium`).
 */
export async function activateSubscription(
  userId: string,
  planOrTier: string,
  durationDaysOrPeriod: number | BillingPeriod = 30,
  _orderId?: string
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const nowMs = Date.now();
    const nowISO = new Date(nowMs).toISOString();

    const normalizedTier: PaidTier =
      planOrTier.toLowerCase().includes('ultimate') ? 'ultimate' : 'premium';
    const days =
      typeof durationDaysOrPeriod === 'number' && durationDaysOrPeriod > 0
        ? durationDaysOrPeriod
        : durationDaysOrPeriod === 'yearly'
        ? 365
        : durationDaysOrPeriod === 'quarterly'
        ? 90
        : 30;
    const period: BillingPeriod =
      days >= 300 ? 'yearly' : days >= 80 ? 'quarterly' : 'monthly';

    const { data: existingRows } = await admin
      .from('user_subscriptions')
      .select('tier, period, started_at, expires_at')
      .eq('user_id', userId)
      .gte('expires_at', nowISO);

    const currentBest =
      existingRows && existingRows.length > 0
        ? selectBestSubscription(existingRows as Array<Record<string, unknown>>)
        : null;

    const baseMs =
      currentBest && new Date(currentBest.expiresAt).getTime() > nowMs
        ? new Date(currentBest.expiresAt).getTime()
        : nowMs;
    const newExpiresAt = new Date(baseMs + days * 86_400_000).toISOString();
    const bestPaidTier: PaidTier | null = currentBest
      ? currentBest.tier === 'pro'
        ? 'premium'
        : currentBest.tier
      : null;
    const effectiveTier: PaidTier =
      bestPaidTier && (TIER_PRIORITY[bestPaidTier] ?? 0) > (TIER_PRIORITY[normalizedTier] ?? 0)
        ? bestPaidTier
        : normalizedTier;

    const { error } = await admin.from('user_subscriptions').upsert(
      {
        user_id: userId,
        tier: effectiveTier,
        period,
        started_at: currentBest?.startedAt || nowISO,
        expires_at: newExpiresAt,
        updated_at: nowISO,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      await admin.from('user_subscriptions').insert({
        user_id: userId,
        tier: effectiveTier,
        period,
        started_at: nowISO,
        expires_at: newExpiresAt,
      });
    }
    return true;
  } catch (err) {
    console.error('activateSubscription lỗi:', err);
    return false;
  }
}
