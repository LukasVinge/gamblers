-- Gamblers – "🤝 I'm on it": show that you're playing someone's spilforslag too
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001–0007).
--
-- * Members can join a tip until kickoff, and leave it again until kickoff.
-- * You can't join your own tip (you're already on it).
-- * Everyone in the group can see who's on which tip.

create table if not exists public.tip_tails (
  tip_id     uuid not null references public.tips(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tip_id, user_id)
);
create index if not exists tip_tails_user_idx on public.tip_tails (user_id);

alter table public.tip_tails enable row level security;

drop policy if exists "members see who is on a tip" on public.tip_tails;
drop policy if exists "join a tip before kickoff" on public.tip_tails;
drop policy if exists "leave a tip before kickoff" on public.tip_tails;

create policy "members see who is on a tip" on public.tip_tails
  for select to authenticated using (
    exists (select 1 from public.tips t where t.id = tip_id and public.is_member(t.group_id))
  );

create policy "join a tip before kickoff" on public.tip_tails
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tips t
      where t.id = tip_id
        and public.is_member(t.group_id)
        and t.author_id <> auth.uid()
        and t.status = 'pending'
        and t.kickoff_at > now()
    )
  );

create policy "leave a tip before kickoff" on public.tip_tails
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (select 1 from public.tips t where t.id = tip_id and t.kickoff_at > now())
  );

revoke all on public.tip_tails from anon;
grant select, insert, delete on public.tip_tails to authenticated;

-- Make the API see the new table immediately.
notify pgrst, 'reload schema';
