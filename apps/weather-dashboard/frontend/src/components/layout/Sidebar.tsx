"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LayoutDashboard, MapPin, Settings, LogOut, CloudRain, SlidersHorizontal, GitCompareArrows, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Close drawer on ESC (mobile)
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleLogout = () => {
    logout();
    onClose();
    router.push("/login");
  };

  const links = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/cities", icon: MapPin, label: "Cidades" },
    { href: "/compare", icon: GitCompareArrows, label: "Comparar" },
    ...(user?.role === "admin"
      ? [
          { href: "/admin/users", icon: Settings, label: "Usuários" },
          { href: "/admin/rules", icon: SlidersHorizontal, label: "Regras" },
        ]
      : []),
  ];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-slate-900 text-white transform transition-transform duration-200 lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <CloudRain className="h-7 w-7 text-teal-400" />
          <span className="font-bold text-lg leading-tight">Weather Risk<br /><span className="text-teal-400 text-sm font-normal">Dashboard</span></span>
        </div>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white" aria-label="Fechar menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 px-4 py-4">
        <div className="mb-3 pb-3 border-b border-slate-700">
          <p className="text-xs text-slate-500 mb-1.5">Desenvolvido por:</p>
          <Image
            src="/logo_nexoia.jpg"
            alt="NexoIA"
            width={100}
            height={32}
            className="rounded opacity-90"
            style={{ objectFit: "contain" }}
          />
        </div>
        <div className="mb-3">
          <p className="text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          <span className="inline-block mt-1 text-xs bg-slate-700 rounded px-1.5 py-0.5 capitalize">{user?.role}</span>
        </div>
        <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
