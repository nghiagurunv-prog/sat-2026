import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { emitMetric, sendAlertIfConfigured } from '@/lib/telemetry';
import { rateLimitDistributed, getRateLimitKey, getClientIp } from '@/lib/rate-limit';
import { applyCouponPrice, validateCoupon } from '@/lib/subscription';
import {
  isValidGateway,
  resolvePaymentSpec,
  generateOrderId,
  buildOrderInfo,
} from '@/lib/payment';
import { createTransaction } from '@/lib/payment-store';
import { resolveShareCode } from '@/lib/parent-share-store';
import { isValidCodeFormat } from '@/lib/parent-share';
import { buildVnpayPaymentUrl, isVnpayConfigured } from '@/lib/payment-vnpay';
import { createMomoPayment, isMomoConfigured } from '@/lib/payment-momo';
import { createPayosPayment, isPayosConfigured, generatePayosOrderCode } from '@/lib/payment-payos';
import { createStripeCheckout, isStripeConfigured } from '@/lib/payment-stripe';

/**
 * ============================================================================
 *  PAYMENT CREATE — Phase 2 Bước 2
 * ============================================================================
 *  POST { gateway, tier, period } → tạo giao dịch 'pending' + trả { payUrl }.
 *
 *  🔴 Client gửi Ý ĐỊNH (gateway + tier + period). SERVER tra PLANS lấy GIÁ
 *  (client KHÔNG gửi số tiền). Sinh orderId (khóa idempotency), ghi 'pending',
 *  build URL cổng. Việc CẤP GÓI chỉ xảy ra ở IPN (đã verify chữ ký) — KHÔNG ở đây.
 * ============================================================================
 */

/** Dựng URL gốc để cổng gọi return/ipn về. Ưu tiên NEXT_PUBLIC_APP_URL / APP_BASE_URL, hỗ trợ VERCEL_URL tạm trên Vercel. */
function baseUrl(req: Request): string | null {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.VERCEL_URL) {
    const cleanHost = process.env.VERCEL_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (cleanHost) return `https://${cleanHost}`;
  }
  if (process.env.NODE_ENV === 'production') return null;
  try {
    return new URL(req.url).origin;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { gateway, tier: rawTier, period: rawPeriod, planId, parentShareCode } = body ?? {};

    const user = await getCurrentUser();
    let targetUserId = user.isAuthenticated ? user.id : '';

    // Luồng Phụ Huynh tài trợ 1-chạm từ Cổng Phụ Huynh (#21 & #32):
    // Nếu phụ huynh chưa đăng nhập nhưng có mã chia sẻ hợp lệ còn hạn → resolve studentId server-side.
    if (!targetUserId && typeof parentShareCode === 'string' && parentShareCode.trim()) {
      const normalizedShare = parentShareCode.trim().toUpperCase();
      if (!isValidCodeFormat(normalizedShare)) {
        return NextResponse.json(
          { success: false, error: 'Mã chia sẻ phụ huynh không hợp lệ.' },
          { status: 400 }
        );
      }
      const resolvedStudentId = await resolveShareCode(normalizedShare);
      if (!resolvedStudentId) {
        return NextResponse.json(
          { success: false, error: 'Mã chia sẻ phụ huynh đã hết hạn hoặc bị thu hồi.' },
          { status: 403 }
        );
      }
      targetUserId = resolvedStudentId;
    }

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'Bạn cần đăng nhập để nâng gói.' }, { status: 401 });
    }

    const rlKey = getRateLimitKey(req, 'payment-create', targetUserId);
    const rl = await rateLimitDistributed(rlKey, 10, 5 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu tạo đơn. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    if (!isValidGateway(gateway)) {
      return NextResponse.json(
        { success: false, error: 'Cổng thanh toán không hợp lệ.' },
        { status: 400 }
      );
    }

    // 🔴 SERVER tra giá từ PLANS / SPRINT_EXAM_PACKS / STUDY_SQUAD_PACKS — client KHÔNG gửi số tiền.
    const plan = resolvePaymentSpec({ planId, tier: rawTier, period: rawPeriod });
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Thông tin gói hoặc chu kỳ thanh toán không hợp lệ.' },
        { status: 400 }
      );
    }
    const { tier, period } = plan;

    const rawCoupon = typeof body?.couponCode === 'string' ? body.couponCode : undefined;
    const extraCoupons = process.env.AFFILIATE_COUPONS
      ? process.env.AFFILIATE_COUPONS.split(',')
      : undefined;
    const couponCheck = validateCoupon(rawCoupon, extraCoupons);
    // Không cộng dồn coupon lên gói Mua Chung đã giảm sâu 25-35%
    const finalAmountVnd =
      plan.kind === 'squad'
        ? plan.priceVnd
        : applyCouponPrice(plan.priceVnd, rawCoupon, extraCoupons);

    const base = baseUrl(req);
    if (!base) {
      return NextResponse.json(
        { success: false, error: 'Thiếu APP_BASE_URL cho cổng thanh toán.', code: 'APP_BASE_URL_REQUIRED' },
        { status: 503 }
      );
    }
    const returnUrl = `${base}/api/payment/return`;

    // payOS yêu cầu orderCode là SỐ → tách nhánh sớm (order_id = String(orderCode)),
    // KHÔNG dùng orderId UUID chung ở dưới (tránh ghi 2 row).
    if (gateway === 'payos') {
      if (!isPayosConfigured()) {
        return NextResponse.json(
          { success: false, error: 'Cổng payOS đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
          { status: 503 }
        );
      }
      let orderCode = generatePayosOrderCode();
      let orderId = String(orderCode);
      let createdPayos = await createTransaction({
        userId: targetUserId,
        orderId,
        gateway,
        tier,
        period,
        amountVnd: finalAmountVnd,
        durationDays: plan.durationDays,
      });

      for (let attempt = 0; !createdPayos && attempt < 2; attempt++) {
        orderCode = generatePayosOrderCode();
        orderId = String(orderCode);
        createdPayos = await createTransaction({
          userId: targetUserId,
          orderId,
          gateway,
          tier,
          period,
          amountVnd: finalAmountVnd,
          durationDays: plan.durationDays,
        });
      }

      if (!createdPayos) {
        return NextResponse.json({ success: false, error: 'Không thể khởi tạo giao dịch. Thử lại sau.' }, { status: 500 });
      }

      const payosDescription = `SAT ${orderCode}`.slice(0, 25);
      const expiredAt = Math.floor(Date.now() / 1000) + 15 * 60;
      const payosRes = await createPayosPayment({
        amountVnd: finalAmountVnd,
        orderCode,
        description: payosDescription,
        returnUrl: `${returnUrl}?orderId=${orderId}`,
        cancelUrl: `${base}/upgrade?status=unknown&order=${orderId}`,
        expiredAt,
      });
      if (!payosRes.ok || !payosRes.payUrl) {
        emitMetric('payment_gateway_error', 1, { gateway: 'payos', orderId });
        void sendAlertIfConfigured('payment_gateway_error', { gateway: 'payos', orderId, message: payosRes.message });
        return NextResponse.json(
          { success: false, error: payosRes.message ?? 'Không tạo được phiên thanh toán payOS.', code: 'GATEWAY_UNCONFIGURED' },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        payUrl: payosRes.payUrl,
        orderId,
        planId: plan.planId,
        seats: plan.seats,
        amountVnd: finalAmountVnd,
        expiredAt: payosRes.expiredAt ?? expiredAt,
        ...(payosRes.qrCode ? { qrCode: payosRes.qrCode } : {}),
        ...(couponCheck.valid && plan.kind !== 'squad' ? { appliedCoupon: couponCheck.code } : {}),
      });
    }

    const orderId = generateOrderId();
    const orderInfo = buildOrderInfo(tier, period);

    if (gateway === 'stripe' && !isStripeConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Cổng Stripe đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }
    if (gateway === 'vnpay' && !isVnpayConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Cổng VNPay đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }
    if (gateway === 'momo' && !isMomoConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Cổng MoMo đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }

    const created = await createTransaction({
      userId: targetUserId,
      orderId,
      gateway,
      tier,
      period,
      amountVnd: finalAmountVnd,
      durationDays: plan.durationDays,
    });
    if (!created) {
      return NextResponse.json({ success: false, error: 'Không thể khởi tạo giao dịch. Thử lại sau.' }, { status: 500 });
    }

    if (gateway === 'stripe') {
      const stripeRes = await createStripeCheckout({
        orderId,
        amountVnd: finalAmountVnd,
        tier,
        period,
        orderInfo,
        successUrl: `${base}/api/payment/return?orderId=${orderId}`,
        cancelUrl: `${base}/upgrade?status=unknown&order=${orderId}`,
      });
      if (!stripeRes.ok || !stripeRes.payUrl) {
        emitMetric('payment_gateway_error', 1, { gateway: 'stripe', orderId });
        void sendAlertIfConfigured('payment_gateway_error', { gateway: 'stripe', orderId, message: stripeRes.message });
        return NextResponse.json(
          { success: false, error: stripeRes.message ?? 'Không tạo được phiên thanh toán Stripe.', code: 'GATEWAY_UNCONFIGURED' },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        payUrl: stripeRes.payUrl,
        orderId,
        planId: plan.planId,
        seats: plan.seats,
        amountVnd: finalAmountVnd,
        ...(couponCheck.valid && plan.kind !== 'squad' ? { appliedCoupon: couponCheck.code } : {}),
      });
    }

    if (gateway === 'vnpay') {
      const payUrl = buildVnpayPaymentUrl({
        orderId,
        amountVnd: finalAmountVnd,
        orderInfo,
        ipAddr: getClientIp(req),
        returnUrl,
      });
      return NextResponse.json({
        success: true,
        payUrl,
        orderId,
        planId: plan.planId,
        seats: plan.seats,
        amountVnd: finalAmountVnd,
        ...(couponCheck.valid && plan.kind !== 'squad' ? { appliedCoupon: couponCheck.code } : {}),
      });
    }

    // gateway === 'momo'
    const momo = await createMomoPayment({
      amountVnd: finalAmountVnd,
      orderId,
      orderInfo,
      redirectUrl: returnUrl,
      ipnUrl: `${base}/api/payment/momo-ipn`,
      requestId: orderId,
    });
    if (!momo.ok || !momo.payUrl) {
      emitMetric('payment_gateway_error', 1, { gateway: 'momo', orderId });
      void sendAlertIfConfigured('payment_gateway_error', { gateway: 'momo', orderId, message: momo.message });
      return NextResponse.json(
        { success: false, error: momo.message ?? 'Cổng MoMo đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }
    return NextResponse.json({
      success: true,
      payUrl: momo.payUrl,
      orderId,
      planId: plan.planId,
      seats: plan.seats,
      amountVnd: finalAmountVnd,
      ...(couponCheck.valid && plan.kind !== 'squad' ? { appliedCoupon: couponCheck.code } : {}),
    });
  } catch (error) {
    console.error('Lỗi payment/create:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
