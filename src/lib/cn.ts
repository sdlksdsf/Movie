/** Tiny class-name joiner — avoids a dependency for one helper. */
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
