import { cn } from "@/lib/cn";

export function GhostButton({
  children,
  className,
  disabled,
  onClick,
  type = "button",
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  "aria-label"?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-btn border border-line bg-white px-3.5 text-[13px] font-semibold text-ink hover:bg-muted disabled:cursor-not-allowed disabled:text-faint",
        className,
      )}
    >
      {children}
    </button>
  );
}
