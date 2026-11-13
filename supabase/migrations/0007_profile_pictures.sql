-- Gamblers – profile pictures
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001–0006).
--
-- * profiles.avatar_url – may only point at the user's own folder in the
--   public "avatars" storage bucket (no arbitrary/tracking URLs).
-- * Storage bucket "avatars": public to view, max 1 MB, images only.
--   Everyone can only upload/replace/delete files in their own folder.
-- * Leaderboard and share links now include the picture.

-- ───────── profile column ─────────
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles drop constraint if exists profiles_avatar_own_folder;
alter table public.profiles add constraint profiles_avatar_own_folder check (
  avatar_url is null
  or (avatar_url like 'https://%' and position(('/storage/v1/object/public/avatars/' || id::text || '/') in avatar_url) > 0)
);

-- ───────── storage bucket ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: read own folder"   on storage.objects;
drop policy if exists "avatars: upload own folder" on storage.objects;
drop policy if exists "avatars: update own folder" on storage.objects;
drop policy if exists "avatars: delete own folder" on storage.objects;

create policy "avatars: read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── leaderboard with pictures (return type changed → drop + recreate) ─────────
drop function if exists public.group_leaderboard(uuid, timestamptz);
create function public.group_leaderboard(p_group uuid, p_since timestamptz default null)
returns table (
  user_id uuid, username text, avatar_url text, settled int, wins int, losses int, voids int,
  pending int, staked numeric, profit numeric, roi numeric, hit_rate numeric
)
language sql stable security invoker set search_path = '' as $$
  with t as (
    select tp.author_id, tp.status, tp.stake_units as stake,
           coalesce(tp.boosted_odds, tp.odds) as o
    from public.tips tp
    where tp.group_id = p_group
      and (p_since is null or tp.kickoff_at >= p_since)
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

-- ───────── share links with the tipster's picture ─────────
drop function if exists public.get_shared_tip(text);
create function public.get_shared_tip(p_slug text)
returns table (
  id uuid, share_slug text, group_id uuid, group_name text, author_id uuid,
  author_username text, sport text, league text, home_team text, away_team text,
  kickoff_at timestamptz, selection text, odds numeric, boosted_odds numeric,
  bookmaker_name text, bookmaker_url text, stake_units numeric, reasoning text,
  status text, settled_at timestamptz, fixture_id bigint, home_logo text, away_logo text,
  edited_at timestamptz, author_avatar text
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.share_slug, t.group_id, g.name, t.author_id,
         p.username, t.sport, t.league, t.home_team, t.away_team,
         t.kickoff_at, t.selection, t.odds, t.boosted_odds,
         b.name, b.url, t.stake_units, t.reasoning,
         t.status, t.settled_at, t.fixture_id, t.home_logo, t.away_logo,
         t.edited_at, p.avatar_url
  from public.tips t
  join public.groups g on g.id = t.group_id
  join public.profiles p on p.id = t.author_id
  join public.bookmakers b on b.id = t.bookmaker_id
  where t.share_slug = p_slug;
$$;
revoke execute on function public.get_shared_tip(text) from public;
grant execute on function public.get_shared_tip(text) to anon, authenticated;

-- Make the API see the changes immediately.
notify pgrst, 'reload schema';
