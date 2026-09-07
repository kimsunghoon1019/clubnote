"use client";

import { cn } from "@/lib/cn";
import { GripVertical, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function indexFromY(list: HTMLElement, y: number) {
  const rows = [...list.querySelectorAll<HTMLElement>("[data-tax-index]")];
  if (rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += 1) {
    const rect = rows[i].getBoundingClientRect();
    if (y < rect.bottom) return i;
  }
  return rows.length - 1;
}

export function TaxonomyEditor({
  label,
  items,
  onAdd,
  onRemove,
  onRename,
  onMove,
  variant = "header",
}: {
  label: string;
  items: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onRename?: (from: string, to: string) => void;
  onMove?: (from: number, to: number) => void;
  variant?: "header" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const onMoveRef = useRef(onMove);
  const dragFromRef = useRef<number | null>(null);
  const overRef = useRef<number | null>(null);
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
    dragFromRef.current = null;
    overRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      if (dragFromRef.current !== null) return;
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (dragFromRef.current !== null) return;
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
    setEditing(null);
    setEditDraft("");
  }, [open]);

  useEffect(() => {
    if (!editing) return;
    editRef.current?.focus();
    editRef.current?.select();
  }, [editing]);

  useEffect(() => () => stopDrag(), []);

  const commitRename = (from: string) => {
    const next = editDraft.trim();
    setEditing(null);
    setEditDraft("");
    if (!onRename || !next || next === from) return;
    onRename(from, next);
  };

  const startDrag = (from: number, event: React.PointerEvent) => {
    if (!onMoveRef.current || items.length < 2) return;
    event.preventDefault();
    event.stopPropagation();
    dragFromRef.current = from;
    overRef.current = from;
    setDragIndex(from);
    setOverIndex(from);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      const list = listRef.current;
      if (!list) return;
      const next = indexFromY(list, moveEvent.clientY);
      if (overRef.current === next) return;
      overRef.current = next;
      setOverIndex(next);
    };
    const onPointerUp = () => {
      const fromIndex = dragFromRef.current;
      const toIndex = overRef.current;
      stopDrag();
      if (fromIndex !== null && toIndex !== null) onMoveRef.current?.(fromIndex, toIndex);
    };
    listenersRef.current = { move: onPointerMove, up: onPointerUp };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
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
        <span className="text-[10px]">▾</span>
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
                {onRename
                  ? "이름을 눌러 바꾸고, 왼쪽 손잡이를 끌어 순서를 바꿀 수 있어요"
                  : onMove
                    ? "끌어 순서를 바꾸거나 항목을 추가·삭제할 수 있어요"
                    : "항목을 추가하거나 지울 수 있어요"}
              </p>
              <ul ref={listRef} className="max-h-52 overflow-auto">
                {items.map((item, index) => (
                  <li
                    key={item}
                    data-tax-index={index}
                    className={cn(
                      "flex items-center gap-1 rounded-btn px-1.5 py-1.5",
                      dragIndex === index && "opacity-40",
                      overIndex === index && dragIndex !== null && dragIndex !== index && "bg-brand-soft",
                      dragIndex === null && "hover:bg-muted",
                    )}
                  >
                    {onMove ? (
                      <span
                        className={cn(
                          "shrink-0 text-faint",
                          items.length > 1 && "cursor-grab",
                          dragIndex !== null && "cursor-grabbing",
                        )}
                        aria-hidden
                        onPointerDown={(event) => {
                          if (dragFromRef.current !== null) return;
                          if (event.button !== 0) return;
                          startDrag(index, event);
                        }}
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    {onRename && editing === item ? (
                      <input
                        ref={editRef}
                        value={editDraft}
                        aria-label={`${item} 이름 바꾸기`}
                        onChange={(event) => setEditDraft(event.target.value)}
                        onBlur={() => commitRename(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRename(item);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setEditing(null);
                            setEditDraft("");
                          }
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        className="h-7 min-w-0 flex-1 rounded-[6px] border border-brand bg-white px-1.5 text-[13px] text-ink outline-none"
                      />
                    ) : onRename ? (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate rounded-[6px] px-1 text-left text-[13px] text-ink hover:bg-white"
                        onClick={() => {
                          setEditing(item);
                          setEditDraft(item);
                        }}
                      >
                        {item}
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item}</span>
                    )}
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
