import { formatDateKo, formatEventTime, formatWeekday, startOfWeekMonday, toISODate, todayISO } from "./format";
import { expectedMembersForEvent, membersForEvent, practiceEvents, upcomingPractice } from "./stats";
import type { AttendanceStatus, ClubEvent, Member } from "./types";

const NOTICE_FOOTER = `⚠ 연습 시간에 늦지 않게 도착해주세요!\n: 지각/결석 등 출결 관련 이슈가 있으신 분은 각 파트장에게 알려주세요`;

function weekBounds(today: string, weekOffset: number) {
  const start = startOfWeekMonday(today);
  start.setDate(start.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: toISODate(start), to: toISODate(end) };
}

function practicesInWeek(events: ClubEvent[], today: string, weekOffset: number) {
  const { from, to } = weekBounds(today, weekOffset);
  return practiceEvents(events)
    .filter((event) => event.date >= from && event.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export function weekPracticeEvents(events: ClubEvent[], today = todayISO()) {
  return practicesInWeek(events, today, 0);
}

export function nextWeekPracticeEvents(events: ClubEvent[], today = todayISO()) {
  return practicesInWeek(events, today, 1);
}

function formatPracticeNotice(header: string, emptyLine: string, week: ClubEvent[]) {
  if (week.length === 0) {
    return `${header}\n\n${emptyLine}\n\n${NOTICE_FOOTER}`;
  }
  const lines = week.map((event) => {
    const time = formatEventTime(event);
    return `${formatDateKo(event.date)} (${formatWeekday(event.date)}) ${time} ${event.place}`.replace(/\s+/g, " ").trim();
  });
  return `${header}\n\n${lines.join("\n")}\n\n${NOTICE_FOOTER}`;
}

export function practiceNoticeText(events: ClubEvent[], today = todayISO()) {
  return formatPracticeNotice("연습 일정 공지", "이번 주는 예정된 연습 일정이 없습니다.", weekPracticeEvents(events, today));
}

export function nextWeekPracticeNoticeText(events: ClubEvent[], today = todayISO()) {
  return formatPracticeNotice(
    "다음 주 연습 일정 공지",
    "다음 주는 예정된 연습 일정이 없습니다.",
    nextWeekPracticeEvents(events, today),
  );
}

export function expectedAttendanceNoticeText(event: ClubEvent, category: string, names: string[]) {
  const when = `${formatDateKo(event.date)} (${formatWeekday(event.date)})`;
  const header = `[${category}] ${when} 참석 예정 인원`;
  const list = names.length === 0 ? "참석 예정 인원이 없습니다." : names.join(" ");
  return `${header}\n${list}\n\n출석 사항에 변동이 있으면 연락 주세요.`;
}

export type TodayMemo = {
  id: string;
  title: string;
  caption?: string;
  text: string;
};

export function todayMemoItems(
  events: ClubEvent[],
  members: Member[],
  categories: string[],
  recordMap: Map<string, AttendanceStatus>,
  today = todayISO(),
): TodayMemo[] {
  const items: TodayMemo[] = [
    {
      id: "next-week",
      title: "다음 주 연습 일정",
      caption: "전주 공지용",
      text: nextWeekPracticeNoticeText(events, today),
    },
  ];
  const event = upcomingPractice(events, today);
  if (!event) {
    items.push({
      id: "expected-empty",
      title: "참석 예정 인원",
      text: "오늘 이후 연습이 없습니다.",
    });
    return items;
  }

  const expected = expectedMembersForEvent(event, members, recordMap);
  const roster = membersForEvent(members, event);
  const rosterCats = new Set(roster.map((member) => member.category));
  const extra = [
    ...new Set(roster.map((member) => member.category).filter((name) => !categories.includes(name))),
  ];
  const when = `${formatDateKo(event.date)} (${formatWeekday(event.date)})`;

  for (const category of [...categories, ...extra]) {
    if (!rosterCats.has(category)) continue;
    const names = expected
      .filter((member) => member.category === category)
      .map((member) => member.name)
      .sort((a, b) => a.localeCompare(b, "ko"));
    items.push({
      id: `expected-${category}`,
      title: `${category} 참석 예정`,
      caption: `${when} · ${names.length}명`,
      text: expectedAttendanceNoticeText(event, category, names),
    });
  }
  return items;
}
