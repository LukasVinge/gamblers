import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (uses the same login cookie as the server).
 *
 * autoRefreshToken is off on purpose: the server (middleware) renews the login on every page view
 * and sets the cookie with a 400-day lifetime. If the browser renewed it from JavaScript instead,
 * Safari/iPhone would cap that cookie at 7 days – and you'd be logged out after a week away.
 */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false },
  });
}
