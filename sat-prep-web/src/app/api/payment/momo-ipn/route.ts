import { NextResponse } from 'next/server';
import { verifyMomoIpnSignature, isMomoSuccess, type MomoIpnPayload } from '@/lib/payment-momo';
import { confirmPaymentAtomic } from '@/lib/payment-store';

/**
 * ============================================================================
 *  MOMO IPN — Phase 2 Bước 2 (server-to-server, AUTHORITATIVE)
 * ============================================================================
 *  MoMo gọi POST JSON sau khi user thanh toán. ĐÂY là nguồn sự thật để cấp gói
 *  (KHÔNG phải redirectUrl — browser giả mạo được).
 *
 *  Luồng: verify chữ ký HMAC-SHA256 (accessKey + secretKey server-side) →
 *  resultCode===0 → confirm_payment ATOMIC (lật paid + CẤP GÓI nguyên tử — A2).
 *  MoMo mong HTTP 204 (No Content) khi đã nhận IPN thành công.
 *
 *  ⚠️ MUST-VERIFY khi có creds: thứ tự field rawSignature IPN (payment-momo.ts).
 * ============================================================================
 */

export async function POST(req: Request) {
  try {
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    if (!accessKey || !secretKey) {
      // Cổng chưa cấu hình → báo lỗi để MoMo retry sau khi set env.
      return NextResponse.json({ message: 'MoMo chưa cấu hình' }, { status: 503 });
    }

    const payload = (await req.json()) as MomoIpnPayload;

    // 1) Verify chữ ký — sai → từ chối, KHÔNG xử lý.
    if (!verifyMomoIpnSignature(payload, accessKey, secretKey)) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    // 2) resultCode !== 0 → giao dịch thất bại/hủy → không cấp gói (trả 204 để MoMo dừng).
    if (!isMomoSuccess(payload.resultCode)) {
      return new NextResponse(null, { status: 204 });
    }

    // 3) Xác nhận atomic (kiểm tiền + idempotent + hỗ trợ pending/expired).
    const orderId = String(payload.orderId ?? '');
    const gatewayTxnId = String(payload.transId ?? '');
    const amountVnd = Number(payload.amount ?? 0);
    const outcome = await confirmPaymentAtomic(orderId, gatewayTxnId, amountVnd);

    // 4) A2: GÓI ĐÃ ĐƯỢC CẤP NGUYÊN TỬ trong confirm_payment RPC (cùng transaction
    //    với UPDATE status='paid') → KHÔNG cấp gói tách rời ở đây. Vá lỗ tiền: trước
    //    đây grant rời (grantSubscription, nay đã gỡ) có thể fail sau khi đơn 'paid'.
    //    Hỗ trợ khôi phục đơn 'expired' khi tiền thật về, và bảo đảm idempotent.

    // 4.1) Idempotent: Nếu đơn đã thanh toán trước đó (order.status === 'paid'), bỏ qua không cộng trùng
    if (outcome.alreadyConfirmed) {
      return new NextResponse(null, { status: 204 });
    }

    // 4.2) Kiểm tra lỗi xác nhận
    if (!outcome.ok) {
      if (outcome.reason === 'amount_mismatch') {
        console.warn(`[momo-ipn] Số tiền không khớp hoặc không đủ cho đơn orderId=${orderId}: nhận ${amountVnd} VND`);
        return NextResponse.json({ message: 'Amount mismatch or insufficient' }, { status: 400 });
      }
      if (outcome.reason === 'not_found') {
        console.warn(`[momo-ipn] Không tìm thấy đơn hàng: orderId=${orderId}`);
        return NextResponse.json({ message: 'Order not found' }, { status: 404 });
      }
      // MoMo: Lỗi hệ thống / DB thất bại → 500 để MoMo retry
      console.error(`[momo-ipn] Lỗi hệ thống khi xác nhận thanh toán orderId=${orderId}:`, outcome.reason);
      return NextResponse.json({ message: 'Confirm failed, retry' }, { status: 500 });
    }

    // MoMo: 204 = đã nhận IPN và xử lý thành công
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Lỗi momo-ipn:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
