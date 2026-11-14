/**
 * Shapes shared by the 18+ vault server code and its client UI.
 *
 * Kept free of server imports on purpose: a `"server-only"` module cannot be
 * pulled into a client component, and both sides need these types.
 *
 * An item carries either an `embed` (the provider's own player, loaded in an
 * iframe — NOFLIX never touches the video bytes) or a direct `stream` URL when
 * the source hands one out. `embed` wins when both are present.
 */

export type VaultItem = {
  /** stable id from the feed — React key, and the provider's own video id */
  id: string;
  title: string;
  year?: number;
  /** "12:41" */
  duration?: string;
  /** free-form labels from the feed: the filter chips are built from these */
  tags: string[];
  poster?: string;
  /** the provider's embed/player URL */
  embed?: string;
  /** HLS playlist (.m3u8) or a progressive file (.mp4/.webm) */
  stream?: string;
  /** age badge, defaults to "18+" */
  rating?: string;
  /** which provider served this, shown on the card and in the player */
  source?: string;
};

export type VaultFeed = {
  items: VaultItem[];
  total?: number;
  /** the search term the provider was asked for, echoed back for the UI */
  term?: string;
  /** false when no provider is wired up at all */
  configured: boolean;
  /** which provider answered: "eporner", "custom", "none" */
  provider?: string;
  /** something the operator should see, e.g. "feed returned 500" */
  error?: string;
};
