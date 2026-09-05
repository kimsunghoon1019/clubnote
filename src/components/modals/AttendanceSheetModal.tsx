"use client";

import { AttendanceToggle } from "@/components/ui/AttendanceToggle";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/cn";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_META } from "@/lib/constants";
import { formatDateKo, formatWeekday, todayISO } from "@/lib/format";
import { isActive, isPracticeEvent, isScheduledFor } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { AttendanceStatus, ClubEvent, Member } from "@/lib/types";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type EditCell = {
  eventId: string;
  memberId: string;
  name: string;
  status?: AttendanceStatus;
  rect: DOMRect;
};

export function AttendanceSheetModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { members, categories, events, attendance, setAttendanceStatus } = useClub();
  const [edit, setEdit] = useState<EditCell | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const todayRowRef = useRef<HTMLTableRowElement>(null);

  const practiceList = useMemo(
    () =>
      events
        .filter(isPracticeEvent)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [events],
  );

  const sheetMembers = useMemo(() => {
    const catIndex = (category: string) => {
      const index = categories.indexOf(category);
      return index === -1 ? 99 : index;
    };
    return members
      .filter(isActive)
      .slice()
      .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.name.localeCompare(b.name, "ko"));
  }, [members, categories]);

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const row of attendance) {
      map.set(`${row.eventId}:${row.memberId}`, row.status);
    }
    return map;
  }, [attendance]);

  const today = todayISO();

  useEffect(() => {
    if (!open) {
      setEdit(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (edit) {
        setEdit(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, edit, onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    todayRowRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [open, practiceList.length]);

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label="출석표"
        className="flex h-[min(92vh,920px)] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-card border border-line bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line-soft px-5 py-3.5">
          <h2 className="text-[16px] font-semibold text-ink">출석표</h2>
          <p className="text-[12px] text-faint">열이 회원, 행이 연습 날짜 · 칸을 눌러 수정</p>
          <ul className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sub">
            {ATTENDANCE_STATUSES.map((status) => (
              <li key={status} className="inline-flex items-center gap-1">
                <StatusDot status={status} />
                {ATTENDANCE_STATUS_META[status].short}
              </li>
            ))}
            <li className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#D1D6DB]" />
              미체크
            </li>
          </ul>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn p-1 text-faint hover:bg-muted hover:text-ink"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-auto scrollbar-thin"
          onScroll={() => setEdit(null)}
        >
          {practiceList.length === 0 || sheetMembers.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-faint">
              연습 일정이나 출석 대상 회원이 없어요.
            </p>
          ) : (
            <table className="min-w-max border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 w-[88px] border-b border-r border-line-soft bg-white px-2 py-2 text-left text-[11px] font-semibold text-faint">
                    날짜
                  </th>
                  {sheetMembers.map((member) => (
                    <th
                      key={member.id}
                      className="sticky top-0 z-20 w-14 border-b border-line-soft bg-white px-0.5 py-2 text-center font-medium text-ink"
                    >
                      <span className="block truncate">{member.name}</span>
                      <span className="block text-[10px] font-normal text-faint">{member.category}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {practiceList.map((event) => {
                  const isToday = event.date === today;
                  return (
                    <tr key={event.id} ref={isToday ? todayRowRef : undefined} data-today-practice={isToday ? "true" : undefined}>
                      <th
                        className={cn(
                          "sticky left-0 z-10 border-b border-r border-line-soft px-2 py-1.5 text-left font-medium",
                          isToday ? "bg-brand-soft text-brand-text" : "bg-white text-ink",
                        )}
                      >
                        <span className="block">{formatDateKo(event.date)}</span>
                        <span className="block text-[10px] font-normal text-faint">
                          {formatWeekday(event.date)} {event.startTime}
                        </span>
                      </th>
                      {sheetMembers.map((member) => (
                        <SheetCell
                          key={member.id}
                          event={event}
                          member={member}
                          status={recordMap.get(`${event.id}:${member.id}`)}
                          editing={edit?.eventId === event.id && edit.memberId === member.id}
                          onEdit={(rect) =>
                            setEdit((current) =>
                              current?.eventId === event.id && current.memberId === member.id
                                ? null
                                : {
                                    eventId: event.id,
                                    memberId: member.id,
                                    name: member.name,
                                    status: recordMap.get(`${event.id}:${member.id}`),
                                    rect,
                                  },
                            )
                          }
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
    {edit ? (
      <StatusPopover
        edit={edit}
        onChange={(status) => {
          setAttendanceStatus(edit.eventId, edit.memberId, status);
          setEdit(null);
        }}
        onClose={() => setEdit(null)}
      />
    ) : null}
    </>
  );
}

function SheetCell({
  event,
  member,
  status,
  editing,
  onEdit,
}: {
  event: ClubEvent;
  member: Member;
  status?: AttendanceStatus;
  editing: boolean;
  onEdit: (rect: DOMRect) => void;
}) {
  const scheduled = isScheduledFor(member, event);
  const meta = status ? ATTENDANCE_STATUS_META[status] : null;

  return (
    <td className="border-b border-line-soft p-0.5">
      {scheduled ? (
        <button
          type="button"
          aria-label={`${formatDateKo(event.date)} ${member.name} ${status ?? "미체크"}`}
          aria-haspopup="dialog"
          aria-expanded={editing}
          data-sheet-cell
          onClick={(e) => onEdit(e.currentTarget.getBoundingClientRect())}
          className={cn(
            "flex h-8 w-full items-center justify-center rounded-[8px] text-[10px] font-semibold",
            editing && "ring-1 ring-brand",
          )}
          style={
            meta
              ? { background: meta.color, color: "#fff" }
              : { background: "#F2F4F6", color: "#8B95A1" }
          }
        >
          {meta ? meta.short : "미체크"}
        </button>
      ) : (
        <span className="flex h-8 items-center justify-center text-faint" aria-hidden>
          ·
        </span>
      )}
    </td>
  );
}

function StatusPopover({
  edit,
  onChange,
  onClose,
}: {
  edit: EditCell;
  onChange: (status: AttendanceStatus | null) => void;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const popW = 292;
    const popH = 52;
    let left = edit.rect.left;
    let top = edit.rect.bottom + 4;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top + popH > window.innerHeight - 8) top = edit.rect.top - popH - 4;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [edit.rect]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (e.target instanceof Element && e.target.closest("[data-sheet-cell]")) return;
      onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label={`${edit.name} 출결 선택`}
      className="fixed z-[60] rounded-[12px] border border-line bg-white p-1 shadow-toast"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <AttendanceToggle name={edit.name} value={edit.status} onChange={onChange} />
    </div>,
    document.body,
  );
}
