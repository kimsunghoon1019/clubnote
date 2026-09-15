import { formatDateKo, formatNoticeClock, formatWeekday, parseISODate, startOfWeekMonday, toISODate, todayISO } from "./format";
import { expectedMembersForEvent, membersForEvent, practiceEvents, upcomingPractice } from "./stats";
import type { AttendanceStatus, ClubEvent, Member } from "./types";

const NOTICE_FOOTER = `⚠ 연습 시간에 늦지 않게 도착해주세요!\n: 지각/결석 등 출결 관련 이슈가 있으신 분은 각 파트장에게 알려주세요`;

function noticeEventTitle(event: ClubEvent) {
  if (!event.title || event.title === "정기연습") return "연습";
  return event.title;
}

function formatNoticeDate(iso: string) {
  const date = parseISODate(iso);
  return `${date.getMonth() + 1}/${date.getDate()}(${formatWeekday(iso)})`;
}

function formatNoticeEvent(event: ClubEvent) {
  const time = event.allDay ? "하루 종일" : formatNoticeClock(event.startTime);
  const place = event.place || "-";
  return `✅ ${formatNoticeDate(event.date)} ${noticeEventTitle(event)}\n|  시각  |  ${time}\n|  장소  |  ${place}`;
}

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
  return `${header}\n\n${week.map(formatNoticeEvent).join("\n\n")}\n\n\n${NOTICE_FOOTER}`;
}

/** 0=이번 주, 1=다음 주(기본 공지). */
export function weekPracticeLabel(weekOffset: number) {
  if (weekOffset === -1) return "지난 주";
  if (weekOffset === 0) return "이번 주";
  if (weekOffset === 1) return "다음 주";
  if (weekOffset === 2) return "그다음 주";
  if (weekOffset > 2) return `${weekOffset}주 뒤`;
  return `${-weekOffset}주 전`;
}

export function weekRangeCaption(today: string, weekOffset: number) {
  const { from, to } = weekBounds(today, weekOffset);
  return `${formatNoticeDate(from)} – ${formatNoticeDate(to)}`;
}

export function weekPracticeNoticeText(events: ClubEvent[], weekOffset: number, today = todayISO()) {
  const label = weekPracticeLabel(weekOffset);
  const particle = label.endsWith("전") ? "은" : "는";
  return formatPracticeNotice(
    `${label} 연습 일정 공지`,
    `${label}${particle} 예정된 연습 일정이 없습니다.`,
    practicesInWeek(events, today, weekOffset),
  );
}

export function practiceNoticeText(events: ClubEvent[], today = todayISO()) {
  return formatPracticeNotice("연습 일정 공지", "이번 주는 예정된 연습 일정이 없습니다.", weekPracticeEvents(events, today));
}

export function nextWeekPracticeNoticeText(events: ClubEvent[], today = todayISO()) {
  return weekPracticeNoticeText(events, 1, today);
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

/** 1명뿐이라 참석 확인 공지가 필요 없는 분류. */
const SKIP_EXPECTED_NOTICE_CATEGORIES = new Set(["반주자", "지휘자"]);

export function todayMemoItems(
  events: ClubEvent[],
  members: Member[],
  categories: string[],
  recordMap: Map<string, AttendanceStatus>,
  today = todayISO(),
  weekOffset = 1,
): TodayMemo[] {
  const label = weekPracticeLabel(weekOffset);
  const items: TodayMemo[] = [
    {
      id: "week-practice",
      title: `${label} 연습 일정`,
      caption: weekRangeCaption(today, weekOffset),
      text: weekPracticeNoticeText(events, weekOffset, today),
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
    if (SKIP_EXPECTED_NOTICE_CATEGORIES.has(category)) continue;
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
