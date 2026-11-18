-- Offers ("tilbud"): Super boost, Odds boost, Dobbelt op and other specials on a tip,
-- plus statistics per offer type and bookmaker for the Boosts view on the leaderboard.
-- Safe to run more than once.

-- ───────── offer type on each tip ─────────
alter table public.tips add column if not exists promo text;

alter table public.tips drop constraint if exists tips_promo_check;
alter table public.tips add constraint tips_promo_check
  check (promo is null or promo in ('super_boost', 'odds_boost', 'dobbelt_op', 'other_offer'));

-- Existing tips with boosted odds count as "Odds boost" (the author can change it before kickoff).
update public.tips set promo = 'odds_boost' where boosted_odds is not null and promo is null;

-- ───────── edit a tip: now also the offer type ─────────
drop function if exists public.edit_tip(uuid, text, numeric, numeric, int, numeric, text);
drop function if exists public.edit_tip(uuid, text, numeric, numeric, int, numeric, text, text);
create function public.edit_tip(
  p_tip uuid,
  p_selection text,
  p_odds numeric,
  p_boosted_odds numeric,
  p_bookmaker_id int,
  p_stake_units numeric,
  p_reasoning text,
  p_promo text default null
)
returns text language plpgsql security definer set search_path = '' as $$
declare t public.tips;
begin
  select * into t from public.tips where id = p_tip for update;
  if not found then raise exception 'Tip not found'; end if;

  if auth.uid() is distinct from t.author_id then
    raise exception 'Only the tipster can edit this tip';
  end if;
  if t.status <> 'pending' then
    raise exception 'Settled tips can''t be edited';
  end if;
  if now() >= t.kickoff_at then
    raise exception 'The match has started – tips are locked at kickoff';
  end if;

  update public.tips
  set selection    = trim(p_selection),
      odds         = p_odds,
      boosted_odds = p_boosted_odds,
      bookmaker_id = p_bookmaker_id,
      stake_units  = p_stake_units,
      reasoning    = nullif(trim(coalesce(p_reasoning, '')), ''),
      promo        = nullif(p_promo, ''),
      edited_at    = now()
  where id = p_tip;

  insert into public.tip_events (tip_id, actor_id, action, old_status, new_status, details)
  values (p_tip, auth.uid(), 'edit', t.status, t.status, jsonb_build_object('before', jsonb_build_object(
    'selection', t.selection, 'odds', t.odds, 'boosted_odds', t.boosted_odds,
    'bookmaker_id', t.bookmaker_id, 'stake_units', t.stake_units, 'reasoning', t.reasoning,
    'promo', t.promo)));

  return t.share_slug;
end;
$$;
revoke execute on function public.edit_tip(uuid, text, numeric, numeric, int, numeric, text, text) from public, anon;
grant execute on function public.edit_tip(uuid, text, numeric, numeric, int, numeric, text, text) to authenticated;

-- ───────── share links show the offer badge ─────────
drop function if exists public.get_shared_tip(text);
create function public.get_shared_tip(p_slug text)
returns table (
  id uuid, share_slug text, group_id uuid, group_name text, author_id uuid,
  author_username text, sport text, league text, home_team text, away_team text,
  kickoff_at timestamptz, selection text, odds numeric, boosted_odds numeric,
  bookmaker_name text, bookmaker_url text, stake_units numeric, reasoning text,
  status text, settled_at timestamptz, fixture_id bigint, home_logo text, away_logo text,
  edited_at timestamptz, author_avatar text, promo text
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.share_slug, t.group_id, g.name, t.author_id,
         p.username, t.sport, t.league, t.home_team, t.away_team,
         t.kickoff_at, t.selection, t.odds, t.boosted_odds,
         b.name, b.url, t.stake_units, t.reasoning,
         t.status, t.settled_at, t.fixture_id, t.home_logo, t.away_logo,
         t.edited_at, p.avatar_url, t.promo
  from public.tips t
  join public.groups g on g.id = t.group_id
  join public.profiles p on p.id = t.author_id
  join public.bookmakers b on b.id = t.bookmaker_id
  where t.share_slug = p_slug;
$$;
grant execute on function public.get_shared_tip(text) to anon, authenticated;

-- ───────── statistics per offer type and bookmaker ─────────
-- Security invoker: tips RLS applies, so only members of the group get any rows.
create or replace function public.promo_stats(p_group uuid, p_since timestamptz default null)
returns table (
  promo text, bookmaker_id int, bookmaker_name text, bookmaker_url text,
  tips int, settled int, wins int, losses int, voids int, pending int,
  staked numeric, profit numeric, roi numeric, hit_rate numeric, avg_odds numeric
)
language sql stable security invoker set search_path = '' as $$
  with t as (
    select tp.promo, tp.bookmaker_id, tp.status, tp.stake_units as stake,
           coalesce(tp.boosted_odds, tp.odds) as o
    from public.tips tp
    where tp.group_id = p_group
      and tp.promo is not null
      and (p_since is null or tp.kickoff_at >= p_since)
  ), agg as (
    select promo, bookmaker_id,
      count(*)::int                                                           as tips,
      count(*) filter (where status <> 'pending')::int                        as settled,
      count(*) filter (where status in ('won', 'half_won'))::int              as wins,
      count(*) filter (where status in ('lost', 'half_lost'))::int            as losses,
      count(*) filter (where status = 'void')::int                            as voids,
      count(*) filter (where status = 'pending')::int                         as pending,
      coalesce(sum(stake) filter (where status in ('won','lost','half_won','half_lost')), 0) as staked,
      coalesce(sum(case status
        when 'won'       then stake * (o - 1)
        when 'half_won'  then stake * (o - 1) / 2
        when 'lost'      then -stake
        when 'half_lost' then -stake / 2
        else 0 end), 0)                                                       as profit,
      avg(o)                                                                  as avg_odds
    from t
    group by promo, bookmaker_id
  )
  select a.promo, a.bookmaker_id, b.name, b.url,
         a.tips, a.settled, a.wins, a.losses, a.voids, a.pending,
         a.staked, round(a.profit, 2),
         case when a.staked > 0 then round(a.profit / a.staked * 100, 1) end,
         case when a.wins + a.losses > 0
              then round(a.wins::numeric / (a.wins + a.losses) * 100, 0) end,
         round(a.avg_odds, 2)
  from agg a
  join public.bookmakers b on b.id = a.bookmaker_id;
$$;
revoke execute on function public.promo_stats(uuid, timestamptz) from public, anon;
grant execute on function public.promo_stats(uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
