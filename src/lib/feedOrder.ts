/**
 * Feed order: matches that haven't started yet come first, the next kickoff at the top.
 * Below them the ones that have started (still waiting for a result, or settled), most recent first –
 * so a bet nobody has settled yet doesn't push tonight's matches down the list.
 */
export function orderFeed<T extends { kickoff_at: string }>(tips: T[], now = Date.now()): { coming: T[]; started: T[] } {
  const at = (t: T) => Date.parse(t.kickoff_at);
  const coming = tips.filter((t) => at(t) > now).sort((a, b) => at(a) - at(b));
  const started = tips.filter((t) => at(t) <= now).sort((a, b) => at(b) - at(a));
  return { coming, started };
}
