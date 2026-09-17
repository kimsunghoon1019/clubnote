"use client";

import { bankMailReady, fetchBankMailSettings, syncBankMail } from "@/lib/bankMailClient";
import { useClub } from "@/lib/store";
import { useEffect, useRef } from "react";

const MIN_GAP_MS = 90_000;

export function BankMailSync() {
  const { importBankTransactions, toast, sessionMemberId } = useClub();
  const importRef = useRef(importBankTransactions);
  const toastRef = useRef(toast);
  importRef.current = importBankTransactions;
  toastRef.current = toast;

  useEffect(() => {
    if (!sessionMemberId) return;
    let cancelled = false;
    let lastAt = 0;
    let inFlight = false;

    const run = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastAt < MIN_GAP_MS) return;
      inFlight = true;
      try {
        const settings = await fetchBankMailSettings();
        if (cancelled || !bankMailReady(settings)) return;
        if (/앱 비밀번호|엑셀 비밀번호|비밀번호가 맞지/.test(settings.lastError)) return;
        lastAt = Date.now();
        const result = await syncBankMail();
        if (cancelled || result.rows.length === 0) return;
        const added = importRef.current(result.rows);
        if (added > 0) toastRef.current(`메일에서 거래 ${added}건을 추가했어요`);
      } catch {
        /* keep the console quiet; 설정 모달에 마지막 오류가 남습니다 */
      } finally {
        inFlight = false;
      }
    };

    void run();
    const timer = window.setInterval(() => void run(), MIN_GAP_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [sessionMemberId]);

  return null;
}
