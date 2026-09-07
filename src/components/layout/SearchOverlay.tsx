"use client";

import { cn } from "@/lib/cn";
import { formatDateKo, formatWon } from "@/lib/format";
import { useClub } from "@/lib/store";
import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const HISTORY_FLAG = "__clubnoteSearch";

export function SearchOverlay() {
  const { searchOpen, setSearchOpen, members, events, transactions, focusMember, focusEvent } = useClub();
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const pushedRef = useRef(false);

  const finishClose = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, [setSearchOpen]);

  const close = useCallback(() => {
    if (pushedRef.current && window.history.state?.[HISTORY_FLAG]) {
      window.history.back();
      return;
    }
    finishClose();
  }, [finishClose]);

  const dismiss = useCallback(() => {
    if (pushedRef.current && window.history.state?.[HISTORY_FLAG]) {
      pushedRef.current = false;
      const state = { ...window.history.state };
      delete state[HISTORY_FLAG];
      window.history.replaceState(state, "", window.location.href);
    }
    finishClose();
  }, [finishClose]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, close]);

  useEffect(() => {
    if (!searchOpen) return;

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
  }, [searchOpen, finishClose]);

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

  const goMember = (id: string) => {
    focusMember(id);
    dismiss();
    if (pathname !== "/members") router.push("/members");
  };

  const goEvent = (id: string) => {
    focusEvent(id);
    dismiss();
    if (pathname !== "/calendar") router.push("/calendar");
  };

  const go = (href: string) => {
    dismiss();
    router.push(href);
  };

  return (
    <div data-search-overlay className="fixed inset-0 z-50 bg-white lg:bg-black/20" onClick={close}>
      <div
        data-search-sheet
        role="dialog"
        aria-modal
        aria-label="검색"
        className={cn(
          "flex h-full flex-col bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          "lg:mx-auto lg:mt-20 lg:h-auto lg:max-h-[min(560px,calc(100%-6rem))] lg:w-[560px] lg:max-w-[calc(100%-32px)] lg:rounded-card lg:border lg:border-line lg:pt-0 lg:pb-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center border-b border-line-soft lg:hidden">
          <button
            type="button"
            data-search-close
            className="flex h-touch min-w-touch items-center justify-center px-3 text-compact text-sub touch-manipulation"
            onClick={close}
          >
            닫기
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-compact font-semibold text-ink">검색</p>
          <span className="invisible flex h-touch min-w-touch items-center justify-center px-3 text-compact" aria-hidden>
            닫기
          </span>
        </header>
        <div className="flex shrink-0 items-center gap-2 border-b border-line-soft px-4">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            autoFocus
            data-search-input
            type="text"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름, 일정, 거래내역을 검색하세요"
            className="h-touch min-w-0 flex-1 bg-transparent text-compact text-ink outline-none placeholder:text-faint focus-visible:outline-none lg:h-12 lg:text-[15px]"
          />
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="hidden h-touch w-touch items-center justify-center text-faint lg:flex"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2 scrollbar-thin lg:max-h-[420px] lg:flex-none">
          {!q ? (
            <p className="px-3 py-6 text-center text-compact-caption text-faint">회원, 일정, 거래 적요를 검색해 보세요</p>
          ) : (
            <>
              <Group title="회원">
                {results.members.length === 0 ? (
                  <Empty />
                ) : (
                  results.members.map((m) => (
                    <ResultButton key={m.id} dataAttr={{ "data-search-member": m.id }} onClick={() => goMember(m.id)}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-compact font-medium text-ink lg:text-[13px] lg:font-normal">
                          {m.name}
                        </span>
                        <span className="block truncate text-compact-caption text-faint lg:hidden">
                          {[m.role, m.major].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-[13px] text-faint lg:inline">
                        {[m.role, m.major].filter(Boolean).join(" · ")}
                      </span>
                    </ResultButton>
                  ))
                )}
              </Group>
              <Group title="일정">
                {results.events.length === 0 ? (
                  <Empty />
                ) : (
                  results.events.map((e) => (
                    <ResultButton key={e.id} dataAttr={{ "data-search-event": e.id }} onClick={() => goEvent(e.id)}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-compact font-medium text-ink lg:text-[13px] lg:font-normal">
                          {e.title}
                        </span>
                        <span className="block truncate text-compact-caption text-faint lg:hidden">
                          {formatDateKo(e.date)} · {e.type}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-[13px] text-faint lg:inline">
                        {formatDateKo(e.date)} · {e.type}
                      </span>
                    </ResultButton>
                  ))
                )}
              </Group>
              <Group title="거래내역">
                {results.transactions.length === 0 ? (
                  <Empty />
                ) : (
                  results.transactions.map((t) => (
                    <ResultButton key={t.id} dataAttr={{ "data-search-tx": t.id }} onClick={() => go("/finance")}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-compact font-medium text-ink lg:text-[13px] lg:font-normal">
                          {t.title}
                        </span>
                        <span className="block truncate text-compact-caption text-faint lg:hidden">{formatWon(t.amount)}</span>
                      </span>
                      <span className="hidden shrink-0 text-[13px] text-faint lg:inline">{formatWon(t.amount)}</span>
                    </ResultButton>
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

function ResultButton({
  children,
  onClick,
  dataAttr,
}: {
  children: React.ReactNode;
  onClick: () => void;
  dataAttr?: Record<string, string>;
}) {
  return (
    <button
      type="button"
      {...dataAttr}
      className="flex min-h-touch w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left touch-manipulation hover:bg-muted lg:min-h-0"
      onClick={onClick}
    >
      {children}
    </button>
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
  return <p className="px-3 py-2 text-compact-caption text-faint lg:text-[12px]">검색 결과가 없어요</p>;
}
