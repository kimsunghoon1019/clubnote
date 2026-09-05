import { cn } from "@/lib/cn";

export function PrimaryButton({
  children,
  className,
  disabled,
  type = "button",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-btn bg-brand px-3.5 text-[13px] font-semibold text-white transition-opacity",
        "hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#D1D6DB] disabled:opacity-100",
        className,
      )}
    >
      {children}
    </button>
  );
}
