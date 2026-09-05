import { ATTENDANCE_STATUSES, isPresentStatus } from "./constants";
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
  const present = catMembers.filter((member) => {
    const status = rows.find((row) => row.memberId === member.id)?.status;
    return Boolean(status && isPresentStatus(status));
  }).length;
  return {
    rate: catMembers.length === 0 ? 0 : (present / catMembers.length) * 100,
    counts: countByStatus(rows),
    total: catMembers.length,
    unchecked: Math.max(0, catMembers.length - rows.length),
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
