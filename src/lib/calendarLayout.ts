import { eventEndDate, toISODate } from "./format";
import type { ClubEvent } from "./types";

export const CALENDAR_MAX_LANES = 3;
export const CALENDAR_LANE_H = 20;
export const CALENDAR_DAY_HEAD = 32;
export const CALENDAR_MORE_H = 16;

export type CalendarCell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

export type WeekSegment = {
  event: ClubEvent;
  lane: number;
  colStart: number;
  colSpan: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

export function monthCells(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const date = new Date(year, monthIndex, i - startPad + 1);
    return {
      iso: toISODate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    };
  });
}

export function chunkWeeks<T>(items: T[], size = 7): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < items.length; i += size) weeks.push(items.slice(i, i + size));
  return weeks;
}

export function isMultiDayEvent(event: ClubEvent) {
  return eventEndDate(event) > event.date;
}

function eventLength(event: ClubEvent) {
  const start = Date.parse(`${event.date}T00:00:00`);
  const end = Date.parse(`${eventEndDate(event)}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.round((end - start) / 86_400_000) + 1;
}

function compareEvents(a: ClubEvent, b: ClubEvent) {
  const aLen = eventLength(a);
  const bLen = eventLength(b);
  if (bLen !== aLen) return bLen - aLen;
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
  return a.title.localeCompare(b.title);
}

export function layoutWeek(weekIsos: string[], events: ClubEvent[]): WeekSegment[] {
  if (weekIsos.length < 7) return [];
  const weekStart = weekIsos[0];
  const weekEnd = weekIsos[6];
  const overlapping = events
    .filter((event) => event.date <= weekEnd && eventEndDate(event) >= weekStart)
    .sort(compareEvents);

  const lanes: { start: string; end: string }[][] = [];
  const segments: WeekSegment[] = [];

  for (const event of overlapping) {
    const end = eventEndDate(event);
    const visStart = event.date < weekStart ? weekStart : event.date;
    const visEnd = end > weekEnd ? weekEnd : end;
    const startIdx = weekIsos.indexOf(visStart);
    const endIdx = weekIsos.indexOf(visEnd);
    if (startIdx < 0 || endIdx < 0) continue;

    let lane = lanes.findIndex((items) =>
      items.every((item) => item.end < visStart || item.start > visEnd),
    );
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([{ start: visStart, end: visEnd }]);
    } else {
      lanes[lane].push({ start: visStart, end: visEnd });
    }

    segments.push({
      event,
      lane,
      colStart: startIdx + 1,
      colSpan: endIdx - startIdx + 1,
      continuesLeft: event.date < visStart,
      continuesRight: end > visEnd,
    });
  }

  return segments;
}

export function hiddenCountForDay(iso: string, segments: WeekSegment[], maxLanes = CALENDAR_MAX_LANES) {
  return segments.filter(
    (seg) => seg.lane >= maxLanes && seg.event.date <= iso && eventEndDate(seg.event) >= iso,
  ).length;
}

export function weekMinHeight(laneCount: number, hasMore: boolean) {
  const shown = Math.min(Math.max(laneCount, 0), CALENDAR_MAX_LANES);
  return Math.max(96, CALENDAR_DAY_HEAD + shown * CALENDAR_LANE_H + (hasMore ? CALENDAR_MORE_H : 8));
}