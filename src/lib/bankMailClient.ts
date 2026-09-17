import type { ParsedBankTx } from "./bankExcel";
import {
  DEFAULT_BANK_MAIL_ADDRESS,
  type BankMailSettingsPublic,
  type BankMailSyncResult,
} from "./bankMailTypes";

export { DEFAULT_BANK_MAIL_ADDRESS, type BankMailSettingsPublic, type BankMailSyncResult };

const SETTINGS_KEY = "clubnote-bank-mail-v1";
const META_KEY = "clubnote-bank-mail-meta-v1";

export type LocalBankMail = {
  address: string;
  appPassword: string;
  excelPassword: string;
};

function emptyLocal(): LocalBankMail {
  return { address: DEFAULT_BANK_MAIL_ADDRESS, appPassword: "", excelPassword: "" };
}

export function loadLocalBankMail(): LocalBankMail {
  if (typeof window === "undefined") return emptyLocal();
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return emptyLocal();
    const data = JSON.parse(raw) as Partial<LocalBankMail>;
    return {
      address:
        typeof data.address === "string" && data.address.trim()
          ? data.address.trim()
          : DEFAULT_BANK_MAIL_ADDRESS,
      appPassword: typeof data.appPassword === "string" ? data.appPassword : "",
      excelPassword: typeof data.excelPassword === "string" ? data.excelPassword : "",
    };
  } catch {
    return emptyLocal();
  }
}

export function saveLocalBankMail(patch: Partial<LocalBankMail>): LocalBankMail {
  const current = loadLocalBankMail();
  const next: LocalBankMail = {
    address: (patch.address ?? current.address).trim() || DEFAULT_BANK_MAIL_ADDRESS,
    appPassword: patch.appPassword !== undefined ? patch.appPassword : current.appPassword,
    excelPassword: patch.excelPassword !== undefined ? patch.excelPassword : current.excelPassword,
  };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function loadBankMailMeta(): { lastSyncedAt: string; lastError: string } {
  if (typeof window === "undefined") return { lastSyncedAt: "", lastError: "" };
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return { lastSyncedAt: "", lastError: "" };
    const data = JSON.parse(raw) as { lastSyncedAt?: string; lastError?: string };
    return {
      lastSyncedAt: typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : "",
      lastError: typeof data.lastError === "string" ? data.lastError : "",
    };
  } catch {
    return { lastSyncedAt: "", lastError: "" };
  }
}

export function saveBankMailMeta(meta: { lastSyncedAt?: string; lastError?: string }) {
  const current = loadBankMailMeta();
  window.localStorage.setItem(
    META_KEY,
    JSON.stringify({
      lastSyncedAt: meta.lastSyncedAt ?? current.lastSyncedAt,
      lastError: meta.lastError ?? current.lastError,
    }),
  );
}

export async function fetchBankMailSettings(): Promise<BankMailSettingsPublic> {
  const local = loadLocalBankMail();
  const meta = loadBankMailMeta();
  const fallback: BankMailSettingsPublic = {
    address: local.address,
    hasAppPassword: Boolean(local.appPassword),
    hasExcelPassword: Boolean(local.excelPassword),
    lastSyncedAt: meta.lastSyncedAt,
    lastError: meta.lastError,
    storedOnServer: false,
  };
  try {
    const res = await fetch("/api/bank-mail/settings", { cache: "no-store" });
    if (!res.ok) return fallback;
    const data = (await res.json()) as Partial<BankMailSettingsPublic>;
    return {
      address: (typeof data.address === "string" && data.address.trim()) || local.address,
      hasAppPassword: Boolean(data.hasAppPassword) || Boolean(local.appPassword),
      hasExcelPassword: Boolean(data.hasExcelPassword) || Boolean(local.excelPassword),
      lastSyncedAt: (typeof data.lastSyncedAt === "string" && data.lastSyncedAt) || meta.lastSyncedAt,
      lastError: typeof data.lastError === "string" ? data.lastError : meta.lastError,
      storedOnServer: Boolean(data.storedOnServer),
    };
  } catch {
    return fallback;
  }
}

export async function saveBankMailSettings(input: {
  address: string;
  appPassword?: string;
  excelPassword?: string;
}): Promise<BankMailSettingsPublic> {
  saveLocalBankMail({
    address: input.address,
    ...(input.appPassword !== undefined ? { appPassword: input.appPassword } : {}),
    ...(input.excelPassword !== undefined ? { excelPassword: input.excelPassword } : {}),
  });
  const res = await fetch("/api/bank-mail/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return fetchBankMailSettings();
  return fetchBankMailSettings();
}

export async function syncBankMail(): Promise<BankMailSyncResult> {
  const local = loadLocalBankMail();
  const res = await fetch("/api/bank-mail/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address: local.address || undefined,
      appPassword: local.appPassword || undefined,
      excelPassword: local.excelPassword || undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<BankMailSyncResult> & { error?: string };
  const result: BankMailSyncResult = {
    ok: Boolean(data.ok) && res.ok,
    added: Number(data.added) || 0,
    scanned: Number(data.scanned) || 0,
    files: Number(data.files) || 0,
    lastSyncedAt: typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : "",
    error: typeof data.error === "string" && data.error ? data.error : res.ok ? undefined : "메일을 가져오지 못했어요",
    needsPassword: Boolean(data.needsPassword),
    rows: Array.isArray(data.rows) ? (data.rows as ParsedBankTx[]) : [],
  };
  saveBankMailMeta({ lastSyncedAt: result.lastSyncedAt, lastError: result.error || "" });
  return result;
}

export function bankMailReady(settings: Pick<BankMailSettingsPublic, "hasAppPassword" | "hasExcelPassword">) {
  return settings.hasAppPassword && settings.hasExcelPassword;
}
