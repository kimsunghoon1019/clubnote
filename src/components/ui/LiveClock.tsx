"use client";

import { useEffect, useState } from "react";

export function LiveClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    let interval = 0;
    const timeout = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 1000);
    }, 1000 - (Date.now() % 1000));
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  if (!now) {
    return <div className={compact ? "h-[48px]" : "h-[52px]"} aria-hidden />;
  }

  const week = ["일", "월", "화", "수", "목", "금", "토"][now.getDay()];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const period = now.getHours() < 12 ? "오전" : "오후";
  const hour12 = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <div data-home-clock={compact ? "true" : undefined}>
      <p className={compact ? "text-compact-caption text-faint" : "text-[12px] text-faint"}>
        {y}.{m}.{d} ({week})
      </p>
      <p
        className={
          compact
            ? "mt-0.5 text-compact font-semibold tabular-nums tracking-tight"
            : "mt-0.5 text-[22px] font-semibold leading-7 tabular-nums tracking-tight"
        }
      >
        {period} {hour12}:{mm}:{ss}
      </p>
    </div>
  );
}
