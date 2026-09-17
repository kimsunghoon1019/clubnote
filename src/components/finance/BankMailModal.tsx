"use client";

import { FieldLabel, TextInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  DEFAULT_BANK_MAIL_ADDRESS,
  fetchBankMailSettings,
  saveBankMailSettings,
  syncBankMail,
  type BankMailSettingsPublic,
} from "@/lib/bankMailClient";
import type { ParsedBankTx } from "@/lib/bankExcel";
import { useEffect, useState } from "react";

export function BankMailModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (rows: ParsedBankTx[]) => number;
}) {
  const [settings, setSettings] = useState<BankMailSettingsPublic | null>(null);
  const [address, setAddress] = useState(DEFAULT_BANK_MAIL_ADDRESS);
  const [appPassword, setAppPassword] = useState("");
  const [excelPassword, setExcelPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setError("");
    setAppPassword("");
    setExcelPassword("");
    void fetchBankMailSettings().then((next) => {
      setSettings(next);
      setAddress(next.address || DEFAULT_BANK_MAIL_ADDRESS);
      if (next.lastError) setError(next.lastError);
    });
  }, [open]);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const next = await saveBankMailSettings({
        address,
        ...(appPassword.trim() ? { appPassword: appPassword.trim() } : {}),
        ...(excelPassword.trim() ? { excelPassword: excelPassword.trim() } : {}),
      });
      setSettings(next);
      setAppPassword("");
      setExcelPassword("");
      setMessage(next.storedOnServer ? "연동 정보를 저장했어요" : "이 브라우저에 저장했어요. 배포 환경이면 R2에도 저장됩니다");
    } catch {
      setError("설정을 저장하지 못했어요");
    } finally {
      setSaving(false);
    }
  }

  async function pull() {
    setSyncing(true);
    setError("");
    setMessage("");
    try {
      const result = await syncBankMail();
      if (result.rows.length > 0) {
        const added = onImported(result.rows);
        setMessage(added === 0 ? "이미 있는 내역이에요. 새로 추가된 거래가 없어요" : `메일에서 ${added}건을 추가했어요`);
      } else if (result.error) {
        setError(result.error);
      } else {
        setMessage(result.files === 0 ? "새 거래내역 메일이 없어요" : "이미 있는 내역이에요. 새로 추가된 거래가 없어요");
      }
      const next = await fetchBankMailSettings();
      setSettings(next);
    } catch {
      setError("메일을 가져오지 못했어요");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Modal
      open={open}
      title="거래내역 메일 연동"
      onClose={onClose}
      width={440}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <GhostButton className="!h-touch lg:!h-9" type="button" onClick={onClose}>
            닫기
          </GhostButton>
          <GhostButton className="!h-touch lg:!h-9" type="submit" form="bank-mail-settings" disabled={saving || !address.trim()}>
            {saving ? "저장 중" : "저장"}
          </GhostButton>
          <PrimaryButton className="!h-touch lg:!h-9" type="button" disabled={syncing} onClick={() => void pull()}>
            {syncing ? "가져오는 중" : "지금 가져오기"}
          </PrimaryButton>
        </div>
      }
    >
      <p className="text-[14px] leading-6 text-ink">
        폰에서 토스뱅크 거래내역 보내기를 누르면{" "}
        <span className="font-medium">{address || DEFAULT_BANK_MAIL_ADDRESS}</span>로 엑셀이 옵니다. 저장된 비밀번호로 열고
        회계에 넣습니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] leading-5 text-sub">
        <li>
          지메일{" "}
          <a className="text-brand-text" href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank" rel="noreferrer">
            IMAP
          </a>
          을 켭니다
        </li>
        <li>
          2단계 인증 후{" "}
          <a className="text-brand-text" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
            앱 비밀번호
          </a>
          를 만듭니다
        </li>
        <li>토스 거래내역 엑셀 비밀번호를 저장합니다</li>
      </ol>

      <form
        id="bank-mail-settings"
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <FieldLabel>받을 지메일</FieldLabel>
          <TextInput
            type="email"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <FieldLabel hint={settings?.hasAppPassword ? "저장됨" : undefined}>지메일 앱 비밀번호</FieldLabel>
          <TextInput
            type="password"
            value={appPassword}
            onChange={(event) => setAppPassword(event.target.value)}
            placeholder={settings?.hasAppPassword ? "바꾸려면 다시 입력" : "16자리 앱 비밀번호"}
            autoComplete="off"
          />
        </div>
        <div>
          <FieldLabel hint={settings?.hasExcelPassword ? "저장됨" : undefined}>엑셀 비밀번호</FieldLabel>
          <TextInput
            type="password"
            value={excelPassword}
            onChange={(event) => setExcelPassword(event.target.value)}
            placeholder={settings?.hasExcelPassword ? "바꾸려면 다시 입력" : "거래내역 파일 암호"}
            autoComplete="off"
          />
        </div>
        {settings?.lastSyncedAt ? (
          <p className="text-[12px] text-faint">마지막 확인 {formatSyncedAt(settings.lastSyncedAt)}</p>
        ) : null}
        {message ? <p className="text-[13px] text-brand-text">{message}</p> : null}
        {error ? <p className="text-[13px] text-down">{error}</p> : null}
      </form>
    </Modal>
  );
}

function formatSyncedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
