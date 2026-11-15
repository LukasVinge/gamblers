"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SlipScanner() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Upload venligst et billede (PNG, JPG eller WebP).");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const fd = new FormData();
        fd.append("image", file);

        const res = await fetch("/api/parse-bet", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Noget gik galt under aflæsning.");
          setLoading(false);
          return;
        }

        // Gem aflæste data kortvarigt i sessionStorage, så formularen pre-filles
        sessionStorage.setItem("rg_scanned_slip", JSON.stringify(data));

        if (data.fixture_id) {
          router.push(`/new?fixture=${data.fixture_id}&scanned=1`);
        } else {
          router.push("/new?manual=1&scanned=1");
        }
      } catch {
        setError("Netværksfejl – prøv igen.");
        setLoading(false);
      }
    },
    [router]
  );

  // Lyt på Ctrl+V / Cmd+V direkte på siden
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        processFile(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [processFile]);

  return (
    <div className="space-y-2">
      <div
        onClick={() => !loading && inputRef.current?.click()}
        className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft/40 px-4 py-3.5 transition hover:border-accent hover:bg-accent-soft/70 ${
          loading ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
          }}
        />
        <div className="space-y-0.5">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <span>📸</span>
            <span>{loading ? "Aflæser kupon med AI…" : "Indsæt eller upload kupon (screenshot)"}</span>
          </span>
          <span className="block text-xs text-muted">
            {loading
              ? "Udtrækker hold, spilvalg og odds…"
              : "Tryk Ctrl+V for at indsætte fra udklipsholder, eller tryk her for at vælge billede"}
          </span>
        </div>
        <span className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
          {loading ? "Arbejder…" : "Upload"}
        </span>
      </div>

      {error && <p className="text-xs font-medium text-loss">{error}</p>}
    </div>
  );
}