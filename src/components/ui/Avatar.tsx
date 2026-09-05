import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const PALETTE = [
  { bg: "#E8F3FF", fg: "#1B64DA" },
  { bg: "#F2F4F6", fg: "#4E5968" },
  { bg: "#FFF1F1", fg: "#F04452" },
  { bg: "#FFF8E1", fg: "#B78103" },
  { bg: "#EEF2F6", fg: "#191F28" },
];

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const palette = PALETTE[name.charCodeAt(0) % PALETTE.length];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
      )}
      style={{
        width: size,
        height: size,
        background: palette.bg,
        color: palette.fg,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
