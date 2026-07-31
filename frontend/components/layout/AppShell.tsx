"use client";

import { usePathname } from "next/navigation";
import { Sidebar, SidebarProvider } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}