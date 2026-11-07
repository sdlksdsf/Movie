/**
 * Media permission probe.
 *
 * Browsers only let an embedded player make sound when the frames above it
 * delegate the `autoplay` feature. Inside a preview shell that does not, every
 * attempt to unmute gets rejected and the player pauses itself — the video
 * looks fine muted and dies the moment sound is requested.
 *
 * `document.featurePolicy.allowsFeature('autoplay')` answers this exactly, so
 * we can tell the user *why* and hand them a one-click way out instead of
 * leaving them tapping a button that cannot work.
 */

export function soundIsBlocked(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const doc = document as Document & {
      featurePolicy?: { allowsFeature?: (feature: string) => boolean };
      permissionsPolicy?: { allowsFeature?: (feature: string) => boolean };
    };
    const policy = doc.featurePolicy ?? doc.permissionsPolicy;
    if (policy && typeof policy.allowsFeature === "function") {
      return !policy.allowsFeature("autoplay");
    }
  } catch {
    /* older browser — assume sound is fine */
  }
  return false;
}

export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Open the app in its own tab, where embeds are allowed to play audio. */
export function openInOwnTab() {
  if (typeof window === "undefined") return;
  try {
    const opened = window.open(window.location.href, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(window.location.href);
  } catch {
    window.location.assign(window.location.href);
  }
}
