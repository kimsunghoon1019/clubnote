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
