import { formatDateKo, formatTimeRange, formatWeekday, startOfWeekMonday, toISODate, todayISO } from "./format";
import { practiceEvents } from "./stats";
import type { ClubEvent } from "./types";

export function weekPracticeEvents(events: ClubEvent[], today = todayISO()) {
  const start = startOfWeekMonday(today);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const from = toISODate(start);
  const to = toISODate(end);
  return practiceEvents(events)
    .filter((event) => event.date >= from && event.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export function practiceNoticeText(events: ClubEvent[], today = todayISO()) {
  const week = weekPracticeEvents(events, today);
  const header = "연습 일정 공지";
  const footer = `⚠ 연습 시간에 늦지 않게 도착해주세요!\n: 지각/결석 등 출결 관련 이슈가 있으신 분은 각 파트장에게 알려주세요`;
  if (week.length === 0) {
    return `${header}\n\n이번 주는 예정된 연습 일정이 없습니다.\n\n${footer}`;
  }
  const lines = week.map((event) => {
    const time = formatTimeRange(event.startTime, event.endTime);
    return `${formatDateKo(event.date)} (${formatWeekday(event.date)}) ${time} ${event.place}`.replace(/\s+/g, " ").trim();
  });
  return `${header}\n\n${lines.join("\n")}\n\n${footer}`;
}
