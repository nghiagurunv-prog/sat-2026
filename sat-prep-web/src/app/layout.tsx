import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import { GamificationProvider } from "@/context/GamificationContext";
import { ToastProvider } from "@/context/ToastContext";
import { BadgeUnlockWatcher } from "@/components/BadgeUnlockWatcher";
import { WelcomeNameModal } from "@/components/WelcomeNameModal";
import { PwaRegistrar } from "@/components/PwaRegistrar";

const rawSiteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}` : "https://satguru.edu.vn");

const SITE_URL = rawSiteUrl.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SAT.Guru — Hệ thống Luyện thi Digital SAT AI chuẩn Bluebook",
    template: "%s | SAT.Guru",
  },
  description:
    "Nền tảng luyện thi Digital SAT thích ứng chuẩn Bluebook cùng Gia sư AI Socratic, kho đề QAS 2024 giải thích tiếng Việt 100% và Cổng Báo cáo Phụ huynh cho học sinh THPT Việt Nam.",
  keywords: [
    "luyện thi SAT",
    "Digital SAT",
    "SAT.Guru",
    "đề thi thử SAT",
    "Bluebook SAT",
    "gia sư AI SAT",
    "SAT 1500+",
    "xét tuyển đại học SAT",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: SITE_URL,
    siteName: "SAT.Guru",
    title: "SAT.Guru — Luyện thi Digital SAT AI chuẩn Bluebook 1450–1550+",
    description:
      "Thi thử thích ứng 2-module chuẩn Bluebook, Gia sư AI giải phẫu bẫy College Board bằng tiếng Việt và Báo cáo tiến độ minh bạch cho Phụ huynh.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SAT.Guru — Hệ thống Luyện thi Digital SAT AI",
    description:
      "Nền tảng luyện thi Digital SAT chuẩn Bluebook cùng Gia sư AI Socratic cho học sinh THPT Việt Nam.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SAT.Guru",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e1117",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className="h-full antialiased dark"
    >
      <body className="flex h-screen overflow-hidden bg-[#0e1117] text-[#fafafa] font-sans">
        <AuthProvider>
          <GamificationProvider>
            <ToastProvider>
              <PwaRegistrar />
              <BadgeUnlockWatcher />
              <WelcomeNameModal />
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </GamificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
