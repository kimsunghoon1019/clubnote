"use client";

import { useCallback, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const GHOST_DISMISS_MS = 400;

/** 배경에서 눌렀다 뗀 경우만 닫는다. 텍스트 드래그와 창을 연 직후 입력은 무시한다. */
export function useBackdropDismiss(onClose: (() => void) | undefined, open = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const downOnBackdrop = useRef(false);
  const openedAt = useRef(0);

  useLayoutEffect(() => {
    downOnBackdrop.current = false;
    if (open) openedAt.current = performance.now();
  }, [open]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      downOnBackdrop.current =
        open &&
        event.isPrimary &&
        event.button === 0 &&
        event.target === event.currentTarget &&
        performance.now() - openedAt.current >= GHOST_DISMISS_MS;
    },
    [open],
  );

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const shouldClose = downOnBackdrop.current && event.target === event.currentTarget;
    downOnBackdrop.current = false;
    if (!shouldClose) return;
    onCloseRef.current?.();
  }, []);

  const onPointerCancel = useCallback(() => {
    downOnBackdrop.current = false;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}
