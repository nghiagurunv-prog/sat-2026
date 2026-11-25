import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import {
  applySubscriptionFreeze,
  canFreezeSubscription,
  isSubscriptionFrozen,
  SUBSCRIPTION_FREEZE_MAX_DAYS,
  SUBSCRIPTION_FREEZE_MIN_DAYS,
  type FreezableSubscription,
  type PaidTier,
  type BillingPeriod,
} from '@/lib/subscription';

/**
 * SUBSCRIPTION FREEZE API (W2 #25 — Đóng băng gói học 7–14 ngày mùa thi học kỳ).
 * Chuẩn #G8: kiểm tra điều kiện & cộng dồn ngày bằng hàm domain thuần trong subscription.ts.
 *
 * GET  → Trạng thái gói & quyền bảo lưu hiện tại của học sinh.
 * POST { days: 7..14 } → Bảo lưu 1 lần cho chu kỳ gói hiện tại, gia hạn expires_at tương ứng.
 */

function mapRowToFreezable(row: Record<string, unknown>): FreezableSubscription {
  return {
    tier: (row.tier as PaidTier) || 'premium',
    period: (row.period as BillingPeriod) || 'monthly',
    startedAt: String(row.started_at ?? new Date().toISOString()),
    expiresAt: String(row.expires_at ?? ''),
    freezeUsed: Boolean(row.freeze_used),
    frozenFrom: typeof row.frozen_from === 'string' ? row.frozen_from : null,
    frozenUntil: typeof row.frozen_until === 'string' ? row.frozen_until : null,
    frozenDays: typeof row.frozen_days === 'number' ? row.frozen_days : 0,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_subscriptions')
      .select('tier, period, started_at, expires_at, freeze_used, frozen_from, frozen_until, frozen_days')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({
        hasSubscription: false,
        canFreeze: false,
        isFrozen: false,
        minDays: SUBSCRIPTION_FREEZE_MIN_DAYS,
        maxDays: SUBSCRIPTION_FREEZE_MAX_DAYS,
      });
    }

    const nowISO = new Date().toISOString();
    const sub = mapRowToFreezable(data as Record<string, unknown>);
    const check = canFreezeSubscription(sub, SUBSCRIPTION_FREEZE_MIN_DAYS, nowISO);

    return NextResponse.json({
      hasSubscription: true,
      tier: sub.tier,
      expiresAt: sub.expiresAt,
      freezeUsed: Boolean(sub.freezeUsed),
      isFrozen: isSubscriptionFrozen(sub, nowISO),
      frozenUntil: sub.frozenUntil,
      frozenDays: sub.frozenDays ?? 0,
      canFreeze: check.allowed,
      reason: check.reason ?? null,
      minDays: SUBSCRIPTION_FREEZE_MIN_DAYS,
      maxDays: SUBSCRIPTION_FREEZE_MAX_DAYS,
    });
  } catch (err) {
    console.error('GET /api/subscription/freeze:', err);
    return NextResponse.json({ error: 'Không thể tải trạng thái bảo lưu.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để bảo lưu gói học.' }, { status: 401 });
  }

  const rl = await rateLimitDistributed(getRateLimitKey(req, 'sub-freeze', user.id), 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Thao tác quá nhanh. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const days = Number(body?.days ?? 7);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_subscriptions')
      .select('tier, period, started_at, expires_at, freeze_used, frozen_from, frozen_until, frozen_days')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Bạn chưa có gói trả phí đang hoạt động để bảo lưu.' }, { status: 404 });
    }

    const nowISO = new Date().toISOString();
    const sub = mapRowToFreezable(data as Record<string, unknown>);
    const outcome = applySubscriptionFreeze(sub, days, nowISO);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.reason }, { status: 400 });
    }

    const { data: updatedRow, error: updErr } = await admin
      .from('user_subscriptions')
      .update({
        expires_at: outcome.updated.expiresAt,
        freeze_used: true,
        frozen_from: outcome.updated.frozenFrom,
        frozen_until: outcome.updated.frozenUntil,
        frozen_days: outcome.updated.frozenDays,
      })
      .eq('user_id', user.id)
      .eq('freeze_used', false)
      .select('user_id')
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ error: 'Không thể cập nhật trạng thái bảo lưu. Vui lòng thử lại.' }, { status: 500 });
    }
    if (!updatedRow) {
      return NextResponse.json({ error: 'Gói học của bạn đã được bảo lưu trước đó.' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      frozenDays: outcome.updated.frozenDays,
      frozenUntil: outcome.updated.frozenUntil,
      newExpiresAt: outcome.updated.expiresAt,
      message: `Đã bảo lưu gói học ${outcome.updated.frozenDays} ngày thành công! Hạn mới của bạn đã được cộng thêm tương ứng.`,
    });
  } catch (err) {
    console.error('POST /api/subscription/freeze:', err);
    return NextResponse.json({ error: 'Lỗi hệ thống khi bảo lưu gói.' }, { status: 500 });
  }
}
