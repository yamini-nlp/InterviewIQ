import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider, Toaster } from "@/components/ui/Toast";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "InterviewIQ — AI Interview Coach",
  description: "Practice, simulate, and ace your next interview with AI-powered MLIM analysis",
};

const themeInitScript = `
(function () {
  try {
    var match = document.cookie.match(/(?:^|; )theme=([^;]*)/);
    var stored = match ? decodeURIComponent(match[1]) : "system";
    var resolved = stored === "system" || !stored
      ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : stored;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-neutral-50 text-neutral-900 font-sans m-0">
        <AuthProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}