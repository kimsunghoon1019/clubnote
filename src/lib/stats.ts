import { ATTENDANCE_STATUSES, isAbsentStatus, isPresentStatus } from "./constants";
import { formatWeekday, parseISODate, startOfWeekMonday, toISODate, todayISO, weekdayToPracticeDay } from "./format";
import type { Attendance, AttendanceStatus, ClubEvent, Member, PracticeDay } from "./types";

export function isPracticeEvent(event: ClubEvent) {
  return event.type === "연습" || event.type === "정기연습";
}

export function practiceEvents(events: ClubEvent[]) {
  return events.filter(isPracticeEvent);
}

export function isActive(member: Member) {
  return member.active !== false;
}

export function isScheduledFor(member: Member, event: ClubEvent) {
  if (!isActive(member)) return false;
  if (!isPracticeEvent(event)) return false;
  const day = weekdayToPracticeDay(event.date);
  return Boolean(day && member.practiceDays.includes(day));
}

export function membersForEvent(members: Member[], event: ClubEvent) {
  return members.filter((member) => isScheduledFor(member, event));
}

export function sortMembersByCategory(members: Member[], categories: string[]) {
  const catIndex = (category: string) => {
    const index = categories.indexOf(category);
    return index === -1 ? categories.length : index;
  };
  return members
    .slice()
    .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.name.localeCompare(b.name, "ko"));
}

export function emptyStatusCounts(): Record<AttendanceStatus, number> {
  return Object.fromEntries(ATTENDANCE_STATUSES.map((status) => [status, 0])) as Record<AttendanceStatus, number>;
}

export function attendanceRate(records: Attendance[]) {
  if (records.length === 0) return 0;
  const present = records.filter((row) => isPresentStatus(row.status)).length;
  return (present / records.length) * 100;
}

export function rosterAttendanceRate(members: Member[], records: Attendance[]) {
  if (members.length === 0) return 0;
  const map = new Map(records.map((row) => [row.memberId, row.status]));
  const present = members.filter((member) => {
    const status = map.get(member.id);
    return Boolean(status && isPresentStatus(status));
  }).length;
  return (present / members.length) * 100;
}

export function countByStatus(records: Attendance[]) {
  return records.reduce((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, emptyStatusCounts());
}

function recordOf(attendance: Attendance[], eventId: string, memberId: string) {
  return attendance.find((row) => row.eventId === eventId && row.memberId === memberId);
}

/** 출석해야 하는 연습 중 제대로 출석(출석만)한 비율. 0~1 */
export function diligenceScore(
  member: Member,
  events: ClubEvent[],
  attendance: Attendance[],
  today = todayISO(),
) {
  const scheduled = practiceEvents(events).filter(
    (event) => event.date <= today && isScheduledFor(member, event),
  );
  if (scheduled.length === 0) return 0;
  const proper = scheduled.filter((event) => recordOf(attendance, event.id, member.id)?.status === "출석");
  return proper.length / scheduled.length;
}

/** 학기 전체 연습 중 참여(출석·지각)한 비율. 0~1 */
export function participationScore(
  member: Member,
  events: ClubEvent[],
  attendance: Attendance[],
  today = todayISO(),
) {
  const held = practiceEvents(events).filter((event) => event.date <= today);
  if (held.length === 0) return 0;
  const joined = held.filter((event) => {
    const status = recordOf(attendance, event.id, member.id)?.status;
    return Boolean(status && isPresentStatus(status));
  });
  return joined.length / held.length;
}

export function categoryCounts(members: Member[], categories: string[]) {
  return categories.map((name) => ({
    name,
    count: members.filter((member) => member.category === name).length,
  }));
}

export function categoryAttendance(
  category: string,
  members: Member[],
  records: Attendance[],
) {
  const catMembers = members.filter((member) => member.category === category);
  const ids = new Set(catMembers.map((m) => m.id));
  const rows = records.filter((row) => ids.has(row.memberId));
  const counts = countByStatus(rows);
  const unchecked = Math.max(0, catMembers.length - rows.length);
  const shown = counts.출석 + counts.통보지각 + counts.미통보지각 + unchecked;
  return {
    shown,
    counts,
    total: catMembers.length,
    unchecked,
  };
}

export function latestPractice(events: ClubEvent[], today = todayISO()) {
  return practiceEvents(events)
    .filter((event) => event.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))[0];
}

export function upcomingPractice(events: ClubEvent[], today = todayISO()) {
  return practiceEvents(events)
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0];
}

/** 오늘 포함, 이미 지난(또는 당일) 연습 */
export function heldPracticeEvents(events: ClubEvent[], today = todayISO()) {
  return practiceEvents(events)
    .filter((event) => event.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

/** 오늘 이후 남은 연습 */
export function remainingPracticeEvents(events: ClubEvent[], today = todayISO()) {
  return practiceEvents(events)
    .filter((event) => event.date > today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

/** 오늘 포함, 다가오는 연습 (오늘 → 미래) */
export function upcomingPracticeEvents(events: ClubEvent[], today = todayISO()) {
  return practiceEvents(events)
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

function monthDayLabel(iso: string) {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

export type PracticeParticipationRow = {
  id: string;
  date: string;
  label: string;
  roster: number;
  joined: number;
  rest: number;
  isFuture: boolean;
  isToday: boolean;
  isPad: boolean;
  isPlaceholder: boolean;
};

/** 미래는 대상 전원, 오늘·과거는 결석을 뺀 실제 참여. */
export function joinedMembersForEvent(
  event: ClubEvent,
  members: Member[],
  recordMap: Map<string, AttendanceStatus>,
  today = todayISO(),
) {
  if (event.date > today) return membersForEvent(members, event);
  return expectedMembersForEvent(event, members, recordMap);
}

function participationRowFromEvent(
  event: ClubEvent,
  members: Member[],
  recordMap: Map<string, AttendanceStatus>,
  today: string,
): PracticeParticipationRow {
  const roster = membersForEvent(members, event).length;
  const joined = joinedMembersForEvent(event, members, recordMap, today).length;
  return {
    id: event.id,
    date: event.date,
    label: monthDayLabel(event.date),
    roster,
    joined,
    rest: Math.max(0, roster - joined),
    isFuture: event.date > today,
    isToday: event.date === today,
    isPad: false,
    isPlaceholder: false,
  };
}

function padParticipationRow(id: string): PracticeParticipationRow {
  return {
    id,
    date: "",
    label: "",
    roster: 0,
    joined: 0,
    rest: 0,
    isFuture: false,
    isToday: false,
    isPad: true,
    isPlaceholder: false,
  };
}

/** 오늘이 가운데 오도록 전후 연습을 잘라 대상/참여 막대를 만든다. */
export function centeredPracticeParticipation(
  events: ClubEvent[],
  members: Member[],
  recordMap: Map<string, AttendanceStatus>,
  today = todayISO(),
  count = 12,
): PracticeParticipationRow[] {
  const list = practiceEvents(events).sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
  const past = list.filter((event) => event.date < today);
  const todayEvent = list.find((event) => event.date === today);
  const future = list.filter((event) => event.date > today);
  const leftSlots = Math.max(0, Math.floor((count - 1) / 2));
  const rightSlots = Math.max(0, count - 1 - leftSlots);
  const leftEvents = past.slice(-leftSlots);
  const rightEvents = future.slice(0, rightSlots);
  const middle: PracticeParticipationRow = todayEvent
    ? participationRowFromEvent(todayEvent, members, recordMap, today)
    : {
        id: "today-placeholder",
        date: today,
        label: monthDayLabel(today),
        roster: 0,
        joined: 0,
        rest: 0,
        isFuture: false,
        isToday: true,
        isPad: false,
        isPlaceholder: true,
      };
  return [
    ...Array.from({ length: leftSlots - leftEvents.length }, (_, i) => padParticipationRow(`pad-l-${i}`)),
    ...leftEvents.map((event) => participationRowFromEvent(event, members, recordMap, today)),
    middle,
    ...rightEvents.map((event) => participationRowFromEvent(event, members, recordMap, today)),
    ...Array.from({ length: rightSlots - rightEvents.length }, (_, i) => padParticipationRow(`pad-r-${i}`)),
  ];
}

export function thisWeekHeldPractices(events: ClubEvent[], today = todayISO()) {
  const start = startOfWeekMonday(today);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const from = toISODate(start);
  const to = toISODate(end);
  return heldPracticeEvents(events, today).filter((event) => event.date >= from && event.date <= to);
}

export function attendanceStatusMap(attendance: Attendance[]) {
  const map = new Map<string, AttendanceStatus>();
  for (const row of attendance) {
    map.set(`${row.eventId}:${row.memberId}`, row.status);
  }
  return map;
}

export function presentMembersForEvent(
  event: ClubEvent,
  members: Member[],
  recordMap: Map<string, AttendanceStatus>,
) {
  return membersForEvent(members, event).filter((member) => {
    const status = recordMap.get(`${event.id}:${member.id}`);
    return Boolean(status && isPresentStatus(status));
  });
}

/** 그날 대상 회원 중 결석이 아닌 사람. 미체크는 참석 예정. */
export function expectedMembersForEvent(
  event: ClubEvent,
  members: Member[],
  recordMap: Map<string, AttendanceStatus>,
) {
  return membersForEvent(members, event).filter((member) => {
    const status = recordMap.get(`${event.id}:${member.id}`);
    return !status || !isAbsentStatus(status);
  });
}

/** 출석표 칸 기준 출석률. 대상(연습요일 맞는 활동 회원) 대비 출석·지각. */
export function pooledRosterRate(
  events: ClubEvent[],
  members: Member[],
  recordMap: Map<string, AttendanceStatus>,
) {
  let roster = 0;
  let present = 0;
  for (const event of events) {
    const people = membersForEvent(members, event);
    roster += people.length;
    for (const member of people) {
      const status = recordMap.get(`${event.id}:${member.id}`);
      if (status && isPresentStatus(status)) present += 1;
    }
  }
  return roster === 0 ? 0 : (present / roster) * 100;
}

export function weeklyAttendanceSpark(
  events: ClubEvent[],
  members: Member[],
  recordMap: Map<string, AttendanceStatus>,
  today = todayISO(),
  weeks = 8,
) {
  const monday = startOfWeekMonday(today);
  const rates: number[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const from = toISODate(start);
    const to = toISODate(end);
    const weekEvents = heldPracticeEvents(events, today).filter(
      (event) => event.date >= from && event.date <= to,
    );
    rates.push(pooledRosterRate(weekEvents, members, recordMap));
  }
  return rates;
}

export function monthlyHeldPracticeSpark(events: ClubEvent[], today = todayISO(), months = 6) {
  const held = heldPracticeEvents(events, today);
  const now = parseISODate(today);
  const counts: number[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    counts.push(held.filter((event) => event.date.startsWith(key)).length);
  }
  return counts;
}

export function categoryPresentCounts(present: Member[], categories: string[]) {
  const extra = [
    ...new Set(present.map((member) => member.category).filter((name) => !categories.includes(name))),
  ];
  return [...categories, ...extra].map((name) => ({
    name,
    value: present.filter((member) => member.category === name).length,
  }));
}

export function hasPracticeDay(days: PracticeDay[], day: PracticeDay) {
  return days.includes(day);
}

export function togglePracticeDay(days: PracticeDay[], day: PracticeDay): PracticeDay[] {
  return days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
}

export function eventWeekdayLabel(event: ClubEvent) {
  return formatWeekday(event.date);
}
