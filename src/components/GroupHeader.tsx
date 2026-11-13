import Link from "next/link";
import { btnPrimary, Card } from "./ui";

const TITLES = {
  tips: { title: "Spilforslag", sub: "Open and settled tips from the group" },
  fixtures: { title: "Kampprogram", sub: "Top 5 leagues + Champions League · next 10 days" },
  leaderboard: { title: "Leaderboard", sub: "Who has the best ROI?" },
} as const;

/** Page title row. Navigation itself lives in the top bar / phone tab bar. */
export function GroupHeader({ active }: { active: keyof typeof TITLES }) {
  const t = TITLES[active];
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h1>
        <p className="text-sm text-muted">{t.sub}</p>
      </div>
      <div className="hidden shrink-0 sm:block">
        <Link href="/new" className={btnPrimary}>
          + Spilforslag
        </Link>
      </div>
    </div>
  );
}

export function NotInGroup() {
  return (
    <Card className="mx-auto max-w-md space-y-2 p-8 text-center">
      <h1 className="text-xl font-bold">You&apos;re not in Gamblers yet</h1>
      <p className="text-sm text-muted">Ask someone in the group for an invite link and open it while logged in.</p>
    </Card>
  );
}
