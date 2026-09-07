"use client";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useClub } from "@/lib/store";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { notifications } from "@/lib/seed";

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
  const [bellOpen, setBellOpen] = useState(false);

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
            <span className="block text-[15px] font-bold text-ink">클럽노트</span>
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

          <div className="relative">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-btn text-sub hover:bg-muted"
              aria-label="알림"
              onClick={() => setBellOpen((v) => !v)}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-up" />
            </button>
            {bellOpen ? (
              <div className="absolute right-0 top-11 w-80 rounded-card border border-line bg-white py-2">
                <p className="px-3 pb-2 text-[12px] font-semibold text-faint">알림</p>
                {notifications.map((item) => (
                  <div key={item.id} className="px-3 py-2 hover:bg-muted">
                    <p className="text-[13px] text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-faint">{item.time}</p>
                  </div>
                ))}
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
              <Avatar name={currentMember.name} size={24} src={currentMember.photoDataUrl} />
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
