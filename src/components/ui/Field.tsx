import { cn } from "@/lib/cn";
import type { SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <label className="text-[12px] font-medium text-sub">{children}</label>
      {hint ? <span className="text-[11px] text-faint">{hint}</span> : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-touch w-full rounded-btn border border-line bg-white px-3 text-compact text-ink placeholder:text-faint touch-manipulation hover:border-[#d1d6db] focus:border-brand lg:h-10 lg:text-[14px]",
        props.className,
      )}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[88px] w-full resize-y rounded-btn border border-line bg-white px-3 py-2 text-compact text-ink placeholder:text-faint touch-manipulation focus:border-brand lg:text-[14px]",
        props.className,
      )}
    />
  );
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-touch w-full rounded-btn border border-line bg-white px-3 text-compact text-ink touch-manipulation focus:border-brand lg:h-10 lg:text-[14px]",
        props.className,
      )}
    />
  );
}
