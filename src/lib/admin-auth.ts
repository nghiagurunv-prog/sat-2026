import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { isUserAdmin } from '@/lib/admin-role-store';
import { createClient } from '@/lib/supabase/server';

/**
 * ============================================================================
 *  ADMIN AUTH (shared-secret) — Phase 2: Admin Fulfillment
 * ============================================================================
 *  App CHƯA có role system (§9.3). Để admin xử lý phiếu đổi quà (pending→fulfilled)
 *  mà KHÔNG dựng cả hệ role, dùng 1 secret dùng-chung đặt trong ENV `ADMIN_SECRET`
 *  (server-only, KHÔNG NEXT_PUBLIC_). Route admin đọc secret từ header
 *  `x-admin-secret` và so timing-safe với ENV.
 *
 *  🔴 2 CHỐT BẢO MẬT:
 *    1. FAIL-CLOSED: ENV `ADMIN_SECRET` chưa set / rỗng → TỪ CHỐI mọi request
 *       (KHÔNG "không set = ai cũng vào"). Không có secret nghĩa là khoá cửa.
 *    2. TIMING-SAFE: so sánh bằng crypto.timingSafeEqual (băm 2 vế về cùng độ
 *       dài trước) → không rò rỉ độ dài / vị trí lệch qua thời gian phản hồi.
 *
 *  ⚠️ THUẦN (pure) — không I/O ngoài đọc process.env + crypto. Tách để unit-test.
 *  Đây là biện pháp NHẸ cho beta; khi có role system đầy đủ thì thay thế.
 * ============================================================================
 */

/**
 * So 2 chuỗi bí mật theo thời-gian-hằng. Băm cả 2 về SHA-256 (32 byte cố định)
 * trước khi timingSafeEqual để tránh: (a) ném lỗi khi khác độ dài, (b) rò rỉ độ
 * dài secret qua kênh phụ. Khác giá trị → false.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  // ha/hb luôn 32 byte → timingSafeEqual không ném; kết quả chỉ true khi bằng hệt.
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Xác thực secret admin từ header hoặc Request. FAIL-CLOSED khi ENV chưa cấu hình.
 * Hỗ trợ nhận Request (có tích hợp rate limit chống brute-force) hoặc chuỗi secret trực tiếp.
 *
 * @param reqOrProvided Request đối tượng hoặc giá trị header `x-admin-secret` (hoặc null nếu thiếu)
 * @returns true CHỈ khi ENV `ADMIN_SECRET` có giá trị VÀ provided khớp hệt và không vượt rate limit.
 */
export function verifyAdminSecret(reqOrProvided: Request | string | null | undefined): boolean {
  let provided: string | null | undefined;
  if (reqOrProvided && typeof reqOrProvided === 'object' && 'headers' in reqOrProvided) {
    const req = reqOrProvided as Request;
    provided = req.headers.get('x-admin-secret');
    if (provided) {
      const rl = rateLimit(`admin-secret:${getClientIp(req)}`, 10, 60_000);
      const isAllowed = 'allowed' in rl ? rl.allowed : (rl as { ok?: boolean }).ok !== false;
      if (!isAllowed) {
        return false;
      }
    }
  } else {
    provided = reqOrProvided;
  }

  const expected = process.env.ADMIN_SECRET;
  // Fail-closed: chưa cấu hình secret → khoá cửa, không cho ai vào.
  if (!expected || expected.length === 0) return false;
  if (typeof provided !== 'string' || provided.length === 0) return false;
  return safeEqual(provided, expected);
}

export type AdminAuthResult =
  | { ok: true; actor?: string }
  | { ok: false; response: NextResponse; error?: string; status?: number };

/**
 * Xác thực quyền quản trị viên tổng hợp (Dual-Auth: shared-secret HOẶC session-admin).
 * Có tích hợp rate limit chống brute-force cho x-admin-secret (10 req/phút).
 *
 * @param req Request hiện tại
 * @returns AdminAuthResult { ok: true, actor?: string } hoặc { ok: false, response: NextResponse, error?: string, status?: number }
 */
export async function verifyAdmin(req: Request): Promise<AdminAuthResult> {
  const secretHeader = req.headers.get('x-admin-secret');

  // 1. Nếu gửi đúng x-admin-secret: cho phép ngay lập tức (KHÔNG tính vào rate-limit lỗi)
  if (secretHeader !== null && secretHeader !== undefined && secretHeader.length > 0) {
    if (verifyAdminSecret(secretHeader)) {
      return { ok: true, actor: 'secret:x-admin-secret' };
    }
  }

  // 2. Session-admin: kiểm tra session Supabase của user và role 'admin'
  try {
    const user = await getCurrentUser();
    if (user.isAuthenticated && (await isUserAdmin(user.id))) {
      let actor = user.id;
      try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) {
          actor = data.user.email;
        }
      } catch {
        // Fallback dùng user.id nếu không đọc được email
      }
      return { ok: true, actor };
    }
  } catch {
    // Fail-safe: lỗi phiên đăng nhập coi như không có quyền
  }

  // 3. Nếu gửi sai x-admin-secret: áp dụng rate limit chống brute-force (10 lần sai / phút / IP)
  if (secretHeader !== null && secretHeader !== undefined && secretHeader.length > 0) {
    const rl = rateLimit(`admin-secret:${getClientIp(req)}`, 10, 60_000);
    const isAllowed = 'allowed' in rl ? rl.allowed : (rl as { ok?: boolean }).ok !== false;
    if (!isAllowed) {
      return {
        ok: false,
        error: 'Too many admin authentication attempts. Please try again later.',
        status: 429,
        response: NextResponse.json(
          { success: false, error: 'Too many admin authentication attempts. Please try again later.' },
          { status: 429 }
        ),
      };
    }
  }

  return {
    ok: false,
    error: 'Không có quyền truy cập.',
    status: 403,
    response: NextResponse.json(
      { success: false, error: 'Không có quyền truy cập.' },
      { status: 403 }
    ),
  };
}

/**
 * Ghi nhật ký kiểm toán (Admin Audit Trail Helper - #030).
 * Bất biến (append-only), an toàn fail-soft (không bao giờ làm crash request nếu bảng chưa migrate).
 * Hỗ trợ truyền 1 object `{ action, targetId, actor, details }` hoặc 4 tham số rời `(actor, action, targetId, details)`.
 */
export async function logAdminAudit(
  paramsOrActor:
    | {
        action: string;
        targetId?: string;
        actor?: string;
        details?: Record<string, unknown>;
      }
    | string,
  actionArg?: string,
  targetIdArg?: string,
  detailsArg?: Record<string, unknown>
): Promise<void> {
  try {
    const params =
      typeof paramsOrActor === 'string'
        ? {
            actor: paramsOrActor,
            action: actionArg || 'admin_action',
            targetId: targetIdArg,
            details: detailsArg,
          }
        : paramsOrActor;
    const admin = createAdminClient();
    await admin.from('admin_audit_logs').insert({
      admin_identity: params.actor || 'admin',
      action: params.action,
      target_id: params.targetId || null,
      details: params.details || {},
    });
  } catch (err) {
    console.warn('[admin-audit]', err);
  }
}
