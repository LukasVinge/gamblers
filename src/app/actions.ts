"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, getAuth, getMyProfile } from "@/lib/supabase/server";
import { fmtKickoff, fmtOdds } from "@/lib/format";
import { pushConfigured, sendPush, type PushTarget } from "@/lib/push";
import { getBaseUrl } from "@/lib/url";
import { competitionName, getMatch, getUpcomingMatches, isCrestUrl, teamName } from "@/lib/footballData";
import { TIP_STATUSES, type TipStatus } from "@/lib/types";
import { isPromo, type Promo } from "@/lib/promos";
import { isReaction, type TipComment } from "@/lib/social";

// ───────── small helpers (not exported) ─────────

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function safePath(p: string, fallback = "/") {
  return p.startsWith("/") && !p.startsWith("//") ? p : fallback;
}

function withParam(path: string, key: string, value: string) {
  const u = new URL(path, "http://local");
  u.searchParams.set(key, value);
  return u.pathname + u.search;
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key).replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// ───────── auth ─────────

export async function login(fd: FormData) {
  const next = safePath(str(fd, "next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(fd, "email"),
    password: String(fd.get("password") ?? ""),
  });
  if (error) redirect(withParam(withParam("/login", "next", next), "error", error.message));
  redirect(next);
}

export async function signup(fd: FormData) {
  const code = str(fd, "code");
  const username = str(fd, "username");
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  const back = code ? `/signup?code=${encodeURIComponent(code)}` : "/signup";

  function fail(message: string): never {
    redirect(withParam(back, "error", message));
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) fail("Username: 3–20 letters, numbers or _");
  if (password.length < 8) fail("Password must be at least 8 characters.");

  const supabase = await createClient();

  const { data: open } = await supabase.rpc("signup_open");
  if (!open) {
    if (!code) fail("You need an invite link from a friend to sign up.");
    const { data: groupName } = await supabase.rpc("check_invite", { p_code: code });
    if (!groupName) fail("That invite code isn't valid (anymore). Ask for a fresh link.");
  }

  const { data: taken } = await supabase.rpc("username_taken", { p_username: username });
  if (taken) fail("That username is taken.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, invite_code: code || null },
      emailRedirectTo: `${await getBaseUrl()}/auth/callback`,
    },
  });
  if (error) fail(error.message);

  // If email confirmation is off in Supabase you get a session right away.
  redirect(data.session ? "/" : "/signup/check-email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ───────── group (there is only one: Gamblers) ─────────

export async function joinGroup(fd: FormData) {
  const code = str(fd, "code");
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group", { p_code: code });
  if (error) redirect(withParam(`/join/${encodeURIComponent(code)}`, "error", error.message));
  revalidatePath("/");
  redirect("/");
}

export async function regenerateInvite(fd: FormData) {
  const groupId = str(fd, "groupId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_invite", { p_group: groupId });
  if (error) redirect(withParam("/", "error", error.message));
  revalidatePath("/");
  redirect(withParam("/", "notice", "New invite link created. The old one no longer works."));
}

// ───────── tips ─────────

export async function createTip(fd: FormData) {
  const groupId = str(fd, "groupId");
  const fixtureRaw = str(fd, "fixture_id");
  const fixtureId = /^\d+$/.test(fixtureRaw) ? Number(fixtureRaw) : null;
  const back = fixtureId ? `/new?fixture=${fixtureId}` : "/new?manual=1";

  function fail(message: string): never {
    redirect(withParam(back, "error", message));
  }

  let home = str(fd, "home_team");
  let away = str(fd, "away_team");
  let kickoff = str(fd, "kickoff_at");
  let league = str(fd, "league") || null;
  let sport = str(fd, "sport") || "Football";
  let homeLogo: string | null = null;
  let awayLogo: string | null = null;

  // Tip made from the Kampprogram: take teams, kickoff and logos from the API, not from the form.
  if (fixtureId) {
    let m;
    try {
      m = await getMatch(fixtureId);
    } catch {
      fail("Couldn't check the match right now – try again in a minute.");
    }
    home = teamName(m.homeTeam);
    away = teamName(m.awayTeam);
    kickoff = m.utcDate;
    league = competitionName(m.competition.code, m.competition.name);
    sport = "Football";
    homeLogo = m.homeTeam.crest && isCrestUrl(m.homeTeam.crest) ? m.homeTeam.crest : null;
    awayLogo = m.awayTeam.crest && isCrestUrl(m.awayTeam.crest) ? m.awayTeam.crest : null;
  }

  if (!home || !away) fail("Fill in both teams / players.");
  if (!kickoff || Number.isNaN(Date.parse(kickoff))) fail("Pick a kickoff time.");
  if (Date.parse(kickoff) <= Date.now()) fail("Kickoff must be in the future – no posting tips after the game has started.");
  const { selection, odds, boosted, stake, bookmakerId, reasoning, promo, promoChosen } = readBet(fd, fail);

  const supabase = await createClient();
  const insertTip = (withPromo: boolean) => supabase
    .from("tips")
    .insert({
      group_id: groupId,
      sport,
      league,
      ...(fixtureId ? { fixture_id: fixtureId, home_logo: homeLogo, away_logo: awayLogo } : {}),
      home_team: home,
      away_team: away,
      kickoff_at: new Date(kickoff).toISOString(),
      selection,
      odds,
      boosted_odds: boosted,
      bookmaker_id: bookmakerId,
      stake_units: stake,
      reasoning,
      ...(withPromo && promo ? { promo } : {}),
    })
    .select("id, share_slug")
    .single();

  let { data, error } = await insertTip(true);
  // Database without migration 0011: still post the tip when the offer was only derived from boosted odds.
  if (error && promoMissing(error) && !promoChosen) ({ data, error } = await insertTip(false));
  if (error || !data) fail(error && promoMissing(error) ? PROMO_MIGRATION_MSG : (error?.message ?? "Couldn't save the tip."));

  await notifyNewTip(supabase, data, (me) => ({
    title: `@${me}: ${selection} @ ${fmtOdds(boosted ?? odds)}`,
    body: `${home} vs ${away} · ${fmtKickoff(kickoff)}`,
  }));

  revalidatePath("/");
  redirect(`/t/${data.share_slug}?posted=1`);
}

/**
 * 🔔 Tell the other members about a new tip. The devices are fetched now; the sending happens after
 * the response, so posting isn't slowed down. A notification failure never blocks the tip.
 */
async function notifyNewTip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tip: { id: string; share_slug: string },
  text: (username: string) => { title: string; body: string },
) {
  if (!pushConfigured()) return;
  try {
    const [{ data: targets }, me] = await Promise.all([supabase.rpc("get_push_targets", { p_tip: tip.id }), getMyProfile()]);
    const list = (targets ?? []) as PushTarget[];
    if (list.length === 0) return;
    const payload = { ...text(me?.username ?? "Someone"), url: `/t/${tip.share_slug}`, tag: `tip-${tip.id}` };
    after(async () => {
      const dead = await sendPush(list, payload);
      if (dead.length > 0) await supabase.rpc("remove_push_subscriptions", { p_endpoints: dead });
    });
  } catch (e) {
    console.error("push notification setup failed", e);
  }
}

type LegInput = {
  fixture_id: number | null;
  sport: string;
  league: string | null;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  kickoff_at: string;
  selection: string;
  odds: number | null;
};

/** Post a combo (kombi): 2–20 matches on one slip, one stake and one total odds. */
export async function createComboTip(fd: FormData) {
  const groupId = str(fd, "groupId");
  function fail(message: string): never {
    redirect(withParam("/new?combo=1", "error", message));
  }

  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "legs") || "[]");
  } catch {
    fail("The matches on the slip couldn't be read – try again.");
  }
  if (!Array.isArray(raw) || raw.length < 2) fail("Tilføj mindst 2 kampe til kombien.");
  if (raw.length > 20) fail("En kombi kan højst have 20 kampe.");

  // Matches from the Kampprogram: take teams, kickoff and logos from the API, not from the browser.
  const fixtureIds = raw.map((l) => Number(l?.fixture_id)).filter((n) => Number.isInteger(n) && n > 0);
  const fixtures = new Map<number, Awaited<ReturnType<typeof getUpcomingMatches>>[number]>();
  if (fixtureIds.length) {
    try {
      for (const m of await getUpcomingMatches(10)) fixtures.set(m.id, m);
    } catch {
      // API down → use what the browser sent (still checked below)
    }
  }

  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const legs: LegInput[] = raw.map((l: Record<string, unknown>, i: number) => {
    const n = i + 1;
    const m = fixtures.get(Number(l.fixture_id));
    const selection = text(l.selection, 200);
    const odds = l.odds == null || l.odds === "" ? null : Number(l.odds);
    if (selection.length < 2) fail(`Kamp ${n}: skriv hvad du spiller på.`);
    if (odds !== null && !(odds > 1)) fail(`Kamp ${n}: odds skal være over 1.00.`);
    if (m) {
      return {
        fixture_id: m.id,
        sport: "Football",
        league: competitionName(m.competition.code, m.competition.name),
        home_team: teamName(m.homeTeam),
        away_team: teamName(m.awayTeam),
        home_logo: m.homeTeam.crest && isCrestUrl(m.homeTeam.crest) ? m.homeTeam.crest : null,
        away_logo: m.awayTeam.crest && isCrestUrl(m.awayTeam.crest) ? m.awayTeam.crest : null,
        kickoff_at: m.utcDate,
        selection,
        odds,
      };
    }
    const home = text(l.home_team, 80);
    const away = text(l.away_team, 80);
    const kickoff = text(l.kickoff_at, 40);
    if (!home || !away) fail(`Kamp ${n}: udfyld begge hold.`);
    if (!kickoff || Number.isNaN(Date.parse(kickoff))) fail(`Kamp ${n} (${home} – ${away}): vælg dato og tidspunkt.`);
    return {
      fixture_id: null,
      sport: text(l.sport, 40) || "Football",
      league: text(l.league, 80) || null,
      home_team: home,
      away_team: away,
      home_logo: null,
      away_logo: null,
      kickoff_at: new Date(kickoff).toISOString(),
      selection,
      odds,
    };
  });
  const started = legs.find((l) => Date.parse(l.kickoff_at) <= Date.now());
  if (started) fail(`${started.home_team} – ${started.away_team} er allerede startet – fjern den fra kuponen.`);

  fd.set("selection", "kombi"); // the per-match picks are checked above; readBet checks the rest
  const { odds, boosted, stake, bookmakerId, reasoning, promo } = readBet(fd, fail);

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_combo_tip", {
      p_group: groupId,
      p_legs: legs,
      p_odds: odds,
      p_boosted_odds: boosted,
      p_bookmaker_id: bookmakerId,
      p_stake_units: stake,
      p_reasoning: reasoning,
      p_promo: promo ?? "",
    })
    .single<{ id: string; share_slug: string }>();
  if (error || !data) {
    fail(
      error?.code === "PGRST202"
        ? "Kombi er ikke sat op i databasen endnu – kør migration 0012_combos_and_bookmakers.sql i Supabase."
        : (error?.message ?? "Couldn't save the combo."),
    );
  }

  const first = [...legs].sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))[0];
  await notifyNewTip(supabase, data, (me) => ({
    title: `@${me}: 🧩 Kombi (${legs.length}) @ ${fmtOdds(boosted ?? odds)}`,
    body: `${legs.map((l) => `${l.home_team}–${l.away_team}: ${l.selection}`).join(" · ").slice(0, 160)} · første kamp ${fmtKickoff(first.kickoff_at)}`,
  }));

  revalidatePath("/");
  redirect(`/t/${data.share_slug}?posted=1`);
}

// ───────── 🔔 notifications ─────────

/** Turn notifications on for this device (called from the browser after the user allows them). */
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string }): Promise<{ error?: string }> {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Log in first." };
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
    p_user_agent: sub.userAgent ?? null,
  });
  if (error) {
    return { error: error.code === "PGRST202" ? "Notifications aren't set up in the database yet (migration 0009)." : error.message };
  }
  return {};
}

/** Turn notifications off for this device. */
export async function deletePushSubscription(endpoint: string): Promise<{ error?: string }> {
  const { supabase, user } = await getAuth();
  if (!user) return {};
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? { error: error.message } : {};
}

/** Pick, odds, bookmaker, stake and reasoning from the form – same rules for posting and editing. */
function readBet(fd: FormData, fail: (message: string) => never) {
  const selection = str(fd, "selection");
  const odds = num(fd, "odds");
  const boosted = num(fd, "boosted_odds");
  const stake = num(fd, "stake_units");
  const bookmakerId = Number(str(fd, "bookmaker_id"));

  if (selection.length < 2) fail("Choose what you're betting on (1 X 2, a player bet, or write it under “Other”).");
  if (odds === null || !(odds > 1)) fail("Odds must be above 1.00 (decimal odds).");
  if (boosted !== null && !(boosted > odds!)) fail("Boosted odds must be higher than the normal odds.");
  if (stake === null || !(stake > 0 && stake <= 10)) fail("Stake must be between 0.5 and 10 units.");
  if (!bookmakerId) fail("Pick the bookmaker the odds are from.");

  const promoRaw = str(fd, "promo");
  if (promoRaw && !isPromo(promoRaw)) fail("Unknown offer type.");
  // Boosted odds without a marked offer count as a plain "Odds boost" in the statistics.
  const promo: Promo | null = isPromo(promoRaw) ? promoRaw : boosted !== null ? "odds_boost" : null;

  return {
    selection,
    odds: odds!,
    boosted,
    stake: Math.round(stake! * 10) / 10,
    bookmakerId,
    reasoning: str(fd, "reasoning") || null,
    promo,
    /** false when the promo was only derived from boosted odds (then it may be dropped on an old database) */
    promoChosen: isPromo(promoRaw),
  };
}

const PROMO_MIGRATION_MSG = "Tilbud er ikke sat op i databasen endnu – kør migration 0011_promos.sql i Supabase.";

/** True when the database doesn't know the promo column / new edit_tip yet (migration 0011 not run). */
function promoMissing(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || error.code === "PGRST202" || /promo/.test(error.message ?? "");
}

/** Edit your own bet – only until kickoff (enforced in the database by edit_tip). */
export async function updateTip(fd: FormData) {
  const tipId = str(fd, "tipId");
  const slug = str(fd, "slug");
  const back = `/edit/${encodeURIComponent(slug)}`;

  function fail(message: string): never {
    redirect(withParam(back, "error", message));
  }

  const { selection, odds, boosted, stake, bookmakerId, reasoning, promo, promoChosen } = readBet(fd, fail);

  const supabase = await createClient();
  const args = {
    p_tip: tipId,
    p_selection: selection,
    p_odds: odds,
    p_boosted_odds: boosted,
    p_bookmaker_id: bookmakerId,
    p_stake_units: stake,
    p_reasoning: reasoning,
  };
  let { error } = await supabase.rpc("edit_tip", { ...args, p_promo: promo ?? "" });
  // Before migration 0011 only the old edit_tip exists – still save the edit when no offer was chosen.
  if (error?.code === "PGRST202" && !promoChosen) ({ error } = await supabase.rpc("edit_tip", args));
  if (error) fail(promoMissing(error) ? PROMO_MIGRATION_MSG : error.message);

  revalidatePath("/");
  revalidatePath(`/t/${slug}`);
  redirect(`/t/${slug}?edited=1`);
}

export async function settleTip(fd: FormData) {
  const tipId = str(fd, "tipId");
  const status = str(fd, "status") as TipStatus;
  const back = safePath(str(fd, "back"));
  const backPath = new URL(back, "http://local").pathname;

  if (!TIP_STATUSES.includes(status)) redirect(withParam(back, "error", "Invalid result"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_tip", { p_tip: tipId, p_status: status });
  if (error) redirect(withParam(back, "error", error.message));
  revalidatePath(backPath);
  redirect(back);
}

export async function deleteTip(fd: FormData) {
  const tipId = str(fd, "tipId");
  const supabase = await createClient();
  const { error, count } = await supabase.from("tips").delete({ count: "exact" }).eq("id", tipId);
  if (error || !count) {
    redirect(withParam("/", "error", error?.message ?? "Tips can only be deleted by their author before kickoff."));
  }
  revalidatePath("/");
  redirect(withParam("/", "notice", "Tip deleted."));
}

/** Admin-only: remove a member (optionally delete their tips and reset the invite link). */
export async function removeMember(fd: FormData) {
  const groupId = str(fd, "groupId");
  const userId = str(fd, "userId");
  const username = str(fd, "username");
  const deleteTips = fd.get("deleteTips") === "on";
  const resetInvite = fd.get("resetInvite") === "on";

  const supabase = await createClient();
  const { data: deleted, error } = await supabase.rpc("remove_member", {
    p_group: groupId,
    p_user: userId,
    p_delete_tips: deleteTips,
  });
  if (error) redirect(withParam("/", "error", error.message));

  if (resetInvite) {
    const { error: resetError } = await supabase.rpc("regenerate_invite", { p_group: groupId });
    if (resetError) redirect(withParam("/", "error", `@${username} was removed, but the invite link couldn't be reset: ${resetError.message}`));
  }

  revalidatePath("/");
  revalidatePath("/leaderboard");
  const parts = [`@${username} was removed`];
  if (deleteTips) parts.push(`${deleted ?? 0} spilforslag deleted`);
  if (resetInvite) parts.push("new invite link created");
  redirect(withParam("/", "notice", `${parts.join(" · ")}.`));
}

// ───────── profile ─────────

export async function updateUsername(fd: FormData) {
  const username = str(fd, "username");
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) redirect(withParam("/profile", "error", "Username: 3–20 letters, numbers or _"));

  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").update({ username }).eq("id", user.id);
  if (error) {
    redirect(withParam("/profile", "error", error.code === "23505" ? "That username is taken." : error.message));
  }
  revalidatePath("/", "layout");
  redirect(withParam("/profile", "notice", `You're now @${username} ✓`));
}

// ───────── 🤝 I'm on it ─────────

/** Join or leave a tip ("I'm playing this too"). Called from the button without a page reload. */
export async function toggleTail(tipId: string, join: boolean): Promise<{ error?: string }> {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Log in first." };

  const { error } = join
    ? await supabase.from("tip_tails").insert({ tip_id: tipId })
    : await supabase.from("tip_tails").delete().eq("tip_id", tipId).eq("user_id", user.id);

  if (error && error.code !== "23505") {
    return {
      error: error.code === "42501" ? "Too late – the match has started (or it's your own tip)." : error.message,
    };
  }
  revalidatePath("/");
  return {};
}

// ───────── 💬 comments + reactions ─────────

const SOCIAL_MIGRATION_MSG = "Kommentarer er ikke sat op i databasen endnu – kør migration 0015_comments_reactions.sql i Supabase.";
const tableMissing = (code?: string) => code === "42P01" || code === "PGRST205" || code === "PGRST202";

/** Post a comment on a tip. Returns it (with your name and picture) so the card can show it at once. */
export async function addComment(tipId: string, body: string): Promise<{ comment?: TipComment; error?: string }> {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Log in first." };
  const text = body.trim();
  if (!text) return { error: "Skriv en kommentar først." };
  if (text.length > 500) return { error: "Max 500 tegn." };

  const { data, error } = await supabase
    .from("tip_comments")
    .insert({ tip_id: tipId, body: text })
    .select("id, author_id, body, created_at")
    .single();
  if (error || !data) {
    return { error: tableMissing(error?.code) ? SOCIAL_MIGRATION_MSG : error?.code === "42501" ? "Du kan kun kommentere i din egen gruppe." : (error?.message ?? "Kunne ikke gemme.") };
  }
  const me = await getMyProfile();

  // 🔔 tell the tipster and the others in the thread (after the response, never blocking the comment)
  if (pushConfigured()) {
    try {
      const [{ data: targets }, { data: tip }] = await Promise.all([
        supabase.rpc("get_comment_push_targets", { p_comment: data.id }),
        supabase.from("tips").select("share_slug, selection").eq("id", tipId).single(),
      ]);
      const list = (targets ?? []) as PushTarget[];
      if (list.length > 0 && tip) {
        const payload = {
          title: `💬 @${me?.username ?? "Someone"} på “${tip.selection.slice(0, 60)}”`,
          body: text.slice(0, 140),
          url: `/t/${tip.share_slug}`,
          tag: `comments-${tipId}`,
        };
        after(async () => {
          const dead = await sendPush(list, payload);
          if (dead.length > 0) await supabase.rpc("remove_push_subscriptions", { p_endpoints: dead });
        });
      }
    } catch (e) {
      console.error("comment push setup failed", e);
    }
  }

  revalidatePath("/");
  return {
    comment: {
      ...data,
      username: me?.username ?? "me",
      avatar_url: me?.avatar_url ?? null,
    },
  };
}

/** Delete a comment – your own, or any comment if you're the group admin (checked by the database). */
export async function deleteComment(commentId: string): Promise<{ error?: string }> {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Log in first." };
  const { error, count } = await supabase.from("tip_comments").delete({ count: "exact" }).eq("id", commentId);
  if (error) return { error: error.message };
  if (count === 0) return { error: "Du kan kun slette dine egne kommentarer." };
  revalidatePath("/");
  return {};
}

/** Give or take back a reaction (🔥 💰 😬 🤡) on a tip. */
export async function toggleReaction(tipId: string, reaction: string, on: boolean): Promise<{ error?: string }> {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Log in first." };
  if (!isReaction(reaction)) return { error: "Ukendt reaktion." };
  const { error } = on
    ? await supabase.from("tip_reactions").insert({ tip_id: tipId, reaction })
    : await supabase.from("tip_reactions").delete().eq("tip_id", tipId).eq("user_id", user.id).eq("reaction", reaction);
  if (error && error.code !== "23505") {
    return { error: tableMissing(error.code) ? SOCIAL_MIGRATION_MSG : error.message };
  }
  revalidatePath("/");
  return {};
}
