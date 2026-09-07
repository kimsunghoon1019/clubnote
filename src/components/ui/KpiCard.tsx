import { cn } from "@/lib/cn";
import { Sparkline } from "./Sparkline";

export function KpiCard({
  label,
  value,
  delta,
  deltaUp,
  caption,
  spark,
  sparkColor = "auto",
  hrefLabel,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  caption?: string;
  spark?: number[];
  sparkColor?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="min-w-0 px-3 py-3">
      <p className="text-[12px] text-sub">{label}</p>
      <p className="mt-1 text-compact-title font-semibold leading-7 text-ink lg:text-[18px] lg:leading-6">{value}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        {delta ? (
          <p className={cn("text-[12px] font-medium", deltaUp ? "text-up" : "text-down")}>{delta}</p>
        ) : caption ? (
          <p className="truncate text-[12px] text-faint">{caption}</p>
        ) : hrefLabel ? (
          <p className="text-[12px] text-brand-text">{hrefLabel}</p>
        ) : (
          <span />
        )}
        {spark ? (
          <span className="hidden xl:inline-flex">
            <Sparkline data={spark} color={sparkColor} width={72} height={28} fill />
          </span>
        ) : null}
      </div>
    </div>
  );
}
