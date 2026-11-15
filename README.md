# Odds League

A private, **invite-only** site where you and your friends post betting tips, settle them, and compete on a leaderboard (ROI, hit rate, profit in units). Every tip has a share link with a rich preview for Messenger / WhatsApp / Discord.

**Stack:** Next.js 15 (App Router) · Supabase (Postgres, Auth, row-level security) · Tailwind CSS · hosted on Vercel.

---

## Get it running (≈15 minutes)

### 1. Create a Supabase project (free)
1. Go to <https://supabase.com>, sign up and click **New project**. Pick region *Europe (Frankfurt)* or *Stockholm*.
2. When it's ready, open **SQL Editor → New query**, paste the whole of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and click **Run**. This creates all tables, security rules and the bookmaker list. Then do the same with [`0002_single_group.sql`](supabase/migrations/0002_single_group.sql), which locks the site to one group called **Gamblers**, and finally [`0003_fixtures_and_logos.sql`](supabase/migrations/0003_fixtures_and_logos.sql), which links spilforslag to real matches and stores club logos.
3. Open **Authentication → URL Configuration** and set
   - **Site URL:** `http://localhost:3000` (change to your real URL when you deploy)
   - **Redirect URLs:** add `http://localhost:3000/auth/callback`
4. *(Optional, for faster local testing)* **Authentication → Sign In / Providers → Email**: turn off **Confirm email**. Turn it back on before inviting friends.

### 2. Connect the app
```bash
cp .env.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from Supabase's **Connect** button (or *Project Settings → API Keys*).

### 3. Start it
```bash
npm install
npm run dev
```
Open <http://localhost:3000>.

### 4. Bootstrap your league
1. Go to **/signup**. As the very first user you don't need an invite, and you automatically become admin of **Gamblers** – the one and only group.
2. On the front page, tap **Invite** and send the link to your friends (or show them the QR code). Everyone after you *must* have a valid invite code – this is enforced in the database, not just the UI.

---

## Deploy (Vercel, free)
1. Push this folder to a GitHub repo.
2. On <https://vercel.com> → **Add New → Project** → import the repo.
3. Add the env vars from `.env.local`, plus `NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app`.
4. In Supabase → Authentication → URL Configuration, set the **Site URL** to the Vercel URL and add `https://<your-app>.vercel.app/auth/callback` to **Redirect URLs**.

---

## How it works

| Feature | Where |
|---|---|
| Invite-only signup | `handle_new_user()` trigger rejects signups without a valid invite code (except the first user) |
| One group: Gamblers | Tip feed at `/`, leaderboard at `/leaderboard`, new tip at `/new`, invites via `/join/[code]` – admins can reset the invite link |
| Post a tip | `/new` – sport, match, pick, odds, boosted odds, **bookmaker**, stake (0.5–10 units), reasoning |
| Honest records | No one can post after kickoff, and odds/stake can't be edited (no UPDATE policy) |
| Settle results | Tipster or group admin: Won / Lost / Void / Half won / Half lost. Every change is logged in `tip_events` |
| Leaderboard | `/leaderboard` – week / month / year / all time, ranked by ROI (5+ settled tips required) |
| Share links | `/t/[slug]` – public page for one tip + auto-generated preview image (`opengraph-image.tsx`) |

**Formulas** (same in SQL and UI)
- Won: `stake × (odds − 1)` · Lost: `−stake` · Void: `0` · Half won/lost: half of that. Boosted odds are used when set.
- **ROI** = profit ÷ staked (voids excluded) · **Hit rate** = wins ÷ (wins + losses)

## Project layout
```
supabase/migrations/0001_init.sql   ← database: tables, RLS, functions, seed bookmakers
src/middleware.ts                   ← keeps the login session fresh, guards private pages
src/app/actions.ts                  ← all server actions (login, signup, groups, tips, settle)
src/app/page.tsx, leaderboard/, new/  ← tip feed, leaderboard, new tip
src/app/t/[slug]/…                  ← public share page + preview image
src/components/                     ← TipCard, SettleForm, ShareButtons, …
src/lib/                            ← Supabase clients, types, formatting
```

## Ideas for next steps
- Cumulative profit chart per tipster on the leaderboard
- "Dispute" button so others can flag a wrong result
- Profile pages (`/u/username`) with all-time stats per sport / bookmaker
- Notifications when someone posts a tip (web push or a Discord webhook)
- Auto-settling from a results API (e.g. API-Football)

> Just for tracking between friends – no money is handled by the site. Keep it private (no public marketing or affiliate links) so it stays a stats app, not a gambling service. 18+ · stopspillet.dk

## Kampprogram (fixtures & club logos)
The Kampprogram page pulls the next 10 days of matches from [football-data.org](https://www.football-data.org) – Champions League, the big 5 leagues and World Cup / EURO games – with club logos. ⭐ *Storkampe* are ranked by competition, knockout stage and the teams' league positions.

1. Get a free key at <https://www.football-data.org/client/register> (arrives by email).
2. Add `FOOTBALL_DATA_API_KEY=your-key` to `.env.local` (and to Vercel's env vars when deployed).
3. Restart `npm run dev`.

The free plan allows 10 requests/minute; everything is cached (fixtures 10 min, league tables 6 h), so normal use stays far below that. Nations League / qualifiers and the Superliga are not in the free plan.

## Notifications (new spilforslag)
Members can turn on push notifications per device (Profile → Notifications, or the 🔔 card on the Spilforslag page). When someone posts a tip, everyone else gets a notification that opens the tip.

1. Run [`supabase/migrations/0009_push_notifications.sql`](supabase/migrations/0009_push_notifications.sql) in Supabase's SQL Editor.
2. Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (from `.env.local`) to Vercel's environment variables and redeploy. To make new keys: `npx web-push generate-vapid-keys` – everyone then has to turn notifications on again.
3. iPhone: notifications only work in the installed app (Safari → Share → Add to Home Screen), iOS 16.4 or newer.
