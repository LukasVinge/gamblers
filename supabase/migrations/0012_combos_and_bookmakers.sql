-- Combo bets (kombi: several matches on one slip) + the bookmakers bet25 and Stake.
-- Run AFTER 0011_promos.sql. Safe to run more than once.

-- ───────── new bookmakers ─────────
insert into public.bookmakers (name, url) values
  ('bet25', 'https://bet25.dk'),
  ('Stake', 'https://stake.dk')
on conflict (name) do nothing;

-- ───────── the matches on a combo slip ─────────
-- A combo is still ONE tip (one stake, one total odds, one result), so the leaderboard, Boosts stats,
-- sharing and notifications all keep working. The tip row holds a summary; the matches live here.
create table if not exists public.tip_legs (
  id          bigint generated always as identity primary key,
  tip_id      uuid not null references public.tips(id) on delete cascade,
  position    smallint not null,
  sport       text not null default 'Football',
  league      text check (league is null or char_length(league) <= 80),
  home_team   text not null check (char_length(home_team) between 1 and 80),
  away_team   text not null check (char_length(away_team) between 1 and 80),
  kickoff_at  timestamptz not null,
  fixture_id  bigint,
  home_logo   text check (home_logo is null or home_logo like 'https://crests.football-data.org/%'),
  away_logo   text check (away_logo is null or away_logo like 'https://crests.football-data.org/%'),
  selection   text not null check (char_length(selection) between 2 and 200),
  odds        numeric(7,2) check (odds is null or odds > 1),
  unique (tip_id, position)
);
create index if not exists tip_legs_tip_idx on public.tip_legs (tip_id);

alter table public.tip_legs enable row level security;
revoke all on public.tip_legs from anon;
-- Written only through create_combo_tip (below); deleted together with the tip.
revoke insert, update, delete on public.tip_legs from authenticated;

drop policy if exists "members see combo legs" on public.tip_legs;
create policy "members see combo legs" on public.tip_legs
  for select to authenticated
  using (exists (select 1 from public.tips t where t.id = tip_id and public.is_member(t.group_id)));

-- ───────── post a combo ─────────
create or replace function public.create_combo_tip(
  p_group uuid,
  p_legs jsonb,
  p_odds numeric,
  p_boosted_odds numeric,
  p_bookmaker_id int,
  p_stake_units numeric,
  p_reasoning text,
  p_promo text default null
)
returns table (id uuid, share_slug text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  n int;
  first_leg jsonb;
  all_picks text;
  new_tip public.tips;
begin
  if auth.uid() is null then raise exception 'Log in first'; end if;
  if not public.is_member(p_group) then raise exception 'Not a member of this group'; end if;
  if jsonb_typeof(p_legs) <> 'array' then raise exception 'Legs must be a list'; end if;

  n := jsonb_array_length(p_legs);
  if n < 2 then raise exception 'A combo needs at least 2 matches'; end if;
  if n > 20 then raise exception 'A combo can have at most 20 matches'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_legs) l
    where (l->>'kickoff_at') is null or (l->>'kickoff_at')::timestamptz <= now()
  ) then
    raise exception 'Every match must be in the future – no posting after kickoff';
  end if;

  select l into first_leg from jsonb_array_elements(p_legs) l order by (l->>'kickoff_at')::timestamptz limit 1;
  select string_agg(trim(l->>'selection'), ' + ' order by (l->>'kickoff_at')::timestamptz)
    into all_picks from jsonb_array_elements(p_legs) l;
  if char_length(all_picks) > 200 then all_picks := left(all_picks, 199) || '…'; end if;

  -- The tip row: first match's teams, earliest kickoff (the slip locks when the first match starts)
  insert into public.tips (group_id, author_id, sport, league, home_team, away_team, kickoff_at,
                           selection, odds, boosted_odds, bookmaker_id, stake_units, reasoning, promo)
  values (p_group, auth.uid(), coalesce(nullif(first_leg->>'sport', ''), 'Football'), 'Kombi',
          trim(first_leg->>'home_team'), trim(first_leg->>'away_team'), (first_leg->>'kickoff_at')::timestamptz,
          all_picks, p_odds, p_boosted_odds, p_bookmaker_id, p_stake_units,
          nullif(trim(coalesce(p_reasoning, '')), ''), nullif(p_promo, ''))
  returning * into new_tip;

  insert into public.tip_legs (tip_id, position, sport, league, home_team, away_team, kickoff_at,
                               fixture_id, home_logo, away_logo, selection, odds)
  select new_tip.id,
         row_number() over (order by (l->>'kickoff_at')::timestamptz)::smallint,
         coalesce(nullif(l->>'sport', ''), 'Football'),
         nullif(trim(l->>'league'), ''),
         trim(l->>'home_team'),
         trim(l->>'away_team'),
         (l->>'kickoff_at')::timestamptz,
         nullif(l->>'fixture_id', '')::bigint,
         nullif(l->>'home_logo', ''),
         nullif(l->>'away_logo', ''),
         trim(l->>'selection'),
         nullif(l->>'odds', '')::numeric
  from jsonb_array_elements(p_legs) l;

  return query select new_tip.id, new_tip.share_slug;
end;
$$;
revoke execute on function public.create_combo_tip(uuid, jsonb, numeric, numeric, int, numeric, text, text) from public, anon;
grant execute on function public.create_combo_tip(uuid, jsonb, numeric, numeric, int, numeric, text, text) to authenticated;

-- ───────── share links include the matches of a combo ─────────
drop function if exists public.get_shared_tip(text);
create function public.get_shared_tip(p_slug text)
returns table (
  id uuid, share_slug text, group_id uuid, group_name text, author_id uuid,
  author_username text, sport text, league text, home_team text, away_team text,
  kickoff_at timestamptz, selection text, odds numeric, boosted_odds numeric,
  bookmaker_name text, bookmaker_url text, stake_units numeric, reasoning text,
  status text, settled_at timestamptz, fixture_id bigint, home_logo text, away_logo text,
  edited_at timestamptz, author_avatar text, promo text, legs jsonb
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.share_slug, t.group_id, g.name, t.author_id,
         p.username, t.sport, t.league, t.home_team, t.away_team,
         t.kickoff_at, t.selection, t.odds, t.boosted_odds,
         b.name, b.url, t.stake_units, t.reasoning,
         t.status, t.settled_at, t.fixture_id, t.home_logo, t.away_logo,
         t.edited_at, p.avatar_url, t.promo,
         (select coalesce(jsonb_agg(to_jsonb(l) - 'id' - 'tip_id' order by l.position), '[]'::jsonb)
            from public.tip_legs l where l.tip_id = t.id)
  from public.tips t
  join public.groups g on g.id = t.group_id
  join public.profiles p on p.id = t.author_id
  join public.bookmakers b on b.id = t.bookmaker_id
  where t.share_slug = p_slug;
$$;
grant execute on function public.get_shared_tip(text) to anon, authenticated;

notify pgrst, 'reload schema';
