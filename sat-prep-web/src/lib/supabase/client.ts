import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Creates or retrieves the Supabase browser client singleton.
 * Using a singleton pattern on the client-side avoids initializing multiple GoTrueClient instances,
 * which prevents race conditions during JWT token refreshes and redundant auth state change listeners.
 * For SSR/pre-rendering environments (`typeof window === 'undefined'`), a fresh client instance is safely returned.
 */
function getBrowserCookieOptions() {
  const sharedDomain =
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim() || undefined
      : undefined
  if (!sharedDomain) return undefined
  // Chỉ áp dụng domain chia sẻ khi hostname hiện tại khớp đuôi (tránh lỗi cookie trên *.vercel.app preview)
  if (typeof window !== 'undefined') {
    const cleanRoot = sharedDomain.replace(/^\./, '').toLowerCase()
    const host = window.location.hostname.toLowerCase()
    if (host !== cleanRoot && !host.endsWith(`.${cleanRoot}`)) {
      return undefined
    }
  }
  return { domain: sharedDomain, sameSite: 'lax' as const, secure: true }
}

export function createClient(): SupabaseClient {
  const cookieOptions = getBrowserCookieOptions()
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      cookieOptions ? { cookieOptions } : undefined
    )
  }

  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      cookieOptions ? { cookieOptions } : undefined
    )
  }

  return browserClient
}
