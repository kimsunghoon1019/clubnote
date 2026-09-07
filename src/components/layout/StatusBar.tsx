"use client";

import { latestTransaction } from "@/lib/bankExcel";
import { formatWon, todayISO } from "@/lib/format";
import { latestPractice, membersForEvent, rosterAttendanceRate } from "@/lib/stats";
import { useClub } from "@/lib/store";

export function StatusBar() {
  const { attendance, transactions, events, members, remoteDb, persistStatus } = useClub();
  const today = todayISO();
  const featured = latestPractice(events, today);
  const roster = featured ? membersForEvent(members, featured) : [];
  const rate = rosterAttendanceRate(
    roster,
    attendance.filter((row) => featured && row.eventId === featured.id),
  );
  const balance = latestTransaction(transactions)?.balanceAfter ?? 0;

  const saveLabel = !remoteDb
    ? "이 브라우저에 저장"
    : persistStatus === "saving" || persistStatus === "pending"
      ? "저장 중"
      : persistStatus === "error"
        ? "저장 실패 · 다시 시도 중"
        : persistStatus === "saved"
          ? "저장됨"
          : "서버와 동기화";

  return (
    <footer className="sticky bottom-0 z-20 flex h-9 items-center justify-between border-t border-line-soft bg-white px-5 text-[12px] text-sub">
      <span>{saveLabel}</span>
      <span>
        오늘 출석 {rate.toFixed(1)}%
        <span className="mx-2 text-line">·</span>
        잔액 {formatWon(balance)}
        <span className="ml-2 text-faint">{today.replaceAll("-", ".")}</span>
      </span>
    </footer>
  );
}
