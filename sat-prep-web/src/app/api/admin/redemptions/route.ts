import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, logAdminAudit } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  listPendingRedemptions,
  fulfillRedemption,
  cancelRedemption,
} from '@/lib/admin-fulfillment-store';
import { rejectRedemption } from '@/lib/economy';

/**
 * ============================================================================
 *  ADMIN REDEMPTIONS API — Phase 2: xử lý hàng đợi đổi quà (shared-secret / admin session)
 * ============================================================================
 *  Bảo vệ bằng verifyAdmin (x-admin-secret hoặc session role admin).
 *  FAIL-CLOSED: Không có quyền hoặc ENV chưa set → mọi request 403.
 *
 *  GET        → danh sách phiếu 'pending' toàn hệ thống (FIFO), cho admin xử lý.
 *  POST/PATCH → { redemptionId, action: 'fulfill' | 'cancel' | 'reject', note?: string }.
 *               fulfill: đánh dấu đã giao mã/quà (KHÔNG hoàn xu).
 *               cancel : hủy + HOÀN xu (atomic, idempotent chống double-refund).
 *               reject : từ chối do gian lận (KHÔNG hoàn xu, ghi chú lý do).
 *
 *  🔴 Audit log: Ghi logAdminAudit cho mọi thao tác fulfill, cancel, reject.
 * ============================================================================
 */

/** IP client (x-forwarded-for đầu tiên) để rate-limit brute-force secret. */
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

/**
 * DUAL-AUTH (session-admin HOẶC secret) + chống brute-force qua verifyAdmin:
 * CHỈ rate-limit các lần thử THẤT BẠI theo IP (10 lần/phút).
 */
async function verifyAdminOrLimit(req: Request): Promise<{ ok: true; actor: string } | { ok: false; res: NextResponse }> {
  const auth = await verifyAdmin(req as NextRequest);
  if (auth.ok) return { ok: true, actor: auth.actor || 'admin' };

  const rl = rateLimit(`admin-auth-fail:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: 'Quá nhiều lần thử sai. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      ),
    };
  }
  return {
    ok: false,
    res: NextResponse.json(
      { success: false, error: auth.error || 'Không có quyền truy cập.' },
      { status: auth.status || 403 }
    ),
  };
}

export async function GET(req: Request) {
  const auth = await verifyAdminOrLimit(req);
  if (!auth.ok) return auth.res;
  const redemptions = await listPendingRedemptions();
  return NextResponse.json({ success: true, redemptions });
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminOrLimit(req);
    if (!auth.ok) return auth.res;

    // Rate-limit thêm theo hành động (chống bấm dồn khi đã có secret đúng).
    const rl = rateLimit('admin-redemptions', 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON không hợp lệ.' },
        { status: 400 }
      );
    }

    const payload = body as { redemptionId?: unknown; action?: unknown; note?: unknown; adminNote?: unknown };
    const redemptionId = typeof payload?.redemptionId === 'string' ? payload.redemptionId : '';
    const actionValue = payload?.action;
    const action = actionValue === 'fulfill' || actionValue === 'cancel' || actionValue === 'reject' ? actionValue : '';
    const note = typeof payload?.note === 'string'
      ? payload.note
      : typeof payload?.adminNote === 'string'
      ? payload.adminNote
      : '';

    if (!redemptionId || !action) {
      return NextResponse.json(
        { success: false, error: 'Thiếu redemptionId hoặc action (fulfill/cancel/reject).' },
        { status: 400 }
      );
    }

    const outcome =
      action === 'fulfill'
        ? await fulfillRedemption(redemptionId)
        : action === 'cancel'
        ? await cancelRedemption(redemptionId)
        : await rejectRedemption(redemptionId, note);

    const isOk = (outcome as any)?.ok ?? (outcome as any)?.success ?? false;
    if (!isOk) {
      const reason = (outcome as any)?.reason || (outcome as any)?.error;
      if (reason === 'unavailable') {
        return NextResponse.json(
          { success: false, error: 'Tính năng đang được nâng cấp. Vui lòng quay lại sau!', code: 'UNAVAILABLE' },
          { status: 503 }
        );
      }
      if (reason === 'not_found' || reason === 'Redemption not found') {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy phiếu.', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }
      if (reason === 'bad_status' || reason === 'Invalid redemption status') {
        return NextResponse.json(
          {
            success: false,
            error: 'Phiếu không ở trạng thái xử lý được (đã giao hoặc đã hủy/từ chối).',
            code: 'BAD_STATUS',
            status: (outcome as any)?.status,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: (outcome as any)?.error || 'Không thể xử lý phiếu lúc này.' },
        { status: 500 }
      );
    }

    // Ghi audit log sau khi thực hiện thành công
    await logAdminAudit(
      auth.actor || 'admin',
      `redemption_${action}`,
      redemptionId,
      { note: note || undefined }
    );

    return NextResponse.json({
      success: true,
      redemptionId,
      action,
      status: (outcome as any)?.status || (action === 'fulfill' ? 'fulfilled' : action === 'cancel' ? 'cancelled' : 'rejected'),
      // Với cancel: số dư MỚI của user sau hoàn xu (server-authoritative).
      coins: (outcome as any)?.coins,
      // 'already' = idempotent (đã ở trạng thái đích), vẫn coi là thành công.
      idempotent: (outcome as any)?.reason === 'already',
    });
  } catch (error) {
    console.error('Lỗi admin redemptions:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  return POST(req);
}
