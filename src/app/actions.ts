"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { competitionName, getMatch, isCrestUrl, teamName } from "@/lib/footballData";
import { TIP_STATUSES, type TipStatus } from "@/lib/types";

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
  const { selection, odds, boosted, stake, bookmakerId, reasoning } = readBet(fd, fail);

  const supabase = await createClient();
  const { data, error } = await supabase
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
    })
    .select("share_slug")
    .single();

  if (error) fail(error.message);
  revalidatePath("/");
  redirect(`/t/${data.share_slug}?posted=1`);
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

  return {
    selection,
    odds: odds!,
    boosted,
    stake: Math.round(stake! * 10) / 10,
    bookmakerId,
    reasoning: str(fd, "reasoning") || null,
  };
}

/** Edit your own bet – only until kickoff (enforced in the database by edit_tip). */
export async function updateTip(fd: FormData) {
  const tipId = str(fd, "tipId");
  const slug = str(fd, "slug");
  const back = `/edit/${encodeURIComponent(slug)}`;

  function fail(message: string): never {
    redirect(withParam(back, "error", message));
  }

  const { selection, odds, boosted, stake, bookmakerId, reasoning } = readBet(fd, fail);

  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_tip", {
    p_tip: tipId,
    p_selection: selection,
    p_odds: odds,
    p_boosted_odds: boosted,
    p_bookmaker_id: bookmakerId,
    p_stake_units: stake,
    p_reasoning: reasoning,
  });
  if (error) fail(error.message);

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
