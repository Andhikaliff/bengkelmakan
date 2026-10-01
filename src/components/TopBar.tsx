"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TopBarProps = {
  onAddClick?: () => void;
  addLabel?: string;
};

export default function TopBar({ onAddClick, addLabel }: TopBarProps) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/admin/dashboard");
  const isEmployees = pathname.startsWith("/admin/employees");

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 h-14 flex items-center justify-between">
      {/* Kiri: Logo */}
      <span className="text-sm font-semibold text-gray-800 shrink-0">Canteen Portal</span>

      {/* Tengah: Nav links */}
      <nav className="flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
        <Link
          href="/admin/dashboard"
          className={`text-sm pb-0.5 transition-colors ${
            isDashboard
              ? "font-semibold text-gray-900 border-b-2 border-gray-900"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/admin/employees"
          className={`text-sm pb-0.5 transition-colors ${
            isEmployees
              ? "font-semibold text-gray-900 border-b-2 border-gray-900"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Employees
        </Link>
      </nav>

      {/* Kanan: Add button (hanya tampil kalau ada) */}
      <div className="shrink-0">
        {onAddClick && addLabel ? (
          <button
            onClick={onAddClick}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            {addLabel}
          </button>
        ) : (
          // Placeholder kosong supaya layout justify-between tetap simetris
          <div className="w-[130px]" />
        )}
      </div>
    </header>
  );
}
