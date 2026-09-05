"use client";

import { EventAttachmentList } from "@/components/calendar/EventAttachments";
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
import { isPracticeEvent } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { ClubEvent } from "@/lib/types";
import type { WeatherDay } from "@/lib/weather";
import { ChevronLeft, ChevronRight, Copy, Paperclip, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function barClass(type: string) {
  if (type === "공연") return "bg-[#FFF1F1] text-up";
  if (type === "회식") return "bg-[#FFF8E1] text-[#B78103]";
  if (type === "회의") return "bg-[#F2F4F6] text-sub";
  return "bg-brand-soft text-brand-text";
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

function eventRangeOf(event: ClubEvent): DateTimeRangeValue {
  return {
    startDate: event.date,
    endDate: event.endDate ?? event.date,
    startTime: event.startTime || "19:00",
    endTime: event.endTime || "21:00",
    allDay: Boolean(event.allDay),
  };
}

export function CalendarView() {
  const { events, weatherDays, addEvent, updateEvent, deleteEvent, openModal, toast } = useClub();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => parseISODate(today));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<ClubEvent | null>(null);

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
  const active = selectedEvents.find((e) => e.id === activeId) ?? selectedEvents[0];
  const notice = practiceNoticeText(events, today);

  const shiftMonth = (delta: number) => {
    setCursor(new Date(year, monthIndex + delta, 1));
  };

  const goToday = () => {
    setCursor(parseISODate(today));
    setSelected(null);
    setActiveId(null);
    setEditing(false);
  };

  const resetPanel = () => {
    setSelected(null);
    setActiveId(null);
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
    setEditing(false);
    toast("일정을 붙여넣었어요");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        if (!active || !selected) return;
        event.preventDefault();
        copyEvent();
      } else if (key === "v") {
        event.preventDefault();
        pasteEvent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, selected, clipboard, addEvent, toast]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <main
        className="min-h-0 min-w-0 flex-[7] overflow-auto p-5 scrollbar-thin"
        onClick={resetPanel}
      >
        <div className="mb-4 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-btn p-1 hover:bg-muted" onClick={() => shiftMonth(-1)} aria-label="이전 달">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-[18px] font-semibold">
              {year}년 {monthIndex + 1}월
            </h1>
            <button type="button" className="rounded-btn p-1 hover:bg-muted" onClick={() => shiftMonth(1)} aria-label="다음 달">
              <ChevronRight className="h-4 w-4" />
            </button>
            <GhostButton className="ml-1 h-8 px-2.5 text-[12px]" onClick={goToday}>
              오늘
            </GhostButton>
            {forecast.size > 0 ? <span className="ml-2 text-[12px] text-faint">신촌 예보</span> : null}
          </div>
          <PrimaryButton onClick={() => openCreate(selected)}>일정 생성</PrimaryButton>
        </div>

        <div className="border-l border-t border-line-soft" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-b border-r border-line-soft bg-muted px-2 py-2 text-[12px] text-faint">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <WeekRow
              key={week[0].iso}
              week={week}
              events={events}
              today={today}
              selected={selected}
              activeId={activeId}
              forecast={forecast}
              onSelectDay={(iso) => {
                setSelected(iso);
                setActiveId((byDate.get(iso) ?? [])[0]?.id ?? null);
                setEditing(false);
              }}
              onSelectEvent={(iso, id) => {
                setSelected(iso);
                setActiveId(id);
                setEditing(false);
              }}
              onCreateDay={(iso) => {
                setSelected(iso);
                setActiveId((byDate.get(iso) ?? [])[0]?.id ?? null);
                setEditing(false);
                openCreate(iso);
              }}
            />
          ))}
        </div>
      </main>

      <aside className="flex min-h-0 w-[32%] min-w-[300px] max-w-[360px] flex-col border-l border-line-soft">
        <div className="flex-1 overflow-auto px-5 py-5 [scrollbar-gutter:stable] scrollbar-thin">
          {selected ? (
            <>
              <p className="text-[28px] font-semibold leading-8">{formatDateKo(selected)}</p>
              <p className="mt-1 text-[13px] text-faint">{formatWeekday(selected)}요일</p>

              {selectedEvents.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {selectedEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setActiveId(event.id)}
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
                      onCancel={() => setEditing(false)}
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
          <GhostButton className="flex-1" disabled={!active || !selected} onClick={() => setEditing(true)}>
            수정
          </GhostButton>
          <GhostButton
            className="px-3"
            disabled={!active || !selected}
            onClick={() => {
              if (!active) return;
              if (!window.confirm(`「${active.title}」 일정을 삭제할까요?`)) return;
              deleteEvent(active.id);
              toast("일정을 삭제했어요");
              setEditing(false);
              setActiveId(null);
            }}
            aria-label="일정 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </GhostButton>
        </div>
      </aside>
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
  forecast,
  onSelectDay,
  onSelectEvent,
  onCreateDay,
}: {
  week: CalendarCell[];
  events: ClubEvent[];
  today: string;
  selected: string | null;
  activeId: string | null;
  forecast: Map<string, WeatherDay>;
  onSelectDay: (iso: string) => void;
  onSelectEvent: (iso: string, id: string) => void;
  onCreateDay: (iso: string) => void;
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

  return (
    <div
      ref={ref}
      className="grid border-b border-line-soft"
      style={{
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gridTemplateRows: `${CALENDAR_DAY_HEAD}px minmax(${bodyMin}px, auto)`,
      }}
    >
      {week.map((cell, index) => {
        const isToday = cell.iso === today;
        const isSelected = cell.iso === selected;
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
            aria-label={`${formatDateKo(cell.iso)}${hasPractice ? " 연습" : ""}`}
            onClick={() => onSelectDay(cell.iso)}
            onDoubleClick={(event) => {
              event.preventDefault();
              onCreateDay(cell.iso);
            }}
            style={{ gridColumn: index + 1, gridRow: "1 / 3" }}
            className={cn(
              "relative flex flex-col border-r border-line-soft text-left hover:bg-muted",
              !cell.inMonth && "bg-[#fcfcfd]",
              isSelected && "bg-[#F7FBFF]",
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
              {weather ? <WeatherMark day={weather} /> : null}
            </span>
            {more > 0 ? (
              <span className="absolute bottom-1 left-1.5 text-[10px] text-faint">+{more}</span>
            ) : null}
          </button>
        );
      })}
      <div
        data-event-overlay
        className="pointer-events-none relative z-[1] grid auto-rows-[18px] grid-cols-7 gap-y-[2px] self-stretch py-0.5"
        style={{ gridColumn: "1 / -1", gridRow: 2 }}
      >
        {visible.map((seg) => (
          <EventBar
            key={`${seg.event.id}-${seg.colStart}`}
            segment={seg}
            active={activeId === seg.event.id}
            onPick={(clientX) => {
              const weekEl = ref.current;
              const iso = weekEl ? isoAtClientX(weekEl, clientX, weekIsos) : weekIsos[seg.colStart - 1];
              onSelectEvent(iso, seg.event.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EventBar({
  segment,
  active,
  onPick,
}: {
  segment: WeekSegment;
  active: boolean;
  onPick: (clientX: number) => void;
}) {
  const { event, lane, colStart, colSpan, continuesLeft, continuesRight } = segment;
  const hasAttach = eventAttachments(event).length > 0;
  return (
    <button
      type="button"
      data-event-id={event.id}
      data-col-span={colSpan}
      data-event-has-attach={hasAttach ? "true" : undefined}
      title={event.title}
      onClick={(e) => {
        e.stopPropagation();
        onPick(e.clientX);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn(
        "pointer-events-auto flex h-[18px] items-center gap-0.5 px-1.5 text-left text-[11px] leading-[18px]",
        continuesLeft ? "ml-0 rounded-l-none" : "ml-[3px] rounded-l-[6px]",
        continuesRight ? "mr-0 rounded-r-none" : "mr-[3px] rounded-r-[6px]",
        barClass(event.type),
        active && "ring-1 ring-inset ring-brand",
      )}
      style={{
        gridColumn: `${colStart} / span ${colSpan}`,
        gridRow: lane + 1,
      }}
    >
      <span className="min-w-0 truncate">
        {continuesLeft ? "·· " : ""}
        {barLabel(event)}
      </span>
      {hasAttach ? <Paperclip className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden /> : null}
    </button>
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
  onCancel,
}: {
  event: ClubEvent;
  onSave: (patch: Partial<ClubEvent>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState(event.type);
  const [place, setPlace] = useState(event.place);
  const [preview, setPreview] = useState(event.preview);
  const [range, setRange] = useState<DateTimeRangeValue>(eventRangeOf(event));
  return (
    <div className="space-y-3">
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
      <div className="flex gap-2">
        <PrimaryButton
          onClick={() =>
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
            })
          }
        >
          저장
        </PrimaryButton>
        <GhostButton onClick={onCancel}>취소</GhostButton>
      </div>
    </div>
  );
}
