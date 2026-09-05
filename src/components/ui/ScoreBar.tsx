import { formatRatio } from "@/lib/format";
import { RatioBar } from "./RatioBar";

export function ScoreBar({
  label,
  value,
  color = "var(--up)",
}: {
  label?: string;
  value: number;
  color?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {label ? <span className="text-[12px] text-sub">{label}</span> : null}
      <span className="w-9 tabular-nums font-medium text-up">{formatRatio(value)}</span>
      <RatioBar value={value * 100} color={color} />
    </span>
  );
}
