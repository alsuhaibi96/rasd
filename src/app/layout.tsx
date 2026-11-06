import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import { getLang } from "@/lib/lang-server";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: "رَصد · نظام الاستجابة الفورية للكوارث الطبيعية",
  description: "منصة مراقبة لحظية لقراءات الحساسات وتصنيف الخطورة وإصدار التنبيهات",
};

export const viewport: Viewport = { themeColor: "#071014" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={plex.variable}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster
          dir={lang === "ar" ? "rtl" : "ltr"}
          theme="dark"
          position={lang === "ar" ? "top-left" : "top-right"}
          richColors
          toastOptions={{ style: { fontFamily: "var(--font-plex)", background: "#0f1e23", border: "1px solid #24393f" } }}
        />
      </body>
    </html>
  );
}
