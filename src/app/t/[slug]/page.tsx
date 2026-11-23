import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/supabase/server";
import { fmtKickoff, fmtOdds, effectiveOdds } from "@/lib/format";
import { getSharedTip } from "@/lib/sharedTip";
import { getBaseUrl } from "@/lib/url";
import { SettleForm } from "@/components/SettleForm";
import { tipMessage } from "@/lib/shareText";
import { ShareSheet } from "@/components/ShareSheet";
import { TipSocial } from "@/components/TipSocial";
import { emptyReactions, getSocial, type TipSocialData } from "@/lib/social";
import { TipCard } from "@/components/TipCard";
import { getTails, type TailUser } from "@/lib/tails";
import { Card, Notice } from "@/components/ui";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ posted?: string; edited?: string; error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tip = await getSharedTip(slug);
  if (!tip) return { title: "Tip not found" };
  const title = `${tip.selection} @ ${fmtOdds(effectiveOdds(tip))}`;
  const description = `${tip.home_team} vs ${tip.away_team} · ${fmtKickoff(tip.kickoff_at)} · ${tip.bookmaker_name} · tip by @${tip.author_username}`;
  // The preview image comes from ./opengraph-image.tsx automatically.
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedTipPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { posted, edited, error } = await searchParams;
  const tip = await getSharedTip(slug);
  if (!tip) notFound();

  const { supabase, user } = await getAuth();

  let isMember = false;
  let canSettle = false;
  const canEdit = user?.id === tip.author_id && tip.status === "pending" && Date.parse(tip.kickoff_at) > Date.now();
  // 🤝 Who's on this tip (members only – the database returns nothing for non-members)
  let tailUsers: TailUser[] = [];
  let me: TailUser | null = null;
  let isAdmin = false;
  let social: TipSocialData | null = null;
  if (user) {
    // One parallel round trip: membership, admin rights, who's on it, comments + reactions, and your own profile.
    const [{ data: member }, { data: admin }, tails, socialMap, myProfile] = await Promise.all([
      supabase.rpc("is_member", { p_group: tip.group_id }),
      supabase.rpc("is_admin", { p_group: tip.group_id }),
      getTails(supabase, [tip.id]),
      getSocial(supabase, [tip.id], user.id),
      getMyProfile(),
    ]);
    isMember = Boolean(member);
    isAdmin = Boolean(admin);
    social = socialMap ? (socialMap.get(tip.id) ?? { comments: [], reactions: emptyReactions() }) : null;
    canSettle =
      (tip.author_id === user.id || Boolean(admin)) && (Date.parse(tip.kickoff_at) <= Date.now() || tip.status !== "pending");
    if (isMember) {
      tailUsers = tails.get(tip.id) ?? [];
      me = { user_id: user.id, username: myProfile?.username ?? "me", avatar_url: myProfile?.avatar_url ?? null };
    }
  }
  const canTail = Boolean(me) && tip.author_id !== user?.id && tip.status === "pending" && Date.parse(tip.kickoff_at) > Date.now();

  const url = `${await getBaseUrl()}/t/${tip.share_slug}`;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Notice
        error={error}
        notice={posted ? "Tip posted! 🎉 Now send it to the group chat ↓" : edited ? "Changes saved ✓" : undefined}
      />
      <p className="text-sm text-muted">
        {isMember ? (
          <Link href="/" className="hover:text-ink">
            ← {tip.group_name}
          </Link>
        ) : (
          <>Shared from {tip.group_name}</>
        )}
      </p>

      <TipCard
        tip={tip}
        linkToShare={false}
        showReasoning
        social={
          isMember ? (
            <TipSocial tipId={tip.id} tails={tailUsers} me={me} canTail={canTail} social={social} isAdmin={isAdmin} collapsedCount={100} />
          ) : undefined
        }
      >
        {canSettle && <SettleForm tipId={tip.id} current={tip.status} back={`/t/${tip.share_slug}`} />}
        {canEdit && (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-xs text-muted">You can change this bet until kickoff.</span>
            <Link
              href={`/edit/${tip.share_slug}`}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-accent ring-1 ring-accent/30 hover:bg-accent-soft"
            >
              Edit bet
            </Link>
          </div>
        )}
      </TipCard>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">{tip.status === "pending" ? "Share this tip" : "Share the result"}</h2>
        <ShareSheet variant="inline" title={`${tip.selection} @ ${fmtOdds(effectiveOdds(tip))}`} message={tipMessage(tip)} url={url} />
      </Card>

      {!user && (
        <p className="text-sm text-muted">
          Gamblers is invite only.{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>{" "}
          if you&apos;re already a member.
        </p>
      )}
    </div>
  );
}
