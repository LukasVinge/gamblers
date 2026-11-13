import { cache } from "react";
import { createPublicClient } from "./supabase/server";
import type { TipView } from "./types";

export type SharedTip = TipView & { group_name: string };

/** Loads one tip by its share slug. Public: works for logged-out visitors and link-preview bots. */
export const getSharedTip = cache(async (slug: string): Promise<SharedTip | null> => {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_shared_tip", { p_slug: slug }).maybeSingle();
  if (!data) return null;
  const t = data as SharedTip;
  return {
    ...t,
    odds: Number(t.odds),
    boosted_odds: t.boosted_odds === null ? null : Number(t.boosted_odds),
    stake_units: Number(t.stake_units),
  };
});
