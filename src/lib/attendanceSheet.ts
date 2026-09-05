import { CLUB_NAME } from "./constants";
import { formatWeekday, todayISO } from "./format";
import { isActive, isPracticeEvent, isScheduledFor, sortMembersByCategory } from "./stats";
import type { Attendance, AttendanceStatus, ClubEvent, Member } from "./types";

export function practiceSheetEvents(events: ClubEvent[]) {
  return events
    .filter(isPracticeEvent)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export function sheetMembers(members: Member[], categories: string[]) {
  return sortMembersByCategory(members.filter(isActive), categories);
}

export function attendanceRecordMap(attendance: Attendance[]) {
  const map = new Map<string, AttendanceStatus>();
  for (const row of attendance) {
    map.set(`${row.eventId}:${row.memberId}`, row.status);
  }
  return map;
}

export function sheetCellValue(
  member: Member,
  event: ClubEvent,
  status?: AttendanceStatus,
): string | null {
  if (!isScheduledFor(member, event)) return null;
  return status ?? "미체크";
}

export type MonthGroup = { key: string; label: string; count: number };

export function practiceMonthGroups(events: ClubEvent[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const event of events) {
    const key = event.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.count += 1;
      continue;
    }
    const month = Number(event.date.slice(5, 7));
    groups.push({ key, label: `${month}월`, count: 1 });
  }
  return groups;
}

function dateHeader(event: ClubEvent) {
  return `${Number(event.date.slice(8, 10))}(${formatWeekday(event.date)})`;
}

export function buildAttendanceSheetAoa(
  members: Member[],
  events: ClubEvent[],
  attendance: Attendance[],
  categories: string[],
): string[][] {
  const people = sheetMembers(members, categories);
  const practices = practiceSheetEvents(events);
  const map = attendanceRecordMap(attendance);
  const monthRow = [
    "분류",
    "이름",
    ...practices.map((event, index) => {
      const month = Number(event.date.slice(5, 7));
      const prev = practices[index - 1];
      if (prev && Number(prev.date.slice(5, 7)) === month) return "";
      return `${month}월`;
    }),
  ];
  const dayRow = ["", "", ...practices.map(dateHeader)];
  const body = people.map((member) => [
    member.category,
    member.name,
    ...practices.map((event) => sheetCellValue(member, event, map.get(`${event.id}:${member.id}`)) ?? ""),
  ]);
  return [monthRow, dayRow, ...body];
}

export async function downloadAttendanceSheetXlsx(
  members: Member[],
  events: ClubEvent[],
  attendance: Attendance[],
  categories: string[],
) {
  const XLSX = await import("xlsx");
  const practices = practiceSheetEvents(events);
  const aoa = buildAttendanceSheetAoa(members, events, attendance, categories);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
  ];
  let col = 2;
  for (const group of practiceMonthGroups(practices)) {
    if (group.count > 1) {
      merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + group.count - 1 } });
    }
    col += group.count;
  }
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 8 }, { wch: 10 }, ...practices.map(() => ({ wch: 10 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "출석표");
  XLSX.writeFile(wb, `${CLUB_NAME}_출석표_${todayISO()}.xlsx`);
}
