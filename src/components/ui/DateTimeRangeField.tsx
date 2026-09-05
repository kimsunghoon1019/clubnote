"use client";

import { cn } from "@/lib/cn";
import { formatDateWeekday, formatTimeKo, parseISODate, toISODate } from "@/lib/format";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type DateTimeRangeValue = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
};

type FieldKey = "start-date" | "end-date" | "start-time" | "end-time";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PERIODS = [
  { value: "am", label: "오전" },
  { value: "pm", label: "오후" },
] as const;
const HOURS = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  return { value: String(n), label: String(n) };
});
const MINUTES = Array.from({ length: 12 }, (_, i) => {
  const label = String(i * 5).padStart(2, "0");
  return { value: label, label };
});

const ITEM_H = 40;
const WHEEL_H = 120;

export function DateTimeRangeField({
  value,
  onChange,
}: {
  value: DateTimeRangeValue;
  onChange: (next: DateTimeRangeValue) => void;
}) {
  const [open, setOpen] = useState<FieldKey | null>(null);
  const [shown, setShown] = useState<"date" | "time" | null>(null);

  const emit = (patch: Partial<DateTimeRangeValue>) => {
    onChange(normalizeRange(value, { ...value, ...patch }));
  };

  const toggle = (key: FieldKey) => {
    if (open === key) {
      setOpen(null);
      return;
    }
    setOpen(key);
    setShown(key.endsWith("date") ? "date" : "time");
  };

  const setAllDay = (allDay: boolean) => {
    emit({ allDay });
    if (allDay && (open === "start-time" || open === "end-time")) setOpen(null);
  };

  const picker = open?.endsWith("date") ? "date" : open?.endsWith("time") ? "time" : null;
  const expanded = picker !== null;

  useEffect(() => {
    if (picker) {
      setShown(picker);
      return;
    }
    const timer = window.setTimeout(() => setShown(null), 320);
    return () => window.clearTimeout(timer);
  }, [picker]);

  const activeDate = open === "end-date" ? value.endDate : value.startDate;
  const activeTime = open === "end-time" ? value.endTime : value.startTime;

  return (
    <div className="rounded-btn border border-line-soft bg-[#fcfcfd] px-3 py-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={value.allDay}
        aria-label="하루 종일"
        onClick={() => setAllDay(!value.allDay)}
        className="flex w-full items-center justify-between rounded-btn px-1 py-1 hover:bg-white/70"
      >
        <span className="inline-flex items-center gap-2 text-[14px] text-ink">
          <Clock className="h-4 w-4 text-faint" />
          하루 종일
        </span>
        <span
          data-allday-track
          className={cn(
            "relative inline-block h-[22px] w-[40px] shrink-0 overflow-hidden rounded-full transition-colors",
            value.allDay ? "bg-brand" : "bg-[#d1d6db]",
          )}
        >
          <span
            data-allday-knob
            className={cn(
              "pointer-events-none absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
              value.allDay ? "translate-x-[18px]" : "translate-x-0",
            )}
          />
        </span>
      </button>

      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-1 py-2">
        <DateTimeColumn
          date={value.startDate}
          time={value.startTime}
          allDay={value.allDay}
          dateOpen={open === "start-date"}
          timeOpen={open === "start-time"}
          dateLabel="시작 날짜"
          timeLabel="시작 시간"
          onDate={() => toggle("start-date")}
          onTime={() => toggle("start-time")}
        />
        <span className="px-1 text-[14px] text-faint" aria-hidden>
          →
        </span>
        <DateTimeColumn
          date={value.endDate}
          time={value.endTime}
          allDay={value.allDay}
          dateOpen={open === "end-date"}
          timeOpen={open === "end-time"}
          dateLabel="종료 날짜"
          timeLabel="종료 시간"
          onDate={() => toggle("end-date")}
          onTime={() => toggle("end-time")}
        />
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {shown ? (
            <div
              className={cn(
                "border-t border-line-soft pt-2 transition-opacity duration-200 ease-out",
                expanded ? "opacity-100" : "opacity-0",
              )}
            >
              {shown === "date" ? (
                <MonthPicker
                  selected={activeDate}
                  onSelect={(iso) => {
                    if (open === "end-date") emit({ endDate: iso });
                    else emit({ startDate: iso });
                    setOpen(null);
                  }}
                />
              ) : (
                <TimeWheel
                  key={open ?? "time"}
                  time={activeTime || (open === "end-time" ? "21:00" : "19:00")}
                  onChange={(next) => {
                    if (open === "end-time") emit({ endTime: next });
                    else emit({ startTime: next });
                  }}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DateTimeColumn({
  date,
  time,
  allDay,
  dateOpen,
  timeOpen,
  dateLabel,
  timeLabel,
  onDate,
  onTime,
}: {
  date: string;
  time: string;
  allDay: boolean;
  dateOpen: boolean;
  timeOpen: boolean;
  dateLabel: string;
  timeLabel: string;
  onDate: () => void;
  onTime: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`${dateLabel} ${formatDateWeekday(date)}`}
        aria-pressed={dateOpen}
        onClick={onDate}
        className={cn(
          "rounded-chip px-2.5 py-1 text-[15px] font-medium tracking-tight text-ink transition-colors",
          dateOpen ? "bg-[#ebedf0] text-ink" : "hover:bg-white",
        )}
      >
        {formatDateWeekday(date)}
      </button>
      {allDay ? null : (
        <button
          type="button"
          aria-label={`${timeLabel} ${formatTimeKo(time)}`}
          aria-pressed={timeOpen}
          onClick={onTime}
          className={cn(
            "rounded-chip px-2.5 py-1 text-[15px] tabular-nums tracking-tight transition-colors",
            timeOpen ? "bg-[#ebedf0] font-semibold text-ink" : "text-ink hover:bg-white",
          )}
        >
          {formatTimeKo(time)}
        </button>
      )}
    </div>
  );
}

function MonthPicker({ selected, onSelect }: { selected: string; onSelect: (iso: string) => void }) {
  const selectedDate = parseISODate(selected);
  const [cursor, setCursor] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  useEffect(() => {
    const date = parseISODate(selected);
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [selected]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return (
    <div data-date-picker data-month={monthKey} className="px-1 pb-1">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          className="rounded-btn p-1 text-sub hover:bg-white"
          onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px] font-semibold text-ink">
          {year}년 {monthIndex + 1}월
        </p>
        <button
          type="button"
          aria-label="다음 달"
          className="rounded-btn p-1 text-sub hover:bg-white"
          onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-faint">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center">
        {cells.map((day, index) => {
          if (!day) return <div key={`e-${index}`} className="h-9" />;
          const iso = toISODate(new Date(year, monthIndex, day));
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              aria-label={iso}
              aria-pressed={isSelected}
              onClick={() => onSelect(iso)}
              className={cn(
                "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition-colors",
                isSelected ? "bg-brand font-semibold text-white" : "text-ink hover:bg-white",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeWheel({ time, onChange }: { time: string; onChange: (next: string) => void }) {
  const parts = toParts(time);
  return (
    <div className="relative mx-auto grid max-w-[280px] grid-cols-[1.1fr_1fr_auto_1fr] items-stretch py-1">
      <WheelColumn
        name="period"
        items={PERIODS}
        value={parts.period}
        wrap={false}
        onChange={(period) => onChange(fromParts(period, parts.hour12, parts.minute))}
      />
      <WheelColumn
        name="hour"
        items={HOURS}
        value={String(parts.hour12)}
        wrap
        onChange={(hour) => onChange(fromParts(parts.period, Number(hour), parts.minute))}
      />
      <div className="relative w-3">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[1px] text-[17px] font-semibold text-ink">
          :
        </span>
      </div>
      <WheelColumn
        name="minute"
        items={MINUTES}
        value={String(parts.minute).padStart(2, "0")}
        wrap
        onChange={(minute) => onChange(fromParts(parts.period, parts.hour12, Number(minute)))}
      />
    </div>
  );
}

function WheelColumn({
  name,
  items,
  value,
  onChange,
  wrap,
}: {
  name: string;
  items: readonly { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
  wrap: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const indexRef = useRef(index);
  const onChangeRef = useRef(onChange);
  indexRef.current = index;
  onChangeRef.current = onChange;
  const drag = useRef<{ y: number; acc: number } | null>(null);
  const movedRef = useRef(false);

  const move = (delta: number) => {
    const current = indexRef.current;
    let next = current + delta;
    if (wrap) next = (next + items.length) % items.length;
    else next = Math.max(0, Math.min(items.length - 1, next));
    if (next !== current) onChangeRef.current(items[next].value);
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY === 0) return;
      move(event.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [items, wrap]);

  return (
    <div
      ref={rootRef}
      data-wheel={name}
      className="relative h-[120px] cursor-grab select-none overflow-hidden active:cursor-grabbing"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        movedRef.current = false;
        drag.current = { y: event.clientY, acc: 0 };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const dy = event.clientY - drag.current.y;
        drag.current.y = event.clientY;
        drag.current.acc += dy;
        if (Math.abs(drag.current.acc) >= ITEM_H * 0.7) {
          if (!movedRef.current) event.currentTarget.setPointerCapture(event.pointerId);
          movedRef.current = true;
          move(drag.current.acc > 0 ? -1 : 1);
          drag.current.acc = 0;
        }
      }}
      onPointerUp={(event) => {
        if (!movedRef.current) {
          const target = (event.target as HTMLElement | null)?.closest("[data-wheel-value]");
          const next = target?.getAttribute("data-wheel-value");
          if (next && next !== value) onChange(next);
        }
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div
        className="transition-transform duration-150 ease-out"
        style={{ transform: `translateY(${WHEEL_H / 2 - ITEM_H / 2 - index * ITEM_H}px)` }}
      >
        {items.map((item, itemIndex) => {
          const distance = Math.abs(itemIndex - index);
          return (
            <button
              key={item.value}
              type="button"
              tabIndex={-1}
              data-wheel-value={item.value}
              className={cn(
                "flex h-10 w-full items-center justify-center tabular-nums tracking-tight",
                distance === 0 ? "text-[17px] font-semibold text-ink" : "text-[15px] text-faint",
                distance > 1 && "text-[#c9cfd6]",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#fcfcfd]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#fcfcfd]" />
    </div>
  );
}

function toParts(hhmm: string) {
  const [hStr, mStr = "00"] = (hhmm || "00:00").split(":");
  const hour = Number(hStr) || 0;
  const rawMinute = Number(mStr) || 0;
  const minute = Math.min(55, Math.max(0, Math.round(rawMinute / 5) * 5));
  return {
    period: hour < 12 ? "am" : "pm",
    hour12: hour % 12 === 0 ? 12 : hour % 12,
    minute,
  };
}

function fromParts(period: string, hour12: number, minute: number) {
  let hour = hour12 % 12;
  if (period === "pm") hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function minutesOf(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0) / 60000;
}

function fromMinutes(total: number) {
  const dt = new Date(total * 60000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mm = String(dt.getUTCMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

function normalizeRange(prev: DateTimeRangeValue, next: DateTimeRangeValue): DateTimeRangeValue {
  const result = { ...next };
  if (next.startDate !== prev.startDate && prev.endDate === prev.startDate) {
    result.endDate = next.startDate;
  }

  if (result.allDay) {
    if (result.endDate < result.startDate) result.endDate = result.startDate;
    return result;
  }

  const start = minutesOf(result.startDate, result.startTime);
  const end = minutesOf(result.endDate, result.endTime);
  if (end > start) return result;

  const prevDuration = minutesOf(prev.endDate, prev.endTime) - minutesOf(prev.startDate, prev.startTime);
  const bumped = fromMinutes(start + Math.max(60, prevDuration));
  result.endDate = bumped.date;
  result.endTime = bumped.time;
  return result;
}
