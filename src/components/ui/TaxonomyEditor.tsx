"use client";

import { cn } from "@/lib/cn";
import { GripVertical, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function moveItems(list: string[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function indexFromY(list: HTMLElement, y: number) {
  const rows = [...list.querySelectorAll<HTMLElement>("[data-tax-index]")];
  if (rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += 1) {
    const rect = rows[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) return i;
  }
  return rows.length - 1;
}

export function TaxonomyEditor({
  label,
  items,
  onAdd,
  onRemove,
  onMove,
  variant = "header",
}: {
  label: string;
  items: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onMove?: (from: number, to: number) => void;
  variant?: "header" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState<string[] | null>(null);
  const [draggedName, setDraggedName] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const onMoveRef = useRef(onMove);
  const originalFromRef = useRef<number | null>(null);
  const currentIndexRef = useRef<number | null>(null);
  const workingRef = useRef<string[] | null>(null);
  const listenersRef = useRef<{ move: (event: PointerEvent) => void; up: () => void } | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  onMoveRef.current = onMove;

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  };

  const stopDrag = () => {
    const listeners = listenersRef.current;
    if (listeners) {
      window.removeEventListener("pointermove", listeners.move);
      window.removeEventListener("pointerup", listeners.up);
      listenersRef.current = null;
    }
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    originalFromRef.current = null;
    currentIndexRef.current = null;
    workingRef.current = null;
    setWorking(null);
    setDraggedName(null);
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      if (currentIndexRef.current !== null) return;
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (currentIndexRef.current !== null) return;
      const target = e.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    stopDrag();
    setDraft("");
  }, [open]);

  useEffect(() => () => stopDrag(), []);

  const startDrag = (from: number, event: React.PointerEvent) => {
    if (!onMoveRef.current || items.length < 2) return;
    event.preventDefault();
    event.stopPropagation();
    const next = [...items];
    workingRef.current = next;
    originalFromRef.current = from;
    currentIndexRef.current = from;
    setWorking(next);
    setDraggedName(items[from] ?? null);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      const list = listRef.current;
      const current = workingRef.current;
      const fromIndex = currentIndexRef.current;
      if (!list || !current || fromIndex === null) return;
      const toIndex = indexFromY(list, moveEvent.clientY);
      if (toIndex === fromIndex) return;
      const reordered = moveItems(current, fromIndex, toIndex);
      workingRef.current = reordered;
      currentIndexRef.current = toIndex;
      setWorking(reordered);
    };
    const onPointerUp = () => {
      const fromIndex = originalFromRef.current;
      const toIndex = currentIndexRef.current;
      stopDrag();
      if (fromIndex !== null && toIndex !== null) onMoveRef.current?.(fromIndex, toIndex);
    };
    listenersRef.current = { move: onPointerMove, up: onPointerUp };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const shown = working ?? items;
  const dragging = draggedName !== null;

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          variant === "button" && "h-8 rounded-btn border border-line px-2.5 text-[13px] hover:bg-muted",
          variant === "header" && "text-[13px] text-faint hover:text-ink",
          open && variant === "header" && "text-brand-text",
          open && variant === "button" && "border-brand bg-brand-soft text-brand-text",
        )}
      >
        {label}
        <span className="text-[10px]" aria-hidden>
          ▾
        </span>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 w-60 rounded-card border border-line bg-white p-2"
              style={{ top: pos.top, left: pos.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="px-1 pb-1 text-[11px] text-faint">
                {onMove ? "끌어 순서를 바꾸거나 항목을 추가·삭제할 수 있어요" : "항목을 추가하거나 지울 수 있어요"}
              </p>
              <ul ref={listRef} className="max-h-52 overflow-auto">
                {shown.map((item, index) => (
                  <li
                    key={item}
                    data-tax-index={index}
                    onPointerDown={(event) => {
                      if (!onMove || currentIndexRef.current !== null) return;
                      if (event.button !== 0) return;
                      if ((event.target as HTMLElement).closest("[data-tax-remove]")) return;
                      startDrag(items.indexOf(item), event);
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded-btn px-1.5 py-1.5",
                      onMove && items.length > 1 && "cursor-grab",
                      dragging && "cursor-grabbing",
                      draggedName === item && "bg-brand-soft opacity-70",
                      !dragging && "hover:bg-muted",
                    )}
                  >
                    {onMove ? (
                      <span className="shrink-0 text-faint" aria-hidden>
                        <GripVertical className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item}</span>
                    <button
                      type="button"
                      data-tax-remove
                      className="rounded p-0.5 text-faint hover:text-up disabled:opacity-30"
                      aria-label={`${item} 삭제`}
                      disabled={items.length <= 1}
                      onPointerDown={(event) => event.stopPropagation()}
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
