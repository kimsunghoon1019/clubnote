"use client";

import { formatWon, todayISO } from "@/lib/format";
import { attendanceRate, latestPractice } from "@/lib/stats";
import { useClub } from "@/lib/store";

export function StatusBar() {
  const { attendance, transactions, events } = useClub();
  const today = todayISO();
  const featured = latestPractice(events, today);
  const rate = attendanceRate(attendance.filter((row) => featured && row.eventId === featured.id));
  const balance = transactions[transactions.length - 1]?.balanceAfter ?? 0;

  return (
    <footer className="sticky bottom-0 z-20 flex h-9 items-center justify-between border-t border-line-soft bg-white px-5 text-[12px] text-sub">
      <span>운영 유의사항</span>
      <span>
        오늘 출석 {rate.toFixed(1)}%
        <span className="mx-2 text-line">·</span>
        잔액 {formatWon(balance)}
        <span className="ml-2 text-faint">{today.replaceAll("-", ".")}</span>
      </span>
    </footer>
  );
}
