import "@fontsource-variable/manrope";
import "@fontsource-variable/newsreader";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "工作数据中心｜日报",
  description: "基于真实经营数据的日报分析仪表盘"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

