import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components (uses the same login cookie as the server). */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
