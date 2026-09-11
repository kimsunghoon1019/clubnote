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
import { useCallback, useEffect, useRef, useState } from "react";
import { NAV_ITEMS, navItemActive } from "./nav";

const HISTORY_FLAG = "__clubnoteBell";

export function AppHeader() {
  const pathname = usePathname();
  const { setSearchOpen, currentMember, persistStatus } = useClub();
  const unread = useUnreadChartNotes();
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);
  const saving = persistStatus === "saving" || persistStatus === "pending";
  const saveFailed = persistStatus === "error";

  const finishClose = useCallback(() => {
    setBellOpen(false);
  }, []);

  const closeBell = useCallback(() => {
    if (pushedRef.current && window.history.state?.[HISTORY_FLAG]) {
      window.history.back();
      return;
    }
    finishClose();
  }, [finishClose]);

  useEffect(() => {
    setBellOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!bellOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBell();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bellOpen, closeBell]);

  useEffect(() => {
    if (!bellOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (bellRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      closeBell();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [bellOpen, closeBell]);

  useEffect(() => {
    if (!bellOpen) return;
    if (!window.history.state?.[HISTORY_FLAG]) {
      window.history.pushState({ ...window.history.state, [HISTORY_FLAG]: true }, "", window.location.href);
      pushedRef.current = true;
    }
    const onPop = () => {
      if (window.history.state?.[HISTORY_FLAG]) return;
      pushedRef.current = false;
      finishClose();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!pushedRef.current) return;
      pushedRef.current = false;
      if (!window.history.state?.[HISTORY_FLAG]) return;
      const state = { ...window.history.state };
      delete state[HISTORY_FLAG];
      window.history.replaceState(state, "", window.location.href);
    };
  }, [bellOpen, finishClose]);

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
            <span className="hidden text-[11px] text-faint lg:block">동아리 운영</span>
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
                  "relative flex h-full items-center whitespace-nowrap px-3 text-[14px]",
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
              className="relative z-10 hidden h-9 w-9 items-center justify-center rounded-btn text-sub hover:bg-muted lg:flex"
              aria-label="알림"
              aria-expanded={bellOpen}
              aria-haspopup="dialog"
              data-bell-open={bellOpen ? "true" : "false"}
              data-bell-unread={unread.length}
              onClick={() => (bellOpen ? closeBell() : setBellOpen(true))}
            >
              <Bell className="h-4 w-4" />
              {unread.length > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-up" data-bell-dot />
              ) : null}
            </button>
            {bellOpen ? (
              <div
                data-bell-panel
                className="absolute right-0 top-full z-20 mt-1.5 hidden w-80 max-w-[calc(100vw-24px)] rounded-card border border-line bg-white py-2 lg:block"
              >
                <p className="px-3 pb-2 text-[12px] font-semibold text-faint">알림</p>
                <div className="max-h-[min(420px,70vh)] overflow-auto px-3 scrollbar-thin">
                  <ChartInbox showHeader={false} />
                </div>
              </div>
            ) : null}
          </div>

          {bellOpen ? (
            <div
              ref={overlayRef}
              data-bell-overlay
              className="fixed inset-0 z-50 bg-white lg:hidden"
            >
              <div
                data-bell-panel
                data-bell-sheet
                role="dialog"
                aria-modal
                aria-label="알림"
                className="flex h-full flex-col bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
              >
                <header className="flex shrink-0 items-center border-b border-line-soft">
                  <button
                    type="button"
                    data-bell-close
                    className="flex h-touch min-w-touch items-center justify-center px-3 text-compact text-sub touch-manipulation"
                    onClick={closeBell}
                  >
                    닫기
                  </button>
                  <p data-bell-title className="min-w-0 flex-1 truncate text-center text-compact font-semibold text-ink">
                    알림
                  </p>
                  <span className="invisible flex h-touch min-w-touch items-center justify-center px-3 text-compact" aria-hidden>
                    닫기
                  </span>
                </header>
                <div className="min-h-0 flex-1 overflow-auto px-4 py-3 scrollbar-thin">
                  <ChartInbox showHeader={false} />
                </div>
              </div>
            </div>
          ) : null}

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
