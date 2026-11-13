"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Avatar } from "./Avatar";

const SIZE = 256; // final picture is 256×256 px
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** Crop the middle square, scale to 256×256 and re-encode as JPEG (drops EXIF/GPS data too). */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image"))), "image/jpeg", 0.85),
  );
}

export function AvatarUploader({ userId, username, avatarUrl }: { userId: string; username: string; avatarUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);

  async function clearOldFiles(keep?: string) {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.storage.from("avatars").list(userId);
    const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
    if (old.length) await supabase.storage.from("avatars").remove(old);
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    if (!file.type.startsWith("image/")) return setMessage({ kind: "error", text: "Pick an image file (JPG, PNG, …)." });
    if (file.size > MAX_INPUT_BYTES) return setMessage({ kind: "error", text: "That image is too big (max 15 MB)." });

    setBusy(true);
    try {
      const blob = await toSquareJpeg(file);
      const supabase = createBrowserSupabase();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (dbErr) throw dbErr;
      await clearOldFiles(path);
      setPreview(url);
      setMessage({ kind: "ok", text: "Profile picture updated ✓" });
      router.refresh();
    } catch (e) {
      const text = e instanceof Error ? e.message : "Upload failed";
      setMessage({
        kind: "error",
        text: /decode|source image/i.test(text)
          ? "Your browser can't read that image format (e.g. HEIC). Try a JPG or PNG."
          : `Upload failed: ${text}`,
      });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function onRemove() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
      await clearOldFiles();
      setPreview(null);
      setMessage({ kind: "ok", text: "Profile picture removed." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Couldn't remove the picture" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative">
        <Avatar url={preview} name={username} size={112} />
        {busy && <span className="absolute inset-0 grid place-items-center rounded-full bg-surface/70 text-sm text-ink-2">…</span>}
      </div>
      <div className="space-y-2 text-center sm:text-left">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {preview ? "Change picture" : "Upload picture"}
          </button>
          {preview && (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-2 hover:bg-subtle disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">Square crop from the middle · JPG or PNG · shown next to your name everywhere</p>
        {message && <p className={`text-sm ${message.kind === "ok" ? "text-win" : "text-loss"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
