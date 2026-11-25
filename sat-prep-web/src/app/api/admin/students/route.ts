import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin, logAdminAudit } from '@/lib/admin-auth';
import { activateSubscription } from '@/lib/subscription-store';
import { emitMetric } from '@/lib/telemetry';

/**
 * ============================================================================
 *  ADMIN STUDENTS & CRM API — /api/admin/students (Server-Authoritative)
 * ============================================================================
 *  Đóng chốt chặn P0-3: thay toàn bộ thao tác client-only trên /admin bằng
 *  API thật ghi thẳng vào Supabase (service_role) kèm `admin_audit_logs`.
 *
 *  GET  → Đọc danh sách học viên thật (user_profiles + user_subscriptions +
 *         user_economy + user_goals).
 *  POST → Hỗ trợ 3 action:
 *         - 'manual_vip': Kích hoạt gói VIP theo userId hoặc email + days + plan
 *         - 'extend_vip': Gia hạn thêm ngày VIP cho userId
 *         - 'reward_coins': Cộng Xu trực tiếp vào user_economy cho userId
 * ============================================================================
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUserIdFromTarget(
  admin: ReturnType<typeof createAdminClient>,
  target: string
): Promise<{ userId: string; email?: string } | null> {
  const clean = target.trim();
  if (!clean) return null;
  if (UUID_REGEX.test(clean)) {
    return { userId: clean };
  }

  // Tra cứu user_id theo email thông qua Supabase Auth Admin API
  try {
    const authApi = (admin as unknown as {
      auth?: { admin?: { listUsers?: (opts: { page: number; perPage: number }) => Promise<{ data?: { users?: Array<{ id: string; email?: string }> } }> } };
    }).auth?.admin;

    if (authApi?.listUsers) {
      const lower = clean.toLowerCase();
      for (let page = 1; page <= 5; page++) {
        const res = await authApi.listUsers({ page, perPage: 200 });
        const users = res?.data?.users ?? [];
        const match = users.find((u) => (u.email || '').toLowerCase() === lower);
        if (match) {
          return { userId: match.id, email: match.email };
        }
        if (users.length < 200) break;
      }
    }
  } catch (err) {
    console.warn('[api/admin/students] resolveUserIdFromTarget error:', err);
  }
  return null;
}

export async function GET(req: Request) {
  const auth = await verifyAdmin(req as NextRequest);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Không có quyền truy cập.' },
      { status: auth.status || 403 }
    );
  }

  try {
    const supabase = createAdminClient();
    const [profilesRes, subsRes, ecoRes, goalsRes] = await Promise.all([
      supabase.from('user_profiles').select('user_id, display_name, school_name, updated_at').limit(200),
      supabase.from('user_subscriptions').select('user_id, tier, period, expires_at').limit(200),
      supabase.from('user_economy').select('user_id, coins, xp, updated_at').limit(200),
      supabase.from('user_goals').select('user_id, target_score').limit(200),
    ]);

    const subMap = new Map<string, { tier?: string; expires_at?: string }>();
    for (const s of (subsRes.data ?? []) as Array<{ user_id: string; tier?: string; expires_at?: string }>) {
      subMap.set(s.user_id, s);
    }

    const ecoMap = new Map<string, { coins?: number; xp?: number; updated_at?: string }>();
    for (const e of (ecoRes.data ?? []) as Array<{ user_id: string; coins?: number; xp?: number; updated_at?: string }>) {
      ecoMap.set(e.user_id, e);
    }

    const goalMap = new Map<string, number>();
    for (const g of (goalsRes.data ?? []) as Array<{ user_id: string; target_score?: number }>) {
      if (typeof g.target_score === 'number') goalMap.set(g.user_id, g.target_score);
    }

    const profileMap = new Map<string, { display_name?: string; school_name?: string; updated_at?: string }>();
    for (const p of (profilesRes.data ?? []) as Array<{ user_id: string; display_name?: string; school_name?: string; updated_at?: string }>) {
      profileMap.set(p.user_id, p);
    }

    const allIds = Array.from(new Set([
      ...profileMap.keys(),
      ...subMap.keys(),
      ...ecoMap.keys(),
    ]));

    const nowMs = Date.now();
    const students = allIds.map((uid) => {
      const prof = profileMap.get(uid);
      const sub = subMap.get(uid);
      const eco = ecoMap.get(uid);
      const expMs = sub?.expires_at ? new Date(sub.expires_at).getTime() : 0;
      const isVip = expMs > nowMs;
      const vipStatus: 'ACTIVE' | 'EXPIRED' | 'TRIAL' = isVip ? 'ACTIVE' : sub?.expires_at ? 'EXPIRED' : 'TRIAL';
      const vipExpiry = sub?.expires_at ? String(sub.expires_at).slice(0, 10) : '—';
      const lastUpdated = prof?.updated_at || eco?.updated_at;
      const lastActiveDaysAgo = lastUpdated
        ? Math.max(0, Math.floor((nowMs - new Date(lastUpdated).getTime()) / 86_400_000))
        : 0;

      return {
        id: uid,
        name: prof?.display_name || `Học viên ${uid.slice(0, 6)}`,
        email: `${uid.slice(0, 8)}@user.sat.guru`,
        phone: 'Chưa cập nhật',
        targetScore: goalMap.get(uid) ?? 1450,
        predictedScore: 0,
        vipStatus,
        vipExpiry,
        coins: Number(eco?.coins ?? 0),
        mockTestsDone: 0,
        accuracy: 0,
        classCode: prof?.school_name || 'SAT-GENERAL',
        lastActiveDaysAgo,
        riskLevel: (lastActiveDaysAgo >= 6 ? 'HIGH' : lastActiveDaysAgo >= 3 ? 'MEDIUM' : 'SAFE') as 'HIGH' | 'MEDIUM' | 'SAFE',
      };
    });

    return NextResponse.json({ success: true, students });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi truy vấn danh sách học viên.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req as NextRequest);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Không có quyền truy cập.' },
      { status: auth.status || 403 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'JSON không hợp lệ.' }, { status: 400 });
    }

    const payload = body as {
      action?: string;
      userId?: string;
      target?: string;
      plan?: string;
      days?: number;
      amount?: number;
      note?: string;
    };

    const action = payload?.action;
    const supabase = createAdminClient();

    if (action === 'manual_vip' || action === 'extend_vip') {
      const rawTarget = String(payload?.userId || payload?.target || '').trim();
      const days = Math.floor(Number(payload?.days ?? 30));
      const rawPlan = String(payload?.plan || 'premium').toLowerCase();
      const normalizedTier = rawPlan.includes('ultimate') ? 'ultimate' : 'premium';

      if (!rawTarget) {
        return NextResponse.json({ success: false, error: 'Thiếu User ID hoặc Email học viên.' }, { status: 400 });
      }
      if (!Number.isFinite(days) || days < 1 || days > 730) {
        return NextResponse.json({ success: false, error: 'Số ngày kích hoạt phải nằm trong khoảng 1–730 ngày.' }, { status: 400 });
      }

      const resolved = await resolveUserIdFromTarget(supabase, rawTarget);
      if (!resolved) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tài khoản khớp Email / User ID trên Supabase Auth.' },
          { status: 404 }
        );
      }

      const ok = await activateSubscription(resolved.userId, normalizedTier, days);
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Không thể ghi gói VIP vào cơ sở dữ liệu.' }, { status: 500 });
      }

      // Đọc lại expires_at thật vừa được cộng dồn trong DB để UI hiển thị chính xác ngay không cần F5
      const { data: latestSub } = await supabase
        .from('user_subscriptions')
        .select('expires_at')
        .eq('user_id', resolved.userId)
        .maybeSingle();
      const persistedExpiry = (latestSub as { expires_at?: string } | null)?.expires_at;
      const newExpiryDate = persistedExpiry
        ? String(persistedExpiry).slice(0, 10)
        : new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      emitMetric(`admin_${action}`, 1, { tier: normalizedTier, days });
      await logAdminAudit(auth.actor || 'admin', action, resolved.userId, {
        tier: normalizedTier,
        days,
        email: resolved.email,
        note: typeof payload?.note === 'string' ? payload.note.slice(0, 300) : undefined,
      });

      return NextResponse.json({
        success: true,
        action,
        userId: resolved.userId,
        email: resolved.email,
        tier: normalizedTier,
        days,
        vipExpiry: newExpiryDate,
      });
    }

    if (action === 'reward_coins') {
      const rawTarget = String(payload?.userId || payload?.target || '').trim();
      const amount = Math.floor(Number(payload?.amount ?? 0));

      if (!rawTarget) {
        return NextResponse.json({ success: false, error: 'Thiếu User ID học viên.' }, { status: 400 });
      }
      if (!Number.isFinite(amount) || amount < 1 || amount > 100_000) {
        return NextResponse.json({ success: false, error: 'Số Xu thưởng phải trong khoảng 1–100.000.' }, { status: 400 });
      }

      const resolved = await resolveUserIdFromTarget(supabase, rawTarget);
      if (!resolved) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tài khoản học viên để cộng Xu.' },
          { status: 404 }
        );
      }

      const { data: currentEco, error: readErr } = await supabase
        .from('user_economy')
        .select('coins, xp')
        .eq('user_id', resolved.userId)
        .maybeSingle();

      if (readErr) {
        return NextResponse.json({ success: false, error: readErr.message }, { status: 500 });
      }

      const prevCoins = Number((currentEco as { coins?: number } | null)?.coins ?? 100);
      const nextCoins = prevCoins + amount;
      const nowIso = new Date().toISOString();

      const { error: writeErr } = await supabase.from('user_economy').upsert(
        {
          user_id: resolved.userId,
          coins: nextCoins,
          xp: Number((currentEco as { xp?: number } | null)?.xp ?? 0),
          updated_at: nowIso,
        },
        { onConflict: 'user_id' }
      );

      if (writeErr) {
        return NextResponse.json({ success: false, error: writeErr.message }, { status: 500 });
      }

      emitMetric('admin_reward_coins', amount, { userId: resolved.userId });
      await logAdminAudit(auth.actor || 'admin', 'reward_coins', resolved.userId, {
        amount,
        previousCoins: prevCoins,
        newCoins: nextCoins,
      });

      return NextResponse.json({
        success: true,
        action: 'reward_coins',
        userId: resolved.userId,
        amount,
        coins: nextCoins,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Hành động không hợp lệ. Chỉ hỗ trợ manual_vip, extend_vip hoặc reward_coins.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi xử lý thao tác học viên.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
