import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Supabase client for Server Components, Server Actions and Route Handlers (uses the user's session cookie). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component – the middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Cookie-less client for public data (share pages, preview images). */
export function createPublicClient() {
  return createPlainClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}
