-- Odds League – initial schema
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run.
--
-- Security model (invite-only):
--   * Signing up REQUIRES a valid group invite code (enforced in the database,
--     not just the UI). The only exception is the very first user (you), who
--     then creates the first group and shares its invite link.
--   * Every table has row-level security: you only see groups you are a member
--     of, and only the tips/profiles inside those groups.
--   * Tips are immutable once posted (no UPDATE policy). Results are set only
--     through settle_tip(), which checks permissions and writes an audit log.
--   * A single tip can be viewed publicly via its random share link
--     (get_shared_tip) so you can paste it into any chat.

-- ───────────────────────── helpers ─────────────────────────

create or replace function public.short_id(len int)
returns text language sql volatile as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, len);
$$;

-- ───────────────────────── tables ─────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name text,
  created_at   timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 50),
  invite_code text not null unique default public.short_id(12),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.bookmakers (
  id   serial primary key,
  name text not null unique,
  url  text
);

create table public.tips (
  id           uuid primary key default gen_random_uuid(),
  share_slug   text not null unique default public.short_id(10),
  group_id     uuid not null references public.groups(id) on delete cascade,
  author_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  sport        text not null,
  league       text,
  home_team    text not null check (char_length(home_team) between 1 and 80),
  away_team    text not null check (char_length(away_team) between 1 and 80),
  kickoff_at   timestamptz not null,
  selection    text not null check (char_length(selection) between 2 and 200),
  odds         numeric(7,2) not null check (odds > 1),
  boosted_odds numeric(7,2) check (boosted_odds is null or boosted_odds > odds),
  bookmaker_id int not null references public.bookmakers(id),
  stake_units  numeric(3,1) not null check (stake_units > 0 and stake_units <= 10),
  reasoning    text check (reasoning is null or char_length(reasoning) <= 2000),
  status       text not null default 'pending'
               check (status in ('pending', 'won', 'lost', 'void', 'half_won', 'half_lost')),
  settled_at   timestamptz,
  settled_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index tips_group_kickoff_idx on public.tips (group_id, kickoff_at desc);
create index tips_author_idx on public.tips (author_id);

-- Audit log: every settle / re-settle is recorded.
create table public.tip_events (
  id         bigint generated always as identity primary key,
  tip_id     uuid not null references public.tips(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);
create index tip_events_tip_idx on public.tip_events (tip_id);

-- ───────────────────────── membership helpers (used by RLS) ─────────────────────────

create or replace function public.is_member(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid()
  );
$$;

create or replace function public.is_admin(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.shares_group(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ───────────────────────── signup (invite-only) ─────────────────────────

-- True only while nobody has signed up yet (lets the owner create the first account).
create or replace function public.signup_open()
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles);
$$;

-- Returns the group name for a valid invite code, otherwise null.
create or replace function public.check_invite(p_code text)
returns text language sql stable security definer set search_path = '' as $$
  select name from public.groups where invite_code = p_code;
$$;

create or replace function public.username_taken(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- Runs when Supabase Auth creates a user. Rejects the signup unless it carries
-- a valid invite code (or it's the very first user), creates the profile and
-- joins the invited group.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code     text := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');
  v_username text := new.raw_user_meta_data ->> 'username';
  v_group    uuid;
  v_first    boolean;
begin
  select not exists (select 1 from public.profiles) into v_first;

  if v_code is not null then
    select id into v_group from public.groups where invite_code = v_code;
  end if;

  if v_group is null and not v_first then
    raise exception 'A valid invite code is required to sign up';
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, coalesce(new.raw_user_meta_data ->> 'display_name', v_username));

  if v_group is not null then
    insert into public.group_members (group_id, user_id) values (v_group, new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── group actions ─────────────────────────

create or replace function public.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.groups (name, created_by) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return v_id;
end;
$$;

create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into v_id from public.groups where invite_code = p_code;
  if v_id is null then raise exception 'That invite link is not valid (anymore)'; end if;
  insert into public.group_members (group_id, user_id) values (v_id, auth.uid())
  on conflict do nothing;
  return v_id;
end;
$$;

-- Admins can rotate the invite code (old links stop working).
create or replace function public.regenerate_invite(p_group uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not public.is_admin(p_group) then raise exception 'Only group admins can do that'; end if;
  update public.groups set invite_code = public.short_id(12) where id = p_group
  returning invite_code into v_code;
  return v_code;
end;
$$;

-- ───────────────────────── settling ─────────────────────────

create or replace function public.settle_tip(p_tip uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tips;
begin
  select * into t from public.tips where id = p_tip for update;
  if not found then raise exception 'Tip not found'; end if;

  if auth.uid() is distinct from t.author_id and not public.is_admin(t.group_id) then
    raise exception 'Only the tipster or a group admin can settle this tip';
  end if;
  if p_status not in ('pending', 'won', 'lost', 'void', 'half_won', 'half_lost') then
    raise exception 'Invalid result';
  end if;
  if p_status not in ('pending', 'void') and now() < t.kickoff_at then
    raise exception 'You can only settle a tip after kickoff';
  end if;
  if p_status = t.status then return; end if;

  update public.tips
  set status     = p_status,
      settled_at = case when p_status = 'pending' then null else now() end,
      settled_by = case when p_status = 'pending' then null else auth.uid() end
  where id = p_tip;

  insert into public.tip_events (tip_id, actor_id, action, old_status, new_status)
  values (p_tip, auth.uid(), 'settle', t.status, p_status);
end;
$$;

-- ───────────────────────── public share link ─────────────────────────

create or replace function public.get_shared_tip(p_slug text)
returns table (
  id uuid, share_slug text, group_id uuid, group_name text, author_id uuid,
  author_username text, sport text, league text, home_team text, away_team text,
  kickoff_at timestamptz, selection text, odds numeric, boosted_odds numeric,
  bookmaker_name text, bookmaker_url text, stake_units numeric, reasoning text,
  status text, settled_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.share_slug, t.group_id, g.name, t.author_id,
         p.username, t.sport, t.league, t.home_team, t.away_team,
         t.kickoff_at, t.selection, t.odds, t.boosted_odds,
         b.name, b.url, t.stake_units, t.reasoning,
         t.status, t.settled_at
  from public.tips t
  join public.groups g on g.id = t.group_id
  join public.profiles p on p.id = t.author_id
  join public.bookmakers b on b.id = t.bookmaker_id
  where t.share_slug = p_slug;
$$;

-- ───────────────────────── leaderboard ─────────────────────────
-- Profit in units:  won = stake × (odds − 1)   lost = −stake   void = 0
--                   half_won / half_lost = half of the above (Asian lines)
-- Boosted odds are used when present.
-- ROI = profit / staked (voids excluded).  Hit rate = wins / (wins + losses).
-- Runs as the caller (security invoker), so RLS limits it to your own groups.

create or replace function public.group_leaderboard(p_group uuid, p_since timestamptz default null)
returns table (
  user_id uuid, username text, settled int, wins int, losses int, voids int,
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
  select m.user_id, p.username,
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

-- ───────────────────────── row-level security ─────────────────────────

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.bookmakers    enable row level security;
alter table public.tips          enable row level security;
alter table public.tip_events    enable row level security;

create policy "see yourself and people in your groups" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_group(id));
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members see their groups" on public.groups
  for select to authenticated using (public.is_member(id));

create policy "members see co-members" on public.group_members
  for select to authenticated using (public.is_member(group_id));
create policy "leave a group, or admin removes member" on public.group_members
  for delete to authenticated using (user_id = auth.uid() or public.is_admin(group_id));

create policy "anyone signed in sees bookmakers" on public.bookmakers
  for select to authenticated using (true);

create policy "members see group tips" on public.tips
  for select to authenticated using (public.is_member(group_id));
create policy "members post tips before kickoff" on public.tips
  for insert to authenticated with check (
    author_id = auth.uid()
    and public.is_member(group_id)
    and status = 'pending'
    and settled_at is null
    and kickoff_at > now()
  );
create policy "author deletes own pending tip before kickoff" on public.tips
  for delete to authenticated using (
    author_id = auth.uid() and status = 'pending' and kickoff_at > now()
  );
-- No UPDATE policy on purpose: odds and stake are locked once posted.

create policy "members see tip history" on public.tip_events
  for select to authenticated using (
    exists (select 1 from public.tips t where t.id = tip_id and public.is_member(t.group_id))
  );

-- ───────────────────────── function permissions ─────────────────────────

revoke execute on all functions in schema public from public, anon;
grant execute on function public.signup_open()             to anon, authenticated;
grant execute on function public.check_invite(text)        to anon, authenticated;
grant execute on function public.username_taken(text)      to anon, authenticated;
grant execute on function public.get_shared_tip(text)      to anon, authenticated;
grant execute on function public.short_id(int)             to authenticated;
grant execute on function public.is_member(uuid)           to authenticated;
grant execute on function public.is_admin(uuid)            to authenticated;
grant execute on function public.shares_group(uuid)        to authenticated;
grant execute on function public.create_group(text)        to authenticated;
grant execute on function public.join_group(text)          to authenticated;
grant execute on function public.regenerate_invite(uuid)   to authenticated;
grant execute on function public.settle_tip(uuid, text)    to authenticated;
grant execute on function public.group_leaderboard(uuid, timestamptz) to authenticated;

-- ───────────────────────── seed data ─────────────────────────

insert into public.bookmakers (name, url) values
  ('Danske Spil', 'https://danskespil.dk'),
  ('bet365',      'https://www.bet365.dk'),
  ('Unibet',      'https://www.unibet.dk'),
  ('Betano',      'https://www.betano.dk'),
  ('LeoVegas',    'https://www.leovegas.dk'),
  ('Betsson',     'https://www.betsson.dk'),
  ('NordicBet',   'https://www.nordicbet.dk'),
  ('Mr Green',    'https://www.mrgreen.dk'),
  ('bwin',        'https://www.bwin.dk'),
  ('Coolbet',     'https://www.coolbet.dk'),
  ('Expekt',      'https://www.expekt.dk'),
  ('Other',       null);
