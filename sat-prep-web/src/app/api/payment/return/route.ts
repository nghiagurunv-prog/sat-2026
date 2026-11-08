import { NextResponse } from 'next/server';
import { getTransaction } from '@/lib/payment-store';

/**
 * ============================================================================
 *  PAYMENT RETURN — Phase 2 Bước 2 (landing sau khi user rời cổng)
 * ============================================================================
 *  Cả VNPay (vnp_TxnRef) và MoMo (orderId) redirect browser về đây kèm orderId.
 *  🔴 CHỈ HIỂN THỊ trạng thái — KHÔNG cấp gói (browser giả mạo được; chỉ IPN
 *  server-to-server đã verify chữ ký mới cấp). Đọc trạng thái đã được IPN cập
 *  nhật (nếu IPN tới trước) rồi redirect về /upgrade với ?status=... để UI báo.
 * ============================================================================
 */

const ALLOWED_STATUSES = new Set(['paid', 'pending', 'cancelled', 'failed', 'unknown']);
const ALLOWED_PATHS = new Set(['/upgrade', '/pricing', '/dashboard']);

/** Lấy origin an toàn từ NEXT_PUBLIC_APP_URL / APP_BASE_URL hoặc req.nextUrl.origin (chống Open Redirect) */
function getSafeOrigin(req: Request, url: URL): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Bỏ qua nếu cấu hình URL không hợp lệ
    }
  }

  const nextReq = req as { nextUrl?: { origin?: string } };
  if (nextReq.nextUrl?.origin) {
    return nextReq.nextUrl.origin;
  }

  return url.origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // VNPay dùng vnp_TxnRef; MoMo dùng orderId; payOS dùng orderCode (số) hoặc orderId
  // mình tự gắn ở returnUrl. Đọc theo thứ tự rồi chuẩn hóa về chuỗi order_id.
  const rawOrderId =
    url.searchParams.get('vnp_TxnRef') ||
    url.searchParams.get('orderId') ||
    url.searchParams.get('orderCode') ||
    '';

  // Làm sạch orderId an toàn: chỉ cho phép chữ cái, số, gạch nối, gạch dưới, max 64 ký tự
  const orderId = /^[a-zA-Z0-9_-]{1,64}$/.test(rawOrderId.trim()) ? rawOrderId.trim() : '';

  // Làm sạch cờ cancel và trạng thái gửi kèm từ query
  const rawCancel = url.searchParams.get('cancel');
  const rawStatus = (url.searchParams.get('status') || '').toLowerCase().trim();
  const isCancelled =
    rawCancel === 'true' ||
    rawCancel === '1' ||
    rawStatus === 'cancelled' ||
    rawStatus === 'cancel';

  const origin = getSafeOrigin(req, url);

  let status = 'unknown';
  if (orderId) {
    const txn = await getTransaction(orderId);
    if (txn && ALLOWED_STATUSES.has(txn.status)) {
      status = txn.status; // 'pending' (IPN chưa tới) | 'paid' | ...
    }
  }

  // Nếu DB chưa cập nhật kịp hoặc pending nhưng có tín hiệu cancel từ cổng thanh toán
  if ((status === 'unknown' || status === 'pending') && isCancelled) {
    status = 'cancelled';
  } else if (!ALLOWED_STATUSES.has(status)) {
    status = 'unknown';
  }

  // Xác định path đích nội bộ an toàn (chống Open Redirect, chỉ cho phép /upgrade, /pricing, /dashboard)
  const requestedPath = url.searchParams.get('redirect_to') || url.searchParams.get('return_to');
  const targetPath = (requestedPath && ALLOWED_PATHS.has(requestedPath)) ? requestedPath : '/upgrade';

  // Redirect về trang nâng cấp với trạng thái để UI hiển thị thân thiện.
  const dest = new URL(targetPath, origin);
  dest.searchParams.set('status', status);
  if (orderId) dest.searchParams.set('order', orderId);
  return NextResponse.redirect(dest.toString());
}
