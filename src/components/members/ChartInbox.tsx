"use client";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { formatChartStamp } from "@/lib/format";
import { useClub } from "@/lib/store";
import type { ChartNote } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

const DISMISS_MS = 320;

export function unreadChartNotes(notes: ChartNote[], seenIds: string[] | undefined) {
  const seen = new Set(seenIds ?? []);
  return [...notes]
    .filter((note) => !seen.has(note.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function useUnreadChartNotes() {
  const { notes, accountId, chartSeenByAccount } = useClub();
  return useMemo(
    () => unreadChartNotes(notes, chartSeenByAccount[accountId]),
    [notes, chartSeenByAccount, accountId],
  );
}

export function ChartInbox({ showHeader = true }: { showHeader?: boolean }) {
  const { members, acknowledgeChartNote } = useClub();
  const unread = useUnreadChartNotes();
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) window.clearTimeout(timer);
      map.clear();
    };
  }, []);

  const dismiss = (id: string) => {
    if (leaving.has(id) || timers.current.has(id)) return;
    setLeaving((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const timer = window.setTimeout(() => {
      timers.current.delete(id);
      acknowledgeChartNote(id);
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, DISMISS_MS);
    timers.current.set(id, timer);
  };

  return (
    <div data-chart-inbox data-chart-unread={unread.length}>
      {showHeader ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-ink">최근 차트</h2>
          {unread.length > 0 ? <span className="text-[12px] tabular-nums text-faint">{unread.length}건</span> : null}
        </div>
      ) : null}
      {unread.length === 0 ? (
        <p className="text-[12px] text-faint">확인할 차트가 없어요</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {unread.map((note) => {
            const member = members.find((item) => item.id === note.memberId);
            const exiting = leaving.has(note.id);
            return (
              <li
                key={note.id}
                className={cn(
                  "grid origin-center transition-[grid-template-rows,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  exiting ? "grid-rows-[0fr] scale-[0.94] opacity-0" : "grid-rows-[1fr] scale-100 opacity-100",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <button
                    type="button"
                    data-chart-note-id={note.id}
                    disabled={exiting}
                    onClick={() => dismiss(note.id)}
                    className="w-full origin-center rounded-[8px] border border-line-soft px-3 py-2.5 text-left transition-transform duration-100 ease-out hover:bg-muted active:scale-[0.97]"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={member?.name ?? "탈퇴"} size={24} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{member?.name ?? "탈퇴 회원"}</p>
                        <p className="text-[11px] text-faint">
                          {formatChartStamp(note.createdAt)}
                          {note.author ? (
                            <>
                              {" · "}
                              <span className="font-medium text-sub">{note.author}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[13px] leading-5 text-ink">{note.body}</p>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {showHeader ? (
        <p className="mt-2 text-[11px] leading-4 text-faint">확인하면 목록에서 내려가고, 다음 차트가 올라와요</p>
      ) : null}
    </div>
  );
}
