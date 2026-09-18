"use client";

import { AttendanceToggle } from "@/components/ui/AttendanceToggle";
import { GhostButton } from "@/components/ui/GhostButton";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/cn";
import { useBackdropDismiss } from "@/lib/overlayDismiss";
import {
  attendanceRecordMap,
  downloadAttendanceSheetXlsx,
  isAttendanceClosed,
  practiceMonthGroups,
  practiceSheetEvents,
  sheetMembers,
} from "@/lib/attendanceSheet";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_META } from "@/lib/constants";
import { formatDateKo, formatWeekday, todayISO } from "@/lib/format";
import { isScheduledFor } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { AttendanceStatus, ClubEvent, Member } from "@/lib/types";
import { Download, X } from "lucide-react";
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
  focusEventId,
}: {
  open: boolean;
  onClose: () => void;
  focusEventId?: string;
}) {
  const { members, categories, events, attendance, setAttendanceStatus, toast } = useClub();
  const [edit, setEdit] = useState<EditCell | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const todayColRef = useRef<HTMLTableCellElement>(null);
  const focusColRef = useRef<HTMLTableCellElement>(null);

  const practiceList = useMemo(() => practiceSheetEvents(events), [events]);
  const people = useMemo(() => sheetMembers(members, categories), [members, categories]);
  const recordMap = useMemo(() => attendanceRecordMap(attendance), [attendance]);
  const monthGroups = useMemo(() => practiceMonthGroups(practiceList), [practiceList]);
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
    (focusColRef.current ?? todayColRef.current)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [open, practiceList.length, focusEventId]);

  const dismiss = useBackdropDismiss(onClose, open);

  if (!open || typeof document === "undefined") return null;

  const exportSheet = async () => {
    if (practiceList.length === 0 || people.length === 0) {
      toast("내보낼 출석표가 없어요");
      return;
    }
    await downloadAttendanceSheetXlsx(members, events, attendance, categories);
    toast("출석표 엑셀을 내려받았어요");
  };

  return createPortal(
    <>
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 lg:items-center lg:p-4" {...dismiss}>
      <div
        role="dialog"
        aria-modal
        aria-label="출석표"
        className="flex h-full w-full flex-col overflow-hidden rounded-none border-0 bg-white lg:h-[min(92vh,920px)] lg:w-[min(96vw,1280px)] lg:rounded-card lg:border lg:border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-line-soft px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:flex-row lg:items-center lg:gap-3 lg:px-5 lg:py-3.5 lg:pt-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-compact font-semibold text-ink lg:text-[16px]">출석표</h2>
            <p className="hidden min-w-0 flex-1 truncate text-[12px] text-faint lg:block">
              행이 회원, 열이 연습 날짜 · 안 오는 요일도 눌러 출석할 수 있어요
            </p>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-touch w-touch items-center justify-center rounded-btn text-faint hover:bg-muted hover:text-ink lg:hidden"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[12px] text-faint lg:hidden">안 오는 요일도 눌러 출석할 수 있어요</p>
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sub lg:ml-auto">
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
            <li className="text-faint">미마감</li>
          </ul>
          <div className="flex items-center gap-2">
            <GhostButton className="h-touch flex-1 px-3 text-[13px] lg:h-8 lg:flex-none lg:text-[12px]" onClick={() => void exportSheet()}>
              <Download className="h-3.5 w-3.5" />
              엑셀로 내보내기
            </GhostButton>
            <button
              type="button"
              onClick={onClose}
              className="hidden rounded-btn p-1 text-faint hover:bg-muted hover:text-ink lg:block"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-auto scrollbar-thin"
          onScroll={() => setEdit(null)}
        >
          {practiceList.length === 0 || people.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-faint">
              연습 일정이나 출석 대상 회원이 없어요.
            </p>
          ) : (
            <table className="min-w-max border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 top-0 z-30 w-[88px] border-b border-r border-line-soft bg-white px-2 py-2 text-left text-[11px] font-semibold text-faint"
                  >
                    이름
                  </th>
                  {monthGroups.map((group) => (
                    <th
                      key={group.key}
                      colSpan={group.count}
                      className="sticky top-0 z-20 h-8 border-b border-l border-line-soft bg-white px-1 text-center text-[11px] font-semibold text-sub"
                    >
                      {group.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {practiceList.map((event) => {
                    const isToday = event.date === today;
                    return (
                      <th
                        key={event.id}
                        ref={(el) => {
                          if (!el) return;
                          if (focusEventId && event.id === focusEventId) focusColRef.current = el;
                          if (isToday) todayColRef.current = el;
                        }}
                        data-today-practice={isToday ? "true" : undefined}
                        className={cn(
                          "sticky top-8 z-20 w-12 border-b border-l border-line-soft px-0.5 py-1.5 text-center font-medium",
                          isToday ? "bg-brand-soft text-brand-text" : "bg-white text-ink",
                        )}
                      >
                        <span className="block text-[12px] leading-4">{Number(event.date.slice(8, 10))}</span>
                        <span className="block text-[10px] font-normal text-faint">{formatWeekday(event.date)}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {people.map((member) => (
                  <tr key={member.id}>
                    <th className="sticky left-0 z-10 border-b border-r border-line-soft bg-white px-2 py-1.5 text-left font-medium text-ink">
                      <span className="block truncate">{member.name}</span>
                      <span className="block text-[10px] font-normal text-faint">{member.category}</span>
                    </th>
                    {practiceList.map((event) => (
                      <SheetCell
                        key={event.id}
                        event={event}
                        member={member}
                        status={recordMap.get(`${event.id}:${member.id}`)}
                        closed={isAttendanceClosed(event, today)}
                        today={event.date === today}
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
                ))}
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
    </>,
    document.body,
  );
}

function SheetCell({
  event,
  member,
  status,
  closed,
  today,
  editing,
  onEdit,
}: {
  event: ClubEvent;
  member: Member;
  status?: AttendanceStatus;
  closed: boolean;
  today: boolean;
  editing: boolean;
  onEdit: (rect: DOMRect) => void;
}) {
  const scheduled = isScheduledFor(member, event);
  const meta = status ? ATTENDANCE_STATUS_META[status] : null;
  const locked = scheduled && !closed;
  const emptyLabel = scheduled ? "미체크" : "·";
  const label = meta ? meta.short : emptyLabel;

  return (
    <td className={cn("border-b border-l border-line-soft p-0.5", today && "bg-brand-soft")}>
      {locked ? (
        <span
          className="flex h-8 items-center justify-center text-[10px] text-faint"
          aria-label={`${formatDateKo(event.date)} ${member.name} 미마감`}
        >
          미마감
        </span>
      ) : (
        <button
          type="button"
          aria-label={`${formatDateKo(event.date)} ${member.name} ${status ?? (scheduled ? "미체크" : "해당 없음")}`}
          aria-haspopup="dialog"
          aria-expanded={editing}
          data-sheet-cell
          data-sheet-guest={!scheduled ? "true" : undefined}
          onClick={(e) => onEdit(e.currentTarget.getBoundingClientRect())}
          className={cn(
            "flex h-8 w-full items-center justify-center rounded-[8px] text-[10px] font-semibold",
            editing && "ring-1 ring-brand",
          )}
          style={
            meta
              ? { background: meta.color, color: "#fff" }
              : scheduled
                ? { background: "#F2F4F6", color: "#8B95A1" }
                : { background: "transparent", color: "#D1D6DB" }
          }
        >
          {label}
        </button>
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
