/**
 * Profile characters.
 *
 * Twelve hand-drawn vector characters — not generated photos — so every avatar
 * is crisp at any size, weighs nothing, and stays readable on any accent colour.
 * The art itself is drawn in white/black opacities, which means the user's
 * chosen colour tints it instead of fighting it.
 */

export type AvatarId =
  | "robot"
  | "astro"
  | "panda"
  | "fox"
  | "hero"
  | "cat"
  | "alien"
  | "dragon"
  | "unicorn"
  | "bear"
  | "ninja"
  | "reel";

export const AVATARS: Array<{ id: AvatarId; label: string; kids?: boolean }> = [
  { id: "robot", label: "Robot" },
  { id: "astro", label: "Astronaut" },
  { id: "panda", label: "Panda", kids: true },
  { id: "fox", label: "Fox", kids: true },
  { id: "hero", label: "Hero" },
  { id: "cat", label: "Cat", kids: true },
  { id: "alien", label: "Alien" },
  { id: "dragon", label: "Dragon", kids: true },
  { id: "unicorn", label: "Unicorn", kids: true },
  { id: "bear", label: "Bear", kids: true },
  { id: "ninja", label: "Ninja" },
  { id: "reel", label: "Cinema" },
];

export const ACCENTS = [
  { id: "red", value: "#e50914", label: "Signal red" },
  { id: "orange", value: "#f97316", label: "Ember" },
  { id: "amber", value: "#f59e0b", label: "Gold" },
  { id: "lime", value: "#84cc16", label: "Lime" },
  { id: "green", value: "#22c55e", label: "Jungle" },
  { id: "teal", value: "#14b8a6", label: "Teal" },
  { id: "cyan", value: "#06b6d4", label: "Ice" },
  { id: "blue", value: "#3b82f6", label: "Ocean" },
  { id: "indigo", value: "#6366f1", label: "Indigo" },
  { id: "violet", value: "#8b5cf6", label: "Violet" },
  { id: "pink", value: "#ec4899", label: "Bubblegum" },
  { id: "slate", value: "#64748b", label: "Graphite" },
] as const;

export type MaturityLevel = "kids" | "7" | "13" | "16" | "all";

export const MATURITY: Array<{ id: MaturityLevel; label: string; hint: string }> = [
  { id: "kids", label: "Little kids", hint: "Pre-school & family animation only" },
  { id: "7", label: "7+", hint: "Cartoons, family films, no scares" },
  { id: "13", label: "13+", hint: "Teen titles, mild action" },
  { id: "16", label: "16+", hint: "Most titles, no extreme violence" },
  { id: "all", label: "All", hint: "Everything, including mature titles" },
];

const MATURITY_RANK: Record<MaturityLevel, number> = { kids: 0, "7": 1, "13": 2, "16": 3, all: 4 };

/** How restrictive a rating string is (0 = everybody, 4 = adults). */
export function ratingRank(maturity?: string): number {
  const value = (maturity ?? "").toUpperCase().replace(/\s/g, "");
  if (!value) return 2;
  if (/^(G|TV-Y|TV-Y7|TV-G|U|ALL)$/.test(value)) return 0;
  if (/^(PG|TV-PG|7\+|U\/A)$/.test(value)) return 1;
  if (/^(PG-13|TV-14|13\+|12A)$/.test(value)) return 2;
  if (/^(R|TV-MA|16\+|18\+|NC-17|MA15\+)$/.test(value)) return 4;
  return 2;
}

export function allowedFor(level: MaturityLevel, maturity?: string): boolean {
  const limit = level === "all" ? 5 : level === "16" ? 3 : MATURITY_RANK[level] + 1;
  return ratingRank(maturity) <= limit;
}
