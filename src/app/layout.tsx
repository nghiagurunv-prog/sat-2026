import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import { GamificationProvider } from "@/context/GamificationContext";
import { ToastProvider } from "@/context/ToastContext";
import { BadgeUnlockWatcher } from "@/components/BadgeUnlockWatcher";
import { WelcomeNameModal } from "@/components/WelcomeNameModal";

export const metadata: Metadata = {
  title: "SAT.Guru — Hệ thống Luyện thi Digital SAT AI",
  description: "Nền tảng luyện thi Digital SAT thích ứng chuẩn Bluebook cùng Gia sư AI Socratic cho học sinh THPT Việt Nam",
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
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="flex h-screen overflow-hidden bg-[#0e1117] text-[#fafafa] font-sans">
        <AuthProvider>
          <GamificationProvider>
            <ToastProvider>
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
