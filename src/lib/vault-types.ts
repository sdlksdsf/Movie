/**
 * Shapes shared by the 18+ vault server code and its client UI.
 *
 * Kept free of server imports on purpose: a `"server-only"` module cannot be
 * pulled into a client component, and both sides need these types.
 */

export type VaultItem = {
  /** stable id from your feed — used as the React key and the stream id */
  id: string;
  title: string;
  year?: number;
  /** "12:41" or "12 min" — passed through as-is */
  duration?: string;
  /** free-form labels straight from the feed: the chips are built from these */
  tags: string[];
  poster?: string;
  /** short muted loop shown before play starts, if the feed has one */
  preview?: string;
  /** HLS playlist (.m3u8) or a progressive file (.mp4/.webm) */
  stream: string;
  /** age badge, defaults to "18+" */
  rating?: string;
};

export type VaultFeed = {
  items: VaultItem[];
  /** some feeds page; the client only ever shows this many */
  total?: number;
  /** true once VAULT_FEED_URL is set on the deployment */
  configured: boolean;
  /** something the operator should see, e.g. "feed returned 500" */
  error?: string;
};
