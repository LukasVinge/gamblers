"use client";

import { inputCls } from "./ui";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

/**
 * 24-hour time picker (hour + minute dropdowns). The phone's own time picker follows the phone's
 * region setting and can show AM/PM – this one is always 00–23. Value: "HH:MM", or "" until both are set.
 */
export function TimeSelect({ value, onChange, name }: { value: string; onChange: (v: string) => void; name?: string }) {
  const [h = "", m = ""] = value ? value.split(":") : [];
  const set = (hh: string, mm: string) => onChange(hh && mm ? `${hh}:${mm}` : hh ? `${hh}:00` : "");
  // a scanned time like 18:32 isn't on the 5-minute list – show it anyway
  const minutes = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES;
  return (
    <div className="flex items-center gap-1.5">
      <select aria-label="Hour" required value={h} onChange={(e) => set(e.target.value, m || "00")} className={`${inputCls} font-mono`}>
        <option value="" disabled>
          tt
        </option>
        {HOURS.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <span className="font-mono text-muted">:</span>
      <select aria-label="Minute" required value={m} onChange={(e) => set(h || "00", e.target.value)} className={`${inputCls} font-mono`}>
        <option value="" disabled>
          mm
        </option>
        {minutes.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
