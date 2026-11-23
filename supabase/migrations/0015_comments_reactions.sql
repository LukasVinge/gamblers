-- Comments and reactions on spilforslag (the social feed).
-- Run after 0001–0014. Safe to run more than once.
--
-- * Members of the group can comment and react on any tip – also after kickoff (banter is the point).
-- * You can delete your own comments; the group admin can delete any comment.
-- * Reactions: 🔥 fire · 🤡 clown · 💰 money · 😬 nervous – each member can give each one once per tip.
-- * Nobody outside the group (or logged out) can read or write any of it.

-- ───────── comments ─────────
create table if not exists public.tip_comments (
  id         uuid primary key default gen_random_uuid(),
  tip_id     uuid not null references public.tips(id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists tip_comments_tip_idx on public.tip_comments (tip_id, created_at);

alter table public.tip_comments enable row level security;

drop policy if exists "members read comments" on public.tip_comments;
drop policy if exists "members write comments" on public.tip_comments;
drop policy if exists "delete own comment or admin" on public.tip_comments;

create policy "members read comments" on public.tip_comments
  for select to authenticated using (
    exists (select 1 from public.tips t where t.id = tip_id and public.is_member(t.group_id))
  );

create policy "members write comments" on public.tip_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (select 1 from public.tips t where t.id = tip_id and public.is_member(t.group_id))
  );

create policy "delete own comment or admin" on public.tip_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.tips t where t.id = tip_id and public.is_admin(t.group_id))
  );

revoke all on public.tip_comments from anon;
revoke update on public.tip_comments from authenticated;
grant select, insert, delete on public.tip_comments to authenticated;

-- ───────── reactions ─────────
create table if not exists public.tip_reactions (
  tip_id     uuid not null references public.tips(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reaction   text not null check (reaction in ('fire', 'clown', 'money', 'nervous')),
  created_at timestamptz not null default now(),
  primary key (tip_id, user_id, reaction)
);
create index if not exists tip_reactions_user_idx on public.tip_reactions (user_id);

alter table public.tip_reactions enable row level security;

drop policy if exists "members see reactions" on public.tip_reactions;
drop policy if exists "members react" on public.tip_reactions;
drop policy if exists "remove own reaction" on public.tip_reactions;

create policy "members see reactions" on public.tip_reactions
  for select to authenticated using (
    exists (select 1 from public.tips t where t.id = tip_id and public.is_member(t.group_id))
  );

create policy "members react" on public.tip_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.tips t where t.id = tip_id and public.is_member(t.group_id))
  );

create policy "remove own reaction" on public.tip_reactions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.tip_reactions from anon;
revoke update on public.tip_reactions from authenticated;
grant select, insert, delete on public.tip_reactions to authenticated;

-- ───────── 🔔 who to notify about a new comment ─────────
-- The tipster and everyone who commented on the tip before – never the commenter themself.
-- Only the comment's author may ask, and only right after posting it (like get_push_targets).
create or replace function public.get_comment_push_targets(p_comment uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = '' as $$
declare c public.tip_comments; t public.tips;
begin
  select * into c from public.tip_comments where id = p_comment;
  if not found or c.author_id is distinct from auth.uid() or c.created_at < now() - interval '10 minutes' then
    return;
  end if;
  select * into t from public.tips where id = c.tip_id;

  return query
    select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
    where s.user_id <> c.author_id
      and public.is_member_of(s.user_id, t.group_id)
      and (s.user_id = t.author_id
           or exists (select 1 from public.tip_comments o where o.tip_id = c.tip_id and o.author_id = s.user_id));
end;
$$;

-- membership check for any user (is_member() only checks the caller)
create or replace function public.is_member_of(p_user uuid, p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where user_id = p_user and group_id = p_group);
$$;
revoke execute on function public.is_member_of(uuid, uuid) from public, anon, authenticated;

revoke execute on function public.get_comment_push_targets(uuid) from public, anon;
grant execute on function public.get_comment_push_targets(uuid) to authenticated;

notify pgrst, 'reload schema';
