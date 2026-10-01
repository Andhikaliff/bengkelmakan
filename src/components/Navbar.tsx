"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DashboardIcon, GroupIcon, ScannerIcon, ReceiptIcon, LogoutIcon, GearIcon } from "./Icons";
import { useCurrentRole } from "@/lib/use-current-role";
import SettingsModal from "./SettingsModal";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/admin/employees", label: "Direktori", Icon: GroupIcon },
  { href: "/admin/audit-logs", label: "Logs", Icon: ReceiptIcon },
  { href: "/scanner", label: "Scanner", Icon: ScannerIcon },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useCurrentRole();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const visibleItems = navItems.filter((item) => {
    if (item.href === "/scanner" || item.href === "/admin/audit-logs") return role === "ADMIN";
    return role === "ADMIN" || role === "DATA";
  });

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/admin/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-[#111827] border-b border-gray-200 dark:border-white/10 h-14 flex items-center px-4 md:px-6 gap-4 shadow-sm dark:shadow-lg overflow-x-auto w-full">
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0 mr-4">
        <div className="w-7 h-7 rounded-md bg-gray-100 dark:bg-white/10 flex items-center justify-center">
          <ScannerIcon className="w-4 h-4 text-gray-900 dark:text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-900 dark:text-white leading-tight whitespace-nowrap hidden sm:inline-block">
          Bengkel Makan Management
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex items-center gap-1 flex-1">
        {visibleItems.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white/80"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Settings & Logout */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Settings"
          className="flex items-center justify-center p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
        >
          <GearIcon className="w-4 h-4" />
        </button>
        <button
          id="navbar-logout-btn"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 dark:text-red-400/70 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all disabled:opacity-50"
        >
          <LogoutIcon className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">{loggingOut ? "Signing out..." : "Sign out"}</span>
        </button>
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
}

