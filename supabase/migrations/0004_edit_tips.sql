-- Gamblers – let tipsters edit their own bet until kickoff
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001–0003).
--
-- * Only the person who posted the tip can edit it.
-- * Only while it's pending AND before kickoff – after that the tip is locked.
-- * The match itself can't be changed (delete and re-post for that).
-- * Every edit is logged in tip_events with the old values.

alter table public.tips add column if not exists edited_at timestamptz;
alter table public.tip_events add column if not exists details jsonb;

create or replace function public.edit_tip(
  p_tip uuid,
  p_selection text,
  p_odds numeric,
  p_boosted_odds numeric,
  p_bookmaker_id int,
  p_stake_units numeric,
  p_reasoning text
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
      edited_at    = now()
  where id = p_tip;

  insert into public.tip_events (tip_id, actor_id, action, old_status, new_status, details)
  values (p_tip, auth.uid(), 'edit', t.status, t.status, jsonb_build_object('before', jsonb_build_object(
    'selection', t.selection, 'odds', t.odds, 'boosted_odds', t.boosted_odds,
    'bookmaker_id', t.bookmaker_id, 'stake_units', t.stake_units, 'reasoning', t.reasoning)));

  return t.share_slug;
end;
$$;

revoke execute on function public.edit_tip(uuid, text, numeric, numeric, int, numeric, text) from public, anon;
grant execute on function public.edit_tip(uuid, text, numeric, numeric, int, numeric, text) to authenticated;

-- Make the API see the new column/function immediately.
notify pgrst, 'reload schema';
