import type { createClient } from "./supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type TailUser = { user_id: string; username: string; avatar_url: string | null };

/** Who is "on" each tip (🤝 I'm on it), oldest first. Empty if the table doesn't exist yet (migration 0008). */
export async function getTails(supabase: Client, tipIds: string[]): Promise<Map<string, TailUser[]>> {
  const map = new Map<string, TailUser[]>();
  if (tipIds.length === 0) return map;
  const { data, error } = await supabase
    .from("tip_tails")
    .select("tip_id, user_id, profile:profiles(username, avatar_url)")
    .in("tip_id", tipIds)
    .order("created_at");
  if (error || !data) return map;
  for (const r of data as unknown as { tip_id: string; user_id: string; profile: { username: string; avatar_url: string | null } | null }[]) {
    const list = map.get(r.tip_id) ?? [];
    list.push({ user_id: r.user_id, username: r.profile?.username ?? "member", avatar_url: r.profile?.avatar_url ?? null });
    map.set(r.tip_id, list);
  }
  return map;
}
