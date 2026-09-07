"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "./AppHeader";
import { SearchOverlay } from "./SearchOverlay";
import { StatusBar } from "./StatusBar";
import { ToastViewport } from "@/components/ui/Toast";
import { SmsModal } from "@/components/modals/SmsModal";
import { AddMemberModal } from "@/components/modals/AddMemberModal";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { EventModal } from "@/components/modals/EventModal";
import { useClub } from "@/lib/store";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionReady, sessionMemberId } = useClub();
  const bare = pathname === "/login" || pathname.startsWith("/auth");

  useEffect(() => {
    if (!sessionReady || bare || sessionMemberId) return;
    const next = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
    router.replace(next);
  }, [sessionReady, sessionMemberId, bare, pathname, router]);

  if (bare) {
    return <>{children}</>;
  }

  if (sessionReady && !sessionMemberId) {
    return <div className="h-screen bg-white" />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <AppHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
      <StatusBar />
      <SearchOverlay />
      <ToastViewport />
      <SmsModal />
      <AddMemberModal />
      <TransactionModal />
      <EventModal />
    </div>
  );
}
