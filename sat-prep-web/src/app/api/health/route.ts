import { NextResponse } from 'next/server';
import { isPayosConfigured } from '@/lib/payment-payos';
import { isStripeConfigured } from '@/lib/payment-stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * ============================================================================
 *  HEALTHCHECK ENDPOINT — /api/health (Commercial Monitoring & Uptime Probe)
 * ============================================================================
 *  Chỉ trả boolean readiness flags (tuyệt đối KHÔNG lộ giá trị biến môi trường
 *  hay chi tiết nội bộ). Dùng cho UptimeRobot / BetterStack / Vercel Checks.
 * ============================================================================
 */
export async function GET() {
  const startedAt = Date.now();
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasSupabaseAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const hasSupabaseService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const hasAiProvider = Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
  const hasCronSecret = Boolean(process.env.CRON_SECRET?.trim());
  const hasAdminSecret = Boolean(process.env.ADMIN_SECRET?.trim());

  let dbReachable = false;
  if (hasSupabaseUrl && hasSupabaseService) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from('questions').select('id').limit(1);
      dbReachable = !error || error.code === '42P01';
    } catch {
      dbReachable = false;
    }
  }

  const coreReady = hasSupabaseUrl && hasSupabaseAnon;
  const status = coreReady ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      ok: coreReady,
      status,
      service: 'sat-guru-web',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks: {
        supabaseConfigured: hasSupabaseUrl && hasSupabaseAnon && hasSupabaseService,
        dbReachable,
        aiConfigured: hasAiProvider,
        paymentPayosConfigured: isPayosConfigured(),
        paymentStripeConfigured: isStripeConfigured(),
        distributedRateLimitConfigured: hasUpstash,
        cronSecretConfigured: hasCronSecret,
        adminSecretConfigured: hasAdminSecret,
      },
    },
    {
      status: coreReady ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
