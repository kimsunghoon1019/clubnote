import { cn } from "@/lib/cn";

export function RatioBar({
  value,
  max = 100,
  color = "var(--up)",
  width = 72,
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  width?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn("h-[4px] overflow-hidden rounded-full bg-[#F2F4F6]", className)}
      style={{ width }}
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
