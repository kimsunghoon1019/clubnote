import { todayISO, weekdayToPracticeDay, formatWeekday } from "./format";
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

export function attendanceRate(records: Attendance[]) {
  const counted = records.filter((row) => row.status !== "공결");
  if (counted.length === 0) return 0;
  const present = counted.filter((row) => row.status === "출석" || row.status === "지각").length;
  return (present / counted.length) * 100;
}

export function countByStatus(records: Attendance[]) {
  return records.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { 출석: 0, 결석: 0, 지각: 0, 공결: 0 } as Record<AttendanceStatus, number>,
  );
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
    return status === "출석" || status === "지각";
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
  const ids = new Set(members.filter((member) => member.category === category).map((m) => m.id));
  const rows = records.filter((row) => ids.has(row.memberId));
  return {
    rate: attendanceRate(rows),
    counts: countByStatus(rows),
    total: rows.length,
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

export function hasPracticeDay(days: PracticeDay[], day: PracticeDay) {
  return days.includes(day);
}

export function togglePracticeDay(days: PracticeDay[], day: PracticeDay): PracticeDay[] {
  return days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
}

export function eventWeekdayLabel(event: ClubEvent) {
  return formatWeekday(event.date);
}
