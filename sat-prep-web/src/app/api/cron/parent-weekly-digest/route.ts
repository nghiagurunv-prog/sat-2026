import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeEqual } from '@/lib/admin-auth';
import { buildParentReport } from '@/lib/parent-report-store';
import { emitMetric } from '@/lib/telemetry';

/**
 * ASYNC PARENT WEEKLY ZNS / WEBHOOK DIGEST CRON (Mục #25 — Gói Ultimate).
 * Chạy 20:00 Chủ Nhật hàng tuần (13:00 UTC) qua Vercel Cron.
 * - Xác thực CRON_SECRET bằng `safeEqual` (fail-closed #G6).
 * - Lọc danh sách học viên gói `ultimate` còn hiệu lực, tổng hợp báo cáo tuần
 *   qua `buildParentReport()` và đẩy sang `PARENT_DIGEST_WEBHOOK_URL` (ZNS / Bot bridge).
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET chưa được cấu hình.' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token || !safeEqual(token, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const nowIso = new Date().toISOString();
    const admin = createAdminClient();
    const { data: subs, error } = await admin
      .from('user_subscriptions')
      .select('user_id, tier, expires_at')
      .eq('tier', 'ultimate')
      .gt('expires_at', nowIso)
      .limit(200);

    if (error) {
      emitMetric('cron_parent_digest_error', 1, { reason: error.code || 'db_error' });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const webhookUrl = process.env.PARENT_DIGEST_WEBHOOK_URL?.trim();
    const users = (subs ?? []) as Array<{ user_id: string }>;
    let processed = 0;
    let delivered = 0;
    const BATCH_SIZE = 10;

    // Xử lý song song theo lô (batch 10) để tránh vượt timeout Vercel khi nhiều học viên Ultimate
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (u) => {
          const report = await buildParentReport(u.user_id);
          let sent = false;
          if (webhookUrl && report) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000);
            try {
              const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  channel: 'zns_parent_weekly_digest',
                  brand: 'SAT.Guru',
                  studentId: u.user_id,
                  generatedAt: nowIso,
                  report,
                }),
                signal: controller.signal,
              });
              sent = res.ok;
            } finally {
              clearTimeout(timer);
            }
          }
          return { sent };
        })
      );

      for (let idx = 0; idx < results.length; idx++) {
        const r = results[idx];
        if (r.status === 'fulfilled') {
          processed++;
          if (r.value.sent) delivered++;
        } else {
          console.warn(`[cron/parent-weekly-digest] Lỗi xử lý user ${batch[idx]?.user_id}:`, r.reason);
        }
      }
    }

    emitMetric('cron_parent_digest_run', processed, { delivered, webhookConfigured: Boolean(webhookUrl) });
    return NextResponse.json({
      ok: true,
      eligibleUltimateUsers: users.length,
      processed,
      delivered,
      webhookConfigured: Boolean(webhookUrl),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
