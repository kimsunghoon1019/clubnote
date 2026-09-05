"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PropertySelect({
  value,
  options,
  onChange,
  children,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const el = rootRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        className="text-left"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {children}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 min-w-[140px] rounded-card border border-line bg-white py-1"
              style={{ top: pos.top, left: pos.left }}
            >
              {options.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-muted",
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
