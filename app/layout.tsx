import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ForceMonitor",
  description: "종목별 주가와 보유 현황을 한눈에 확인합니다.",
  icons: {
    icon: "/assets/brand/forcemonitor-blue.png",
    apple: "/assets/brand/forcemonitor-blue.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
