import type { createClient } from "./supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type MainGroup = { id: string; name: string };

/** The one and only group ("Gamblers"). Null if you're not a member (RLS hides it). */
export async function getMainGroup(supabase: Client): Promise<MainGroup | null> {
  const { data } = await supabase.from("groups").select("id, name").order("created_at").limit(1).maybeSingle();
  return (data as MainGroup | null) ?? null;
}
