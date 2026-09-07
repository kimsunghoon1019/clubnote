import { cn } from "@/lib/cn";

function roleStyle(role: string) {
  if (role === "회장" || role === "부회장") return "bg-brand-soft text-brand-text";
  if (role === "파트장") return "bg-[#FFF8E1] text-[#B78103]";
  if (role === "총무" || role === "스태프") return "bg-[#F2F4F6] text-sub";
  return "bg-transparent text-sub ring-1 ring-inset ring-line-soft";
}

export function Pill({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "brand" | "warn" | "muted" | "up";
  className?: string;
}) {
  const tones = {
    default: "bg-[#F2F4F6] text-sub",
    brand: "bg-brand-soft text-brand-text",
    warn: "bg-[#FFF8E1] text-[#B78103]",
    muted: "bg-transparent text-faint ring-1 ring-inset ring-line",
    up: "bg-[#FFF1F1] text-up",
  };
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-chip px-2 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RolePill({ role, className }: { role: string; className?: string }) {
  return (
    <span
      title={role}
      className={cn(
        "inline-flex h-[22px] max-w-full items-center justify-center overflow-hidden rounded-chip px-2 text-[11px] font-medium",
        roleStyle(role),
        className,
      )}
    >
      <span className="truncate">{role}</span>
    </span>
  );
}
