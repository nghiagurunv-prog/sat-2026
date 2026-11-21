import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin, logAdminAudit } from '@/lib/admin-auth';
import { confirmPaymentAtomic } from '@/lib/payment-store';
import { activateSubscription } from '@/lib/subscription-store';
import * as subscriptionModule from '@/lib/subscription';
import { emitMetric } from '@/lib/telemetry';

/**
 * ============================================================================
 *  ADMIN ORDERS API — Nguồn sự thật duy nhất: `payment_transactions` (Mục #2)
 * ============================================================================
 *  Đồng bộ 100% với `payment-store.ts` & các cổng PayOS / VNPay / MoMo / Stripe
 *  (loại bỏ Dual-Source Table Drift với bảng cũ `payment_orders`).
 *
 *  GET  → Truy vấn danh sách giao dịch từ `payment_transactions` (created_at DESC),
 *         trả kèm các alias UI tương thích (`order_code`, `amount`, `plan_id`).
 *  POST → Duyệt đơn tay ('approve') qua `confirmPaymentAtomic` nguyên tử (hoặc CAS
 *         fallback nếu môi trường chưa cài RPC) / hủy đơn ('cancel').
 * ============================================================================
 */

interface RawPaymentTxnRow {
  id?: string;
  order_id: string;
  user_id?: string;
  gateway?: string;
  tier?: string;
  period?: string;
  amount_vnd?: number;
  duration_days?: number;
  status?: string;
  gateway_txn_id?: string | null;
  created_at?: string;
  paid_at?: string | null;
  [key: string]: unknown;
}

function normalizeOrderForUi(row: RawPaymentTxnRow) {
  return {
    ...row,
    id: row.id ?? row.order_id,
    order_code: row.order_id,
    amount: row.amount_vnd ?? 0,
    plan_id: row.tier ?? 'premium',
  };
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

    const supabase = createAdminClient();
    let query = supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(isNaN(limit) || limit <= 0 ? 50 : Math.min(limit, 200));

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const normalized = ((data || []) as RawPaymentTxnRow[]).map(normalizeOrderForUi);
    return NextResponse.json({ success: true, orders: normalized });
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

    const rawIdentifier =
      payload?.orderCode !== undefined && payload?.orderCode !== null && String(payload.orderCode).trim() !== ''
        ? String(payload.orderCode).trim()
        : payload?.orderId !== undefined && payload?.orderId !== null && String(payload.orderId).trim() !== ''
          ? String(payload.orderId).trim()
          : '';
    const note = typeof payload?.note === 'string' ? payload.note.slice(0, 500) : '';

    if (!rawIdentifier) {
      return NextResponse.json(
        { success: false, error: 'Thiếu orderId hoặc orderCode.' },
        { status: 400 }
      );
    }

    // Validate nghiêm ngặt chống PostgREST filter injection
    const safeIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!safeIdPattern.test(rawIdentifier)) {
      return NextResponse.json({ success: false, error: 'Định dạng orderId/orderCode không hợp lệ.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    let query = supabase.from('payment_transactions').select('*');
    if (uuidPattern.test(rawIdentifier)) {
      query = query.or(`id.eq.${rawIdentifier},order_id.eq.${rawIdentifier}`);
    } else {
      query = query.eq('order_id', rawIdentifier);
    }

    const { data: orders, error: fetchErr } = await query.limit(1);
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    const order = (orders?.[0] ?? null) as RawPaymentTxnRow | null;
    if (!order) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng.' }, { status: 404 });
    }

    const canonicalOrderId = String(order.order_id);

    if (action === 'approve') {
      if (order.status === 'paid') {
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          action: 'approve',
          orderId: order.id ?? canonicalOrderId,
          orderCode: canonicalOrderId,
          status: 'paid',
          message: 'Đơn hàng này đã được duyệt/thanh toán trước đó.',
        });
      }

      // Ưu tiên 1: RPC confirm_payment nguyên tử (cùng đường với PayOS/VNPay/MoMo/Stripe)
      const adminRef = `admin:${auth.actor || 'manual'}:${Date.now()}`;
      const outcome = await confirmPaymentAtomic(canonicalOrderId, adminRef, Number(order.amount_vnd ?? 0));

      if (outcome.alreadyConfirmed) {
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          action: 'approve',
          orderId: order.id ?? canonicalOrderId,
          orderCode: canonicalOrderId,
          status: 'paid',
          message: 'Đơn hàng vừa được xác nhận bởi tiến trình khác.',
        });
      }

      if (!outcome.ok) {
        if (outcome.reason === 'confirm_unavailable') {
          // Fallback CAS nguyên tử nếu môi trường dev chưa chạy RPC confirm_payment (chỉ cho phép pending/expired)
          const { data: updatedRows, error: updateErr } = await supabase
            .from('payment_transactions')
            .update({
              status: 'paid',
              gateway_txn_id: adminRef,
              paid_at: new Date().toISOString(),
            })
            .eq('order_id', canonicalOrderId)
            .in('status', ['pending', 'expired'])
            .select('order_id');

          if (updateErr) {
            return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
          }
          if (!updatedRows || updatedRows.length === 0) {
            return NextResponse.json({
              success: true,
              alreadyPaid: true,
              action: 'approve',
              orderId: order.id ?? canonicalOrderId,
              orderCode: canonicalOrderId,
              status: 'paid',
              message: 'Đơn hàng vừa được xác nhận bởi tiến trình khác.',
            });
          }

          const userId = order.user_id;
          const tier = order.tier || 'premium';
          let durationDays = Number(order.duration_days || 0);
          if (!durationDays) {
            const subMod = subscriptionModule as Record<string, unknown>;
            const PLANS = subMod.PLANS as Record<string, { durationDays?: number }> | undefined;
            durationDays = PLANS?.[tier]?.durationDays || 30;
          }
          if (userId) {
            await activateSubscription(userId, tier, durationDays, canonicalOrderId);
          }
        } else {
          emitMetric('admin_order_approve_failed', 1, { reason: outcome.reason });
          return NextResponse.json(
            { success: false, error: `Không thể duyệt đơn hàng (${outcome.reason}).` },
            { status: 500 }
          );
        }
      }

      emitMetric('admin_order_approved', 1, { gateway: order.gateway || 'manual', amountVnd: order.amount_vnd || 0 });
      await logAdminAudit(auth.actor || 'admin', 'order_approve', canonicalOrderId, {
        note: note || undefined,
        orderCode: canonicalOrderId,
        userId: order.user_id,
        tier: order.tier,
        durationDays: order.duration_days,
      });

      return NextResponse.json({
        success: true,
        action: 'approve',
        orderId: order.id ?? canonicalOrderId,
        orderCode: canonicalOrderId,
        status: 'paid',
      });
    } else {
      // action === 'cancel' — chỉ hủy khi chưa paid
      if (order.status === 'paid') {
        return NextResponse.json(
          { success: false, error: 'Không thể hủy đơn hàng đã thanh toán.' },
          { status: 409 }
        );
      }

      const { data: cancelledRows, error: updateErr } = await supabase
        .from('payment_transactions')
        .update({ status: 'failed' })
        .eq('order_id', canonicalOrderId)
        .neq('status', 'paid')
        .select('order_id');

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }
      if (!cancelledRows || cancelledRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Đơn hàng vừa được thanh toán bởi cổng thanh toán, không thể hủy.' },
          { status: 409 }
        );
      }

      emitMetric('admin_order_cancelled', 1, { gateway: order.gateway || 'manual' });
      await logAdminAudit(auth.actor || 'admin', 'order_cancel', canonicalOrderId, {
        note: note || undefined,
        orderCode: canonicalOrderId,
      });

      return NextResponse.json({
        success: true,
        action: 'cancel',
        orderId: order.id ?? canonicalOrderId,
        orderCode: canonicalOrderId,
        status: 'failed',
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
