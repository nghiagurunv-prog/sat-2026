import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeEqual } from '@/lib/admin-auth';
import { emitMetric } from '@/lib/telemetry';

/**
 * VERCEL CRON — Dọn rác bảng `issued_questions` chưa trả lời quá 48 giờ (Mục #4).
 * Fail-closed: yêu cầu Authorization: Bearer <CRON_SECRET> timing-safe (#G6).
 */
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
    const cutoffIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('issued_questions')
      .delete()
      .eq('answered', false)
      .lt('created_at', cutoffIso)
      .select('id');

    if (error) {
      console.error('[cron/cleanup-issued] Supabase delete error:', error.message);
      emitMetric('cron_cleanup_issued_error', 1, { reason: error.code || 'db_error' });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const deleted = Array.isArray(data) ? data.length : 0;
    emitMetric('cron_cleanup_issued_deleted', deleted);
    return NextResponse.json({ ok: true, deleted, cutoff: cutoffIso });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error';
    console.error('[cron/cleanup-issued] Unexpected error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
