import type { createClient } from "./supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export const REACTIONS = [
  { id: "fire", emoji: "🔥", label: "Godt spil" },
  { id: "money", emoji: "💰", label: "Det går hjem" },
  { id: "nervous", emoji: "😬", label: "Nervøs" },
  { id: "clown", emoji: "🤡", label: "Aldrig i livet" },
] as const;
export type Reaction = (typeof REACTIONS)[number]["id"];
export const isReaction = (v: unknown): v is Reaction => REACTIONS.some((r) => r.id === v);

export type TipComment = {
  id: string;
  author_id: string;
  username: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
};

/** Per reaction: how many gave it, and whether I did. */
export type ReactionCounts = Record<Reaction, { count: number; mine: boolean }>;

export type TipSocialData = { comments: TipComment[]; reactions: ReactionCounts };

export const emptyReactions = (): ReactionCounts =>
  Object.fromEntries(REACTIONS.map((r) => [r.id, { count: 0, mine: false }])) as ReactionCounts;

/**
 * Comments (oldest first) and reaction counts for these tips, in two queries.
 * `null` when the tables don't exist yet (migration 0015 not run) – the cards then just leave it out.
 */
export async function getSocial(supabase: Client, tipIds: string[], myId: string): Promise<Map<string, TipSocialData> | null> {
  const map = new Map<string, TipSocialData>();
  if (tipIds.length === 0) return map;
  const [comments, reactions] = await Promise.all([
    supabase
      .from("tip_comments")
      .select("id, tip_id, author_id, body, created_at, author:profiles(username, avatar_url)")
      .in("tip_id", tipIds)
      .order("created_at"),
    supabase.from("tip_reactions").select("tip_id, user_id, reaction").in("tip_id", tipIds),
  ]);
  if (comments.error || reactions.error) return null;

  const get = (id: string) => {
    let s = map.get(id);
    if (!s) map.set(id, (s = { comments: [], reactions: emptyReactions() }));
    return s;
  };
  for (const c of comments.data as unknown as {
    id: string;
    tip_id: string;
    author_id: string;
    body: string;
    created_at: string;
    author: { username: string; avatar_url: string | null } | null;
  }[]) {
    get(c.tip_id).comments.push({
      id: c.id,
      author_id: c.author_id,
      username: c.author?.username ?? "former member",
      avatar_url: c.author?.avatar_url ?? null,
      body: c.body,
      created_at: c.created_at,
    });
  }
  for (const r of reactions.data as { tip_id: string; user_id: string; reaction: string }[]) {
    if (!isReaction(r.reaction)) continue;
    const slot = get(r.tip_id).reactions[r.reaction];
    slot.count += 1;
    if (r.user_id === myId) slot.mine = true;
  }
  return map;
}
