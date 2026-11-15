-- Gamblers – push notifications ("@lukas posted a new spilforslag")
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001–0008).
--
-- * One row per device that turned notifications on.
-- * You can only see and remove your own devices.
-- * When someone posts a tip, the site may fetch the other members' devices –
--   but only for a tip the caller just posted themselves (get_push_targets).

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "see own devices" on public.push_subscriptions;
drop policy if exists "remove own devices" on public.push_subscriptions;
create policy "see own devices" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "remove own devices" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Turn notifications on for this device (re-assigns the device if another account used it before).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 2000 then raise exception 'Invalid subscription'; end if;

  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

-- The devices to notify about a new tip: every other member of the tip's group.
-- Only works for the tip's author, and only right after posting.
create or replace function public.get_push_targets(p_tip uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = '' as $$
declare t public.tips;
begin
  select * into t from public.tips where id = p_tip;
  if not found or auth.uid() is distinct from t.author_id or t.created_at < now() - interval '10 minutes' then
    return;
  end if;

  return query
    select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
    join public.group_members m on m.user_id = s.user_id
    where m.group_id = t.group_id and s.user_id <> auth.uid();
end;
$$;

-- Clean up devices whose subscription has expired (the push service says "gone").
create or replace function public.remove_push_subscriptions(p_endpoints text[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  delete from public.push_subscriptions s
  where s.endpoint = any(p_endpoints)
    and (s.user_id = auth.uid() or public.shares_group(s.user_id));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.get_push_targets(uuid) from public, anon;
revoke execute on function public.remove_push_subscriptions(text[]) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.get_push_targets(uuid) to authenticated;
grant execute on function public.remove_push_subscriptions(text[]) to authenticated;

-- Make the API see the changes immediately.
notify pgrst, 'reload schema';
