import type { Transaction, TxType } from "./types";

export type ParsedBankTx = Omit<Transaction, "id" | "category" | "proofName">;

const DATE_HEADERS = ["거래일시", "거래일자", "거래일", "일자", "날짜", "일시"];
const TYPE_HEADERS = ["거래유형", "거래구분", "구분", "유형"];
const TITLE_HEADERS = ["적요", "내용", "거래내용", "적요내용", "상대방", "보낸분/받는분", "보낸분", "받는분"];
const AMOUNT_HEADERS = ["거래금액", "금액", "거래액"];
const DEPOSIT_HEADERS = ["입금", "입금액", "맡기신금액", "입금금액"];
const WITHDRAW_HEADERS = ["출금", "출금액", "찾으신금액", "출금금액"];
const BALANCE_HEADERS = ["거래후잔액", "거래 후 잔액", "거래후 잔액", "잔액", "잔액(원)"];
const INSTITUTION_HEADERS = ["거래기관", "금융기관", "은행", "취급점", "거래점", "상대은행"];
const ACCOUNT_HEADERS = ["계좌번호", "계좌", "계좌 번호"];
const MEMO_HEADERS = ["메모", "비고", "기재내용", "거래메모", "거래 메모"];

function normHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[()]/g, "")
    .trim();
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  const wanted = aliases.map(normHeader);
  return headers.findIndex((h) => wanted.includes(normHeader(h)));
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return "";
  return String(value).trim();
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parenNeg = /^\(.*\)$/.test(trimmed);
    const cleaned = trimmed.replace(/[^\d.-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    const signed = parenNeg || trimmed.startsWith("-") ? -Math.abs(n) : n;
    return Math.round(signed);
  }
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fromUtcParts(date: Date): { occurredOn: string; occurredAt?: string } | null {
  if (Number.isNaN(date.getTime())) return null;
  const occurredOn = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  const s = date.getUTCSeconds();
  if (h || m || s) {
    return { occurredOn, occurredAt: `${occurredOn}T${pad2(h)}:${pad2(m)}:${pad2(s)}` };
  }
  return { occurredOn };
}

/** Excel 1900 date system: serial 1 = 1899-12-31, with the fake 1900-02-29 leap day. */
function fromExcelSerial(serial: number): { occurredOn: string; occurredAt?: string } | null {
  if (!Number.isFinite(serial) || serial < 20000) return null;
  const totalSeconds = Math.round(serial * 86400);
  const date = new Date(Date.UTC(1899, 11, 30) + totalSeconds * 1000);
  return fromUtcParts(date);
}

export function parseOccurred(value: unknown): { occurredOn: string; occurredAt?: string } | null {
  if (typeof value === "number" && Number.isFinite(value)) return fromExcelSerial(value);
  if (value instanceof Date) return fromExcelSerial(value.getTime() / 86400000 + 25569);
  const raw = cellText(value).replace(/\./g, "-").replace(/\//g, "-");
  if (!raw) return null;
  const match = raw.match(
    /(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) return null;
  const occurredOn = `${match[1]}-${pad2(Number(match[2]))}-${pad2(Number(match[3]))}`;
  if (match[4] != null) {
    const occurredAt = `${occurredOn}T${pad2(Number(match[4]))}:${pad2(Number(match[5]))}:${pad2(Number(match[6] ?? 0))}`;
    return { occurredOn, occurredAt };
  }
  return { occurredOn };
}

function mapType(raw: string, amount: number): TxType {
  const t = raw.replace(/\s+/g, "");
  if (t.includes("이체")) return "이체";
  if (t.includes("입금") || t.includes("이자")) return "입금";
  if (t.includes("출금") || t.includes("결제") || t.includes("송금") || t.includes("이체출금")) return "출금";
  return amount >= 0 ? "입금" : "출금";
}

function guessInstitution(fileName: string): string {
  const n = fileName.replace(/\s+/g, "").toLowerCase();
  if (n.includes("토스") || n.includes("toss")) return "토스뱅크";
  if (n.includes("케이뱅크") || n.includes("kbank") || n.includes("k뱅크")) return "케이뱅크";
  if (n.includes("카카오") || n.includes("kakao")) return "카카오뱅크";
  if (n.includes("신한")) return "신한";
  if (n.includes("국민") || n.includes("kb")) return "KB국민";
  if (n.includes("우리")) return "우리";
  if (n.includes("하나")) return "하나";
  return "";
}

function maskAccount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.includes("*")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return trimmed;
  return `${digits.slice(0, 4)}-****-${digits.slice(-4)}`;
}

function headerAccount(rows: unknown[][]): string {
  for (const row of rows.slice(0, 12)) {
    const line = row.map(cellText).join(" ");
    const m = line.match(/계좌번호\s*[:：]?\s*([0-9*-]+)/);
    if (m) return maskAccount(m[1]);
  }
  return "";
}

function looksEncrypted(buffer: ArrayBuffer): boolean {
  const u = new Uint8Array(buffer);
  if (u.length < 8) return false;
  const ole = u[0] === 0xd0 && u[1] === 0xcf && u[2] === 0x11 && u[3] === 0xe0;
  if (!ole) return false;
  const head = new TextDecoder("utf-16le").decode(u.slice(0, Math.min(u.length, 16384)));
  return head.includes("EncryptedPackage") || head.includes("EncryptionInfo");
}

function pickSheetRows(sheets: { name: string; rows: unknown[][] }[]): unknown[][] {
  let best: unknown[][] = [];
  let bestScore = -1;
  for (const sheet of sheets) {
    for (let i = 0; i < sheet.rows.length; i += 1) {
      const headers = sheet.rows[i].map(cellText);
      const score =
        Number(findHeaderIndex(headers, DATE_HEADERS) >= 0) +
        Number(findHeaderIndex(headers, TITLE_HEADERS) >= 0) +
        Number(findHeaderIndex(headers, AMOUNT_HEADERS) >= 0 || findHeaderIndex(headers, DEPOSIT_HEADERS) >= 0) +
        Number(findHeaderIndex(headers, TYPE_HEADERS) >= 0) +
        Number(findHeaderIndex(headers, BALANCE_HEADERS) >= 0);
      if (score > bestScore) {
        bestScore = score;
        best = sheet.rows;
      }
    }
  }
  return best;
}

export function txFingerprint(row: Pick<Transaction, "occurredOn" | "amount" | "title" | "balanceAfter">): string {
  const title = row.title.replace(/\s+/g, " ").trim();
  return `${row.occurredOn}|${row.amount}|${title}|${row.balanceAfter}`;
}

export function compareTxDesc(a: Transaction, b: Transaction): number {
  const ta = a.occurredAt || a.occurredOn;
  const tb = b.occurredAt || b.occurredOn;
  const byTime = tb.localeCompare(ta);
  if (byTime !== 0) return byTime;
  return b.balanceAfter - a.balanceAfter;
}

export function compareTxAsc(a: Transaction, b: Transaction): number {
  return compareTxDesc(b, a);
}

export function latestTransaction(rows: Transaction[]): Transaction | undefined {
  if (rows.length === 0) return undefined;
  return [...rows].sort(compareTxDesc)[0];
}

export function parseBankWorkbook(
  sheets: { name: string; rows: unknown[][] }[],
  fileName: string,
): { rows: ParsedBankTx[]; error?: string } {
  const table = pickSheetRows(sheets);
  if (table.length === 0) return { rows: [], error: "엑셀에서 시트를 읽지 못했어요" };

  let headerAt = -1;
  let mapped: {
    date: number;
    type: number;
    title: number;
    amount: number;
    deposit: number;
    withdraw: number;
    balance: number;
    institution: number;
    account: number;
    memo: number;
  } | null = null;

  for (let i = 0; i < table.length; i += 1) {
    const headers = table[i].map(cellText);
    const date = findHeaderIndex(headers, DATE_HEADERS);
    const title = findHeaderIndex(headers, TITLE_HEADERS);
    const amount = findHeaderIndex(headers, AMOUNT_HEADERS);
    const deposit = findHeaderIndex(headers, DEPOSIT_HEADERS);
    const withdraw = findHeaderIndex(headers, WITHDRAW_HEADERS);
    const hasMoney = amount >= 0 || deposit >= 0 || withdraw >= 0;
    if (date >= 0 && hasMoney && (title >= 0 || findHeaderIndex(headers, MEMO_HEADERS) >= 0)) {
      headerAt = i;
      mapped = {
        date,
        type: findHeaderIndex(headers, TYPE_HEADERS),
        title,
        amount,
        deposit,
        withdraw,
        balance: findHeaderIndex(headers, BALANCE_HEADERS),
        institution: findHeaderIndex(headers, INSTITUTION_HEADERS),
        account: findHeaderIndex(headers, ACCOUNT_HEADERS),
        memo: findHeaderIndex(headers, MEMO_HEADERS),
      };
      break;
    }
  }

  if (headerAt < 0 || !mapped) {
    return { rows: [], error: "거래일시·금액 열이 있는 거래내역 시트를 찾지 못했어요" };
  }

  const fallbackInstitution = guessInstitution(fileName);
  const fallbackAccount = headerAccount(table);
  const parsed: ParsedBankTx[] = [];

  for (const row of table.slice(headerAt + 1)) {
    const occurred = parseOccurred(row[mapped.date]);
    if (!occurred) continue;

    let amount: number | null = mapped.amount >= 0 ? parseAmount(row[mapped.amount]) : null;
    if (amount == null && mapped.deposit >= 0) {
      const deposit = parseAmount(row[mapped.deposit]);
      if (deposit && deposit !== 0) amount = Math.abs(deposit);
    }
    if ((amount == null || amount === 0) && mapped.withdraw >= 0) {
      const withdraw = parseAmount(row[mapped.withdraw]);
      if (withdraw && withdraw !== 0) amount = -Math.abs(withdraw);
    }
    if (amount == null) continue;

    const typeRaw = mapped.type >= 0 ? cellText(row[mapped.type]) : "";
    const type = mapType(typeRaw, amount);
    if (type === "출금" && amount > 0) amount = -amount;
    if (type === "입금" && amount < 0) amount = Math.abs(amount);

    const title = (mapped.title >= 0 ? cellText(row[mapped.title]) : "") || (mapped.memo >= 0 ? cellText(row[mapped.memo]) : "");
    if (!title) continue;

    const balanceAfter = mapped.balance >= 0 ? parseAmount(row[mapped.balance]) : 0;
    const institution = (mapped.institution >= 0 ? cellText(row[mapped.institution]) : "") || fallbackInstitution || "토스뱅크";
    const accountMasked = maskAccount((mapped.account >= 0 ? cellText(row[mapped.account]) : "") || fallbackAccount);
    const memo = mapped.memo >= 0 ? cellText(row[mapped.memo]) : "";

    parsed.push({
      occurredOn: occurred.occurredOn,
      occurredAt: occurred.occurredAt,
      title,
      type,
      institution,
      accountMasked,
      amount,
      balanceAfter: balanceAfter ?? 0,
      memo,
    });
  }

  if (parsed.length === 0) {
    return { rows: [], error: "엑셀에서 거래 행을 찾지 못했어요" };
  }

  return { rows: parsed };
}

export async function parseBankExcelFile(file: File): Promise<{ rows: ParsedBankTx[]; error?: string }> {
  const buffer = await file.arrayBuffer();
  if (looksEncrypted(buffer)) {
    return {
      rows: [],
      error: "암호가 걸린 엑셀이에요. 엑셀에서 암호를 해제한 뒤 다시 올려 주세요",
    };
  }

  const XLSX = await import("xlsx");
  let workbook: import("xlsx").WorkBook;
  try {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
      const text = new TextDecoder("utf-8").decode(buffer);
      workbook = XLSX.read(text, { type: "string", raw: true, FS: lower.endsWith(".tsv") ? "\t" : "," });
    } else {
      workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false, raw: true });
    }
  } catch {
    if (looksEncrypted(buffer)) {
      return { rows: [], error: "암호가 걸린 엑셀이에요. 엑셀에서 암호를 해제한 뒤 다시 올려 주세요" };
    }
    return { rows: [], error: "엑셀 파일을 읽지 못했어요" };
  }

  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: "" }) as unknown[][],
  }));

  return parseBankWorkbook(sheets, file.name);
}

export function newBankRows(existing: Transaction[], incoming: ParsedBankTx[]): ParsedBankTx[] {
  const seen = new Set(existing.map(txFingerprint));
  const fresh: ParsedBankTx[] = [];
  for (const row of incoming) {
    const key = txFingerprint(row);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(row);
  }
  return fresh;
}
