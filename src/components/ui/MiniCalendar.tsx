"use client";

import { cn } from "@/lib/cn";
import { eachISODate, eventEndDate, formatDateKo, parseISODate, toISODate, todayISO } from "@/lib/format";
import type { ClubEvent } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function MiniCalendar({
  events,
  selected,
  onSelect,
  month,
  compact,
}: {
  events: ClubEvent[];
  selected?: string;
  onSelect?: (iso: string) => void;
  month?: string;
  compact?: boolean;
}) {
  const base = parseISODate(month ?? todayISO());
  const year = base.getFullYear();
  const monthIndex = base.getMonth();
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventDates = new Set(events.flatMap((event) => eachISODate(event.date, eventEndDate(event))));
  const cellSize = compact ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-[12px]";
  const emptySize = compact ? "h-6" : "h-8";

  return (
    <div>
      <div className={cn("flex items-center justify-between", compact ? "mb-1" : "mb-2")}>
        <p className={cn("font-semibold text-ink", compact ? "text-[12px]" : "text-[13px]")}>
          {year}년 {monthIndex + 1}월
        </p>
        {compact ? null : <p className="text-[12px] text-faint">오늘 {formatDateKo(todayISO())}</p>}
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-faint">
        {WEEKDAYS.map((d) => (
          <div key={d} className={compact ? "py-0.5" : "py-1"}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center">
        {cells.map((day, index) => {
          if (!day) return <div key={`e-${index}`} className={emptySize} />;
          const iso = toISODate(new Date(year, monthIndex, day));
          const isToday = iso === todayISO();
          const isSelected = iso === selected;
          const hasEvent = eventDates.has(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect?.(iso)}
              className={cn(
                "relative mx-auto flex items-center justify-center rounded-full",
                cellSize,
                isToday && "bg-brand font-semibold text-white",
                !isToday && isSelected && "ring-1 ring-brand text-brand-text",
                !isToday && !isSelected && "text-ink hover:bg-muted",
              )}
            >
              {day}
              {hasEvent && !isToday ? (
                <span className={cn("absolute h-1 w-1 rounded-full bg-brand", compact ? "bottom-0.5" : "bottom-1")} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MiniWeek({
  events,
  selected,
  onSelect,
}: {
  events: ClubEvent[];
  selected?: string;
  onSelect?: (iso: string) => void;
}) {
  const today = parseISODate(todayISO());
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const eventDates = new Set(events.flatMap((e) => eachISODate(e.date, eventEndDate(e))));

  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink">이번 주</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((d) => {
          const iso = toISODate(d);
          const isToday = iso === todayISO();
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect?.(iso)}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[11px] text-faint">{WEEKDAYS[d.getDay()]}</span>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[12px]",
                  isToday && "bg-brand font-semibold text-white",
                  !isToday && isSelected && "ring-1 ring-brand",
                  !isToday && !isSelected && "text-ink",
                )}
              >
                {d.getDate()}
              </span>
              {eventDates.has(iso) ? <span className="h-1 w-1 rounded-full bg-brand" /> : <span className="h-1 w-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
