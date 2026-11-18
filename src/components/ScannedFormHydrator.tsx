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
      if (data.bookmaker_id != null) {
        const radio = document.querySelector<HTMLInputElement>(`input[name="bookmaker_id"][value="${data.bookmaker_id}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      setVal("odds", data.odds);
      setVal("boosted_odds", data.boosted_odds);
      // offer type: the scanner's guess, or "Odds boost" when it only saw boosted odds
      const promo = data.promo ?? (data.boosted_odds ? "odds_boost" : null);
      if (typeof promo === "string") {
        const tile = document.querySelector<HTMLInputElement>(`input[name="promo"][value="${CSS.escape(promo)}"]`);
        if (tile) tile.checked = true;
      }
      // (the kickoff date + time are filled in by ManualMatchFields itself)
    } catch {
      // ignorer ugyldig JSON
    }
  }, [active]);

  return null;
}