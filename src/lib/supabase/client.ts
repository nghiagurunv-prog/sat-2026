import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Creates or retrieves the Supabase browser client singleton.
 * Using a singleton pattern on the client-side avoids initializing multiple GoTrueClient instances,
 * which prevents race conditions during JWT token refreshes and redundant auth state change listeners.
 * For SSR/pre-rendering environments (`typeof window === 'undefined'`), a fresh client instance is safely returned.
 */
export function createClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return browserClient
}
