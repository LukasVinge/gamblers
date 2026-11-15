import { getSharedTip } from "@/lib/sharedTip";
import { renderNotFoundImage, renderTipImage } from "@/lib/tipImage";

// The image shown when a tip link is pasted in Messenger, WhatsApp, Discord, Slack, …
export const alt = "Shared tip on Gamblers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } | Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tip = await getSharedTip(slug);
  return tip ? renderTipImage(tip) : renderNotFoundImage();
}
