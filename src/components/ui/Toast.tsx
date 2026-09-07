"use client";

import { useClub } from "@/lib/store";

export function ToastViewport() {
  const { toasts } = useClub();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 space-y-2 lg:bottom-12">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-btn bg-[#191F28] px-4 py-2.5 text-[13px] text-white shadow-toast"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
