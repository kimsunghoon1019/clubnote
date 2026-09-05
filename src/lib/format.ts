import type { PracticeDay } from "./types";

export function formatWon(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export function formatSignedWon(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${n.toLocaleString("ko-KR")}원`;
}

export function formatNumber(n: number, digits = 0) {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function formatDateKo(iso: string) {
  const date = parseISODate(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatDateDot(iso: string) {
  const date = parseISODate(iso);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${m}.${d}`;
}

export function formatTxWhen(occurredOn: string, occurredAt?: string) {
  const date = formatDateDot(occurredOn);
  const stamp = occurredAt ?? occurredOn;
  const time = stamp.match(/T(\d{2}:\d{2})/);
  return time ? `${date} ${time[1]}` : date;
}

export function formatWeekday(iso: string) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[parseISODate(iso).getDay()];
}

export function weekdayToPracticeDay(iso: string): PracticeDay | null {
  const day = formatWeekday(iso);
  if (day === "화" || day === "목" || day === "토") return day;
  return null;
}

export function formatTimeRange(start: string, end: string) {
  if (!start) return "";
  return end ? `${start}–${end}` : start;
}

export function formatDateWeekday(iso: string) {
  return `${formatDateKo(iso)} (${formatWeekday(iso)})`;
}

export function formatTimeKo(hhmm: string) {
  if (!hhmm) return "";
  const [hStr, mStr = "00"] = hhmm.split(":");
  const hour = Number(hStr);
  if (!Number.isFinite(hour)) return hhmm;
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}:${mStr.padStart(2, "0")}`;
}

export function formatEventTime(event: { startTime: string; endTime: string; allDay?: boolean }) {
  if (event.allDay) return "하루 종일";
  return formatTimeRange(event.startTime, event.endTime);
}

export function eventEndDate(event: { date: string; endDate?: string }) {
  return event.endDate && event.endDate > event.date ? event.endDate : event.date;
}

export function eachISODate(from: string, to: string) {
  const dates: string[] = [];
  const cursor = parseISODate(from);
  const last = parseISODate(to);
  if (Number.isNaN(cursor.getTime()) || last < cursor) return from ? [from] : [];
  while (cursor <= last) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function formatEventWhen(event: {
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
}) {
  const end = eventEndDate(event);
  if (end === event.date) return formatEventTime(event);
  if (event.allDay) return `${formatDateKo(event.date)} – ${formatDateKo(end)}`;
  return `${formatDateKo(event.date)} ${event.startTime} – ${formatDateKo(end)} ${event.endTime}`;
}

export function formatChartStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const week = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${y}.${m}.${d} (${week}) ${hh}:${mm}`;
}

export function tenureLabel(joinedAt: string, today = todayISO()) {
  const start = parseISODate(joinedAt);
  const now = parseISODate(today);
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;
  if (months < 12) return `${months}개월`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years}년` : `${years}년 ${rest}개월`;
}

export function tenureMonths(joinedAt: string, today = todayISO()) {
  const start = parseISODate(joinedAt);
  const now = parseISODate(today);
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function studentYear(studentId: string) {
  return `${studentId.slice(2, 4)}학번`;
}

const COLLEGE_BY_MAJOR: Record<string, string> = {
  음악학과: "음악대학",
  기악과: "음악대학",
  관현악과: "음악대학",
  피아노과: "음악대학",
  경영학과: "경영대학",
  회계학과: "경영대학",
  컴퓨터공학과: "공과대학",
  기계공학과: "공과대학",
  전자공학과: "공과대학",
  사회학과: "사회과학대학",
  행정학과: "사회과학대학",
  신문방송학과: "사회과학대학",
  심리학과: "사회과학대학",
  경제학과: "사회과학대학",
  철학과: "인문대학",
  국어국문학과: "인문대학",
  영어영문학과: "인문대학",
  사학과: "인문대학",
  디자인학과: "예술대학",
  화학과: "자연과학대학",
  수학과: "자연과학대학",
};

export function collegeFromMajor(major: string) {
  return COLLEGE_BY_MAJOR[major] ?? "";
}

export function ageFromBirthDate(iso: string, today = todayISO()) {
  if (!iso) return 0;
  const birth = parseISODate(iso);
  const now = parseISODate(today);
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function inferredBirthDate(age: number, seed = "0") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const year = new Date().getFullYear() - Math.max(0, age);
  const month = (hash % 8) + 1;
  const day = (hash % 27) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function initials(name: string) {
  return name.slice(0, 1);
}

export function formatRatio(value: number) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

export function startOfWeekMonday(iso: string) {
  const date = parseISODate(iso);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}
