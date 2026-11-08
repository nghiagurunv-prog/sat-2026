import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isE2E, E2E_COOKIE } from '@/lib/e2e'

/**
 * Các path CÔNG KHAI — KHÔNG ép đăng nhập (khớp bằng prefix).
 * Mọi path khác cần user thật, vì dữ liệu app scope theo `user_id` kiểu UUID
 * (FK auth.users). Guest 'local-default-user' (non-UUID) ghi gì cũng fail âm thầm
 * → phải chặn ở cửa. Xem plan merry-pondering-graham.md.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/diagnostic',
  '/leaderboard',
  '/auth', // OAuth / email-confirm callback (đổi ?code= lấy session) — phải public để không bị chặn trước khi có session
  '/parent', // trang phụ huynh đọc ?code= (no-auth) — /parent-share (học sinh) KHÔNG khớp vì cần đúng prefix + '/'
  '/admin', // tự bảo vệ 2 lớp: UI cho phép nhập ADMIN_SECRET (tránh tự khóa khi chưa có session), API /api/admin tự bảo vệ bằng verifyAdminAccess
  '/api/auth',
  '/api/payment/momo-ipn',
  '/api/payment/vnpay-ipn',
  '/api/payment/stripe-webhook', // Stripe gọi server-to-server, không có cookie session
  '/api/payment/payos-webhook', // payOS gọi server-to-server, không có cookie session (chữ ký HMAC tự bảo vệ)
  '/api/payment/return',
  '/api/parent/report',
  '/api/admin', // tự bảo vệ bằng verifyAdminAccess (session-admin HOẶC shared-secret timing-safe)
]

/**
 * Kiểm tra đường dẫn redirect nội bộ an toàn (chống Open Redirect, Null Byte, Backslash injection).
 */
export function isSafeRedirectPath(path: string | null | undefined): boolean {
  return Boolean(
    path &&
      path.startsWith('/') &&
      !path.startsWith('//') &&
      !path.includes('\\') &&
      !path.toLowerCase().includes('%5c') &&
      !path.includes('\0')
  )
}

/**
 * Gắn các security headers cơ bản vào response:
 * - X-Frame-Options: DENY (chống clickjacking)
 * - X-Content-Type-Options: nosniff (chống MIME sniffing)
 * - Referrer-Policy: strict-origin-when-cross-origin (bảo vệ thông tin referrer)
 */
function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return res
}

/** true nếu path là public (khớp chính path hoặc prefix + '/'). */
function isPublicPath(path: string): boolean {
  // Cho phép khách vãng lai học thử trang chủ '/' không bị đá sang /login ngay giây đầu
  if (path === '/') return true
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
}

export async function updateSession(request: NextRequest) {
  // E2E: khi E2E_TEST_MODE=1 (chỉ máy test) VÀ có cookie e2e_auth → coi như đã
  // đăng nhập, cho qua thẳng (bỏ Supabase). Cần CẢ env LẪN cookie (defense-in-depth):
  // env không set trên prod → nhánh này chết; cookie thiếu → vẫn đi đường auth thật.
  if (isE2E() && request.cookies.get(E2E_COOKIE)) {
    return applySecurityHeaders(NextResponse.next({ request }))
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshing the auth token (cũng dùng kết quả này để gate bên dưới).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Chưa đăng nhập + path không công khai → chặn.
  if (!user && !isPublicPath(path)) {
    // API → 401 JSON (client fetch xử lý gọn, không redirect HTML).
    if (path.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 })
      // Bê cookie refresh của Supabase sang response mới (cạm bẫy SSR #1).
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c))
      return applySecurityHeaders(res)
    }

    // Page → redirect /login?next=<path> (chỉ giữ path nội bộ an toàn, chống open-redirect).
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    if (isSafeRedirectPath(path)) {
      url.searchParams.set('next', path)
    }
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return applySecurityHeaders(redirect)
  }

  return applySecurityHeaders(supabaseResponse)
}
