"use client";

import { cn } from "@/lib/cn";
import type { PracticeDay } from "@/lib/types";
import { Cell, Pie, PieChart } from "recharts";

export const PIE_COLORS = ["#3182F6", "#1B64DA", "#8B95A1", "#4E5968", "#F04452", "#FFB800"];
export const STAFF_CATEGORIES = new Set(["지휘자", "반주자"]);
export const PRACTICE_PIE_DAYS: { day: PracticeDay; title: string }[] = [
  { day: "화", title: "화요일 연습 파트별 참여인원" },
  { day: "목", title: "목요일 연습 파트별 참여인원" },
  { day: "토", title: "토요일 연습 파트별 참여인원" },
];

export type CategoryCount = { name: string; count: number };

export function CategoryPie({
  counts,
  total,
  stacked = false,
}: {
  counts: CategoryCount[];
  total: number;
  stacked?: boolean;
}) {
  const slices = counts.filter((item) => item.count > 0);
  return (
    <div className={cn("flex items-center gap-3", stacked && "flex-col items-start gap-2")}>
      <PieChart width={88} height={88}>
        <Pie
          data={slices}
          dataKey="count"
          innerRadius={26}
          outerRadius={40}
          paddingAngle={1.5}
          stroke="none"
          isAnimationActive={false}
          cx="50%"
          cy="50%"
        >
          {slices.map((entry) => {
            const i = counts.findIndex((item) => item.name === entry.name);
            return <Cell key={entry.name} fill={PIE_COLORS[Math.max(0, i) % PIE_COLORS.length]} />;
          })}
        </Pie>
      </PieChart>
      <ul className="min-w-0 space-y-1">
        {counts.map((item, i) => (
          <li key={item.name} className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-sub">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink">
              {total ? Math.round((item.count / total) * 100) : 0}% {item.count}명
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
