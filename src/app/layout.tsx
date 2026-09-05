import type { Metadata } from "next";
import "./globals.css";
import { ClubProvider } from "@/lib/store";
import { AppFrame } from "@/components/layout/AppFrame";

export const metadata: Metadata = {
  title: "클럽노트 — 한빛 오케스트라",
  description: "출석·회원·회계·일정을 한 화면에서 보는 동아리 운영 콘솔",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <ClubProvider>
          <AppFrame>{children}</AppFrame>
        </ClubProvider>
      </body>
    </html>
  );
}
