import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isE2E, E2E_COOKIE } from '@/lib/e2e'

/**
 * Các path CÔNG KHAI KHỚP CHÍNH XÁC (Mục #6 — Fail-Closed `#G6`).
 * Ví dụ: `/teacher` (landing/demo) công khai, nhưng mọi route quản trị con
 * `/teacher/classes`, `/teacher/students` và `/api/teacher/*` BẮT BUỘC đăng nhập.
 */
const PUBLIC_EXACT_PATHS = new Set<string>([
  '/',
  '/login',
  '/pricing',
  '/upgrade',
  '/teacher',
  '/onboarding',
  '/diagnostic',
  '/leaderboard',
  '/desmos',
  '/mock-exams',
  '/exam-mode',
  '/practice',
  '/math',
  '/reading',
  '/literature',
  '/vocab',
  '/vocabulary',
  '/mistakes',
  '/forge',
  '/grind',
  '/rescue',
  '/quests',
  '/missions',
  '/collection',
  '/achievements',
  '/analytics',
  '/scholarship',
  '/journey',
  '/study-plan',
  '/join',
  '/terms',
  '/privacy',
  '/refund',
  '/contact',
  '/pvp',
])

/**
 * Các path CÔNG KHAI KHỚP PREFIX — chỉ dành cho nhánh cần sub-path công khai thật sự.
 */
const PUBLIC_PREFIXES = [
  '/auth', // OAuth / email-confirm callback
  '/parent', // trang phụ huynh đọc ?code= (no-auth) — /parent-share không khớp vì cần đúng prefix + '/'
  '/uni-predict', // SEO SSG/ISR Hub xét tuyển SAT các trường ĐH Top VN (#29)
  '/admin', // tự bảo vệ 2 lớp (ADMIN_SECRET + session admin)
  '/exams', // phòng thi thử Guest Trial (/exams/[id])
  // API xác thực, webhook & cron
  '/api/auth',
  '/api/health',
  '/api/cron', // Vercel Cron tự xác thực bằng Authorization: Bearer CRON_SECRET (timing-safe)
  '/api/payment/create', // tự xác thực 2 nhánh: user session hoặc parentShareCode hợp lệ (401/403 nếu thiếu)
  '/api/payment/momo-ipn',
  '/api/payment/vnpay-ipn',
  '/api/payment/stripe-webhook',
  '/api/payment/payos-webhook',
  '/api/payment/return',
  '/api/parent/report',
  '/api/admin', // tự bảo vệ bằng verifyAdmin
  '/api/og', // Dynamic OG SVG card chia sẻ Zalo/Facebook (#20)
  '/api/activity', // Verified Activity Ticker công khai không PII (#27)
  '/api/b2b', // Form đăng ký Dùng thử 14 ngày Trung tâm (#39)
  '/api/diagnostic', // Diagnostic test 5 câu Guest Trial (#3)
  // API hỗ trợ Guest/Trial (có rate-limit theo IP)
  '/api/exams',
  '/api/exam-session',
  '/api/generate-practice',
  '/api/grade',
  '/api/chat',
  '/api/ai-tutor',
  '/api/hint',
  '/api/vocab',
  '/api/cau-sai',
  '/api/leaderboard',
  '/api/mastery',
  '/api/scholarship-match',
  '/api/uni-predict',
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
 * Security headers chính (CSP, HSTS, X-Content-Type-Options, Referrer-Policy,
 * Permissions-Policy, X-Frame-Options) được cấp tập trung 1 nơi tại `next.config.ts`
 * (Mục #7) để tránh duplicate headers. Middleware chỉ đảm bảo X-Frame-Options trên
 * redirect/401 response sinh trực tiếp tại Edge.
 */
function applySecurityHeaders(res: NextResponse): NextResponse {
  if (!res.headers.has('X-Frame-Options')) {
    res.headers.set('X-Frame-Options', 'DENY')
  }
  return res
}

/** true nếu path là public (khớp exact trong PUBLIC_EXACT_PATHS hoặc prefix + '/'). */
export function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(path)) return true
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

  let user = null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

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
