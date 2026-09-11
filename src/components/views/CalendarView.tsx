"use client";

import { EventAttachmentList } from "@/components/calendar/EventAttachments";
import { DetailSurface } from "@/components/layout/DetailSurface";
import { DateTimeRangeField, type DateTimeRangeValue } from "@/components/ui/DateTimeRangeField";
import { FieldLabel, TextArea, TextInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { InlineTaxonomySelect } from "@/components/ui/InlineTaxonomySelect";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { WeatherMark } from "@/components/ui/WeatherMark";
import {
  CALENDAR_DAY_HEAD,
  CALENDAR_MAX_LANES,
  chunkWeeks,
  hiddenCountForDay,
  isMultiDayEvent,
  layoutWeek,
  monthCells,
  weekMinHeight,
  type CalendarCell,
  type WeekSegment,
} from "@/lib/calendarLayout";
import { cn } from "@/lib/cn";
import {
  defaultPracticeRange,
  eachISODate,
  eventEndDate,
  formatDateKo,
  formatDateWeekday,
  formatTimeKo,
  formatWeekday,
  parseISODate,
  toISODate,
  todayISO,
} from "@/lib/format";
import { practiceNoticeText } from "@/lib/notice";
import { eventAttachments } from "@/lib/proof";
import { COMPACT_QUERY, isCompactViewport } from "@/lib/compact";
import { isPracticeEvent } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { ClubEvent } from "@/lib/types";
import type { WeatherDay } from "@/lib/weather";
import { ChevronLeft, ChevronRight, Clock, Copy, MapPin, MoreHorizontal, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const EDIT_FORM_ID = "calendar-event-edit";

function barClass(type: string) {
  if (type === "공연") return "bg-[#FFF1F1] text-up";
  if (type === "회식") return "bg-[#FFF8E1] text-[#B78103]";
  if (type === "회의") return "bg-[#F2F4F6] text-sub";
  return "bg-brand-soft text-brand-text";
}

function typeAccentClass(type: string) {
  if (type === "공연") return "bg-up";
  if (type === "회식") return "bg-[#E8A317]";
  if (type === "회의") return "bg-[#8b95a1]";
  return "bg-brand";
}

function hourLabel(event: ClubEvent) {
  if (event.allDay) return "종일";
  const [h, m = "00"] = event.startTime.split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return event.startTime;
  return `${hour}:${m.padStart(2, "0")}`;
}

function eventTimeRangeText(event: ClubEvent) {
  if (event.allDay) return "하루 종일";
  const start = formatTimeKo(event.startTime);
  const end = formatTimeKo(event.endTime);
  if (!end) return start;
  return `${start} - ${end}`;
}

function barLabel(event: ClubEvent) {
  const title = event.title === "정기연습" ? "연습" : event.title;
  if (event.allDay || isMultiDayEvent(event)) return title;
  return `${event.startTime} ${title}`;
}

function addDaysISO(iso: string, days: number) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function eventSpanDays(event: ClubEvent) {
  return Math.max(0, eachISODate(event.date, eventEndDate(event)).length - 1);
}

function cloneEventOntoDate(event: ClubEvent, date: string): Omit<ClubEvent, "id"> {
  const span = eventSpanDays(event);
  return {
    date,
    endDate: span > 0 ? addDaysISO(date, span) : undefined,
    title: event.title,
    type: event.type,
    place: event.place,
    preview: event.preview,
    startTime: event.startTime,
    endTime: event.endTime,
    allDay: event.allDay,
    attachments: eventAttachments(event),
  };
}

function daysBetweenISO(from: string, to: string) {
  const start = parseISODate(from).getTime();
  const end = parseISODate(to).getTime();
  return Math.round((end - start) / 86_400_000);
}

function shiftEventDates(event: ClubEvent, grabIso: string, dropIso: string) {
  const delta = daysBetweenISO(grabIso, dropIso);
  if (delta === 0) return null;
  const date = addDaysISO(event.date, delta);
  const span = eventSpanDays(event);
  return {
    date,
    endDate: span > 0 ? addDaysISO(date, span) : undefined,
  };
}

function isoFromPoint(clientX: number, clientY: number) {
  const nodes = document.querySelectorAll<HTMLElement>("[data-iso]");
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom) {
      return node.dataset.iso ?? null;
    }
  }
  return null;
}

function swallowNextClick() {
  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("click", onClick, true);
  window.setTimeout(() => window.removeEventListener("click", onClick, true), 400);
}

type DragGhost = {
  event: ClubEvent;
  x: number;
  y: number;
  width: number;
  height: number;
};

type EventMenu = {
  event: ClubEvent;
  x: number;
  y: number;
};

function EventBarFace({ event }: { event: ClubEvent }) {
  const hasAttach = eventAttachments(event).length > 0;
  return (
    <>
      <span className="min-w-0 truncate">{barLabel(event)}</span>
      {hasAttach ? <Paperclip className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden /> : null}
    </>
  );
}

function eventRangeOf(event: ClubEvent): DateTimeRangeValue {
  const fallback = defaultPracticeRange(event.date);
  return {
    startDate: event.date,
    endDate: event.endDate ?? event.date,
    startTime: event.startTime || fallback.startTime,
    endTime: event.endTime || fallback.endTime,
    allDay: Boolean(event.allDay),
  };
}

function MonthSwitcher({
  year,
  monthIndex,
  onPrev,
  onNext,
}: {
  year: number;
  monthIndex: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center lg:h-8 lg:w-[176px] lg:min-w-[176px] lg:max-w-[176px] lg:flex-none lg:justify-between lg:overflow-hidden">
      <button
        type="button"
        className="flex h-touch w-touch shrink-0 items-center justify-center rounded-btn hover:bg-muted lg:h-8 lg:w-8"
        onClick={onPrev}
        aria-label="이전 달"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <h1 className="min-w-0 truncate whitespace-nowrap px-0.5 text-center text-[18px] font-semibold tabular-nums lg:flex-1">
        {year}년 {monthIndex + 1}월
      </h1>
      <button
        type="button"
        className="flex h-touch w-touch shrink-0 items-center justify-center rounded-btn hover:bg-muted lg:h-8 lg:w-8"
        onClick={onNext}
        aria-label="다음 달"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CalendarView() {
  const {
    events,
    weatherDays,
    addEvent,
    updateEvent,
    deleteEvent,
    deleteEvents,
    undoEventChange,
    openModal,
    modal,
    toast,
    pendingEventId,
    consumePendingEvent,
  } = useClub();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => parseISODate(today));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<ClubEvent | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIsos, setDropIsos] = useState<string[]>([]);
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const [eventMenu, setEventMenu] = useState<EventMenu | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const weeks = useMemo(() => chunkWeeks(monthCells(year, monthIndex)), [year, monthIndex]);
  const forecast = useMemo(() => {
    const map = new Map<string, WeatherDay>();
    for (const day of weatherDays) map.set(day.date, day);
    return map;
  }, [weatherDays]);

  const byDate = useMemo(() => {
    const map = new Map<string, ClubEvent[]>();
    events.forEach((event) => {
      for (const iso of eachISODate(event.date, eventEndDate(event))) {
        const list = map.get(iso) ?? [];
        list.push(event);
        map.set(iso, list);
      }
    });
    return map;
  }, [events]);

  const selectedEvents = selected ? byDate.get(selected) ?? [] : [];
  const pickedEvents = selectedEventIds
    .map((id) => events.find((event) => event.id === id))
    .filter((event): event is ClubEvent => Boolean(event));
  const active = events.find((event) => event.id === activeId) ?? pickedEvents[0];
  const notice = practiceNoticeText(events, today);
  const multiSelected = pickedEvents.length > 1;

  useEffect(() => {
    if (!pendingEventId) return;
    const event = events.find((item) => item.id === pendingEventId);
    if (!event) return;
    setCursor(parseISODate(event.date));
    setSelected(event.date);
    setActiveId(event.id);
    setSelectedEventIds([event.id]);
    setEditing(false);
    consumePendingEvent();
  }, [pendingEventId, events, consumePendingEvent]);

  const shiftMonth = (delta: number) => {
    setCursor(new Date(year, monthIndex + delta, 1));
  };

  const goToday = () => {
    setCursor(parseISODate(today));
    setSelected(null);
    setActiveId(null);
    setSelectedEventIds([]);
    setEditing(false);
  };

  const resetPanel = () => {
    setSelected(null);
    setActiveId(null);
    setSelectedEventIds([]);
    setEditing(false);
  };

  const copyNotice = async () => {
    try {
      await navigator.clipboard.writeText(notice);
      toast("공지 멘트를 복사했어요");
    } catch {
      toast("복사에 실패했어요");
    }
  };

  const openCreate = (date?: string | null) => {
    openModal("event", date ? { date } : undefined);
  };

  const copyEvent = () => {
    if (!active) return;
    setClipboard(active);
    toast("일정을 복사했어요");
  };

  const pasteEvent = () => {
    if (!clipboard) {
      toast("복사한 일정이 없어요");
      return;
    }
    if (!selected) {
      toast("붙여넣을 날짜를 선택해 주세요");
      return;
    }
    const created = addEvent(cloneEventOntoDate(clipboard, selected));
    setActiveId(created.id);
    setSelectedEventIds([created.id]);
    setEditing(false);
    toast("일정을 붙여넣었어요");
  };

  const clearDeletedSelection = (ids: string[]) => {
    const doomed = new Set(ids);
    setSelectedEventIds((prev) => prev.filter((id) => !doomed.has(id)));
    setActiveId((id) => (id && doomed.has(id) ? null : id));
    setEditing(false);
  };

  const confirmDelete = (event: ClubEvent) => {
    setEventMenu(null);
    if (!window.confirm(`「${event.title}」 일정을 삭제할까요?`)) return;
    deleteEvent(event.id);
    toast("일정을 삭제했어요");
    clearDeletedSelection([event.id]);
  };

  const confirmDeleteSelected = () => {
    const ids = pickedEvents.map((event) => event.id);
    if (ids.length === 0 && active) {
      confirmDelete(active);
      return;
    }
    if (ids.length === 1) {
      const event = pickedEvents[0];
      if (event) confirmDelete(event);
      return;
    }
    if (ids.length === 0) return;
    setEventMenu(null);
    if (!window.confirm(`선택한 ${ids.length}개 일정을 삭제할까요?`)) return;
    deleteEvents(ids);
    toast(`${ids.length}개 일정을 삭제했어요`);
    clearDeletedSelection(ids);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (modal) return;
      if (event.key === "Delete") {
        if (editing) return;
        if (pickedEvents.length === 0 && !active) return;
        event.preventDefault();
        confirmDeleteSelected();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        if (!active || !selected) return;
        event.preventDefault();
        copyEvent();
      } else if (key === "v") {
        event.preventDefault();
        pasteEvent();
      } else if (key === "z") {
        event.preventDefault();
        setEventMenu(null);
        if (undoEventChange()) toast("일정을 되돌렸어요");
        else toast("되돌릴 변경이 없어요");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, selected, clipboard, addEvent, undoEventChange, toast, modal, editing, pickedEvents]);

  useEffect(() => {
    if (!draggingId) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [draggingId]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-calendar-more], [data-calendar-more-menu]")) return;
      setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!eventMenu) return;
    const close = () => setEventMenu(null);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-event-menu]")) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [eventMenu]);

  const onEventPointerDown = (pointer: ReactPointerEvent, event: ClubEvent) => {
    if (pointer.button !== 0) return;
    if (pointer.ctrlKey || pointer.metaKey) return;
    if (isCompactViewport()) return;
    setEventMenu(null);
    const grabIso = isoFromPoint(pointer.clientX, pointer.clientY) ?? event.date;
    const pointerId = pointer.pointerId;
    const startX = pointer.clientX;
    const startY = pointer.clientY;
    const bar = pointer.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const offsetX = pointer.clientX - rect.left;
    const offsetY = pointer.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    let moved = false;

    const placeGhost = (clientX: number, clientY: number) => {
      setDragGhost({
        event,
        x: clientX - offsetX,
        y: clientY - offsetY,
        width,
        height,
      });
    };

    const onMove = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      if (!moved) {
        if (Math.hypot(next.clientX - startX, next.clientY - startY) < 6) return;
        moved = true;
        setDraggingId(event.id);
        placeGhost(next.clientX, next.clientY);
      } else {
        placeGhost(next.clientX, next.clientY);
      }
      next.preventDefault();
      const drop = isoFromPoint(next.clientX, next.clientY);
      if (!drop) {
        setDropIsos([]);
        return;
      }
      const shifted = shiftEventDates(event, grabIso, drop);
      setDropIsos(shifted ? eachISODate(shifted.date, shifted.endDate ?? shifted.date) : []);
    };

    const finish = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      setDraggingId(null);
      setDropIsos([]);
      setDragGhost(null);
      if (!moved) return;
      swallowNextClick();
      const drop = isoFromPoint(next.clientX, next.clientY);
      if (!drop) return;
      const shifted = shiftEventDates(event, grabIso, drop);
      if (!shifted) return;
      updateEvent(event.id, shifted);
      setSelected(drop);
      setActiveId(event.id);
      setSelectedEventIds([event.id]);
      setEditing(false);
      toast("일정을 옮겼어요");
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const onEventContextMenu = (clientX: number, clientY: number, event: ClubEvent) => {
    const iso = isoFromPoint(clientX, clientY) ?? event.date;
    setSelected(iso);
    setActiveId(event.id);
    setSelectedEventIds((prev) => (prev.includes(event.id) ? prev : [event.id]));
    setEditing(false);
    const menuW = 128;
    const menuH = 40;
    setEventMenu({
      event,
      x: Math.max(8, Math.min(clientX, window.innerWidth - menuW - 8)),
      y: Math.max(8, Math.min(clientY, window.innerHeight - menuH - 8)),
    });
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <main
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 pt-3 pb-2 lg:block lg:flex-[7] lg:overflow-auto lg:p-5 lg:pb-5"
        onClick={resetPanel}
      >
        <div
          data-calendar-compact-head
          className="mb-2 flex min-w-0 items-center gap-0.5 lg:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <MonthSwitcher year={year} monthIndex={monthIndex} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
          <GhostButton className="h-8 shrink-0 px-2.5 text-[12px]" onClick={goToday}>
            오늘
          </GhostButton>
          <button
            type="button"
            data-calendar-add
            aria-label="일정 생성"
            className="ml-auto flex h-touch w-touch shrink-0 items-center justify-center text-brand-text"
            onClick={() => openCreate(selected)}
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="relative shrink-0">
            <button
              type="button"
              data-calendar-more
              aria-label="더보기"
              aria-expanded={moreOpen}
              className="flex h-touch w-touch items-center justify-center text-sub"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {moreOpen ? (
              <div
                data-calendar-more-menu
                className="absolute right-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-btn border border-line bg-white py-1 shadow-toast"
              >
                <button
                  type="button"
                  className="flex min-h-touch w-full items-center px-3 text-left text-compact"
                  onClick={() => {
                    setMoreOpen(false);
                    void copyNotice();
                  }}
                >
                  카톡 공지 복사
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div
          data-calendar-console-head
          className="mb-4 hidden items-center justify-between lg:flex"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <MonthSwitcher year={year} monthIndex={monthIndex} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
            <GhostButton className="ml-1 h-8 px-2.5 text-[12px]" onClick={goToday}>
              오늘
            </GhostButton>
            {forecast.size > 0 ? <span className="ml-2 text-[12px] text-faint">신촌 예보</span> : null}
          </div>
          <PrimaryButton onClick={() => openCreate(selected)}>일정 생성</PrimaryButton>
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col border-l border-t border-line-soft max-lg:overflow-hidden lg:block lg:flex-none",
            draggingId && "select-none",
          )}
          data-calendar-grid
          data-calendar-dragging={draggingId ? "true" : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid shrink-0 grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-b border-r border-line-soft bg-muted px-2 py-2 text-[12px] text-faint">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <WeekRow
              key={week[0].iso}
              className="max-lg:min-h-0 max-lg:flex-1"
              week={week}
              events={events}
              today={today}
              selected={selected}
              activeId={activeId}
              selectedEventIds={selectedEventIds}
              draggingId={draggingId}
              dropIsos={dropIsos}
              forecast={forecast}
              onSelectDay={(iso) => {
                setSelected(iso);
                setEditing(false);
                if (isCompactViewport()) {
                  setActiveId(null);
                  setSelectedEventIds([]);
                  return;
                }
                const first = (byDate.get(iso) ?? [])[0]?.id ?? null;
                setActiveId(first);
                setSelectedEventIds(first ? [first] : []);
              }}
              onSelectEvent={(iso, id, additive) => {
                setSelected(iso);
                setEditing(false);
                if (additive) {
                  setSelectedEventIds((prev) => {
                    const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
                    setActiveId(next.includes(id) ? id : (next[next.length - 1] ?? null));
                    return next;
                  });
                  return;
                }
                setActiveId(id);
                setSelectedEventIds([id]);
              }}
              onCreateDay={(iso) => {
                if (isCompactViewport()) {
                  openCreate(iso);
                  return;
                }
                const first = (byDate.get(iso) ?? [])[0]?.id ?? null;
                setSelected(iso);
                setActiveId(first);
                setSelectedEventIds(first ? [first] : []);
                setEditing(false);
                openCreate(iso);
              }}
              onEventPointerDown={onEventPointerDown}
              onEventContextMenu={onEventContextMenu}
            />
          ))}
        </div>

      </main>

      <DayAgendaSheet
        open={compact && Boolean(selected)}
        date={selected}
        events={selectedEvents}
        onClose={resetPanel}
        onPickEvent={(id) => {
          setActiveId(id);
          setSelectedEventIds([id]);
          setEditing(false);
        }}
        onAdd={() => {
          if (selected) openCreate(selected);
        }}
      />

      <DetailSurface
        sheet
        open={compact && Boolean(active) && Boolean(selected)}
        title={editing ? active?.title : undefined}
        onClose={() => {
          setActiveId(null);
          setSelectedEventIds([]);
          setEditing(false);
        }}
        onSave={
          editing
            ? () => {
                const form = document.getElementById(EDIT_FORM_ID) as HTMLFormElement | null;
                form?.requestSubmit();
              }
            : undefined
        }
        footer={
          active && !editing ? (
            <div className="flex items-center justify-around">
              <button
                type="button"
                className="flex min-h-touch flex-1 flex-col items-center justify-center gap-1 text-[11px] text-sub touch-manipulation"
                onClick={copyEvent}
              >
                <Copy className="h-5 w-5" />
                복사
              </button>
              <button
                type="button"
                className="flex min-h-touch flex-1 flex-col items-center justify-center gap-1 text-[11px] text-sub touch-manipulation"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-5 w-5" />
                수정
              </button>
              <button
                type="button"
                className="flex min-h-touch flex-1 flex-col items-center justify-center gap-1 text-[11px] text-up touch-manipulation"
                onClick={() => confirmDelete(active)}
              >
                <Trash2 className="h-5 w-5" />
                삭제
              </button>
            </div>
          ) : null
        }
      >
        {compact && active ? (
          editing ? (
            <EditEvent
              key={active.id}
              event={active}
              onSave={(patch) => {
                updateEvent(active.id, patch);
                setEditing(false);
                toast("일정을 수정했어요");
              }}
            />
          ) : (
            <CompactEventRead key={active.id} event={active} />
          )
        ) : null}
      </DetailSurface>

      <aside
        className="hidden min-h-0 flex-col border-l border-line-soft lg:flex lg:w-[32%] lg:min-w-[300px] lg:max-w-[360px]"
        data-event-selected-count={pickedEvents.length}
        data-active-event-id={active?.id ?? undefined}
        data-selected-date={selected ?? undefined}
      >
        <div className="flex-1 overflow-auto px-5 py-5 [scrollbar-gutter:stable] scrollbar-thin">
          {multiSelected ? (
            <>
              <p className="text-[28px] font-semibold leading-8">{pickedEvents.length}개 선택</p>
              <p className="mt-1 text-[13px] text-faint">Delete 키로 한 번에 지울 수 있어요.</p>
              <ul className="mt-5 space-y-2">
                {pickedEvents
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                  .map((event) => (
                    <li key={event.id} className="rounded-[10px] bg-muted px-3 py-2 text-[13px]">
                      <p className="font-medium">{event.title}</p>
                      <p className="mt-0.5 text-[12px] text-faint">
                        {formatDateWeekday(event.date)} · {event.startTime}
                      </p>
                    </li>
                  ))}
              </ul>
            </>
          ) : selected ? (
            <>
              <p className="text-[28px] font-semibold leading-8">{formatDateKo(selected)}</p>
              <p className="mt-1 text-[13px] text-faint">{formatWeekday(selected)}요일</p>

              {selectedEvents.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {selectedEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        setActiveId(event.id);
                        setSelectedEventIds([event.id]);
                      }}
                      className={cn(
                        "rounded-chip px-2 py-1 text-[12px]",
                        (active?.id ?? "") === event.id ? "bg-brand-soft text-brand-text" : "bg-muted text-sub",
                      )}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              ) : null}

              {active ? (
                <div className="mt-5">
                  {editing ? (
                    <EditEvent
                      key={active.id}
                      event={active}
                      onSave={(patch) => {
                        updateEvent(active.id, patch);
                        setEditing(false);
                        toast("일정을 수정했어요");
                      }}
                    />
                  ) : (
                    <EventDetail key={active.id} event={active} />
                  )}
                </div>
              ) : (
                <p className="mt-8 text-[13px] text-faint">
                  이 날짜에 일정이 없어요.{" "}
                  <button type="button" className="text-brand-text" onClick={() => openCreate(selected)}>
                    추가하기
                  </button>
                </p>
              )}
            </>
          ) : (
            <NoticePanel text={notice} onCopy={copyNotice} />
          )}
        </div>
        <div className="flex gap-2 border-t border-line-soft px-5 py-3">
          <PrimaryButton className="flex-1" onClick={() => openCreate(selected)}>
            일정 생성
          </PrimaryButton>
          {editing ? (
            <PrimaryButton className="flex-1" type="submit" form={EDIT_FORM_ID} disabled={!active}>
              저장
            </PrimaryButton>
          ) : (
            <GhostButton className="flex-1" disabled={multiSelected || !active || !selected} onClick={() => setEditing(true)}>
              수정
            </GhostButton>
          )}
          <GhostButton
            className="px-3"
            disabled={pickedEvents.length === 0 && !active}
            onClick={confirmDeleteSelected}
            aria-label="일정 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </GhostButton>
        </div>
      </aside>
      {dragGhost ? <EventDragGhost ghost={dragGhost} /> : null}
      {eventMenu ? (
        <EventContextMenu
          menu={eventMenu}
          onDelete={() => {
            if (pickedEvents.length > 1 && selectedEventIds.includes(eventMenu.event.id)) {
              confirmDeleteSelected();
              return;
            }
            confirmDelete(eventMenu.event);
          }}
        />
      ) : null}
    </div>
  );
}

function isoAtClientX(weekEl: HTMLElement, clientX: number, weekIsos: string[]) {
  const rect = weekEl.getBoundingClientRect();
  if (rect.width <= 0) return weekIsos[0];
  const col = Math.min(6, Math.max(0, Math.floor((clientX - rect.left) / (rect.width / 7))));
  return weekIsos[col];
}

function WeekRow({
  week,
  events,
  today,
  selected,
  activeId,
  selectedEventIds,
  draggingId,
  dropIsos,
  forecast,
  className,
  onSelectDay,
  onSelectEvent,
  onCreateDay,
  onEventPointerDown,
  onEventContextMenu,
}: {
  week: CalendarCell[];
  events: ClubEvent[];
  today: string;
  selected: string | null;
  activeId: string | null;
  selectedEventIds: string[];
  draggingId: string | null;
  dropIsos: string[];
  forecast: Map<string, WeatherDay>;
  className?: string;
  onSelectDay: (iso: string) => void;
  onSelectEvent: (iso: string, id: string, additive: boolean) => void;
  onCreateDay: (iso: string) => void;
  onEventPointerDown: (pointer: ReactPointerEvent, event: ClubEvent) => void;
  onEventContextMenu: (clientX: number, clientY: number, event: ClubEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const weekIsos = week.map((cell) => cell.iso);
  const segments = layoutWeek(weekIsos, events);
  const visible = segments.filter((seg) => seg.lane < CALENDAR_MAX_LANES);
  const laneCount = segments.reduce((max, seg) => Math.max(max, seg.lane + 1), 0);
  const moreByDay = weekIsos.map((iso) => hiddenCountForDay(iso, segments));
  const hasMore = moreByDay.some((n) => n > 0);
  const height = weekMinHeight(laneCount, hasMore);
  const bodyMin = height - CALENDAR_DAY_HEAD;
  const longTimer = useRef(0);
  const longFired = useRef(false);

  const startLong = (iso: string) => {
    if (!isCompactViewport()) return;
    longFired.current = false;
    window.clearTimeout(longTimer.current);
    longTimer.current = window.setTimeout(() => {
      longFired.current = true;
      onCreateDay(iso);
    }, 500);
  };
  const endLong = (iso: string, click: boolean) => {
    window.clearTimeout(longTimer.current);
    if (longFired.current) return;
    if (click) onSelectDay(iso);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "grid min-h-0 border-b border-line-soft max-lg:![grid-template-rows:2.75rem_minmax(1rem,1fr)]",
        className,
      )}
      style={{
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gridTemplateRows: `${CALENDAR_DAY_HEAD}px minmax(${bodyMin}px, auto)`,
      }}
    >
      {week.map((cell, index) => {
        const isToday = cell.iso === today;
        const isSelected = cell.iso === selected;
        const isDrop = dropIsos.includes(cell.iso);
        const weather = forecast.get(cell.iso);
        const hasPractice = events.some(
          (event) => event.date <= cell.iso && eventEndDate(event) >= cell.iso && isPracticeEvent(event),
        );
        const more = moreByDay[index];
        return (
          <button
            key={cell.iso}
            type="button"
            data-iso={cell.iso}
            data-drop-hover={isDrop ? "true" : undefined}
            aria-label={`${formatDateKo(cell.iso)}${hasPractice ? " 연습" : ""}`}
            onPointerDown={() => startLong(cell.iso)}
            onPointerUp={() => endLong(cell.iso, true)}
            onPointerCancel={() => endLong(cell.iso, false)}
            onClick={(event) => {
              if (longFired.current) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              if (isCompactViewport()) return;
              onCreateDay(cell.iso);
            }}
            style={{ gridColumn: index + 1, gridRow: "1 / 3" }}
            className={cn(
              "relative flex flex-col border-r border-line-soft text-left hover:bg-muted",
              !cell.inMonth && "bg-[#fcfcfd]",
              isSelected && "bg-[#F7FBFF]",
              isDrop && "bg-brand-soft",
            )}
          >
            <span
              data-day-head
              className="flex shrink-0 items-center justify-between gap-1 px-1.5"
              style={{ height: CALENDAR_DAY_HEAD }}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px]",
                  isToday && "bg-brand font-semibold text-white",
                  !isToday && cell.inMonth && "text-ink",
                  !isToday && !cell.inMonth && "text-faint",
                )}
              >
                {cell.day}
              </span>
              {weather ? (
                <span className="hidden lg:inline-flex">
                  <WeatherMark day={weather} />
                </span>
              ) : null}
            </span>
            <span className="flex gap-0.5 px-1.5 pb-1.5 lg:hidden">
              {events
                .filter((event) => event.date <= cell.iso && eventEndDate(event) >= cell.iso)
                .slice(0, 3)
                .map((event) => (
                  <span
                    key={event.id}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isPracticeEvent(event) ? "bg-brand" : "bg-[#8b95a1]",
                    )}
                  />
                ))}
            </span>
            {more > 0 ? (
              <span className="absolute bottom-1 left-1.5 hidden text-[10px] text-faint lg:inline">+{more}</span>
            ) : null}
          </button>
        );
      })}
      <div
        data-event-overlay
        className="pointer-events-none relative z-[1] hidden auto-rows-[18px] grid-cols-7 gap-y-[2px] self-stretch py-0.5 lg:grid"
        style={{ gridColumn: "1 / -1", gridRow: 2 }}
      >
        {visible.map((seg) => (
          <EventBar
            key={`${seg.event.id}-${seg.colStart}`}
            segment={seg}
            active={activeId === seg.event.id}
            selected={selectedEventIds.includes(seg.event.id)}
            dragging={draggingId === seg.event.id}
            onPick={(clientX, additive) => {
              const weekEl = ref.current;
              const iso = weekEl ? isoAtClientX(weekEl, clientX, weekIsos) : weekIsos[seg.colStart - 1];
              onSelectEvent(iso, seg.event.id, additive);
            }}
            onMoveStart={onEventPointerDown}
            onContextMenu={onEventContextMenu}
          />
        ))}
      </div>
    </div>
  );
}

function EventBar({
  segment,
  active,
  selected,
  dragging,
  onPick,
  onMoveStart,
  onContextMenu,
}: {
  segment: WeekSegment;
  active: boolean;
  selected: boolean;
  dragging: boolean;
  onPick: (clientX: number, additive: boolean) => void;
  onMoveStart: (pointer: ReactPointerEvent, event: ClubEvent) => void;
  onContextMenu: (clientX: number, clientY: number, event: ClubEvent) => void;
}) {
  const { event, lane, colStart, colSpan, continuesLeft, continuesRight } = segment;
  const hasAttach = eventAttachments(event).length > 0;
  return (
    <button
      type="button"
      draggable={false}
      data-event-id={event.id}
      data-col-span={colSpan}
      data-event-has-attach={hasAttach ? "true" : undefined}
      data-event-dragging={dragging ? "true" : undefined}
      data-event-selected={selected ? "true" : undefined}
      aria-grabbed={dragging || undefined}
      aria-pressed={selected || undefined}
      title={event.title}
      onPointerDown={(e) => onMoveStart(e, event)}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onPick(e.clientX, e.ctrlKey || e.metaKey);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e.clientX, e.clientY, event);
      }}
      className={cn(
        "pointer-events-auto flex h-[18px] cursor-grab items-center gap-0.5 px-1.5 text-left text-[11px] leading-[18px] touch-none active:cursor-grabbing",
        continuesLeft ? "ml-0 rounded-l-none" : "ml-[3px] rounded-l-[6px]",
        continuesRight ? "mr-0 rounded-r-none" : "mr-[3px] rounded-r-[6px]",
        barClass(event.type),
        (selected || active) && "ring-1 ring-inset ring-brand",
        dragging && "opacity-40",
      )}
      style={{
        gridColumn: `${colStart} / span ${colSpan}`,
        gridRow: lane + 1,
      }}
    >
      {continuesLeft ? <span className="shrink-0">·· </span> : null}
      <EventBarFace event={event} />
    </button>
  );
}

function EventDragGhost({ ghost }: { ghost: DragGhost }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-event-drag-ghost
      className={cn(
        "pointer-events-none fixed left-0 top-0 z-[80] flex items-center gap-0.5 rounded-[6px] px-1.5 text-[11px] leading-[18px] shadow-toast",
        barClass(ghost.event.type),
      )}
      style={{
        width: ghost.width,
        height: ghost.height,
        transform: `translate(${ghost.x}px, ${ghost.y}px)`,
      }}
    >
      <EventBarFace event={ghost.event} />
    </div>,
    document.body,
  );
}

function EventContextMenu({ menu, onDelete }: { menu: EventMenu; onDelete: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-event-menu
      role="menu"
      className="fixed z-[90] min-w-[128px] overflow-hidden rounded-[12px] border border-line-soft bg-white py-1 shadow-toast"
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        type="button"
        role="menuitem"
        data-event-menu-delete
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-up hover:bg-[#FFF1F1]"
      >
        <Trash2 className="h-3.5 w-3.5" />
        삭제
      </button>
    </div>,
    document.body,
  );
}

const DAY_SHEET_FLAG = "__clubnoteDaySheet";
const DAY_SHEET_SWIPE_PX = 88;

function DayAgendaSheet({
  open,
  date,
  events,
  onClose,
  onPickEvent,
  onAdd,
}: {
  open: boolean;
  date: string | null;
  events: ClubEvent[];
  onClose: () => void;
  onPickEvent: (id: string) => void;
  onAdd: () => void;
}) {
  const titleId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const pushedRef = useRef(false);
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [entered, setEntered] = useState(false);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (pushedRef.current && window.history.state?.[DAY_SHEET_FLAG]) {
      window.history.back();
      return;
    }
    onCloseRef.current?.();
  }, []);

  useLayoutEffect(() => {
    if (open && window.matchMedia(COMPACT_QUERY).matches) {
      document.documentElement.dataset.daySheetOpen = "true";
    } else {
      delete document.documentElement.dataset.daySheetOpen;
    }
    return () => {
      delete document.documentElement.dataset.daySheetOpen;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setEntered(false);
      setDragY(0);
      return;
    }
    setEntered(false);
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !window.matchMedia(COMPACT_QUERY).matches) return;
    const root = sheetRef.current;
    root?.querySelector<HTMLElement>("[data-day-sheet-close]")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, open]);

  useEffect(() => {
    if (!open || !window.matchMedia(COMPACT_QUERY).matches) return;

    if (!window.history.state?.[DAY_SHEET_FLAG]) {
      window.history.pushState({ ...window.history.state, [DAY_SHEET_FLAG]: true }, "", window.location.href);
      pushedRef.current = true;
    }

    const onPop = () => {
      if (window.history.state?.[DAY_SHEET_FLAG]) return;
      pushedRef.current = false;
      onCloseRef.current?.();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!pushedRef.current) return;
      pushedRef.current = false;
      if (!window.history.state?.[DAY_SHEET_FLAG]) return;
      const state = { ...window.history.state };
      delete state[DAY_SHEET_FLAG];
      window.history.replaceState(state, "", window.location.href);
    };
  }, [open]);

  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as Element | null)?.closest("button")) return;
    if (!window.matchMedia(COMPACT_QUERY).matches) return;
    dragStartY.current = event.clientY;
    setDragY(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHeaderPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragStartY.current == null) return;
    setDragY(Math.max(0, event.clientY - dragStartY.current));
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragStartY.current == null) return;
    const delta = Math.max(0, event.clientY - dragStartY.current);
    dragStartY.current = null;
    if (delta >= DAY_SHEET_SWIPE_PX) {
      setDragY(0);
      close();
      return;
    }
    setDragY(0);
  };

  const dim = open ? Math.max(0, 1 - dragY / 420) : 0;
  const shift = open ? (entered ? dragY : typeof window === "undefined" ? 0 : window.innerHeight) : 0;
  const day = date ? parseISODate(date).getDate() : 0;
  const weekday = date ? `${formatWeekday(date)}요일` : "";
  const sorted = events.slice().sort((a, b) => {
    if (Boolean(a.allDay) !== Boolean(b.allDay)) return a.allDay ? -1 : 1;
    return a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title);
  });

  return (
    <div className="lg:hidden">
      <div
        data-calendar-day-backdrop
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/30",
          open ? "pointer-events-auto" : "pointer-events-none opacity-0",
        )}
        style={{
          opacity: open ? dim : 0,
          transition: dragY ? "none" : "opacity var(--motion) ease-out",
        }}
        onClick={close}
      />
      <section
        ref={sheetRef}
        tabIndex={-1}
        data-calendar-day-sheet
        data-day-sheet-open={open ? "true" : "false"}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={open && date ? titleId : undefined}
        className={cn(
          "fixed inset-x-3 z-40 flex flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_16px_40px_rgba(25,31,40,0.18)]",
          open ? "pointer-events-auto" : "hidden",
        )}
        style={
          open
            ? {
                top: "max(4.75rem, calc(env(safe-area-inset-top) + 3.25rem))",
                bottom: "max(1rem, env(safe-area-inset-bottom))",
                transform: `translateY(${shift}px)`,
                transition: dragY || !entered ? "none" : "transform var(--motion) ease-out",
              }
            : undefined
        }
      >
        <header
          data-calendar-day-sheet-head
          className="flex shrink-0 touch-none items-center gap-2 px-5 pb-2 pt-4"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="min-w-0 flex-1">
            <p id={titleId} className="truncate text-[22px] font-semibold leading-7 text-ink">
              {day} {weekday}
            </p>
          </div>
          <button
            type="button"
            data-day-sheet-close
            className="flex h-touch min-w-touch items-center justify-center text-compact text-sub touch-manipulation"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={close}
          >
            닫기
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-2 scrollbar-thin">
          {sorted.length === 0 ? (
            <p className="px-3 py-8 text-center text-compact-caption text-faint">이 날짜에 일정이 없어요.</p>
          ) : (
            <ul>
              {sorted.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    data-calendar-day-event={event.id}
                    className="flex min-h-row w-full items-start gap-3 rounded-[16px] px-3 py-3 text-left touch-manipulation active:bg-muted"
                    onClick={() => onPickEvent(event.id)}
                  >
                    <span className="w-12 shrink-0 pt-0.5 text-right text-[15px] font-semibold tabular-nums text-ink">
                      {hourLabel(event)}
                    </span>
                    <span className={cn("mt-1 h-10 w-1 shrink-0 rounded-full", typeAccentClass(event.type))} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-ink">{event.title}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-faint">{eventTimeRangeText(event)}</span>
                      {event.place ? (
                        <span className="mt-0.5 block truncate text-[13px] text-faint">{event.place}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          <button
            type="button"
            data-calendar-day-add
            className="flex min-h-touch w-full items-center justify-center gap-2 rounded-full bg-muted text-compact font-medium text-ink touch-manipulation"
            onClick={onAdd}
          >
            {date ? `${formatDateKo(date)}에 추가` : "일정 추가"}
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

function CompactEventRead({ event }: { event: ClubEvent }) {
  const start = event.date;
  const end = eventEndDate(event);
  return (
    <div className="space-y-5" data-event-fields="readonly">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[22px] font-semibold leading-7 text-ink">{event.title || "제목 없음"}</h2>
        <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", typeAccentClass(event.type))} aria-hidden />
      </div>
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sub" aria-hidden />
        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div>
            <p className="text-[15px] font-medium text-ink">{formatDateWeekday(start)}</p>
            <p className="mt-1 text-[14px] text-sub">{event.allDay ? "하루 종일" : formatTimeKo(event.startTime) || "-"}</p>
          </div>
          <span className="pt-1 text-faint" aria-hidden>
            →
          </span>
          <div>
            <p className="text-[15px] font-medium text-ink">{formatDateWeekday(end)}</p>
            <p className="mt-1 text-[14px] text-sub">{event.allDay ? "하루 종일" : formatTimeKo(event.endTime) || "-"}</p>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-3 border-t border-line-soft pt-4">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-sub" aria-hidden />
        <div>
          <p className="text-[15px] text-ink">{event.place || "장소 없음"}</p>
          {event.type && event.type !== event.title ? (
            <p className="mt-1 text-[13px] text-faint">{event.type}</p>
          ) : null}
        </div>
      </div>
      {event.preview && event.preview !== event.title && event.preview !== event.type ? (
        <p className="whitespace-pre-wrap border-t border-line-soft pt-4 text-[15px] leading-6 text-ink">{event.preview}</p>
      ) : null}
      <div className="border-t border-line-soft pt-4">
        <p className="text-[12px] font-medium text-sub">첨부파일</p>
        <div className="mt-1">
          <EventAttachmentList eventId={event.id} />
        </div>
      </div>
    </div>
  );
}

function NoticePanel({ text, onCopy }: { text: string; onCopy: () => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-semibold">카톡 공지</p>
        <GhostButton className="h-8 px-2.5 text-[12px]" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
          복사
        </GhostButton>
      </div>
      <p className="mb-3 text-[12px] text-faint">이번 주 연습을 인식해 카톡에 바로 붙여넣을 수 있어요.</p>
      <pre className="whitespace-pre-wrap rounded-card border border-line-soft bg-muted px-3.5 py-3 text-[13px] leading-6 text-ink">
        {text}
      </pre>
    </div>
  );
}

function eventWhenText(event: ClubEvent) {
  const end = eventEndDate(event);
  if (event.allDay) {
    if (end === event.date) return "하루 종일";
    return `${formatDateWeekday(event.date)} → ${formatDateWeekday(end)} · 하루 종일`;
  }
  const startT = formatTimeKo(event.startTime);
  const endT = formatTimeKo(event.endTime);
  if (end === event.date) return `${startT} – ${endT}`;
  return `${formatDateWeekday(event.date)} ${startT} → ${formatDateWeekday(end)} ${endT}`;
}

function EventDetail({ event }: { event: ClubEvent }) {
  return (
    <dl className="space-y-4" data-event-fields="readonly">
      <Info label="제목" value={event.title || "-"} />
      <Info label="유형" value={event.type || "-"} />
      <Info label="일시" value={eventWhenText(event)} />
      <Info label="장소" value={event.place || "-"} />
      <div>
        <dt className="text-[12px] font-medium text-sub">메모</dt>
        <dd className={cn("mt-1 whitespace-pre-wrap text-[14px]", event.preview ? "text-ink" : "text-faint")}>
          {event.preview || "없음"}
        </dd>
      </div>
      <div>
        <dt className="text-[12px] font-medium text-sub">첨부파일</dt>
        <dd className="mt-1">
          <EventAttachmentList eventId={event.id} />
        </dd>
      </div>
    </dl>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-sub">{label}</dt>
      <dd className="mt-1 text-[14px] text-ink">{value}</dd>
    </div>
  );
}

function EventFields({
  eventId,
  title,
  type,
  place,
  preview,
  range,
  onTitle,
  onType,
  onPlace,
  onPreview,
  onRange,
}: {
  eventId: string;
  title: string;
  type: string;
  place: string;
  preview: string;
  range: DateTimeRangeValue;
  onTitle: (value: string) => void;
  onType: (value: string) => void;
  onPlace: (value: string) => void;
  onPreview: (value: string) => void;
  onRange: (value: DateTimeRangeValue) => void;
}) {
  const { eventTypes, places, addEventType, removeEventType, addPlace, removePlace } = useClub();
  const typeItems = eventTypes.includes(type) ? eventTypes : [...eventTypes, type];
  const placeItems = places.includes(place) ? places : [...places, place];

  return (
    <div className="space-y-3" data-event-fields="edit">
      <div>
        <FieldLabel>제목</FieldLabel>
        <TextInput value={title} onChange={(e) => onTitle(e.target.value)} />
      </div>
      <div>
        <FieldLabel>유형</FieldLabel>
        <InlineTaxonomySelect
          value={type}
          items={typeItems}
          addLabel="유형 추가"
          placeholder="유형 선택"
          onChange={onType}
          onAdd={addEventType}
          onRemove={removeEventType}
        />
      </div>
      <div>
        <FieldLabel>일시</FieldLabel>
        <DateTimeRangeField value={range} onChange={onRange} />
      </div>
      <div>
        <FieldLabel>장소</FieldLabel>
        <InlineTaxonomySelect
          value={place}
          items={placeItems}
          addLabel="장소 추가"
          placeholder="장소 선택"
          onChange={onPlace}
          onAdd={addPlace}
          onRemove={removePlace}
        />
      </div>
      <div>
        <FieldLabel>메모</FieldLabel>
        <TextArea value={preview} onChange={(e) => onPreview(e.target.value)} placeholder="한 줄 메모" />
      </div>
      <div>
        <FieldLabel>첨부파일</FieldLabel>
        <EventAttachmentList eventId={eventId} />
      </div>
    </div>
  );
}

function EditEvent({
  event,
  onSave,
}: {
  event: ClubEvent;
  onSave: (patch: Partial<ClubEvent>) => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState(event.type);
  const [place, setPlace] = useState(event.place);
  const [preview, setPreview] = useState(event.preview);
  const [range, setRange] = useState<DateTimeRangeValue>(eventRangeOf(event));
  return (
    <form
      id={EDIT_FORM_ID}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title,
          type,
          place,
          preview,
          startTime: range.startTime,
          endTime: range.endTime,
          date: range.startDate,
          endDate: range.endDate !== range.startDate ? range.endDate : undefined,
          allDay: range.allDay,
        });
      }}
    >
      <EventFields
        eventId={event.id}
        title={title}
        type={type}
        place={place}
        preview={preview}
        range={range}
        onTitle={setTitle}
        onType={setType}
        onPlace={setPlace}
        onPreview={setPreview}
        onRange={setRange}
      />
    </form>
  );
}
