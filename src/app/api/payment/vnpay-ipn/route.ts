import { NextResponse } from 'next/server';
import {
  IpnSuccess,
  IpnOrderNotFound,
  InpOrderAlreadyConfirmed,
  IpnInvalidAmount,
  IpnFailChecksum,
  IpnUnknownError,
  type ReturnQueryFromVNPay,
} from 'vnpay';
import { verifyVnpayIpn } from '@/lib/payment-vnpay';
import { confirmPaymentAtomic } from '@/lib/payment-store';
import {
  checkWebhookTimestampAnomaly,
  emitMetric,
  isWebhookRecentlyConfirmed,
  markWebhookConfirmed,
} from '@/lib/telemetry';

/**
 * ============================================================================
 *  VNPAY IPN — Phase 2 Bước 2 (server-to-server, AUTHORITATIVE)
 * ============================================================================
 *  VNPay gọi GET với query params sau khi user thanh toán. ĐÂY là nguồn sự thật
 *  để cấp gói (KHÔNG phải Return URL — browser giả mạo được).
 *
 *  Luồng: verify chữ ký HMAC-SHA512 (lib) → confirm_payment ATOMIC (chống double-
 *  grant + kiểm tiền + CẤP GÓI nguyên tử trong cùng transaction — A2).
 *  Trả { RspCode, Message } đúng mã VNPay (tái dụng constants của lib).
 * ============================================================================
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries()) as unknown as ReturnQueryFromVNPay;

    const result = verifyVnpayIpn(query);

    // 1) Chữ ký sai → dữ liệu không toàn vẹn → từ chối.
    if (!result.isVerified) {
      emitMetric('webhook_invalid_signature', 1, { gateway: 'vnpay' });
      return NextResponse.json(IpnFailChecksum);
    }

    // 2) Giao dịch THẤT BẠI/hủy (chữ ký hợp lệ nhưng responseCode≠'00') → KHÔNG
    //    đụng vào đơn (tránh lật pending→'paid' oan, kẹt đơn, nuốt thanh toán
    //    thật sau). Ack IpnSuccess để VNPay dừng retry — đối xứng momo-ipn:38.
    if (!result.isSuccess) {
      return NextResponse.json(IpnSuccess);
    }

    // Mục #8: Giám sát lệch mốc thời gian vnp_PayDate (>24h chỉ cảnh báo, KHÔNG reject retry thật #G8)
    checkWebhookTimestampAnomaly('vnpay', result.orderId, url.searchParams.get('vnp_PayDate'));

    // Edge Dedup Lock (60s): chặn replay flood khi đơn vừa được xác nhận
    const dedupKey = `vnpay:${result.orderId}:${result.gatewayTxnId || result.amountVnd}`;
    if (isWebhookRecentlyConfirmed(dedupKey)) {
      emitMetric('webhook_edge_dedup_hit', 1, { gateway: 'vnpay' });
      return NextResponse.json(InpOrderAlreadyConfirmed);
    }

    // 3) Xác nhận atomic (kiểm tiền + idempotent + hỗ trợ pending/expired).
    // amountVnd từ IPN đã ÷100 (lib).
    const outcome = await confirmPaymentAtomic(result.orderId, result.gatewayTxnId, result.amountVnd);

    if (!outcome.ok) {
      if (outcome.reason === 'not_found') {
        emitMetric('webhook_order_not_found', 1, { gateway: 'vnpay', orderId: result.orderId });
        console.warn(`[vnpay-ipn] Không tìm thấy đơn hàng: orderId=${result.orderId}`);
        return NextResponse.json(IpnOrderNotFound);
      }
      if (outcome.reason === 'amount_mismatch') {
        emitMetric('webhook_amount_mismatch', 1, { gateway: 'vnpay', orderId: result.orderId });
        console.warn(`[vnpay-ipn] Số tiền không khớp hoặc không đủ cho đơn orderId=${result.orderId}: nhận ${result.amountVnd} VND`);
        return NextResponse.json(IpnInvalidAmount);
      }
      // confirm_unavailable / bad_status / error → báo lỗi để VNPay retry sau.
      emitMetric('webhook_confirm_error', 1, { gateway: 'vnpay', reason: outcome.reason });
      console.error(`[vnpay-ipn] Lỗi xác nhận đơn hàng orderId=${result.orderId}:`, outcome.reason);
      return NextResponse.json(IpnUnknownError);
    }

    // 4) Đã xác nhận trước đó (order.status === 'paid') → idempotent, KHÔNG cấp lại gói.
    if (outcome.alreadyConfirmed) {
      markWebhookConfirmed(dedupKey);
      return NextResponse.json(InpOrderAlreadyConfirmed);
    }

    markWebhookConfirmed(dedupKey);
    emitMetric('webhook_payment_confirmed', 1, { gateway: 'vnpay', amountVnd: result.amountVnd });
    // 5) Lật pending/expired→paid THÀNH CÔNG lần đầu (isSuccess đã đảm bảo ở bước 2).
    return NextResponse.json(IpnSuccess);
  } catch (error) {
    console.error('Lỗi vnpay-ipn:', error);
    return NextResponse.json(IpnUnknownError);
  }
}
