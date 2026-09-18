"use client";

import { cn } from "@/lib/cn";
import { useBackdropDismiss } from "@/lib/overlayDismiss";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.modalOpen = "true";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.documentElement.dataset.modalOpen;
    };
  }, [open, onClose]);

  const dismiss = useBackdropDismiss(onClose, open);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-black/30 p-0 lg:p-4",
        align === "top" ? "items-stretch lg:items-start lg:pt-[7vh]" : "items-stretch lg:items-center",
      )}
      {...dismiss}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="flex h-full w-full max-h-none flex-col overflow-hidden rounded-none border-0 bg-white lg:h-auto lg:max-h-[86vh] lg:w-[min(100%-2rem,var(--modal-w))] lg:rounded-card lg:border lg:border-line"
        style={{ ["--modal-w" as string]: `${width}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-touch shrink-0 items-center justify-between border-b border-line-soft px-5 pt-[env(safe-area-inset-top)] lg:h-auto lg:py-3.5 lg:pt-3.5">
          <h2 className="text-compact font-semibold text-ink lg:text-[16px]">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-touch w-touch items-center justify-center rounded-btn text-faint hover:bg-muted hover:text-ink lg:h-auto lg:w-auto lg:p-1" aria-label="닫기">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 [scrollbar-gutter:stable] scrollbar-thin">
          {children}
        </div>
        {footer ? <div className="shrink-0 border-t border-line-soft px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>,
    document.body,
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

  const dismiss = useBackdropDismiss(onClose, open);

  return (
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        className={cn("absolute inset-0 bg-black/20 transition-opacity", open ? "opacity-100" : "opacity-0")}
        {...dismiss}
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
