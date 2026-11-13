-- Odds League – one single group called "Gamblers"
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001_init.sql).
--
-- * Renames your existing group to "Gamblers" (or creates it if there is none).
-- * Moves tips and members from any other groups into it, then removes those groups.
-- * Makes it impossible to create a second group.
-- * On a fresh install, the very first user to sign up automatically gets
--   the "Gamblers" group and becomes its admin. Everyone else still needs
--   an invite link.

do $$
declare
  v_main  uuid;
  v_owner uuid;
begin
  select id into v_main from public.groups order by created_at limit 1;

  if v_main is null then
    select id into v_owner from public.profiles order by created_at limit 1;
    if v_owner is not null then
      insert into public.groups (name, created_by) values ('Gamblers', v_owner) returning id into v_main;
      insert into public.group_members (group_id, user_id, role) values (v_main, v_owner, 'admin');
    end if;
  else
    update public.groups set name = 'Gamblers' where id = v_main;

    -- fold any other groups into the main one ('admin' < 'member', so min() keeps admins)
    update public.tips set group_id = v_main where group_id <> v_main;
    insert into public.group_members (group_id, user_id, role)
      select v_main, user_id, min(role) from public.group_members
      where group_id <> v_main group by user_id
    on conflict (group_id, user_id) do nothing;
    delete from public.groups where id <> v_main;
  end if;

  -- Everyone who has an account belongs in the one group
  if v_main is not null then
    insert into public.group_members (group_id, user_id)
      select v_main, p.id from public.profiles p
    on conflict (group_id, user_id) do nothing;
  end if;
end $$;

-- Only one row can ever exist in groups.
create unique index if not exists groups_single_row on public.groups ((true));

-- No more creating groups from the app.
drop function if exists public.create_group(text);

-- Signup: first user creates "Gamblers" and becomes admin; everyone else needs a valid invite.
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

  if v_group is null and v_first then
    select id into v_group from public.groups limit 1;
    if v_group is null then
      insert into public.groups (name, created_by) values ('Gamblers', new.id) returning id into v_group;
      insert into public.group_members (group_id, user_id, role) values (v_group, new.id, 'admin');
      return new;
    end if;
  end if;

  insert into public.group_members (group_id, user_id) values (v_group, new.id)
  on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon;
