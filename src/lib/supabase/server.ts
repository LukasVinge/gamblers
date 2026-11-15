import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

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

/**
 * The Supabase client + who is logged in, shared by the layout and the page within one request.
 *
 * Uses getClaims(): the login token is verified locally against the project's public signing key,
 * so there is no network round trip to Supabase Auth (getUser() made one from the middleware, the
 * layout AND the page on every page view). Row-level security still decides what data is visible.
 */
export const getAuth = cache(async () => {
  const supabase = await createClient();
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = (data?.claims?.sub as string | undefined) ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    // Safety net: if local verification isn't possible, ask Supabase directly (the old behaviour).
    // For logged-out visitors this returns at once without a network call.
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  return { supabase, user: userId ? { id: userId } : null };
});

/** Your own username + picture (top bar, tip page, profile) – fetched once per request. */
export const getMyProfile = cache(async (): Promise<{ username: string; avatar_url: string | null } | null> => {
  const { supabase, user } = await getAuth();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("username, avatar_url").eq("id", user.id).maybeSingle();
  return (data as { username: string; avatar_url: string | null } | null) ?? null;
});

/** Cookie-less client for public data (share pages, preview images). */
export function createPublicClient() {
  return createPlainClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}
