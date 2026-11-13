import { Field, inputCls } from "./ui";

export type BetDefaults = {
  bookmaker_id?: number;
  odds?: number;
  boosted_odds?: number | null;
  stake_units?: number;
  reasoning?: string | null;
};

/** Bookmaker, odds, boosted odds, stake and reasoning – shared by "new" and "edit". */
export function BetFields({ bookmakers, defaults = {} }: { bookmakers: { id: number; name: string }[]; defaults?: BetDefaults }) {
  const fmt = (n?: number | null) => (n == null ? undefined : Number(n).toFixed(2));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Bookmaker">
          <select name="bookmaker_id" required className={inputCls} defaultValue={defaults.bookmaker_id ?? ""}>
            <option value="" disabled>
              Choose…
            </option>
            {bookmakers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Odds" hint="Decimal, e.g. 2.10">
          <input name="odds" required inputMode="decimal" placeholder="2.10" defaultValue={fmt(defaults.odds)} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Boosted odds" hint="Optional">
          <input name="boosted_odds" inputMode="decimal" placeholder="—" defaultValue={fmt(defaults.boosted_odds)} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Stake (units)" hint="0.5 – 10">
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
