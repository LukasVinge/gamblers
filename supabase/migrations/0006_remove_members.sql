-- Gamblers – admins can remove members from the site
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001–0005).
--
-- * Only admins, never yourself, never another admin.
-- * Optionally deletes the member's spilforslag too (e.g. for a test user).
--   Otherwise their old tips stay in the history as "former member".
-- * Their login still exists, but they can't see anything and can't get back
--   in without a (new) invite link.

create or replace function public.remove_member(p_group uuid, p_user uuid, p_delete_tips boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_deleted int := 0;
begin
  if not public.is_admin(p_group) then
    raise exception 'Only group admins can remove members';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t remove yourself';
  end if;

  select role into v_role from public.group_members where group_id = p_group and user_id = p_user;
  if v_role is null then
    raise exception 'That person isn''t a member';
  end if;
  if v_role = 'admin' then
    raise exception 'Admins can''t be removed here';
  end if;

  if p_delete_tips then
    delete from public.tips where group_id = p_group and author_id = p_user;
    get diagnostics v_deleted = row_count;
  end if;

  delete from public.group_members where group_id = p_group and user_id = p_user;
  return v_deleted;
end;
$$;

revoke execute on function public.remove_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.remove_member(uuid, uuid, boolean) to authenticated;

-- Make the API see the new function immediately.
notify pgrst, 'reload schema';
