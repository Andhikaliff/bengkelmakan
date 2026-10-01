"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DashboardIcon, GroupIcon, ScannerIcon, PersonIcon, LogoutIcon, GearIcon, ReceiptIcon } from "./Icons";
import { useCurrentRole } from "@/lib/use-current-role";
import SettingsModal from "./SettingsModal";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/admin/employees", label: "Employee Management", Icon: GroupIcon },
  { href: "/admin/audit-logs", label: "Audit Logs", Icon: ReceiptIcon },
  { href: "/scanner", label: "Scanner", Icon: ScannerIcon },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  DATA: "Data Operator",
  SCANNER: "Scanner Operator",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useCurrentRole();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const visibleItems = navItems.filter((item) => {
    if (item.href === "/scanner") return role === "ADMIN";
    if (item.href === "/admin/audit-logs") return role === "ADMIN";
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
    <nav className="w-[220px] shrink-0 bg-white dark:bg-[#111827] h-screen fixed left-0 top-0 flex flex-col border-r border-gray-200 dark:border-transparent">
      {/* Logo/Brand */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gray-100 dark:bg-white/10 flex items-center justify-center">
            <ScannerIcon className="w-4 h-4 text-gray-900 dark:text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
              Bengkel Makan Management
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-white/40 mt-0.5">Enterprise Meal Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <ul className="flex flex-col gap-0.5 p-3 flex-1">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.Icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  active
                    ? "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white/80"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* User + Logout */}
      <div className="p-3 border-t border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0">
            <PersonIcon className="w-4 h-4 text-gray-600 dark:text-white/60" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{role ? ROLE_LABELS[role] || role : "—"}</p>
            <p className="text-[10px] text-gray-500 dark:text-white/40 truncate">{role || "Not signed in"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all"
            title="Settings"
          >
            <GearIcon className="w-4 h-4 shrink-0" />
          </button>
          <button
            id="sidebar-logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex-[3] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-red-500 dark:text-red-400/70 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all disabled:opacity-50"
          >
            <LogoutIcon className="w-4 h-4 shrink-0" />
            <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </nav>
  );
}

