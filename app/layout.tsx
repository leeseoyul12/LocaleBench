import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://localebench-ui-lab.almondhawk7.chatgpt.site"),
  title: "LocaleBench — 다국어 번역 UI 검사",
  description:
    "독일어·프랑스어·한국어 번역문을 여러 폰트와 화면 너비에서 검사하세요. 실제 브라우저 측정으로 UI 넘침과 변수 오류를 찾고 수정 전후 결과를 비교합니다.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "LocaleBench",
    title: "LocaleBench — 다국어 번역 UI 검사",
    description: "실제 브라우저 측정으로 번역 UI 넘침과 변수 오류를 확인하세요.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
