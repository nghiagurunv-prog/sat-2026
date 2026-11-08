import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin, logAdminAudit } from '@/lib/admin-auth';
import { activateSubscription } from '@/lib/subscription-store';
import * as subscriptionModule from '@/lib/subscription';

/**
 * ============================================================================
 *  ADMIN ORDERS API — Quản lý đơn hàng thanh toán gói cước (payment_orders)
 * ============================================================================
 *  Bảo vệ bằng verifyAdmin (x-admin-secret hoặc session role admin).
 *
 *  GET  → Truy vấn danh sách đơn hàng từ bảng payment_orders (created_at DESC,
 *         hỗ trợ lọc status, limit mặc định 50) qua Supabase Service Role client.
 *  POST → Duyệt đơn tay ('approve') hoặc hủy đơn ('cancel'):
 *         - approve: Kích hoạt gói qua activateSubscription + cập nhật payment_orders.status = 'paid'.
 *         - cancel : Cập nhật payment_orders.status = 'cancelled'.
 *         - Ghi audit log qua logAdminAudit(auth.actor, `order_${action}`, orderId, ...).
 * ============================================================================
 */

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Thiếu cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const supabase = getAdminSupabase();
    let query = supabase
      .from('payment_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(isNaN(limit) || limit <= 0 ? 50 : limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, orders: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi truy vấn danh sách đơn hàng.';
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
      orderId?: string | number;
      orderCode?: string | number;
      action?: string;
      note?: string;
    };

    const action = payload?.action;
    if (action !== 'approve' && action !== 'cancel') {
      return NextResponse.json(
        { success: false, error: 'Hành động không hợp lệ. Chỉ chấp nhận action là approve hoặc cancel.' },
        { status: 400 }
      );
    }

    const orderId = payload?.orderId;
    const orderCode = payload?.orderCode;
    const note = typeof payload?.note === 'string' ? payload.note : '';

    if (!orderId && !orderCode) {
      return NextResponse.json(
        { success: false, error: 'Thiếu orderId hoặc orderCode.' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();

    let query = supabase.from('payment_orders').select('*');
    if (orderId) {
      query = query.or(`id.eq.${orderId},order_code.eq.${orderId}`);
    } else {
      query = query.eq('order_code', String(orderCode));
    }

    const { data: orders, error: fetchErr } = await query.limit(1);
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    const order = orders?.[0];
    if (!order) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng.' }, { status: 404 });
    }

    const targetOrderId = String(order.id || orderId || orderCode);

    if (action === 'approve') {
      const userId = order.user_id || order.userId;
      const planId = order.plan_id || order.planId;

      let durationDays = order.duration_days || order.durationDays || order.metadata?.durationDays;
      if (!durationDays && planId) {
        const getPlanById = (subscriptionModule as any).getPlanById;
        const PLANS = (subscriptionModule as any).PLANS;
        const plan = (typeof getPlanById === 'function' ? getPlanById(planId) : null) || (PLANS as any)?.[planId];
        durationDays = plan?.durationDays || plan?.days || 30;
      }
      if (!durationDays) {
        durationDays = 30;
      }

      if (userId && planId) {
        await activateSubscription(userId, planId, Number(durationDays), targetOrderId);
      }

      const { error: updateErr } = await supabase
        .from('payment_orders')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
          ...(note ? { admin_note: note } : {}),
        })
        .eq('id', order.id);

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }

      await logAdminAudit(
        auth.actor || 'admin',
        'order_approve',
        targetOrderId,
        {
          note: note || undefined,
          orderCode: order.order_code,
          userId,
          planId,
          durationDays,
        }
      );

      return NextResponse.json({
        success: true,
        action: 'approve',
        orderId: order.id,
        orderCode: order.order_code,
        status: 'paid',
      });
    } else {
      // action === 'cancel'
      const { error: updateErr } = await supabase
        .from('payment_orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          ...(note ? { admin_note: note } : {}),
        })
        .eq('id', order.id);

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }

      await logAdminAudit(
        auth.actor || 'admin',
        'order_cancel',
        targetOrderId,
        {
          note: note || undefined,
          orderCode: order.order_code,
        }
      );

      return NextResponse.json({
        success: true,
        action: 'cancel',
        orderId: order.id,
        orderCode: order.order_code,
        status: 'cancelled',
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi xử lý đơn hàng.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  return POST(req);
}
