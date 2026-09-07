"use client";

import { DetailSurface } from "@/components/layout/DetailSurface";
import type { ReactNode } from "react";

export function RightRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DetailSurface open={false} className={className}>
      {children}
    </DetailSurface>
  );
}

export function RailSection({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      {title ? (
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
