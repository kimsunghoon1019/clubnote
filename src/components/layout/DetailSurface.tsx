"use client";

import { cn } from "@/lib/cn";
import { COMPACT_QUERY } from "@/lib/compact";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const HISTORY_FLAG = "__clubnoteDetail";
const SWIPE_CLOSE_PX = 88;

function focusableIn(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.tabIndex !== -1 && !el.closest("[disabled]"));
}

export function DetailSurface({
  open,
  title,
  onClose,
  onSave,
  saveLabel = "저장",
  footer,
  children,
  className,
  sheet,
}: {
  open: boolean;
  title?: string;
  onClose?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  sheet?: boolean;
}) {
  const titleId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreRef = useRef<HTMLElement | null>(null);
  const pushedRef = useRef(false);
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [entered, setEntered] = useState(false);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (pushedRef.current && window.history.state?.[HISTORY_FLAG]) {
      window.history.back();
      return;
    }
    onCloseRef.current?.();
  }, []);

  useLayoutEffect(() => {
    if (open) document.documentElement.dataset.detailOpen = "true";
    else delete document.documentElement.dataset.detailOpen;
    return () => {
      delete document.documentElement.dataset.detailOpen;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !window.matchMedia(COMPACT_QUERY).matches) return;
    const shell = document.querySelector("[data-app-shell]");
    if (!shell) return;
    const blocked: HTMLElement[] = [];
    const visit = (node: Element) => {
      for (const child of Array.from(node.children)) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.dataset.detailSurface !== undefined || child.dataset.detailBackdrop !== undefined) continue;
        if (child.querySelector("[data-detail-surface], [data-detail-backdrop]")) {
          visit(child);
          continue;
        }
        child.setAttribute("inert", "");
        blocked.push(child);
      }
    };
    visit(shell);
    return () => {
      for (const el of blocked) el.removeAttribute("inert");
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setEntered(false);
      setDragY(0);
      return;
    }
    setEntered(false);
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !window.matchMedia(COMPACT_QUERY).matches) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = sheetRef.current;
    const closeBtn = root?.querySelector<HTMLElement>("[data-detail-close]");
    closeBtn?.focus();
    if (!closeBtn) root?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = focusableIn(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [close, open]);

  useEffect(() => {
    if (!open || !window.matchMedia(COMPACT_QUERY).matches) return;

    if (!window.history.state?.[HISTORY_FLAG]) {
      window.history.pushState({ ...window.history.state, [HISTORY_FLAG]: true }, "", window.location.href);
      pushedRef.current = true;
    }

    const onPop = () => {
      if (window.history.state?.[HISTORY_FLAG]) return;
      pushedRef.current = false;
      onCloseRef.current?.();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!pushedRef.current) return;
      pushedRef.current = false;
      if (!window.history.state?.[HISTORY_FLAG]) return;
      const state = { ...window.history.state };
      delete state[HISTORY_FLAG];
      window.history.replaceState(state, "", window.location.href);
    };
  }, [open]);

  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as Element | null)?.closest("button")) return;
    if (!window.matchMedia(COMPACT_QUERY).matches) return;
    dragStartY.current = event.clientY;
    setDragY(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHeaderPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragStartY.current == null) return;
    setDragY(Math.max(0, event.clientY - dragStartY.current));
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragStartY.current == null) return;
    const delta = Math.max(0, event.clientY - dragStartY.current);
    dragStartY.current = null;
    if (delta >= SWIPE_CLOSE_PX) {
      setDragY(0);
      close();
      return;
    }
    setDragY(0);
  };

  const compactOpen = open;
  const dim = compactOpen ? Math.max(0, 1 - dragY / 420) : 0;
  const shift = compactOpen ? (entered ? dragY : typeof window === "undefined" ? 0 : window.innerHeight) : 0;

  return (
    <>
      <div
        data-detail-backdrop
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/30 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none opacity-0",
        )}
        style={{
          opacity: open ? dim : 0,
          transition: dragY ? "none" : "opacity var(--motion) ease-out",
        }}
        onClick={close}
      />
      <aside
        ref={sheetRef}
        tabIndex={-1}
        data-detail-surface
        data-detail-open={open ? "true" : "false"}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={open && title ? titleId : undefined}
        className={cn(
          "min-h-0 bg-white",
          sheet
            ? open
              ? "fixed inset-0 z-40 flex flex-col overscroll-contain lg:hidden"
              : "hidden"
            : cn(
                "lg:static lg:z-auto lg:flex lg:w-[300px] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:border-l lg:border-line-soft lg:!translate-y-0 lg:!transition-none",
                open ? "fixed inset-0 z-40 flex flex-col overscroll-contain" : "hidden lg:flex",
              ),
          className,
        )}
        style={
          open
            ? {
                transform: `translateY(${shift}px)`,
                transition: dragY || !entered ? "none" : "transform var(--motion) ease-out",
              }
            : undefined
        }
      >
        <header
          data-detail-header
          className="flex shrink-0 touch-none items-center border-b border-line-soft pt-[env(safe-area-inset-top)] lg:hidden"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <button
            type="button"
            data-detail-close
            className="flex h-touch min-w-touch items-center justify-center px-3 text-compact text-sub touch-manipulation"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={close}
          >
            닫기
          </button>
          <p id={titleId} data-detail-title className="min-w-0 flex-1 truncate text-center text-compact font-semibold text-ink">
            {title ?? ""}
          </p>
          {onSave ? (
            <button
              type="button"
              data-detail-save
              className="flex h-touch min-w-touch items-center justify-center px-3 text-compact font-semibold text-brand-text touch-manipulation"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onSave}
            >
              {saveLabel}
            </button>
          ) : (
            <span className="invisible flex h-touch min-w-touch items-center justify-center px-3 text-compact" aria-hidden>
              닫기
            </span>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 scrollbar-thin lg:px-4 lg:py-4">{children}</div>
        {footer ? (
          <div data-detail-footer className="shrink-0 border-t border-line-soft px-5 py-3 lg:px-4">
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}
