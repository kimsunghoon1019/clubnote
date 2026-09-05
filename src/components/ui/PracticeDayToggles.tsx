"use client";

import { cn } from "@/lib/cn";
import { PRACTICE_DAYS } from "@/lib/constants";
import { togglePracticeDay } from "@/lib/stats";
import type { PracticeDay } from "@/lib/types";

export function PracticeDayToggles({
  value,
  onChange,
  size = "md",
}: {
  value: PracticeDay[];
  onChange: (next: PracticeDay[]) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-[6px] border border-line",
        size === "sm" ? "h-6" : "h-7",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {PRACTICE_DAYS.map((day, index) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(togglePracticeDay(value, day))}
            className={cn(
              "font-medium transition-colors",
              index > 0 && "border-l border-line",
              size === "sm" ? "min-w-[22px] px-1.5 text-[11px]" : "min-w-[26px] px-2 text-[12px]",
              on ? "bg-brand text-white" : "bg-white text-faint hover:bg-muted hover:text-sub",
            )}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}
