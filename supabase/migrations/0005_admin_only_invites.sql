-- Gamblers – only admins can see (and share) the invite link
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001–0004).
--
-- Members can still see the group's name, but the invite_code column is hidden
-- from them. Admins get the code through get_invite_code().

revoke select on public.groups from anon, authenticated;
grant select (id, name, created_by, created_at) on public.groups to authenticated;

create or replace function public.get_invite_code(p_group uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_code text;
begin
  if not public.is_admin(p_group) then
    raise exception 'Only group admins can see the invite link';
  end if;
  select invite_code into v_code from public.groups where id = p_group;
  return v_code;
end;
$$;

revoke execute on function public.get_invite_code(uuid) from public, anon;
grant execute on function public.get_invite_code(uuid) to authenticated;

-- Make the API see the change immediately.
notify pgrst, 'reload schema';
