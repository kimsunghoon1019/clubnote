import { cn } from "@/lib/cn";

export function FilterChip({
  active,
  children,
  onClick,
  plus,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  plus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-chip px-3 text-[13px] transition-colors",
        plus && "px-2.5",
        active
          ? "bg-brand-soft font-semibold text-brand-text"
          : "bg-transparent text-sub hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
