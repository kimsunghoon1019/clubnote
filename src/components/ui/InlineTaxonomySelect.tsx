"use client";

import { cn } from "@/lib/cn";
import { Check, Plus, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TAG_PALETTE = [
  { bg: "#E8F3FF", fg: "#1B64DA" },
  { bg: "#F2F4F6", fg: "#4E5968" },
  { bg: "#FFF8E1", fg: "#B78103" },
  { bg: "#FFF1F1", fg: "#D92D20" },
  { bg: "#E7F8F0", fg: "#087443" },
  { bg: "#F3E8FF", fg: "#6927DA" },
  { bg: "#E6F6F6", fg: "#0F766E" },
  { bg: "#FFF3E8", fg: "#C2410C" },
] as const;

const FIXED_TAG_COLOR: Record<string, (typeof TAG_PALETTE)[number]> = {
  정기연습: TAG_PALETTE[0],
  연습: TAG_PALETTE[1],
  공연: TAG_PALETTE[3],
  회식: TAG_PALETTE[2],
  오디션: TAG_PALETTE[0],
  회의: TAG_PALETTE[1],
  "학생회관 404호": TAG_PALETTE[0],
  "학생회관 301호": TAG_PALETTE[4],
};

export function tagColor(name: string) {
  if (FIXED_TAG_COLOR[name]) return FIXED_TAG_COLOR[name];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

export function InlineTaxonomySelect({
  value,
  items,
  onChange,
  onAdd,
  onRemove,
  placeholder = "선택",
  addLabel,
}: {
  value: string;
  items: string[];
  onChange: (value: string) => void;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  placeholder?: string;
  addLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });

  const query = draft.trim();
  const filtered = query ? items.filter((item) => item.toLowerCase().includes(query.toLowerCase())) : items;
  const canCreate = Boolean(query) && !items.some((item) => item.toLowerCase() === query.toLowerCase());
  const selectedColor = value ? tagColor(value) : null;

  const placeMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
    const estimated = Math.min(360, 52 + items.length * 36 + 48);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const top =
      spaceBelow < Math.min(estimated, 180)
        ? Math.max(8, rect.top - Math.min(estimated, rect.top - 8) - 6)
        : rect.bottom + 6;
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setPos({ top, left: Math.max(8, left), width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setDraft("");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      setDraft("");
    };
    const onReposition = () => placeMenu();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const createAndSelect = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    onChange(trimmed);
    setDraft("");
    setOpen(false);
  };

  const removeItem = (name: string) => {
    if (items.length <= 1) return;
    onRemove(name);
    if (value === name) {
      const next = items.find((item) => item !== name);
      if (next) onChange(next);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) placeMenu();
          setOpen((current) => !current);
        }}
        className={cn(
          "flex h-10 w-full items-center rounded-btn border bg-white px-2.5 text-left transition-colors",
          open ? "border-brand" : "border-line hover:border-[#d1d6db]",
        )}
      >
        {value && selectedColor ? (
          <span
            className="inline-flex max-w-full items-center truncate rounded-chip px-2 py-0.5 text-[13px] font-medium"
            style={{ background: selectedColor.bg, color: selectedColor.fg }}
          >
            {value}
          </span>
        ) : (
          <span className="text-[14px] text-faint">{placeholder}</span>
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[70] overflow-hidden rounded-[14px] border border-line bg-white shadow-toast"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2">
                <Plus className="h-3.5 w-3.5 text-faint" />
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (canCreate) createAndSelect(query);
                      else if (filtered[0]) {
                        onChange(filtered[0]);
                        setDraft("");
                        setOpen(false);
                      }
                    }
                  }}
                  placeholder={addLabel}
                  className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
                />
              </div>
              <ul className="max-h-52 overflow-auto py-1 scrollbar-thin" role="listbox">
                {filtered.map((item) => {
                  const color = tagColor(item);
                  const selected = item === value;
                  return (
                    <li key={item} className="group flex items-center px-1.5">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-btn px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => {
                          onChange(item);
                          setDraft("");
                          setOpen(false);
                        }}
                      >
                        <span
                          className="inline-flex min-w-0 max-w-full items-center truncate rounded-chip px-2 py-0.5 text-[12px] font-medium"
                          style={{ background: color.bg, color: color.fg }}
                        >
                          {item}
                        </span>
                        {selected ? <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-brand" /> : null}
                      </button>
                      <button
                        type="button"
                        aria-label={`${item} 삭제`}
                        disabled={items.length <= 1}
                        className="rounded p-1 text-faint hover:bg-muted hover:text-up disabled:opacity-30"
                        onClick={() => removeItem(item)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && !canCreate ? (
                  <li className="px-3 py-2 text-[12px] text-faint">일치하는 항목이 없어요</li>
                ) : null}
              </ul>
              {canCreate ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-t border-line-soft px-3 py-2 text-left text-[13px] hover:bg-muted"
                  onClick={() => createAndSelect(query)}
                >
                  <span className="inline-flex h-5 items-center rounded-chip bg-brand-soft px-2 text-[12px] font-medium text-brand-text">
                    {query}
                  </span>
                  <span className="text-sub">만들기</span>
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
