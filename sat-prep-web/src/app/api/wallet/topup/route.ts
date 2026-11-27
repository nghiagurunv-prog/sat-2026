import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import { generateOrderId } from '@/lib/payment';
import { createPayosPayment, isPayosConfigured, generatePayosOrderCode } from '@/lib/payment-payos';
import { createStripeCheckout, isStripeConfigured } from '@/lib/payment-stripe';
import { validateTopupAmount } from '@/lib/wallet-catalog';
import { createWalletTopup } from '@/lib/wallet-store';
import { emitMetric, sendAlertIfConfigured } from '@/lib/telemetry';

function resolveBaseUrl(req: Request): string | null {
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

/**
 * POST /api/wallet/topup
 * Body: { gateway: 'payos' | 'stripe', amountVnd: number }
 * - Khởi tạo đơn nạp tiền VNĐ vào Ví chung (`wallet_topups` status='pending').
 * - Tiền CHỈ được cộng vào Ví khi Webhook PayOS/Stripe đã verify chữ ký gọi `confirm_wallet_topup`.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng tạo tài khoản hoặc đăng nhập trước khi nạp tiền vào Ví.' },
        { status: 401 }
      );
    }

    const rlKey = getRateLimitKey(req, 'wallet-topup', user.id);
    const rl = await rateLimitDistributed(rlKey, 10, 5 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu nạp tiền. Vui lòng thử lại sau ít phút.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    let body: { gateway?: unknown; amountVnd?: unknown } = {};
    try {
      body = (await req.json()) ?? {};
    } catch {
      return NextResponse.json({ success: false, error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
    }

    const gateway = body.gateway === 'stripe' ? 'stripe' : body.gateway === 'payos' ? 'payos' : null;
    if (!gateway) {
      return NextResponse.json(
        { success: false, error: 'Cổng nạp không hợp lệ. Chỉ hỗ trợ payOS VietQR hoặc Stripe.' },
        { status: 400 }
      );
    }

    const amountCheck = validateTopupAmount(body.amountVnd);
    if (!amountCheck.ok) {
      return NextResponse.json({ success: false, error: amountCheck.error }, { status: 400 });
    }
    const { amountVnd } = amountCheck;

    const base = resolveBaseUrl(req);
    if (!base) {
      return NextResponse.json(
        { success: false, error: 'Thiếu cấu hình NEXT_PUBLIC_APP_URL / APP_BASE_URL.', code: 'APP_BASE_URL_REQUIRED' },
        { status: 503 }
      );
    }

    if (gateway === 'payos') {
      if (!isPayosConfigured()) {
        return NextResponse.json(
          { success: false, error: 'Cổng payOS đang được cấu hình. Vui lòng thử lại sau hoặc gọi 0986.722.324.', code: 'GATEWAY_UNCONFIGURED' },
          { status: 503 }
        );
      }

      let orderCode = generatePayosOrderCode();
      let orderId = String(orderCode);
      let created = await createWalletTopup({ userId: user.id, orderId, gateway: 'payos', amountVnd });
      for (let attempt = 0; !created && attempt < 2; attempt++) {
        orderCode = generatePayosOrderCode();
        orderId = String(orderCode);
        created = await createWalletTopup({ userId: user.id, orderId, gateway: 'payos', amountVnd });
      }
      if (!created) {
        return NextResponse.json({ success: false, error: 'Không thể khởi tạo đơn nạp Ví. Thử lại sau.' }, { status: 500 });
      }

      const description = `NAP ${orderCode}`.slice(0, 25);
      const payosRes = await createPayosPayment({
        amountVnd,
        orderCode,
        description,
        returnUrl: `${base}/api/payment/return?orderId=${orderId}&redirect_to=/wallet`,
        cancelUrl: `${base}/wallet?status=cancelled&order=${orderId}`,
      });

      if (!payosRes.ok || !payosRes.payUrl) {
        emitMetric('wallet_topup_gateway_error', 1, { gateway: 'payos', orderId });
        void sendAlertIfConfigured('wallet_topup_gateway_error', { gateway: 'payos', orderId, message: payosRes.message });
        return NextResponse.json(
          { success: false, error: payosRes.message ?? 'Không tạo được mã VietQR nạp tiền payOS.' },
          { status: 503 }
        );
      }

      return NextResponse.json({
        success: true,
        gateway: 'payos',
        orderId,
        amountVnd,
        payUrl: payosRes.payUrl,
      });
    }

    // Stripe Checkout
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Cổng thẻ quốc tế Stripe đang được cấu hình. Vui lòng dùng payOS VietQR.', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }

    const orderId = generateOrderId();
    const created = await createWalletTopup({ userId: user.id, orderId, gateway: 'stripe', amountVnd });
    if (!created) {
      return NextResponse.json({ success: false, error: 'Không thể khởi tạo đơn nạp Stripe.' }, { status: 500 });
    }

    const stripeRes = await createStripeCheckout({
      orderId,
      amountVnd,
      tier: 'wallet_topup',
      period: 'topup',
      orderInfo: `Nạp Ví aionthi.com (${amountVnd.toLocaleString('vi-VN')}₫)`,
      successUrl: `${base}/api/payment/return?orderId=${orderId}&redirect_to=/wallet`,
      cancelUrl: `${base}/wallet?status=cancelled&order=${orderId}`,
    });

    if (!stripeRes.ok || !stripeRes.payUrl) {
      emitMetric('wallet_topup_gateway_error', 1, { gateway: 'stripe', orderId });
      return NextResponse.json(
        { success: false, error: stripeRes.message ?? 'Không tạo được phiên nạp tiền Stripe.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      gateway: 'stripe',
      orderId,
      amountVnd,
      payUrl: stripeRes.payUrl,
    });
  } catch (err) {
    console.error('Lỗi POST /api/wallet/topup:', err);
    return NextResponse.json({ success: false, error: 'Lỗi máy chủ khi khởi tạo nạp tiền.' }, { status: 500 });
  }
}
