-- Gamblers – add Betfair to the bookmaker list
-- Run this once in Supabase: SQL Editor → paste → Run (after 0001–0009).
-- Safe to run more than once.

insert into public.bookmakers (name, url)
values ('Betfair', 'https://www.betfair.com')
on conflict (name) do nothing;

-- Make the API see the change immediately.
notify pgrst, 'reload schema';
