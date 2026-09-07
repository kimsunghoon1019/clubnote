"use client";

import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { AttendanceStatus } from "@/lib/types";

export function AttendanceToggle({
  value,
  name,
  onChange,
  fill = false,
}: {
  value?: AttendanceStatus;
  name: string;
  onChange: (status: AttendanceStatus | null) => void;
  fill?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`${name} 출결`}
      className={cn(
        "overflow-hidden rounded-[10px] border border-line bg-white",
        fill ? "flex h-touch w-full max-w-[420px]" : "inline-flex h-8",
      )}
    >
      {ATTENDANCE_STATUSES.map((status, index) => {
        const meta = ATTENDANCE_STATUS_META[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={status}
            onClick={() => onChange(active ? null : status)}
            className={cn(
              "flex flex-col items-center justify-center font-semibold transition-colors",
              fill
                ? "h-touch min-w-0 flex-1 text-[11px] leading-[13px] touch-manipulation"
                : "h-8 w-[3.35rem] text-[10px] leading-[11px]",
              index > 0 && "border-l border-line",
              !active && "text-faint hover:bg-muted",
            )}
            style={
              active
                ? { backgroundColor: meta.color, color: "#fff" }
                : { backgroundColor: "transparent" }
            }
          >
            {meta.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </button>
        );
      })}
    </div>
  );
}

export function StatusMixBar({
  counts,
  unchecked = 0,
}: {
  counts: Record<AttendanceStatus, number>;
  unchecked?: number;
}) {
  const parts = [
    ...ATTENDANCE_STATUSES.map((status) => ({
      key: status,
      n: counts[status],
      color: ATTENDANCE_STATUS_META[status].color,
    })),
    { key: "미체크", n: unchecked, color: "#E5E8EB" },
  ];
  const total = parts.reduce((sum, part) => sum + part.n, 0);

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[#F2F4F6]" role="img" aria-label="분류별 출석 구성">
      {total === 0
        ? null
        : parts
            .filter((part) => part.n > 0)
            .map((part) => (
              <div
                key={part.key}
                className="h-full"
                style={{ width: `${(part.n / total) * 100}%`, background: part.color }}
              />
            ))}
    </div>
  );
}
