"use client";

import { applyDesktopSiteViewport } from "@/lib/desktopSite";
import { useLayoutEffect } from "react";

export function DesktopSiteBoot() {
  useLayoutEffect(() => {
    applyDesktopSiteViewport();
  }, []);
  return null;
}
