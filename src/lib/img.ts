/**
 * Artwork URL helper.
 *
 * Every remote poster goes through our own `/api/img` proxy instead of being
 * requested by the browser directly:
 *
 *   • a host that hangs (no `load`, no `error`) used to leave tiles blank with
 *     no way for the UI to recover — the proxy imposes a 6s timeout and turns
 *     that into a clean 404, so the fallback plate appears;
 *   • a host blocked at the visitor's ISP no longer takes the artwork with it,
 *     because the request is made from our server, not their device.
 *
 * Local `/img/...` paths are returned untouched.
 */
export function artUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/img?u=${encodeURIComponent(url)}`;
}
