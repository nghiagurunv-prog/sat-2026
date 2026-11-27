import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const rawSharedDomain =
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim() || undefined
      : undefined
  let sharedDomain: string | undefined
  if (rawSharedDomain) {
    try {
      const hdrs = await headers()
      const rawHost = (hdrs.get('x-forwarded-host') || hdrs.get('host') || '').split(',')[0].trim().toLowerCase()
      const host = rawHost.split(':')[0]
      const cleanRoot = rawSharedDomain.replace(/^\./, '').toLowerCase()
      if (host === cleanRoot || host.endsWith(`.${cleanRoot}`)) {
        sharedDomain = rawSharedDomain
      }
    } catch {
      sharedDomain = undefined
    }
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                sharedDomain
                  ? { ...options, domain: sharedDomain, sameSite: 'lax', secure: true }
                  : options
              )
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
