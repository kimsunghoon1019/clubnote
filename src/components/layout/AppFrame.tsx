"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";
import { SearchOverlay } from "./SearchOverlay";
import { StatusBar } from "./StatusBar";
import { ToastViewport } from "@/components/ui/Toast";
import { SmsModal } from "@/components/modals/SmsModal";
import { AddMemberModal } from "@/components/modals/AddMemberModal";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { EventModal } from "@/components/modals/EventModal";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login" || pathname.startsWith("/auth");

  if (bare) {
    return <>{children}</>;
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
