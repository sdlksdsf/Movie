/**
 * Vault facets — the category rail and the "from each country" rail.
 *
 * Neither is a real taxonomy in the provider's API: Eporner's Webmasters API
 * has no category endpoint and no ISO-country parameter, only a free-text
 * `query` that it matches against titles and keywords. So every facet here is
 * a *search term* (`term`), and `id` is what the UI stores and the API echoes.
 *
 * Anything that implies a minor is deliberately absent — these lists are for an
 * 18+ area and are curated to stay adult-only. Terms are lowercase because the
 * provider's keywords are.
 */

export type VaultFacet = {
  id: string;
  label: string;
  /** what actually goes to the provider as `query` */
  term: string;
  /** flags / glyphs for the rails; decorative, not semantic */
  emoji?: string;
};

export const VAULT_CATEGORIES: VaultFacet[] = [
  { id: "amateur", label: "Amateur", emoji: "📱", term: "amateur" },
  { id: "anal", label: "Anal", emoji: "🍑", term: "anal" },
  { id: "asian", label: "Asian", emoji: "🏮", term: "asian" },
  { id: "bbw", label: "BBW", emoji: "💜", term: "bbw" },
  { id: "bdsm", label: "BDSM", emoji: "⛓️", term: "bdsm" },
  { id: "big-tits", label: "Big Tits", emoji: "🍒", term: "big tits" },
  { id: "blonde", label: "Blonde", emoji: "💛", term: "blonde" },
  { id: "blowjob", label: "Blowjob", emoji: "👄", term: "blowjob" },
  { id: "brunette", label: "Brunette", emoji: "🤎", term: "brunette" },
  { id: "creampie", label: "Creampie", emoji: "💦", term: "creampie" },
  { id: "ebony", label: "Ebony", emoji: "🖤", term: "ebony" },
  { id: "gay", label: "Gay", emoji: "🏳️‍🌈", term: "gay" },
  { id: "group", label: "Group", emoji: "👥", term: "group" },
  { id: "hairy", label: "Hairy", emoji: "🪶", term: "hairy" },
  { id: "hentai", label: "Hentai", emoji: "🎨", term: "hentai" },
  { id: "interracial", label: "Interracial", emoji: "🖐️", term: "interracial" },
  { id: "latina", label: "Latina", emoji: "🌶️", term: "latina" },
  { id: "lesbian", label: "Lesbian", emoji: "💗", term: "lesbian" },
  { id: "mature", label: "Mature", emoji: "🍷", term: "mature" },
  { id: "milf", label: "MILF", emoji: "👠", term: "milf" },
  { id: "outdoor", label: "Outdoor", emoji: "🌳", term: "outdoor" },
  { id: "petite", label: "Petite", emoji: "🌸", term: "petite" },
  { id: "pov", label: "POV", emoji: "👁️", term: "pov" },
  { id: "public", label: "Public", emoji: "🚏", term: "public" },
  { id: "redhead", label: "Redhead", emoji: "🔥", term: "redhead" },
  { id: "squirt", label: "Squirt", emoji: "🚿", term: "squirt" },
  { id: "threesome", label: "Threesome", emoji: "🔺", term: "threesome" },
  { id: "trans", label: "Trans", emoji: "🏳️‍⚧️", term: "trans" },
  { id: "vintage", label: "Vintage", emoji: "📼", term: "vintage" },
];

export const VAULT_COUNTRIES: VaultFacet[] = [
  { id: "japanese", label: "Japan", emoji: "🇯🇵", term: "japanese" },
  { id: "indian", label: "India", emoji: "🇮🇳", term: "indian" },
  { id: "american", label: "USA", emoji: "🇺🇸", term: "american" },
  { id: "british", label: "UK", emoji: "🇬🇧", term: "british" },
  { id: "german", label: "Germany", emoji: "🇩🇪", term: "german" },
  { id: "french", label: "France", emoji: "🇫🇷", term: "french" },
  { id: "italian", label: "Italy", emoji: "🇮🇹", term: "italian" },
  { id: "spanish", label: "Spain", emoji: "🇪🇸", term: "spanish" },
  { id: "russian", label: "Russia", emoji: "🇷🇺", term: "russian" },
  { id: "ukrainian", label: "Ukraine", emoji: "🇺🇦", term: "ukrainian" },
  { id: "czech", label: "Czechia", emoji: "🇨🇿", term: "czech" },
  { id: "brazilian", label: "Brazil", emoji: "🇧🇷", term: "brazilian" },
  { id: "colombian", label: "Colombia", emoji: "🇨🇴", term: "colombian" },
  { id: "mexican", label: "Mexico", emoji: "🇲🇽", term: "mexican" },
  { id: "argentinian", label: "Argentina", emoji: "🇦🇷", term: "argentinian" },
  { id: "korean", label: "Korea", emoji: "🇰🇷", term: "korean" },
  { id: "thai", label: "Thailand", emoji: "🇹🇭", term: "thai" },
  { id: "filipino", label: "Philippines", emoji: "🇵🇭", term: "filipino" },
  { id: "vietnamese", label: "Vietnam", emoji: "🇻🇳", term: "vietnamese" },
  { id: "arab", label: "Arab", emoji: "🇸🇦", term: "arab" },
  { id: "turkish", label: "Türkiye", emoji: "🇹🇷", term: "turkish" },
  { id: "iranian", label: "Iran", emoji: "🇮🇷", term: "iranian" },
  { id: "african", label: "Africa", emoji: "🌍", term: "african" },
  { id: "nigerian", label: "Nigeria", emoji: "🇳🇬", term: "nigerian" },
  { id: "australian", label: "Australia", emoji: "🇦🇺", term: "australian" },
  { id: "canadian", label: "Canada", emoji: "🇨🇦", term: "canadian" },
  { id: "polish", label: "Poland", emoji: "🇵🇱", term: "polish" },
  { id: "hungarian", label: "Hungary", emoji: "🇭🇺", term: "hungarian" },
];

/** Resolve an incoming `tag` to its facet, so the API never trusts raw input. */
export function facetFor(id: string | undefined): VaultFacet | undefined {
  if (!id) return undefined;
  return [...VAULT_CATEGORIES, ...VAULT_COUNTRIES].find((facet) => facet.id === id);
}

export const isCountry = (id: string | undefined) =>
  Boolean(id) && VAULT_COUNTRIES.some((facet) => facet.id === id);
