import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeEqual } from '@/lib/admin-auth';
import { sendAlertIfConfigured } from '@/lib/telemetry';
import { OFFICIAL_SITE_URL } from '@/lib/subscription';

export const maxDuration = 60;

/**
 * ABANDONED CHECKOUT RECOVERY CRON (W3 #26 — Khôi phục đơn hàng bỏ dở 30p–24h).
 * Quét bảng `payment_transactions` có status='pending', tạo từ 30 phút đến 24 giờ trước
 * và chưa gửi nhắc (`recovery_notified_at IS NULL`), gửi webhook nhắc kèm link hoàn tất 1-chạm.
 * Bảo mật Fail-Closed: timing-safe Bearer CRON_SECRET.
 */

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!secret || !safeEqual(token, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const olderThanIso = new Date(now - 30 * 60_000).toISOString();
  const newerThanIso = new Date(now - 24 * 60 * 60_000).toISOString();

  try {
    const admin = createAdminClient();
    const { data: pendingOrders, error } = await admin
      .from('payment_transactions')
      .select('order_id, user_id, tier, period, amount_vnd, created_at')
      .eq('status', 'pending')
      .is('recovery_notified_at', null)
      .lte('created_at', olderThanIso)
      .gte('created_at', newerThanIso)
      .limit(50);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const orders = (pendingOrders ?? []) as Array<{
      order_id: string;
      user_id: string;
      tier: string;
      period: string;
      amount_vnd: number;
      created_at: string;
    }>;

    const results = await Promise.allSettled(
      orders.map(async (ord) => {
        const resumeUrl = `${OFFICIAL_SITE_URL}/upgrade?resumeOrder=${encodeURIComponent(ord.order_id)}`;
        await sendAlertIfConfigured('abandoned_checkout_recovery', {
          orderId: ord.order_id,
          tier: ord.tier,
          period: ord.period,
          amountVnd: ord.amount_vnd,
          resumeUrl,
        });
        await admin
          .from('payment_transactions')
          .update({ recovery_notified_at: new Date().toISOString() })
          .eq('order_id', ord.order_id)
          .eq('status', 'pending');
        return ord.order_id;
      })
    );

    const notified = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({
      ok: true,
      scanned: orders.length,
      notified,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Cron abandoned-checkout error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
