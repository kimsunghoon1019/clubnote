import { formatDateDot, parseISODate, todayISO } from "./format";
import { sortMembersByCategory } from "./stats";
import type { Member, Transaction } from "./types";

export type DuesSemester = {
  start: string;
  end: string;
  label: string;
};

export type DuesRow = {
  id: string;
  name: string;
  category: string;
  role: string;
  paid: boolean;
  paidAmount: number;
  titles: string[];
};

function lastDayOfFeb(year: number) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return `${year}-02-${leap ? "29" : "28"}`;
}

/** 3월–8월 = 1학기, 9월–다음 해 2월 = 2학기. */
export function duesSemester(today = todayISO()): DuesSemester {
  const date = parseISODate(today);
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 8) {
    return { start: `${year}-09-01`, end: lastDayOfFeb(year + 1), label: `${year}년 2학기` };
  }
  if (month <= 1) {
    return { start: `${year - 1}-09-01`, end: lastDayOfFeb(year), label: `${year - 1}년 2학기` };
  }
  return { start: `${year}-03-01`, end: `${year}-08-31`, label: `${year}년 1학기` };
}

export function formatDuesPeriod(semester: DuesSemester) {
  return `${formatDateDot(semester.start)} – ${formatDateDot(semester.end)}`;
}

function titleHasName(title: string, name: string) {
  if (!name) return false;
  if (title.includes(name)) return true;
  return title.replace(/\s+/g, "").includes(name);
}

function matchingNames(title: string, names: string[]) {
  const hits = names.filter((name) => titleHasName(title, name));
  return hits.filter((name) => !hits.some((other) => other !== name && other.includes(name)));
}

function isDuesDeposit(row: Transaction) {
  return row.type === "입금" && row.amount > 0;
}

export function duesStatus(
  members: Member[],
  transactions: Transaction[],
  categories: string[],
  today = todayISO(),
): { semester: DuesSemester; rows: DuesRow[] } {
  const semester = duesSemester(today);
  const names = [...new Set(members.map((member) => member.name).filter(Boolean))];
  const byName = new Map<string, { amount: number; titles: string[] }>();

  for (const row of transactions) {
    if (row.occurredOn < semester.start || row.occurredOn > semester.end) continue;
    if (!isDuesDeposit(row)) continue;
    const hits = matchingNames(row.title, names);
    if (hits.length === 0) continue;
    for (const name of hits) {
      const prev = byName.get(name) ?? { amount: 0, titles: [] };
      prev.amount += row.amount;
      if (!prev.titles.includes(row.title)) prev.titles.push(row.title);
      byName.set(name, prev);
    }
  }

  const rows = sortMembersByCategory(members, categories).map((member) => {
    const match = byName.get(member.name);
    const paidAmount = match?.amount ?? 0;
    return {
      id: member.id,
      name: member.name,
      category: member.category,
      role: member.role,
      paid: paidAmount > 0,
      paidAmount,
      titles: match?.titles ?? [],
    };
  });

  rows.sort((a, b) => Number(a.paid) - Number(b.paid) || a.name.localeCompare(b.name, "ko"));

  return { semester, rows };
}
