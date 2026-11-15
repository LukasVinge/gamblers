"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Longest side in pixels after shrinking – plenty for the AI to read a betting slip. */
const MAX_SIDE = 1600;

/**
 * Scales the image down (if needed) and re-encodes it as JPEG, so uploads are small and fast.
 * A phone photo of 5–10 MB typically ends up around 200–400 KB. Throws if the browser can't decode it.
 */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNG screenshots → white background, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

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

      // 1. Make the image small enough to upload quickly (and below Vercel's ~4.5 MB limit).
      let upload: Blob = file;
      try {
        upload = await shrinkImage(file);
      } catch {
        // the browser can't read this format (e.g. HEIC on a PC) – send the original if it's small enough
        if (file.size > 4 * 1024 * 1024) {
          setError("Billedet kunne ikke formindskes og er for stort. Tag et screenshot af kuponen i stedet.");
          setLoading(false);
          return;
        }
      }

      // 2. Send it to the AI
      let res: Response;
      try {
        const fd = new FormData();
        fd.append("image", upload, upload === file ? file.name : "kupon.jpg");
        res = await fetch("/api/parse-bet", { method: "POST", body: fd });
      } catch {
        setError("Netværksfejl – tjek din forbindelse og prøv igen.");
        setLoading(false);
        return;
      }

      // 3. Read the answer – show the server's own message when something went wrong
      try {
        const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
        const data = isJson ? await res.json() : null;

        if (!res.ok || !data) {
          setError(
            data?.error ??
              (res.status === 413
                ? "Billedet er for stort. Prøv et screenshot i stedet."
                : res.status === 404
                  ? "Scanneren blev ikke fundet på serveren (404)."
                  : `Serverfejl (${res.status}). Prøv igen om lidt.`),
          );
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
        setError("Svaret fra AI'en kunne ikke læses. Prøv igen.");
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

  /**
   * "Indsæt kupon": reads an image straight from the clipboard (e.g. bet365 → Share → Copy),
   * so nothing has to be saved on the phone. Works on iPhone (Safari 13.4+) and Android Chrome;
   * the phone shows a small "Paste" bubble the first time, which the user taps to allow it.
   */
  async function pasteFromClipboard() {
    setError(null);
    if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
      setError("Din browser kan ikke læse billeder fra udklipsholderen. Brug Upload i stedet.");
      return;
    }
    let items: ClipboardItems;
    try {
      items = await navigator.clipboard.read();
    } catch {
      setError("Indsæt blev afvist. Tryk på \"Indsæt\"-boblen, når telefonen spørger – eller brug Upload.");
      return;
    }
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) {
        const blob = await item.getType(type);
        await processFile(new File([blob], `kupon.${type.split("/")[1] || "png"}`, { type }));
        return;
      }
    }
    const hasText = items.some((i) => i.types.includes("text/plain"));
    setError(
      hasText
        ? "Udklipsholderen indeholder tekst, ikke et billede. I bet365: tryk Del på spillet og vælg Kopiér billedet – eller tag et screenshot og brug Upload."
        : "Der er intet billede i udklipsholderen. Kopiér kuponen i bet365 først (Del → Kopiér).",
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`space-y-3 rounded-2xl border border-accent/40 bg-accent-soft/40 px-4 py-3.5 ${loading ? "pointer-events-none opacity-70" : ""}`}
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
            <span>{loading ? "Aflæser kupon med AI…" : "Indsæt eller upload kupon"}</span>
          </span>
          <span className="block text-xs text-muted">
            {loading
              ? "Udtrækker hold, spilvalg og odds…"
              : "Kopiér kuponen i bet365 (Del → Kopiér) og tryk Indsæt – eller upload et screenshot. På computer virker Ctrl+V også."}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={pasteFromClipboard}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            <span aria-hidden>📋</span>
            {loading ? "Arbejder…" : "Indsæt kupon"}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-subtle disabled:opacity-60"
          >
            <span aria-hidden>🖼️</span>
            Upload
          </button>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-loss">{error}</p>}
    </div>
  );
}