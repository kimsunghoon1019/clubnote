"use client";

import { formatDateKo, formatWon } from "@/lib/format";
import { useClub } from "@/lib/store";
import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function SearchOverlay() {
  const { searchOpen, setSearchOpen, members, events, transactions, focusMember, focusEvent } = useClub();
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, setSearchOpen]);

  const q = query.trim();
  const results = useMemo(() => {
    if (!q) return { members: [], events: [], transactions: [] };
    return {
      members: members.filter((m) => `${m.name}${m.major}${m.studentId}${m.role}`.includes(q)).slice(0, 5),
      events: events.filter((e) => `${e.title}${e.type}${e.place}`.includes(q)).slice(0, 5),
      transactions: transactions.filter((t) => `${t.title}${t.category}${t.institution}`.includes(q)).slice(0, 5),
    };
  }, [q, members, events, transactions]);

  if (!searchOpen) return null;

  const close = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const goMember = (id: string) => {
    focusMember(id);
    close();
    if (pathname !== "/members") router.push("/members");
  };

  const goEvent = (id: string) => {
    focusEvent(id);
    close();
    if (pathname !== "/calendar") router.push("/calendar");
  };

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-white lg:bg-black/20"
      onClick={() => setSearchOpen(false)}
    >
      <div
        className="flex h-full flex-col bg-white pt-[env(safe-area-inset-top)] lg:mx-auto lg:mt-20 lg:h-auto lg:max-h-[min(520px,calc(100%-96px))] lg:w-[560px] lg:max-w-[calc(100%-32px)] lg:rounded-card lg:border lg:border-line lg:pt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line-soft px-4">
          <Search className="h-4 w-4 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름, 일정, 거래내역을 검색하세요"
            className="h-touch flex-1 bg-transparent text-compact outline-none placeholder:text-faint lg:h-12 lg:text-[15px]"
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            aria-label="닫기"
            className="flex h-touch w-touch items-center justify-center text-faint"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2 scrollbar-thin lg:max-h-[420px] lg:flex-none">
          {!q ? (
            <p className="px-3 py-6 text-center text-[13px] text-faint">회원, 일정, 거래 적요를 검색해 보세요</p>
          ) : (
            <>
              <Group title="회원">
                {results.members.length === 0 ? (
                  <Empty />
                ) : (
                  results.members.map((m) => (
                    <button key={m.id} type="button" data-search-member={m.id} className="flex min-h-touch w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-compact lg:min-h-0 lg:text-[13px] hover:bg-muted" onClick={() => goMember(m.id)}>
                      <span>{m.name}</span>
                      <span className="text-faint">
                        {m.role} · {m.major}
                      </span>
                    </button>
                  ))
                )}
              </Group>
              <Group title="일정">
                {results.events.length === 0 ? (
                  <Empty />
                ) : (
                  results.events.map((e) => (
                    <button key={e.id} type="button" data-search-event={e.id} className="flex min-h-touch w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-compact lg:min-h-0 lg:text-[13px] hover:bg-muted" onClick={() => goEvent(e.id)}>
                      <span>{e.title}</span>
                      <span className="text-faint">
                        {formatDateKo(e.date)} · {e.type}
                      </span>
                    </button>
                  ))
                )}
              </Group>
              <Group title="거래내역">
                {results.transactions.length === 0 ? (
                  <Empty />
                ) : (
                  results.transactions.map((t) => (
                    <button key={t.id} type="button" className="flex min-h-touch w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-compact lg:min-h-0 lg:text-[13px] hover:bg-muted" onClick={() => go("/finance")}>
                      <span>{t.title}</span>
                      <span className="text-faint">{formatWon(t.amount)}</span>
                    </button>
                  ))
                )}
              </Group>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-3 py-1 text-[11px] font-semibold text-faint">{title}</p>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="px-3 py-2 text-[12px] text-faint">검색 결과가 없어요</p>;
}
