import Link from "next/link";
import QRCode from "qrcode";
import { deleteTip, regenerateInvite } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { getMainGroup } from "@/lib/group";
import { getBaseUrl } from "@/lib/url";
import { inviteMessage, openTipsDigest } from "@/lib/shareText";
import { TIP_SELECT, toTipView, type TipRow } from "@/lib/types";
import { GroupHeader, NotInGroup } from "@/components/GroupHeader";
import { SettleForm } from "@/components/SettleForm";
import { ShareSheet } from "@/components/ShareSheet";
import { TipCard } from "@/components/TipCard";
import { btnGhost, btnPrimary, Card, Notice } from "@/components/ui";

type View = "upcoming" | "settled" | "all";
type Member = { user_id: string; role: string; profile: { username: string } | null };

function Landing() {
  return (
    <section className="space-y-8 py-10">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Gamblers · invite only</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Post your tips. Track every hit and miss. Settle the arguments.
        </h1>
        <p className="max-w-xl text-muted">
          Share odds from any bookmaker, settle results, and let the leaderboard show who really has the best ROI.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/login" className={btnPrimary}>
          Log in
        </Link>
        <Link href="/signup" className={btnGhost}>
          I have an invite
        </Link>
      </div>
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; error?: string; notice?: string; fixture?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Landing />;

  const group = await getMainGroup(supabase);
  if (!group) return <NotInGroup />;

  const sp = await searchParams;
  const view: View = sp.view === "settled" || sp.view === "all" ? sp.view : "upcoming";
  const id = group.id;

  const fixtureId = /^\d+$/.test(sp.fixture ?? "") ? Number(sp.fixture) : null;

  let tipsQuery = supabase.from("tips").select(TIP_SELECT).eq("group_id", id).limit(100);
  if (fixtureId) tipsQuery = tipsQuery.eq("fixture_id", fixtureId);
  if (view === "upcoming") tipsQuery = tipsQuery.eq("status", "pending").order("kickoff_at", { ascending: true });
  else if (view === "settled") tipsQuery = tipsQuery.neq("status", "pending").order("kickoff_at", { ascending: false });
  else tipsQuery = tipsQuery.order("kickoff_at", { ascending: false });

  const [{ data: tipRows }, { data: memberRows }, { count: totalTips }] = await Promise.all([
    tipsQuery,
    supabase.from("group_members").select("user_id, role, profile:profiles(username)").eq("group_id", id).order("joined_at"),
    supabase.from("tips").select("id", { count: "exact", head: true }).eq("group_id", id),
  ]);

  const tips = ((tipRows ?? []) as unknown as TipRow[]).map(toTipView);
  const members = (memberRows ?? []) as unknown as Member[];
  const isAdmin = members.some((m) => m.user_id === user.id && m.role === "admin");
  const baseUrl = await getBaseUrl();
  const tipUrl = (slug: string) => `${baseUrl}/t/${slug}`;
  // Only admins can invite: the invite code is only loaded for them (and the database hides it from others).
  let inviteUrl: string | null = null;
  if (isAdmin) {
    const { data: code, error: codeError } = await supabase.rpc("get_invite_code", { p_group: id });
    let inviteCode = codeError ? null : (code as string | null);
    if (!inviteCode) {
      // Fallback for databases where 0005_admin_only_invites.sql hasn't been run yet.
      const { data: g } = await supabase.from("groups").select("invite_code").eq("id", id).maybeSingle();
      inviteCode = (g as { invite_code?: string } | null)?.invite_code ?? null;
    }
    if (inviteCode) inviteUrl = `${baseUrl}/join/${inviteCode}`;
  }
  const qrSvg = inviteUrl ? await QRCode.toString(inviteUrl, { type: "svg", margin: 1 }) : undefined;
  const now = Date.now();
  const back = `/?view=${view}`;

  const needsFriends = isAdmin && inviteUrl !== null && members.length < 2;
  const needsTips = (totalTips ?? 0) === 0;

  const invite = (label: string, primary: boolean) =>
    inviteUrl ? (
      <ShareSheet
        title={`Invite friends to ${group.name}`}
        message={inviteMessage(group.name)}
        url={inviteUrl}
        label={label}
        primary={primary}
        qrSvg={qrSvg}
      />
    ) : null;

  return (
    <div className="space-y-6">
      <GroupHeader active="tips" />
      <Notice error={sp.error} notice={sp.notice} />

      {(needsFriends || needsTips) && (
        <Card className="space-y-4 border-accent/30 bg-accent-soft p-5">
          <h2 className="font-semibold">Get {group.name} going 🚀</h2>
          <ol className="space-y-3 text-sm">
            {isAdmin && (
              <li className="flex items-center justify-between gap-3">
                <span className={needsFriends ? "" : "text-muted line-through"}>
                  <b>1.</b> Invite your friends – they sign up and land straight in {group.name}
                </span>
                {needsFriends && invite("Invite", true)}
              </li>
            )}
            <li className="flex items-center justify-between gap-3">
              <span className={needsTips ? "" : "text-muted line-through"}>
                {isAdmin && <b>2. </b>}Post the first tip and share it in your group chat
              </span>
              {needsTips && (
                <Link href="/new" className={btnPrimary}>
                  Post tip
                </Link>
              )}
            </li>
          </ol>
        </Card>
      )}

      {fixtureId && (
        <div className="flex items-center justify-between rounded-lg bg-surface px-4 py-2 text-sm ring-1 ring-line">
          <span className="text-ink-2">Showing spilforslag for one match</span>
          <Link href="/" className="text-accent hover:underline">
            Show all
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm">
          {(["upcoming", "settled", "all"] as const).map((v) => (
            <Link
              key={v}
              href={`/?view=${v}`}
              className={`rounded-full px-3 py-1 capitalize ring-1 ${
                v === view ? "bg-accent text-white ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-line-strong"
              }`}
            >
              {v}
            </Link>
          ))}
        </div>
        {view === "upcoming" && tips.length > 1 && (
          <ShareSheet
            size="sm"
            label={`Share all ${tips.length} open tips`}
            title="Share all open tips"
            message={openTipsDigest(group.name, tips, (t) => tipUrl(t.share_slug))}
          />
        )}
      </div>

      {tips.length === 0 ? (
        <Card className="space-y-3 p-8 text-center text-muted">
          <p>{view === "upcoming" ? "No open spilforslag right now – find a match in the Kampprogram." : "Nothing here yet."}</p>
          {view === "upcoming" && (
            <Link href="/kampprogram" className={btnPrimary}>
              Open Kampprogram
            </Link>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {tips.map((t) => {
            const started = Date.parse(t.kickoff_at) <= now;
            const canSettle = (t.author_id === user.id || isAdmin) && (started || t.status !== "pending");
            const canDelete = t.author_id === user.id && t.status === "pending" && !started;
            return (
              <li key={t.id}>
                <TipCard tip={t} shareUrl={tipUrl(t.share_slug)}>
                  {canSettle && <SettleForm tipId={t.id} current={t.status} back={back} />}
                  {canDelete && (
                    <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                      <Link
                        href={`/edit/${t.share_slug}`}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-accent ring-1 ring-accent/30 hover:bg-accent-soft"
                      >
                        Edit bet
                      </Link>
                      <form action={deleteTip}>
                        <input type="hidden" name="tipId" value={t.id} />
                        <button className="text-xs text-muted hover:text-loss">Delete</button>
                      </form>
                    </div>
                  )}
                </TipCard>
              </li>
            );
          })}
        </ul>
      )}

      <div className={`grid gap-4 ${inviteUrl ? "sm:grid-cols-2" : ""}`}>
        {inviteUrl && (
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Invite friends</h2>
              <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] text-muted">only you see this</span>
            </div>
            <p className="text-sm text-muted">Send the link in your group chat, or show the QR code to friends next to you.</p>
            {invite("Invite friends", false)}
            <form action={regenerateInvite}>
              <input type="hidden" name="groupId" value={id} />
              <button className="text-xs text-muted hover:text-ink-2">Reset invite link (old one stops working)</button>
            </form>
          </Card>
        )}
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Members ({members.length})</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {members.map((m) => (
              <li key={m.user_id} className="rounded-full bg-subtle px-3 py-1">
                @{m.profile?.username}
                {m.role === "admin" && <span className="ml-1 text-xs text-accent">admin</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
