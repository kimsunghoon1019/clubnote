import "server-only";

import { ImapFlow } from "imapflow";
import type { Readable } from "node:stream";
import { compareTxAsc, newBankRows, parseBankExcelBytes, type ParsedBankTx } from "./bankExcel";
import { DEFAULT_BANK_MAIL_ADDRESS, type BankMailSettingsPublic, type BankMailSyncResult } from "./bankMailTypes";
import { readClubState, remoteDbConfigured, writeClubState } from "./db/clubRepo";
import { persistableTransaction } from "./proof";
import { hasR2, readR2Key, writeR2Key } from "./r2";
import type { Transaction } from "./types";

const SECRETS_KEY = "secrets/bank-mail.json";
const GMAIL_SEARCH = "has:attachment (filename:xlsx OR filename:xls) newer_than:45d";
const MAX_FILE_BYTES = 8_000_000;
const MAX_MESSAGES = 40;
const MAX_PROCESSED = 400;

type StructureNode = {
  part?: string;
  type?: string;
  size?: number;
  parameters?: Record<string, string>;
  dispositionParameters?: Record<string, string>;
  childNodes?: StructureNode[];
};

export type BankMailSecrets = {
  address: string;
  appPassword: string;
  excelPassword: string;
  lastUid: number;
  lastSyncedAt: string;
  lastError: string;
  processedUids: number[];
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function emptySecrets(): BankMailSecrets {
  return {
    address: env("BANK_MAIL_ADDRESS") || DEFAULT_BANK_MAIL_ADDRESS,
    appPassword: env("BANK_MAIL_APP_PASSWORD"),
    excelPassword: env("BANK_EXCEL_PASSWORD"),
    lastUid: 0,
    lastSyncedAt: "",
    lastError: "",
    processedUids: [],
  };
}

function asSecrets(value: unknown): Partial<BankMailSecrets> {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return {
    address: typeof row.address === "string" ? row.address : undefined,
    appPassword: typeof row.appPassword === "string" ? row.appPassword : undefined,
    excelPassword: typeof row.excelPassword === "string" ? row.excelPassword : undefined,
    lastUid: typeof row.lastUid === "number" ? row.lastUid : undefined,
    lastSyncedAt: typeof row.lastSyncedAt === "string" ? row.lastSyncedAt : undefined,
    lastError: typeof row.lastError === "string" ? row.lastError : undefined,
    processedUids: Array.isArray(row.processedUids)
      ? row.processedUids.filter((item): item is number => typeof item === "number")
      : undefined,
  };
}

export async function loadBankMailSecrets(): Promise<{ secrets: BankMailSecrets; storedOnServer: boolean }> {
  const base = emptySecrets();
  if (!hasR2()) return { secrets: base, storedOnServer: false };
  try {
    const raw = await readR2Key(SECRETS_KEY);
    if (!raw) return { secrets: base, storedOnServer: false };
    const stored = asSecrets(JSON.parse(raw.toString("utf8")));
    return {
      storedOnServer: true,
      secrets: {
        address: stored.address?.trim() || base.address,
        appPassword: stored.appPassword || base.appPassword,
        excelPassword: stored.excelPassword || base.excelPassword,
        lastUid: stored.lastUid ?? 0,
        lastSyncedAt: stored.lastSyncedAt ?? "",
        lastError: stored.lastError ?? "",
        processedUids: stored.processedUids ?? [],
      },
    };
  } catch {
    return { secrets: base, storedOnServer: false };
  }
}

export async function saveBankMailSecrets(patch: Partial<BankMailSecrets>) {
  const { secrets } = await loadBankMailSecrets();
  const next: BankMailSecrets = {
    address: (patch.address ?? secrets.address).trim() || DEFAULT_BANK_MAIL_ADDRESS,
    appPassword: patch.appPassword !== undefined && patch.appPassword !== "" ? patch.appPassword : secrets.appPassword,
    excelPassword:
      patch.excelPassword !== undefined && patch.excelPassword !== "" ? patch.excelPassword : secrets.excelPassword,
    lastUid: patch.lastUid ?? secrets.lastUid,
    lastSyncedAt: patch.lastSyncedAt ?? secrets.lastSyncedAt,
    lastError: patch.lastError ?? secrets.lastError,
    processedUids: patch.processedUids ?? secrets.processedUids,
  };
  if (patch.appPassword === "") next.appPassword = "";
  if (patch.excelPassword === "") next.excelPassword = "";
  if (!hasR2()) return { secrets: next, storedOnServer: false };
  await writeR2Key(SECRETS_KEY, "application/json", Buffer.from(JSON.stringify(next), "utf8"));
  return { secrets: next, storedOnServer: true };
}

export function publicBankMailSettings(secrets: BankMailSecrets, storedOnServer: boolean): BankMailSettingsPublic {
  return {
    address: secrets.address || DEFAULT_BANK_MAIL_ADDRESS,
    hasAppPassword: Boolean(secrets.appPassword),
    hasExcelPassword: Boolean(secrets.excelPassword),
    lastSyncedAt: secrets.lastSyncedAt,
    lastError: secrets.lastError,
    storedOnServer,
  };
}

function isSpreadsheet(filename: string, mime: string) {
  const name = filename.replace(/\s+/g, "").toLowerCase();
  if (/\.(xlsx|xls|xlsm)$/i.test(filename)) return true;
  if (mime.includes("spreadsheet") || mime.includes("excel")) return true;
  if (name.includes("거래내역") || name.includes("토스") || name.includes("toss")) return true;
  return false;
}

function spreadsheetParts(node: StructureNode, acc: { part: string; filename: string; size: number }[] = []) {
  const filename =
    node.dispositionParameters?.filename ||
    node.parameters?.name ||
    node.parameters?.filename ||
    "";
  const mime = String(node.type || "").toLowerCase();
  if (node.part && isSpreadsheet(filename, mime)) {
    acc.push({ part: node.part, filename: filename || "토스뱅크_거래내역.xlsx", size: node.size ?? 0 });
  }
  for (const child of node.childNodes ?? []) spreadsheetParts(child, acc);
  return acc;
}

async function readStream(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("authentication") || lower.includes("invalid credentials") || lower.includes("login")) {
    return "지메일 앱 비밀번호가 맞지 않아요. IMAP과 앱 비밀번호를 확인해 주세요";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("enotfound")) {
    return "지메일에 연결하지 못했어요. 잠시 후 다시 시도해 주세요";
  }
  return message || "메일을 읽지 못했어요";
}

async function fetchMailboxAttachments(secrets: BankMailSecrets) {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: secrets.address, pass: secrets.appPassword },
    logger: false,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
    disableAutoIdle: true,
  });
  await client.connect();
  try {
    const boxes = await client.list();
    const all =
      boxes.find((box) => box.specialUse === "\\All") ||
      boxes.find((box) => /all mail|모든\s*메일/i.test(box.path));
    const mailbox = all?.path || "INBOX";
    const lock = await client.getMailboxLock(mailbox);
    try {
      let uids: number[] = [];
      try {
        uids = (await client.search({ gmraw: GMAIL_SEARCH }, { uid: true })) || [];
      } catch {
        const since = new Date(Date.now() - 45 * 24 * 3600 * 1000);
        uids = (await client.search({ since }, { uid: true })) || [];
      }
      const processed = new Set(secrets.processedUids);
      uids = uids
        .filter((uid) => uid > secrets.lastUid && !processed.has(uid))
        .sort((a, b) => a - b);
      if (uids.length > MAX_MESSAGES) uids = uids.slice(-MAX_MESSAGES);

      const files: { uid: number; name: string; bytes: Uint8Array }[] = [];
      const seenUids: number[] = [];
      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), { uid: true, bodyStructure: true }, { uid: true });
        if (!msg || !msg.bodyStructure) {
          seenUids.push(uid);
          continue;
        }
        const parts = spreadsheetParts(msg.bodyStructure as StructureNode);
        if (parts.length === 0) {
          seenUids.push(uid);
          continue;
        }
        for (const part of parts) {
          if (part.size > MAX_FILE_BYTES) continue;
          const downloaded = await client.download(String(uid), part.part, { uid: true });
          if (!downloaded.content) continue;
          const buf = await readStream(downloaded.content);
          if (buf.length === 0 || buf.length > MAX_FILE_BYTES) continue;
          const name = downloaded.meta?.filename || part.filename;
          files.push({ uid, name, bytes: new Uint8Array(buf) });
        }
        seenUids.push(uid);
      }
      return { files, seenUids };
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

function txId() {
  return `t-${Math.random().toString(36).slice(2, 8)}`;
}

async function applyRowsToClubState(incoming: ParsedBankTx[]) {
  if (!remoteDbConfigured() || incoming.length === 0) return 0;
  const current = await readClubState();
  if (!current) return 0;
  const fresh = newBankRows(current.payload.transactions, incoming);
  if (fresh.length === 0) return 0;
  const transactions: Transaction[] = [
    ...current.payload.transactions,
    ...fresh.map((row) => persistableTransaction({ ...row, id: txId(), category: "", proofs: [] })),
  ].sort(compareTxAsc);
  const result = await writeClubState({ ...current.payload, transactions }, current.version);
  if ("conflict" in result) {
    const again = newBankRows(result.conflict.payload.transactions, incoming);
    if (again.length === 0) return 0;
    const merged: Transaction[] = [
      ...result.conflict.payload.transactions,
      ...again.map((row) => persistableTransaction({ ...row, id: txId(), category: "", proofs: [] })),
    ].sort(compareTxAsc);
    const retried = await writeClubState({ ...result.conflict.payload, transactions: merged }, result.conflict.version);
    if ("conflict" in retried) return 0;
    return again.length;
  }
  return fresh.length;
}

export async function syncBankMailInbox(input: {
  address?: string;
  appPassword?: string;
  excelPassword?: string;
  apply?: boolean;
}): Promise<BankMailSyncResult> {
  const loaded = await loadBankMailSecrets();
  const secrets: BankMailSecrets = {
    ...loaded.secrets,
    address: input.address?.trim() || loaded.secrets.address,
    appPassword: input.appPassword || loaded.secrets.appPassword,
    excelPassword: input.excelPassword || loaded.secrets.excelPassword,
  };

  if (!secrets.address) {
    return emptyResult("받을 지메일 주소가 없어요");
  }
  if (!secrets.appPassword) {
    return emptyResult("지메일 앱 비밀번호를 먼저 저장해 주세요");
  }

  let files: { uid: number; name: string; bytes: Uint8Array }[] = [];
  let seenUids: number[] = [];
  try {
    const fetched = await fetchMailboxAttachments(secrets);
    files = fetched.files;
    seenUids = fetched.seenUids;
  } catch (error) {
    const message = authErrorMessage(error);
    await saveBankMailSecrets({ lastError: message, lastSyncedAt: new Date().toISOString() }).catch(() => undefined);
    return emptyResult(message);
  }

  if (files.length === 0) {
    const lastSyncedAt = new Date().toISOString();
    await saveBankMailSecrets({
      lastUid: seenUids.reduce((max, uid) => Math.max(max, uid), secrets.lastUid),
      processedUids: mergeUids(secrets.processedUids, seenUids),
      lastSyncedAt,
      lastError: "",
    }).catch(() => undefined);
    return { ok: true, added: 0, scanned: seenUids.length, files: 0, lastSyncedAt, rows: [] };
  }

  const rows: ParsedBankTx[] = [];
  let needsPassword = false;
  let parseError = "";
  const parsedUids: number[] = [];
  const blockedUids = new Set<number>();

  for (const file of files) {
    const parsed = await parseBankExcelBytes(file.bytes, file.name, secrets.excelPassword || undefined);
    if (parsed.needsPassword) {
      needsPassword = true;
      blockedUids.add(file.uid);
      parseError = "엑셀 비밀번호를 먼저 저장해 주세요";
      continue;
    }
    if (parsed.error) {
      blockedUids.add(file.uid);
      parseError = parsed.error;
      continue;
    }
    rows.push(...parsed.rows);
    parsedUids.push(file.uid);
  }

  const completedUids = seenUids.filter((uid) => !blockedUids.has(uid));
  const lastSyncedAt = new Date().toISOString();
  const lastError = blockedUids.size > 0 ? parseError : "";
  await saveBankMailSecrets({
    address: secrets.address,
    appPassword: secrets.appPassword,
    excelPassword: secrets.excelPassword,
    lastUid: completedUids.reduce((max, uid) => Math.max(max, uid), secrets.lastUid),
    processedUids: mergeUids(secrets.processedUids, completedUids),
    lastSyncedAt,
    lastError,
  }).catch(() => undefined);

  const unique = newBankRows([], rows);
  let added = unique.length;
  if (input.apply) {
    added = await applyRowsToClubState(unique);
  }

  return {
    ok: !lastError,
    added,
    scanned: seenUids.length,
    files: files.length,
    lastSyncedAt,
    error: lastError || undefined,
    needsPassword: needsPassword || undefined,
    rows: unique,
  };
}

function mergeUids(existing: number[], extra: number[]) {
  return [...new Set([...existing, ...extra])].sort((a, b) => a - b).slice(-MAX_PROCESSED);
}

function emptyResult(error: string): BankMailSyncResult {
  return {
    ok: false,
    added: 0,
    scanned: 0,
    files: 0,
    lastSyncedAt: "",
    error,
    rows: [],
  };
}

export function cronSecret() {
  return env("CRON_SECRET") || env("BANK_MAIL_CRON_SECRET");
}

export function isCronRequest(request: Request) {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secret = cronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return header === `Bearer ${secret}` || query === secret;
}
