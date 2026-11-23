-- Some offers are shared on the site but don't count for anyone personally on the leaderboard:
--   · Super boost at bet365
--   · Dobbelt op at Danske Spil (Oddset)
-- They still show in the feed and in the Boosts statistics. All other offers count as normal.
-- Run AFTER 0011_promos.sql. Safe to run more than once.
-- Keep in sync with OFF_LEADERBOARD in src/lib/promos.ts (the label on the cards).

create or replace function public.counts_on_leaderboard(p_promo text, p_bookmaker_name text)
returns boolean language sql immutable set search_path = '' as $$
  select not coalesce(
    (p_bookmaker_name = 'bet365' and p_promo = 'super_boost') or
    (p_bookmaker_name = 'Danske Spil' and p_promo = 'dobbelt_op'),
    false);
$$;
grant execute on function public.counts_on_leaderboard(text, text) to authenticated, anon;

-- Same as 0007's version, minus the offers above.
create or replace function public.group_leaderboard(p_group uuid, p_since timestamptz default null)
returns table (
  user_id uuid, username text, avatar_url text, settled int, wins int, losses int, voids int,
  pending int, staked numeric, profit numeric, roi numeric, hit_rate numeric
)
language sql stable security invoker set search_path = '' as $$
  with t as (
    select tp.author_id, tp.status, tp.stake_units as stake,
           coalesce(tp.boosted_odds, tp.odds) as o
    from public.tips tp
    join public.bookmakers bk on bk.id = tp.bookmaker_id
    where tp.group_id = p_group
      and (p_since is null or tp.kickoff_at >= p_since)
      and public.counts_on_leaderboard(tp.promo, bk.name)
  ), agg as (
    select author_id,
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
        else 0 end), 0)                                                       as profit
    from t
    group by author_id
  )
  select m.user_id, p.username, p.avatar_url,
         coalesce(a.settled, 0), coalesce(a.wins, 0), coalesce(a.losses, 0),
         coalesce(a.voids, 0), coalesce(a.pending, 0),
         coalesce(a.staked, 0), round(coalesce(a.profit, 0), 2),
         case when a.staked > 0 then round(a.profit / a.staked * 100, 1) end,
         case when a.wins + a.losses > 0
              then round(a.wins::numeric / (a.wins + a.losses) * 100, 0) end
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  left join agg a on a.author_id = m.user_id
  where m.group_id = p_group;
$$;
revoke execute on function public.group_leaderboard(uuid, timestamptz) from public, anon;
grant execute on function public.group_leaderboard(uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
