/** 크롬 PC 버전 레이아웃은 980px. 갤럭시 S24 기본 화면은 360px라 여기 안 든다. */
export const CONSOLE_MIN_PX = 980;

export const COMPACT_QUERY = `(max-width: ${CONSOLE_MIN_PX - 1}px)`;

export function isCompactViewport() {
  return typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches;
}
