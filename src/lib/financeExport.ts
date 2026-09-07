import { compareTxAsc, compareTxDesc } from "./bankExcel";
import { CLUB_NAME } from "./constants";
import { formatTxWhen, todayISO } from "./format";
import { txProofs } from "./proof";
import type { Transaction } from "./types";

export const LEDGER_HEADERS = [
  "거래일시",
  "거래유형",
  "거래기관",
  "계좌번호",
  "거래금액",
  "거래후잔액",
  "적요",
  "카테고리",
  "세부내역",
  "증빙",
] as const;

export function proofNumberById(rows: Transaction[]) {
  const map = new Map<string, number>();
  [...rows].sort(compareTxAsc).forEach((row, index) => {
    map.set(row.id, index + 1);
  });
  return map;
}

export function proofLabel(n: number) {
  return `증빙${n}`;
}

export function rowsWithProofs(rows: Transaction[]) {
  return [...rows].sort(compareTxAsc).filter((row) => txProofs(row).length > 0);
}

export function buildLedgerAoa(rows: Transaction[]) {
  const numbers = proofNumberById(rows);
  const body = [...rows].sort(compareTxDesc).map((row) => {
    const n = numbers.get(row.id) ?? 0;
    return [
      formatTxWhen(row.occurredOn, row.occurredAt),
      row.type,
      row.institution,
      row.accountMasked,
      row.amount,
      row.balanceAfter,
      row.title,
      row.category,
      row.memo || "",
      n ? proofLabel(n) : "",
    ];
  });
  return [[...LEDGER_HEADERS], ...body];
}

export function formatProofPeriodLine(start: string, end: string) {
  return `${formatDotLoose(start)} ~ ${formatDotLoose(end)}`;
}

export function periodDateBounds(rows: Transaction[], range: { start: string; end: string } | null) {
  if (range) return { start: range.start, end: range.end };
  if (rows.length === 0) {
    const today = todayISO();
    return { start: today, end: today };
  }
  const dates = rows.map((row) => row.occurredOn).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

export async function downloadLedgerXlsx(rows: Transaction[], period: string) {
  const XLSX = await import("xlsx");
  const aoa = buildLedgerAoa(rows);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 10 },
    { wch: 24 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "내역");
  XLSX.writeFile(wb, `${CLUB_NAME}_회계내역_${period}_${todayISO()}.xlsx`);
}

export function proofsDocFileName(period: string) {
  return `${CLUB_NAME}_증빙자료_${period}_${todayISO()}.docx`;
}

function formatDotLoose(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}. ${m}. ${d}.`;
}
