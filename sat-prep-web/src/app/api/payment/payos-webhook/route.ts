import { NextResponse } from 'next/server';
import { verifyPayosWebhook, isPayosSuccess } from '@/lib/payment-payos';
import { confirmPaymentAtomic } from '@/lib/payment-store';

/**
 * ============================================================================
 *  PAYOS WEBHOOK — server-to-server (AUTHORITATIVE)
 * ============================================================================
 *  payOS gọi POST JSON sau khi user quét QR chuyển khoản. ĐÂY là nguồn sự thật
 *  để cấp gói (KHÔNG phải returnUrl — browser giả mạo được).
 *
 *  Body: { code, desc, success, data:{ orderCode, amount, reference, ... }, signature }
 *  Chữ ký = HMAC-SHA256(checksumKey, sort-alphabet mọi field trong `data`).
 *
 *  Luồng: verify chữ ký → code==='00' → confirm_payment ATOMIC (lật paid + cấp
 *  gói nguyên tử). payOS mong HTTP 200 + body { success: true } khi nhận xong.
 * ============================================================================
 */

interface PayosWebhookData {
  orderCode?: number | string;
  amount?: number | string;
  reference?: string;
  [k: string]: unknown;
}

interface PayosWebhookPayload {
  code?: string | number;
  desc?: string;
  success?: boolean;
  data?: PayosWebhookData | null;
  signature?: string;
}

export async function POST(req: Request) {
  try {
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!checksumKey) {
      // Cổng chưa cấu hình → báo lỗi để payOS retry sau khi set env.
      return NextResponse.json({ success: false, message: 'payOS chưa cấu hình' }, { status: 503 });
    }

    const payload = (await req.json()) as PayosWebhookPayload;

    // 1) Verify chữ ký — sai → từ chối, KHÔNG xử lý (chống giả mạo webhook).
    if (!payload?.data || !verifyPayosWebhook(payload.data as Record<string, unknown>, String(payload.signature ?? ''), checksumKey)) {
      return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 400 });
    }

    // 2) code !== '00' → giao dịch thất bại/hủy → không cấp gói, trả 200 để payOS dừng.
    if (!isPayosSuccess(payload.code)) {
      return NextResponse.json({ success: true, message: 'ignored non-success' });
    }

    // 3) Xác nhận atomic (kiểm tiền + idempotent + hỗ trợ pending/expired).
    // orderCode số → String khớp order_id.
    const orderId = String(payload.data?.orderCode ?? '');
    const gatewayTxnId = String(payload.data?.reference ?? '');
    const amountVnd = Number(payload.data?.amount ?? 0);
    const outcome = await confirmPaymentAtomic(orderId, gatewayTxnId, amountVnd);

    // 4) GÓI ĐÃ ĐƯỢC CẤP NGUYÊN TỬ trong confirm_payment RPC (cùng transaction với
    //    UPDATE status='paid') → không cấp gói tách rời ở đây.
    //    Hỗ trợ khôi phục đơn 'expired' khi tiền thật về, và bảo đảm idempotent.

    // 4.1) Đơn đã thanh toán trước đó (order.status === 'paid') → idempotent ack, không cộng dồn trùng
    if (outcome.alreadyConfirmed) {
      return NextResponse.json({ success: true, received: true, alreadyPaid: true });
    }

    // 4.2) Kiểm tra lỗi xác nhận
    if (!outcome.ok) {
      if (outcome.reason === 'amount_mismatch') {
        console.warn(`[payos-webhook] Số tiền chuyển không đủ hoặc không khớp: orderId=${orderId}, nhận ${amountVnd} VND`);
        return NextResponse.json({ success: true, received: true, reason: 'amount_mismatch' }, { status: 200 });
      }
      if (outcome.reason === 'not_found') {
        console.warn(`[payos-webhook] Không tìm thấy đơn hàng: orderId=${orderId}`);
        return NextResponse.json({ success: true, received: true, reason: 'not_found' }, { status: 200 });
      }
      // Lỗi hệ thống / cập nhật DB thất bại → trả 500 để payOS tự động retry
      console.error(`[payos-webhook] Lỗi hệ thống khi xác nhận thanh toán orderId=${orderId}:`, outcome.reason);
      return NextResponse.json({ success: false, message: 'Confirm failed, retry' }, { status: 500 });
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error('Lỗi payos-webhook:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
