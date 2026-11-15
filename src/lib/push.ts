import webpush from "web-push";

// Web push: the server signs each notification with the private VAPID key and hands it to the
// phone's push service (Google / Apple / Mozilla), which delivers it even when the app is closed.

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
/** Contact for the push services – must be a real https URL or mailto (Apple rejects localhost). */
const SUBJECT = process.env.VAPID_SUBJECT || "https://ragegamblers.vercel.app";

export function pushConfigured() {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

/** Sends one notification to every device. Returns the endpoints that no longer exist (to clean up). */
export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<string[]> {
  if (!pushConfigured() || targets.length === 0) return [];
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);
  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.allSettled(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, {
          TTL: 60 * 60 * 12, // not delivered within 12 hours → drop it, the tip is old news
          urgency: "normal",
        });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(t.endpoint); // subscription expired or removed
        else console.error("push failed", status ?? e);
      }
    }),
  );
  return dead;
}
