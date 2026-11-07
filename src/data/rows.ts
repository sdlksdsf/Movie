import type { Genre, Row, Title } from "@/lib/types";
import { allTitles } from "@/lib/catalog";

/**
 * Shelves are *derived* from the catalogue, never typed by hand.
 *
 * Every row is filled to at least 20 titles (unless the catalogue itself is
 * smaller than that for the filter), which is what keeps a shelf from ending
 * after three posters on a wide screen. Rows may share titles with each other
 * — Netflix does the same — but never repeat inside a single row.
 */

const MIN_PER_SHELF = 20;
const WIDE_SHELF = 26;

const all = allTitles;

const byScore = (a: Title, b: Title) =>
  b.rating * 10 +
  b.match / 4 +
  (b.year >= 2024 ? 8 : 0) +
  (b.featured ? 6 : 0) +
  (b.badge ? 3 : 0) -
  (a.rating * 10 +
    a.match / 4 +
    (a.year >= 2024 ? 8 : 0) +
    (a.featured ? 6 : 0) +
    (a.badge ? 3 : 0));

const ranked = [...all].sort(byScore);
const fresh = [...all].sort((a, b) => b.year - a.year || byScore(a, b));
const topRated = [...all].sort((a, b) => b.rating - a.rating || byScore(a, b));
const mostWatched = [...all].sort((a, b) => b.match - a.match || byScore(a, b));

/**
 * Fill a row. `strict` keeps a shelf honest — an Anime row only ever contains
 * anime, a Drama row only drama — so it stays short rather than lying. Without
 * it the row is topped up from the highest-rated titles in the catalogue.
 */
function fill(pool: Title[], count: number, strict = false): Title[] {
  const out: Title[] = [];
  const seen = new Set<string>();
  const add = (list: Title[]) => {
    for (const title of list) {
      if (out.length >= count) return;
      if (seen.has(title.slug)) continue;
      seen.add(title.slug);
      out.push(title);
    }
  };
  add(pool);
  if (!strict) add(ranked);
  return out;
}

function shelf(
  id: string,
  title: string,
  hint: string,
  pool: Title[],
  count = MIN_PER_SHELF,
  strict = false,
): Row {
  return { id, title, hint, slugs: fill(pool, count, strict).map((t) => t.slug) };
}

const anime = all.filter((t) => Boolean(t.anime));
const series = all.filter((t) => t.kind === "series");
const films = all.filter((t) => t.kind === "movie");
const originals = all.filter((t) => t.original);
const acclaimed = all.filter((t) => t.rating >= 8);

const desiFavourites = [
  "3-idiots",
  "sacred-games",
  "money-heist",
  "narcos",
  "dark",
  "the-witcher",
  "squid-game",
  "parasite",
  "monk",
  "friends",
];

const comfortFavourites = [
  "friends",
  "sherlock",
  "better-call-saul",
  "modern-family",
  "brooklyn-nine-nine",
  "the-office",
  "hocus-pocus",
  "coraline",
  "the-nightmare-before-christmas",
  "home-alone",
].filter((slug) => all.some((t) => t.slug === slug));

const bySlugs = (slugs: string[]) =>
  slugs.map((slug) => all.find((t) => t.slug === slug)).filter((t): t is Title => Boolean(t));

export const rows: Row[] = [
  shelf("trending", "Trending Now", "Everyone is watching these", ranked, WIDE_SHELF),
  {
    id: "top10",
    title: "Top 10 in Your Region Today",
    hint: "Updated daily",
    slugs: [],
    ranked: true,
  },
  shelf("originals", "NOFLIX Originals", "Only here", originals.length >= 12 ? originals : ranked, MIN_PER_SHELF),
  shelf("new", "New Releases", "Fresh this month", fresh, WIDE_SHELF),
  shelf("award", "Award Winners", "Critically acclaimed", acclaimed, MIN_PER_SHELF),
  shelf("popular", "Popular on NOFLIX", "Most watched right now", mostWatched, WIDE_SHELF),
  shelf("series", "Binge-Worthy Series", "One more episode", series, WIDE_SHELF),
  shelf("films", "Blockbuster Films", "Big screen, small screen", films, WIDE_SHELF),
  shelf("anime", "Anime Spotlight", "Subbed, dubbed, unmissable", anime, WIDE_SHELF, true),
  shelf(
    "desi",
    "Desi Hits & Beyond",
    "Streaming from Mumbai to Karachi",
    [...bySlugs(desiFavourites), ...all.filter((t) => t.genres.includes("Crime") || t.genres.includes("Drama"))],
    MIN_PER_SHELF,
  ),
  shelf(
    "comfort",
    "Comfort Classics",
    "Press play, feel better",
    [...bySlugs(comfortFavourites), ...all.filter((t) => t.genres.includes("Comedy") && t.year <= 2016)],
    MIN_PER_SHELF,
  ),
];

/* ------------------------------------------------------------------ *
 * Genre shelves — only genres that actually have a shelf's worth of
 * titles, so no row is ever three cards long.
 * ------------------------------------------------------------------ */

const GENRE_HINTS: Record<string, string> = {
  Action: "Fights, chases, explosions",
  Comedy: "Laugh-out-loud picks",
  Drama: "Stories that stay with you",
  Thriller: "Keep the lights on",
  "Sci-Fi": "Worlds beyond ours",
  Crime: "Follow the evidence",
  Romance: "Fall for something new",
  Fantasy: "Myths, magic and monsters",
  Animation: "Drawn to perfection",
  Mystery: "Nothing is as it seems",
  Horror: "Watch between your fingers",
  Adventure: "Go somewhere far",
  Family: "For the whole couch",
  Documentary: "True stories, told well",
  History: "The past, replayed",
  War: "On the front line",
  Western: "Dust, guns and justice",
  Music: "Turn it up",
};

const genreRows: Row[] = (Object.keys(GENRE_HINTS) as Genre[])
  .map((genre) => ({ genre, matches: all.filter((t) => t.genres.includes(genre)) }))
  .filter((entry) => entry.matches.length >= 16)
  .sort((a, b) => b.matches.length - a.matches.length)
  .slice(0, 10)
  .map(({ genre, matches }) =>
    shelf(
      `genre-${genre.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      genre,
      GENRE_HINTS[genre],
      [...matches].sort(byScore),
      24,
      true,
    ),
  );

/** Rows derived from the live catalogue so the shelves never go stale. */
export const dynamicRows: Row[] = [
  shelf(
    "trending-today",
    "Trending Today",
    "What everyone is watching right now",
    ranked,
    WIDE_SHELF,
  ),
  shelf("top-rated", "Top Rated", "The highest rated titles in the catalogue", topRated, WIDE_SHELF),
  ...genreRows,
];
