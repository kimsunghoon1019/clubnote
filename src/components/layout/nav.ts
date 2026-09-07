export const NAV_ITEMS = [
  { href: "/", label: "홈", short: "홈" },
  { href: "/members", label: "회원관리", short: "회원" },
  { href: "/attendance", label: "출석체크", short: "출석" },
  { href: "/finance", label: "회계", short: "회계" },
  { href: "/calendar", label: "캘린더", short: "캘린더" },
] as const;

export function navItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
