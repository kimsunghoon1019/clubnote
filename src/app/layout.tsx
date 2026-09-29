import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClubProvider } from "@/lib/store";
import { AppFrame } from "@/components/layout/AppFrame";
import { DesktopSiteBoot } from "@/components/layout/DesktopSiteBoot";
import { CLUB_NAME } from "@/lib/constants";
import { desktopSiteBoot } from "@/lib/desktopSite";

export const preferredRegion = "icn1";

export const metadata: Metadata = {
  title: `${CLUB_NAME} — 동아리 운영`,
  description: "출석·회원·회계·일정을 한 화면에서 보는 동아리 운영 콘솔",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <script dangerouslySetInnerHTML={{ __html: desktopSiteBoot }} />
        <DesktopSiteBoot />
        <ClubProvider>
          <AppFrame>{children}</AppFrame>
        </ClubProvider>
      </body>
    </html>
  );
}
