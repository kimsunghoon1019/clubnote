"use client";

import { Avatar } from "@/components/ui/Avatar";
import { formatChartStamp } from "@/lib/format";
import { useClub } from "@/lib/store";
import { useMemo } from "react";

export function ChartInbox() {
  const { members, notes, accountId, chartSeenByAccount, acknowledgeChartNote } = useClub();

  const unread = useMemo(() => {
    const seen = new Set(chartSeenByAccount[accountId] ?? []);
    return [...notes]
      .filter((note) => !seen.has(note.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notes, chartSeenByAccount, accountId]);

  return (
    <div data-chart-inbox>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-ink">최근 차트</h2>
        {unread.length > 0 ? <span className="text-[12px] tabular-nums text-faint">{unread.length}건</span> : null}
      </div>
      {unread.length === 0 ? (
        <p className="text-[12px] text-faint">확인할 차트가 없어요</p>
      ) : (
        <ol className="space-y-2">
          {unread.map((note) => {
            const member = members.find((item) => item.id === note.memberId);
            return (
              <li key={note.id}>
                <button
                  type="button"
                  data-chart-note-id={note.id}
                  onClick={() => acknowledgeChartNote(note.id)}
                  className="w-full rounded-[8px] border border-line-soft px-3 py-2.5 text-left hover:bg-muted"
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
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-2 text-[11px] leading-4 text-faint">확인하면 목록에서 내려가고, 다음 차트가 올라와요</p>
    </div>
  );
}
