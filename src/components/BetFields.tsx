import { sortBookmakers } from "@/lib/bookmakerLogo";
import { OFF_LEADERBOARD_TEXT, PROMOS } from "@/lib/promos";
import { BookmakerLogo } from "./BookmakerLogo";
import { Field, inputCls } from "./ui";

export type BetDefaults = {
  bookmaker_id?: number;
  odds?: number;
  boosted_odds?: number | null;
  stake_units?: number;
  reasoning?: string | null;
  promo?: string | null;
};

export type BookmakerOption = { id: number; name: string; url: string | null };

/** Bookmaker (logo grid), odds, boosted odds, stake and reasoning – shared by "new" and "edit". */
export function BetFields({
  bookmakers,
  defaults = {},
  oddsHint = "e.g. 2.10",
}: {
  bookmakers: BookmakerOption[];
  defaults?: BetDefaults;
  oddsHint?: string;
}) {
  const fmt = (n?: number | null) => (n == null ? undefined : Number(n).toFixed(2));
  return (
    <>
      {/* Plain radio buttons styled as logo tiles – works without JavaScript and with the form's "required" check */}
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Bookmaker</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {sortBookmakers(bookmakers).map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl bg-surface px-1.5 py-2.5 text-center text-xs font-medium sm:flex-row sm:gap-2 sm:px-2.5 sm:py-2 sm:text-left sm:text-sm text-ink-2 ring-1 ring-line transition hover:ring-line-strong has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink has-[:checked]:ring-2 has-[:checked]:ring-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
            >
              <input
                type="radio"
                name="bookmaker_id"
                value={b.id}
                required
                defaultChecked={defaults.bookmaker_id === b.id}
                className="sr-only"
              />
              <BookmakerLogo name={b.name} url={b.url} size={28} />
              <span className="w-full truncate">{b.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Offer type – feeds the Boosts statistics on the leaderboard */}
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Tilbud</legend>
        <div className="flex flex-wrap gap-2">
          {[{ id: "", label: "Ingen", emoji: "" }, ...PROMOS].map((p) => (
            <label
              key={p.id || "none"}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-ink-2 ring-1 ring-line transition hover:ring-line-strong has-[:checked]:bg-boost-soft has-[:checked]:text-boost has-[:checked]:ring-2 has-[:checked]:ring-boost has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
            >
              <input type="radio" name="promo" value={p.id} defaultChecked={(defaults.promo ?? "") === p.id} className="sr-only" />
              {p.emoji && <span aria-hidden>{p.emoji}</span>}
              {p.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Skriv de forhøjede odds i Boost-feltet, så ROI bliver regnet rigtigt. {OFF_LEADERBOARD_TEXT} vises på siden, men tæller ikke på
          leaderboardet.
        </p>
      </fieldset>

      {/* Short labels so all three stay on one line on a phone and the boxes line up */}
      <div className="grid grid-cols-3 items-start gap-3 sm:gap-4">
        <Field label="Odds" hint={oddsHint}>
          <input name="odds" required inputMode="decimal" placeholder="2.10" defaultValue={fmt(defaults.odds)} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Boost" hint="Optional">
          <input name="boosted_odds" inputMode="decimal" placeholder="—" defaultValue={fmt(defaults.boosted_odds)} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Units" hint="0.5 – 10">
          <input
            name="stake_units"
            required
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            defaultValue={defaults.stake_units ?? 1}
            className={`${inputCls} font-mono`}
          />
        </Field>
      </div>

      <Field label="Why? (optional)">
        <textarea name="reasoning" rows={3} maxLength={2000} placeholder="Your reasoning…" defaultValue={defaults.reasoning ?? ""} className={inputCls} />
      </Field>
    </>
  );
}
