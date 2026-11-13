-- Odds League – link tips to real fixtures and store club logos
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001 and 0002).

alter table public.tips
  add column if not exists fixture_id bigint,
  add column if not exists home_logo  text,
  add column if not exists away_logo  text;

-- Logos may only point at football-data.org's crest server.
alter table public.tips drop constraint if exists tips_logo_host;
alter table public.tips add constraint tips_logo_host check (
  (home_logo is null or home_logo like 'https://crests.football-data.org/%') and
  (away_logo is null or away_logo like 'https://crests.football-data.org/%')
);

create index if not exists tips_fixture_idx on public.tips (fixture_id) where fixture_id is not null;

-- Share links now include the logos (return type changed, so drop + recreate).
drop function if exists public.get_shared_tip(text);
create function public.get_shared_tip(p_slug text)
returns table (
  id uuid, share_slug text, group_id uuid, group_name text, author_id uuid,
  author_username text, sport text, league text, home_team text, away_team text,
  kickoff_at timestamptz, selection text, odds numeric, boosted_odds numeric,
  bookmaker_name text, bookmaker_url text, stake_units numeric, reasoning text,
  status text, settled_at timestamptz, fixture_id bigint, home_logo text, away_logo text
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.share_slug, t.group_id, g.name, t.author_id,
         p.username, t.sport, t.league, t.home_team, t.away_team,
         t.kickoff_at, t.selection, t.odds, t.boosted_odds,
         b.name, b.url, t.stake_units, t.reasoning,
         t.status, t.settled_at, t.fixture_id, t.home_logo, t.away_logo
  from public.tips t
  join public.groups g on g.id = t.group_id
  join public.profiles p on p.id = t.author_id
  join public.bookmakers b on b.id = t.bookmaker_id
  where t.share_slug = p_slug;
$$;
revoke execute on function public.get_shared_tip(text) from public;
grant execute on function public.get_shared_tip(text) to anon, authenticated;

-- Make the API see the new columns immediately.
notify pgrst, 'reload schema';
