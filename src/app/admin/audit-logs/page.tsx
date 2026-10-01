"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useCurrentRole } from "@/lib/use-current-role";

type AuditLog = {
  id: number;
  timestamp: string;
  username: string;
  role: string;
  action: string;
  targetId: string | null;
  description: string;
  status: string;
  ipAddress: string | null;
  scannerId: string | null;
};

export default function AuditLogsPage() {
  const role = useCurrentRole();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-logs?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (role === "ADMIN") {
      fetchLogs();
    }
  }, [role, fetchLogs]);

  if (role === null) {
    return <div className="min-h-screen bg-[#f4f6f8] p-8 text-gray-500 dark:bg-gray-950 dark:text-gray-400">Memuat...</div>;
  }

  if (role !== "ADMIN") {
    return <div className="p-8 text-red-600 font-bold">Akses ditolak.</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] dark:bg-gray-950">
      <Navbar />

      <main className="px-6 py-6 max-w-[1200px] mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Logs</h2>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Log Aktivitas Sistem
              </h3>
              <button
                onClick={fetchLogs}
                className="text-sm px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md font-medium text-gray-700 dark:text-gray-200 transition-colors"
              >
                Refresh
              </button>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Memuat log...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Belum ada aktivitas yang dicatat.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                  <thead className="bg-gray-50 dark:bg-gray-800/70 text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Waktu</th>
                      <th className="px-6 py-4 font-semibold">Aksi</th>
                      <th className="px-6 py-4 font-semibold">User</th>
                      <th className="px-6 py-4 font-semibold">Deskripsi</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("id-ID")}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-white">{log.username}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{log.role}</div>
                        </td>
                        <td className="px-6 py-4">
                          {log.description}
                          {log.targetId && (
                            <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                              ID: {log.targetId}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.status === "SUCCESS" ? (
                            <span className="text-green-600 font-medium">Berhasil</span>
                          ) : (
                            <span className="text-red-600 font-medium">Gagal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Halaman <span className="font-medium">{page}</span> dari <span className="font-medium">{totalPages}</span>
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
      </main>
    </div>
  );
}
