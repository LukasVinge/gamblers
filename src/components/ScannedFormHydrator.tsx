"use client";

import { useEffect } from "react";

/** Udfylder DOM-inputs automatisk én gang, når brugeren kommer fra SlipScanner. */
export function ScannedFormHydrator({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const raw = sessionStorage.getItem("rg_scanned_slip");
    if (!raw) return;

    // Vi lader SelectionInput læse den også, og rydder derefter storage på næste tick
    setTimeout(() => sessionStorage.removeItem("rg_scanned_slip"), 100);

    try {
      const data = JSON.parse(raw);

      const setVal = (name: string, val: unknown) => {
        if (val == null || val === "") return;
        const el = document.querySelector<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >(`[name="${name}"]`);
        if (!el) return;
        const setter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(el),
          "value"
        )?.set;
        if (setter) {
          setter.call(el, String(val));
        } else {
          el.value = String(val);
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };

      setVal("home_team", data.home_team);
      setVal("away_team", data.away_team);
      setVal("league", data.league);
      setVal("bookmaker_id", data.bookmaker_id);
      setVal("odds", data.odds);
      setVal("boosted_odds", data.boosted_odds);

      if (data.kickoff_at) {
        const d = new Date(data.kickoff_at);
        if (!Number.isNaN(d.getTime())) {
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setVal("kickoff_at", local);
        }
      }
    } catch {
      // ignorer ugyldig JSON
    }
  }, [active]);

  return null;
}