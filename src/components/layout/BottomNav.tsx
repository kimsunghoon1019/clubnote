"use client";

import { cn } from "@/lib/cn";
import { Calendar, ClipboardCheck, Home, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompactDetail } from "./DetailSurface";
import { NAV_ITEMS, navItemActive } from "./nav";

const ICONS = {
  "/": Home,
  "/members": Users,
  "/attendance": ClipboardCheck,
  "/finance": Wallet,
  "/calendar": Calendar,
} as const;

export function BottomNav() {
  const pathname = usePathname();
  const { open } = useCompactDetail();

  return (
    <nav
      data-bottom-nav
      aria-hidden={open || undefined}
      aria-label="주요 메뉴"
      className={cn(
        "shrink-0 border-t border-line-soft bg-white pb-[env(safe-area-inset-bottom)] lg:hidden",
        open && "hidden",
      )}
    >
      <ul className="grid h-14 grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = navItemActive(pathname, item.href);
          const Icon = ICONS[item.href];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-nav-href={item.href}
                className={cn(
                  "flex h-full min-h-touch flex-col items-center justify-center gap-0.5 touch-manipulation",
                  active ? "font-semibold text-ink" : "text-sub",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span className="text-[11px] leading-none">{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
