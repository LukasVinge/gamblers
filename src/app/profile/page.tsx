import { updateUsername } from "../actions";
import { getAuth, getMyProfile } from "@/lib/supabase/server";
import { getMainGroup } from "@/lib/group";
import { fmtUnits, profitClass } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";
import { AvatarUploader } from "@/components/AvatarUploader";
import { InstallHint } from "@/components/InstallHint";
import { NotificationToggle } from "@/components/NotificationToggle";
import { btnPrimary, Card, Field, inputCls, Notice } from "@/components/ui";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await getAuth();

  const [me, group] = await Promise.all([getMyProfile(), getMainGroup(supabase)]);
  if (!me) return <Notice error="Couldn't load your profile." />;

  // All-time stats for the header card
  let stats: LeaderboardRow | undefined;
  if (group) {
    const { data } = await supabase.rpc("group_leaderboard", { p_group: group.id, p_since: null });
    stats = ((data ?? []) as LeaderboardRow[]).find((r) => r.user_id === user!.id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your profile</h1>
        <p className="text-sm text-muted">Your picture and name show on your spilforslag, the members list and the leaderboard.</p>
      </div>
      <Notice error={sp.error} notice={sp.notice} />

      <Card className="space-y-6 p-5">
        <AvatarUploader userId={user!.id} username={me.username} avatarUrl={me.avatar_url} />

        {stats && (
          <dl className="grid grid-cols-2 gap-3 border-t border-line pt-5 text-center sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Settled tips</dt>
              <dd className="font-mono text-lg font-semibold">{stats.settled}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">W–L–V</dt>
              <dd className="font-mono text-lg font-semibold">
                {stats.wins}–{stats.losses}–{stats.voids}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Profit</dt>
              <dd className={`font-mono text-lg font-semibold ${profitClass(Number(stats.profit))}`}>{fmtUnits(Number(stats.profit))}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">ROI</dt>
              <dd className={`font-mono text-lg font-semibold ${profitClass(stats.roi === null ? null : Number(stats.roi))}`}>
                {stats.roi === null ? "—" : `${Number(stats.roi) > 0 ? "+" : ""}${Number(stats.roi).toFixed(1)}%`}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="p-5">
        <InstallHint variant="profile" />
      </Card>

      <Card className="p-5">
        <NotificationToggle />
      </Card>

      <Card className="p-5">
        <form action={updateUsername} className="space-y-4">
          <Field label="Username" hint="3–20 letters, numbers or _ · shown as @name everywhere">
            <input
              name="username"
              required
              pattern="[a-zA-Z0-9_]{3,20}"
              defaultValue={me.username}
              autoComplete="username"
              className={inputCls}
            />
          </Field>
          <button className={btnPrimary}>Save username</button>
        </form>
      </Card>
    </div>
  );
}
