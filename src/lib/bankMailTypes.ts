import type { ParsedBankTx } from "./bankExcel";

export const DEFAULT_BANK_MAIL_ADDRESS = "yonseigleeclub@gmail.com";

export type BankMailSettingsPublic = {
  address: string;
  hasAppPassword: boolean;
  hasExcelPassword: boolean;
  lastSyncedAt: string;
  lastError: string;
  storedOnServer: boolean;
};

export type BankMailSyncResult = {
  ok: boolean;
  added: number;
  scanned: number;
  files: number;
  lastSyncedAt: string;
  error?: string;
  needsPassword?: boolean;
  rows: ParsedBankTx[];
};
