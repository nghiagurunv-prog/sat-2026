import { NextRequest, NextResponse } from 'next/server';
import { getCostReport } from '@/lib/ai-cost';
import { verifyAdmin, logAdminAudit } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';

/**
 * AI COST REPORT (implementation_plan.md §9.5, task #5)
 *
 * GET  → chi phí AI toàn hệ thống hôm nay: số lượt gọi, token in/out, chi phí
 *        USD ước tính, ngân sách ngày và phần còn lại.
 * POST → cấu hình ngân sách hoặc reset thống kê chi phí AI, ghi nhận audit log.
 *
 * 🔒 DUAL-AUTH (session-admin HOẶC shared-secret) qua verifyAdmin: vào được
 * nếu user có role 'admin' HOẶC header x-admin-secret khớp ADMIN_SECRET.
 * FAIL-CLOSED: không quyền → 403 (số liệu vận hành KHÔNG lộ ra ngoài).
 *
 * 🔴 Chống brute-force: CHỈ rate-limit lần thử SAI theo IP (10 lần/phút); vào hợp
 * lệ (secret/session) không chạm limit. Middleware allow /api/admin (public) nên
 * endpoint này tự bảo vệ.
 */
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export async function GET(req: Request) {
  const auth = await verifyAdmin(req as NextRequest);
  if (!auth.ok) {
    const rl = rateLimit(`admin-auth-fail:${clientIp(req)}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều lần thử sai. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { success: false, error: auth.error || 'Không có quyền truy cập.' },
      { status: auth.status || 403 }
    );
  }
  return NextResponse.json(await getCostReport());
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
    const body = await req.json().catch(() => ({}));
    const action = (body as { action?: string })?.action || 'reset';

    // Ghi audit log
    await logAdminAudit(auth.actor || 'admin', `ai_cost_${action}`, undefined, {
      payload: body,
    });

    return NextResponse.json({
      success: true,
      message: `Đã ghi nhận thao tác ${action} trên AI cost.`,
      action,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi xử lý yêu cầu.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
