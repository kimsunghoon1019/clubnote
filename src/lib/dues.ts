import { formatDateDot, parseISODate, toISODate, todayISO } from "./format";
import { isActive, sortMembersByCategory } from "./stats";
import type { DuesOverride, Member, Transaction } from "./types";

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
  autoPaid: boolean;
  paidAmount: number;
  titles: string[];
  manual: boolean;
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

export function previousSemester(today = todayISO()): DuesSemester {
  const start = parseISODate(duesSemester(today).start);
  start.setDate(start.getDate() - 1);
  return duesSemester(toISODate(start));
}

export function inSemester(iso: string, semester: DuesSemester) {
  return iso >= semester.start && iso <= semester.end;
}

/** 공백·문장부호를 빼고 글자만 남겨 글리강은채 / 글리 강은채도 같은 이름으로 본다. */
function compactText(value: string) {
  return value.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function titleHasName(title: string, name: string) {
  const compactName = compactText(name);
  if (!compactName) return false;
  return compactText(title).includes(compactName);
}

function matchingNames(title: string, names: string[]) {
  const hits = names.filter((name) => titleHasName(title, name));
  return hits.filter((name) => {
    const compactName = compactText(name);
    return !hits.some((other) => other !== name && compactText(other).includes(compactName));
  });
}

function isDuesDeposit(row: Transaction) {
  return row.type === "입금" && row.amount > 0;
}

export function duesStatus(
  members: Member[],
  transactions: Transaction[],
  categories: string[],
  options: { today?: string; overrides?: DuesOverride[] } = {},
): { semester: DuesSemester; rows: DuesRow[] } {
  const semester = duesSemester(options.today ?? todayISO());
  const activeMembers = members.filter(isActive);
  const names = [...new Set(activeMembers.map((member) => member.name).filter(Boolean))];
  const byName = new Map<string, { amount: number; titles: string[] }>();
  const overrideByMember = new Map(
    (options.overrides ?? [])
      .filter((row) => row.semesterStart === semester.start)
      .map((row) => [row.memberId, row] as const),
  );

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

  const rows = sortMembersByCategory(activeMembers, categories).map((member) => {
    const match = byName.get(member.name);
    const paidAmount = match?.amount ?? 0;
    const autoPaid = paidAmount > 0;
    const override = overrideByMember.get(member.id);
    const paid = override ? override.paid : autoPaid;
    return {
      id: member.id,
      name: member.name,
      category: member.category,
      role: member.role,
      paid,
      autoPaid,
      paidAmount: paid ? paidAmount : 0,
      titles: match?.titles ?? [],
      manual: Boolean(override),
    };
  });

  return { semester, rows };
}
