export const COMPACT_QUERY = "(max-width: 1023px)";

export function isCompactViewport() {
  return typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches;
}
