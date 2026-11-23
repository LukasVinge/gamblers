-- Betfair is no longer available in Denmark: remove it from the bookmaker list.
-- Tips already posted with Betfair are kept and moved to "Other" (their result and stats stay the same).
-- Safe to run more than once.

update public.tips
set bookmaker_id = (select id from public.bookmakers where name = 'Other')
where bookmaker_id = (select id from public.bookmakers where name = 'Betfair');

delete from public.bookmakers where name = 'Betfair';

notify pgrst, 'reload schema';
