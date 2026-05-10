"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, CloudRain } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatWidget } from "@/components/agent/ChatWidget";
import { FullPageSpinner } from "@/components/ui/Spinner";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  // Close drawer on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (isLoading) return <FullPageSpinner />;
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay (only visible when drawer open on small screens) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      <div className="lg:ml-60 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-slate-900 text-white shadow">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1.5 rounded hover:bg-slate-800"
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <CloudRain className="h-5 w-5 text-teal-400" />
            <span className="font-semibold text-sm">Weather Risk</span>
          </div>
          <div className="w-8" aria-hidden="true" />
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>

      <ChatWidget />
    </div>
  );
}
