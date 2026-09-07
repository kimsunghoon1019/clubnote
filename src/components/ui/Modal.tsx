"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

const HISTORY_FLAG = "__clubnoteModal";

export function Modal({
  open,
  title,
  children,
  onClose,
  width = 440,
  align = "center",
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
  align?: "center" | "top";
  footer?: ReactNode;
}) {
  const onCloseRef = useRef(onClose);
  const pushedRef = useRef(false);
  onCloseRef.current = onClose;

  const finishClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  const close = useCallback(() => {
    if (pushedRef.current && window.history.state?.[HISTORY_FLAG]) {
      window.history.back();
      return;
    }
    finishClose();
  }, [finishClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open) return;
    document.documentElement.dataset.modalOpen = "true";
    return () => {
      delete document.documentElement.dataset.modalOpen;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!window.history.state?.[HISTORY_FLAG]) {
      window.history.pushState({ ...window.history.state, [HISTORY_FLAG]: true }, "", window.location.href);
      pushedRef.current = true;
    }

    const onPop = () => {
      if (window.history.state?.[HISTORY_FLAG]) return;
      pushedRef.current = false;
      finishClose();
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
  }, [open, finishClose]);

  if (!open) return null;

  return (
    <div
      data-modal-overlay
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-white",
        "lg:bg-black/30 lg:p-4",
        align === "top" ? "lg:items-start lg:pt-[7vh]" : "lg:items-center",
      )}
      onClick={close}
    >
      <div
        data-modal-sheet
        role="dialog"
        aria-modal
        aria-label={title}
        className={cn(
          "flex h-full w-full max-w-none flex-col overflow-hidden bg-white overscroll-contain",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          "lg:h-auto lg:max-h-[86vh] lg:rounded-card lg:border lg:border-line lg:pt-0 lg:pb-0",
          "lg:w-[var(--modal-width)] lg:max-w-[min(var(--modal-width),calc(100vw-32px))]",
        )}
        style={{ ["--modal-width" as string]: `${width}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center border-b border-line-soft lg:hidden">
          <button
            type="button"
            data-modal-close
            className="flex h-touch min-w-touch items-center justify-center px-3 text-compact text-sub touch-manipulation"
            onClick={close}
          >
            닫기
          </button>
          <p data-modal-title className="min-w-0 flex-1 truncate text-center text-compact font-semibold text-ink">
            {title}
          </p>
          <span className="invisible flex h-touch min-w-touch items-center justify-center px-3 text-compact" aria-hidden>
            닫기
          </span>
        </header>
        <div className="hidden shrink-0 items-center justify-between border-b border-line-soft px-5 py-3.5 lg:flex">
          <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={close}
            className="rounded-btn p-1 text-faint hover:bg-muted hover:text-ink"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 [scrollbar-gutter:stable] scrollbar-thin lg:px-5">
          {children}
        </div>
        {footer ? (
          <div data-modal-footer className="shrink-0 border-t border-line-soft px-4 py-3 lg:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        className={cn("absolute inset-0 bg-black/20 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full w-[400px] max-w-full flex-col border-l border-line bg-white transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
          <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-btn p-1 text-faint hover:bg-muted" aria-label="닫기">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4 scrollbar-thin">{children}</div>
      </aside>
    </div>
  );
}
