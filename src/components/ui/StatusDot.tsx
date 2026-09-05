import { ATTENDANCE_STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { AttendanceStatus } from "@/lib/types";

export const STATUS_COLOR: Record<AttendanceStatus, string> = {
  출석: ATTENDANCE_STATUS_META.출석.color,
  미통보지각: ATTENDANCE_STATUS_META.미통보지각.color,
  통보지각: ATTENDANCE_STATUS_META.통보지각.color,
  통보결석: ATTENDANCE_STATUS_META.통보결석.color,
  미통보결석: ATTENDANCE_STATUS_META.미통보결석.color,
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
