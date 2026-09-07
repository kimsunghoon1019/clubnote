import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function RightRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside
      className={cn(
        "hidden w-[300px] shrink-0 overflow-auto border-l border-line-soft bg-white scrollbar-thin lg:block min-h-0",
        className,
      )}
    >
      <div className="px-4 py-4">{children}</div>
    </aside>
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
