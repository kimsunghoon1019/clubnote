import { cn } from "@/lib/cn";
import type { AttendanceStatus } from "@/lib/types";

export const STATUS_COLOR: Record<AttendanceStatus, string> = {
  출석: "var(--up)",
  결석: "var(--down)",
  지각: "var(--warn)",
  공결: "var(--text-sub)",
};

export function StatusDot({ status, className }: { status: AttendanceStatus; className?: string }) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full", className)}
      style={{ background: STATUS_COLOR[status] }}
      aria-hidden
    />
  );
}

export function StatusText({ status }: { status: AttendanceStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: STATUS_COLOR[status] }}>
      <StatusDot status={status} />
      {status}
    </span>
  );
}
