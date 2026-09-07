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

const NAV = [
  { href: "/", label: "홈" },
  { href: "/members", label: "회원관리" },
  { href: "/attendance", label: "출석체크" },
  { href: "/finance", label: "회계" },
  { href: "/calendar", label: "캘린더" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { setSearchOpen, currentMember } = useClub();
  const unread = useUnreadChartNotes();
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-30 h-14 border-b border-line-soft bg-white">
      <div className="flex h-full items-center gap-6 px-5">
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

        <nav className="flex h-full items-center gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
            className="hidden h-9 w-[280px] items-center gap-2 rounded-chip border border-line bg-white px-3 text-[13px] text-faint hover:border-[#d1d6db] md:flex"
          >
            <Search className="h-3.5 w-3.5" />
            이름, 일정, 거래내역을 검색하세요
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-btn text-sub hover:bg-muted md:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="검색"
          >
            <Search className="h-4 w-4" />
          </button>

          <div className="relative" ref={bellRef}>
            <button
              type="button"
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-btn text-sub hover:bg-muted"
              aria-label="알림"
              aria-expanded={bellOpen}
              aria-haspopup="dialog"
              data-bell-open={bellOpen ? "true" : "false"}
              data-bell-unread={unread.length}
              onClick={() => setBellOpen((open) => !open)}
            >
              <Bell className="h-4 w-4" />
              {unread.length > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-up" data-bell-dot />
              ) : null}
            </button>
            {bellOpen ? (
              <div
                data-bell-panel
                className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-card border border-line bg-white py-2"
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
                "flex h-9 items-center gap-2 rounded-chip border px-2.5",
                pathname.startsWith("/mypage") ? "border-brand bg-brand-soft" : "border-line-soft hover:bg-muted",
              )}
            >
              <Avatar name={currentMember.name} size={24} src={memberPhotoSrc(currentMember)} />
              <span className="text-[13px] text-ink">
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
