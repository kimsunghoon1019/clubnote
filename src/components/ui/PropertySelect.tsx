"use client";

import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PropertySelect({
  value,
  options,
  onChange,
  children,
  className,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const field = children == null;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 140, maxHeight: 240 });

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = field ? rect.width : Math.max(140, rect.width);
    const row = 34;
    const estimated = Math.min(360, 8 + options.length * row);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < Math.min(estimated, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(360, openUp ? spaceAbove - 4 : spaceBelow - 4));
    const top = openUp ? Math.max(8, rect.top - Math.min(estimated, maxHeight) - 4) : rect.bottom + 4;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPos({ top, left, width, maxHeight });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, options.length, field]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
    };
    const onReposition = () => place();
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      const el = rootRef.current;
      if (!el) {
        setOpen(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const visible =
        rect.bottom > 40 &&
        rect.top < window.innerHeight - 40 &&
        rect.right > 8 &&
        rect.left < window.innerWidth - 8;
      if (!visible) {
        setOpen(false);
        return;
      }
      place();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, field]);

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "text-left",
          field &&
            "flex h-10 w-full items-center justify-between gap-1 rounded-btn border border-line bg-white px-3 text-[14px] text-ink hover:border-[#d1d6db]",
          field && open && "border-brand",
          className,
        )}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {children ?? (
          <>
            <span className="min-w-0 truncate">{value}</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-200", open && "rotate-180")}
            />
          </>
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-50 overflow-hidden rounded-card border border-line bg-white p-1 shadow-toast"
              style={{
                top: pos.top,
                left: pos.left,
                width: field ? pos.width : undefined,
                minWidth: pos.width,
                maxHeight: pos.maxHeight,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="overflow-auto overscroll-contain scrollbar-thin" style={{ maxHeight: pos.maxHeight - 8 }}>
                {options.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={item === value}
                    className={cn(
                      "flex w-full rounded-[10px] px-2.5 py-1.5 text-left text-[13px] hover:bg-muted",
                      item === value && "bg-brand-soft font-medium text-brand-text",
                    )}
                    onClick={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
