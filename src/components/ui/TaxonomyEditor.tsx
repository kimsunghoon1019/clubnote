"use client";

import { cn } from "@/lib/cn";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function TaxonomyEditor({
  label,
  items,
  onAdd,
  onRemove,
  variant = "header",
}: {
  label: string;
  items: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  variant?: "header" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          variant === "button" &&
            "h-8 rounded-btn border border-line px-2.5 text-[13px] hover:bg-muted",
          variant === "header" && "text-[13px] text-faint hover:text-ink",
          open && variant === "header" && "text-brand-text",
          open && variant === "button" && "border-brand bg-brand-soft text-brand-text",
        )}
      >
        {label}
        <span className="text-[10px]">▾</span>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 w-56 rounded-card border border-line bg-white p-2"
              style={{ top: pos.top, left: pos.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="px-1 pb-1 text-[11px] text-faint">항목을 추가하거나 지울 수 있어요</p>
              <ul className="max-h-52 overflow-auto">
                {items.map((item) => (
                  <li key={item} className="flex items-center justify-between rounded-btn px-2 py-1.5 hover:bg-muted">
                    <span className="text-[13px] text-ink">{item}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-faint hover:text-up disabled:opacity-30"
                      aria-label={`${item} 삭제`}
                      disabled={items.length <= 1}
                      onClick={() => onRemove(item)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="mt-1 flex items-center gap-1 border-t border-line-soft pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  onAdd(draft.trim());
                  setDraft("");
                }}
              >
                <Plus className="h-3.5 w-3.5 text-faint" />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="항목 추가"
                  className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
                />
              </form>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
