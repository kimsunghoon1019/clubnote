import { cn } from "@/lib/cn";

export function GhostButton({
  children,
  className,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
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
