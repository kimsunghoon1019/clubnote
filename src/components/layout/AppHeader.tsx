"use client";

import { ChartInbox, useUnreadChartNotes } from "@/components/members/ChartInbox";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { CLUB_NAME } from "@/lib/constants";
import { memberPhotoSrc } from "@/lib/proof";
import { useClub } from "@/lib/store";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS, navItemActive } from "./nav";

export function AppHeader() {
  const pathname = usePathname();
  const { setSearchOpen, currentMember, persistStatus } = useClub();
  const unread = useUnreadChartNotes();
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const saving = persistStatus === "saving" || persistStatus === "pending";
  const saveFailed = persistStatus === "error";

  useEffect(() => {
    setBellOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!bellOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (bellRef.current?.contains(event.target as Node)) return;
      setBellOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBellOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [bellOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-white pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-6 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center">
            <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
              <rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.2" transform="rotate(45 8 8)" fill="#3182F6" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold text-ink">{CLUB_NAME}</span>
            <span className="block text-[11px] text-faint">동아리 운영</span>
          </span>
        </Link>

        <nav data-console-nav className="hidden h-full items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = navItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full items-center px-3 text-[14px]",
                  active ? "font-semibold text-ink" : "text-sub hover:text-ink",
                )}
              >
                {item.label}
                {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 w-[280px] items-center gap-2 rounded-chip border border-line bg-white px-3 text-[13px] text-faint hover:border-[#d1d6db] lg:flex"
          >
            <Search className="h-3.5 w-3.5" />
            이름, 일정, 거래내역을 검색하세요
          </button>
          <button
            type="button"
            className="flex h-touch w-touch items-center justify-center rounded-btn text-sub hover:bg-muted lg:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="검색"
          >
            <Search className="h-4 w-4" />
          </button>

          {saving || saveFailed ? (
            <span
              data-save-dot
              className={cn("h-3 w-3 shrink-0 rounded-full lg:hidden", saveFailed ? "bg-up" : "bg-brand")}
              title={saveFailed ? "저장 실패" : "저장 중"}
              aria-label={saveFailed ? "저장 실패" : "저장 중"}
            />
          ) : null}

          <div className="relative" ref={bellRef}>
            <button
              type="button"
              className="relative z-10 flex h-touch w-touch items-center justify-center rounded-btn text-sub hover:bg-muted lg:h-9 lg:w-9"
              aria-label="알림"
              aria-expanded={bellOpen}
              aria-haspopup="dialog"
              data-bell-open={bellOpen ? "true" : "false"}
              data-bell-unread={unread.length}
              onClick={() => setBellOpen((open) => !open)}
            >
              <Bell className="h-4 w-4" />
              {unread.length > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-up lg:right-1.5 lg:top-1.5" data-bell-dot />
              ) : null}
            </button>
            {bellOpen ? (
              <div
                data-bell-panel
                className="absolute right-0 top-full z-20 mt-1.5 w-80 max-w-[calc(100vw-24px)] rounded-card border border-line bg-white py-2"
              >
                <p className="px-3 pb-2 text-[12px] font-semibold text-faint">알림</p>
                <div className="max-h-[min(420px,70vh)] overflow-auto px-3 scrollbar-thin">
                  <ChartInbox showHeader={false} />
                </div>
              </div>
            ) : null}
          </div>

          {currentMember ? (
            <Link
              href="/mypage"
              aria-label={`${currentMember.name} 마이페이지`}
              className={cn(
                "flex h-touch w-touch items-center justify-center rounded-full lg:h-9 lg:w-auto lg:gap-2 lg:rounded-chip lg:border lg:px-2.5",
                pathname.startsWith("/mypage")
                  ? "bg-brand-soft lg:border-brand"
                  : "hover:bg-muted lg:border-line-soft",
              )}
            >
              <Avatar name={currentMember.name} size={24} src={memberPhotoSrc(currentMember)} />
              <span className="hidden text-[13px] text-ink lg:inline">
                <span className="text-faint">{currentMember.role} · </span>
                {currentMember.name}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex h-9 items-center rounded-chip border border-line-soft px-3 text-[13px] font-medium text-brand-text hover:bg-brand-soft"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
