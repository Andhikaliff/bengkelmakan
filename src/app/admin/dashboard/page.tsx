"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { SearchIcon, BadgeIcon, RestaurantIcon, ReceiptIcon, ScannerIcon } from "@/components/Icons";
import { CATEGORIES, CATEGORY_LABELS, DEPARTMENTS, type Category, type Employee, type Transaction } from "@/lib/canteen-shared";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCurrentRole } from "@/lib/use-current-role";
import { useSettings } from "@/lib/use-settings";

const PAGE_SIZE = 25;
const MONTH_ORDER: Record<string, number> = {
  Januari: 1,
  Februari: 2,
  Maret: 3,
  April: 4,
  Mei: 5,
  Juni: 6,
  Juli: 7,
  Agustus: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  Desember: 12,
};

function parseSheetName(name: string) {
  const cleaned = name.replace(/^Transaksi\s+/i, "").trim();
  const match = cleaned.match(/^(.*?)(?:\s+(\d{4}))?$/);
  return {
    month: match ? match[1].trim() : "",
    year: match && match[2] ? match[2] : "",
  };
}

function sortSheetNames(names: string[]) {
  return [...names].sort((a, b) => {
    const parsedA = parseSheetName(a);
    const parsedB = parseSheetName(b);

    if (parsedA.year !== parsedB.year) {
      if (!parsedA.year) return 1;
      if (!parsedB.year) return -1;
      return Number(parsedB.year) - Number(parsedA.year);
    }

    const orderA = MONTH_ORDER[parsedA.month] ?? 99;
    const orderB = MONTH_ORDER[parsedB.month] ?? 99;
    return orderA - orderB || parsedA.month.localeCompare(parsedB.month, 'id');
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const role = useCurrentRole();
  const { settings, loaded: settingsLoaded } = useSettings();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedPos, setSelectedPos] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);

  const availableYears = useMemo(
    () => Array.from(
      new Set(availableSheetNames.map((name) => parseSheetName(name).year).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a)),
    [availableSheetNames]
  );

  const availableMonths = useMemo(() => {
    if (!selectedYear) return [];
    const months = availableSheetNames
      .filter((name) => parseSheetName(name).year === selectedYear)
      .map((name) => parseSheetName(name).month)
      .filter(Boolean);
    return Array.from(new Set(months)).sort((a, b) => {
      const orderA = MONTH_ORDER[a] ?? 99;
      const orderB = MONTH_ORDER[b] ?? 99;
      return orderA - orderB || a.localeCompare(b, 'id');
    });
  }, [availableSheetNames, selectedYear]);

  const availableDates = useMemo(() => {
    if (!selectedMonth) return [];
    return Array.from(new Set(transactions.map((t) => t.tanggal))).sort();
  }, [transactions, selectedMonth]);

  const chartData = useMemo(() => {
    const grouped = transactions.reduce((acc, t) => {
      const status = String(t.status || "").toUpperCase();
      if (!acc[t.tanggal]) acc[t.tanggal] = { date: t.tanggal, BERHASIL: 0, DUPLIKAT: 0, DIRESET: 0, NONAKTIF: 0, TIDAK_DIKENAL: 0 };
      if (status === "BERHASIL") acc[t.tanggal].BERHASIL += 1;
      if (status === "DUPLIKAT") acc[t.tanggal].DUPLIKAT += 1;
      if (status === "DIRESET") acc[t.tanggal].DIRESET += 1;
      if (status === "NONAKTIF") acc[t.tanggal].NONAKTIF += 1;
      if (status === "TIDAK DIKENAL" || status === "TIDAK_DIKENAL") acc[t.tanggal].TIDAK_DIKENAL += 1;
      return acc;
    }, {} as Record<string, { date: string; BERHASIL: number; DUPLIKAT: number; DIRESET: number; NONAKTIF: number; TIDAK_DIKENAL: number }>);

    const sortedDates = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    if (!selectedDate) return sortedDates;

    const selectedIndex = sortedDates.findIndex((item) => item.date === selectedDate);
    if (selectedIndex === -1) return sortedDates;

    const windowSize = 7;
    let start = Math.max(0, selectedIndex - 3);
    let end = Math.min(sortedDates.length, start + windowSize);
    if (end - start < windowSize) start = Math.max(0, end - windowSize);

    return sortedDates.slice(start, end);
  }, [transactions, selectedDate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const baseSorted = [...transactions].sort((a, b) => {
      const timeA = new Date(`${a.tanggal}T${a.jam}`).getTime();
      const timeB = new Date(`${b.tanggal}T${b.jam}`).getTime();

      if (isNaN(timeA) || isNaN(timeB)) {
        const strA = `${a.tanggal} ${a.jam}`;
        const strB = `${b.tanggal} ${b.jam}`;
        return strB.localeCompare(strA);
      }

      return timeB - timeA;
    });

    let dateFiltered = selectedDate ? baseSorted.filter((t) => t.tanggal === selectedDate) : baseSorted;

    if (selectedDept) {
      const target = selectedDept.toUpperCase();
      dateFiltered = dateFiltered.filter((t) => (t.departemen || "").toUpperCase() === target);
    }

    if (selectedPos) {
      const target = selectedPos.toUpperCase();
      dateFiltered = dateFiltered.filter((t) => {
        const match = String(t.id).match(/^([A-Za-z]+)/);
        const cat = match ? match[1].toUpperCase() : "";
        return cat === target;
      });
    }

    if (!q) return dateFiltered;
    return dateFiltered.filter((t) => t.nama.toLowerCase().includes(q) || String(t.id).toLowerCase().includes(q));
  }, [transactions, search, selectedDate, selectedDept, selectedPos]);

  useEffect(() => {
    fetch("/api/months", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const sheets = Array.isArray(data) ? data : [];
        setAvailableSheetNames(sortSheetNames(sheets));
      })
      .catch(() => setAvailableSheetNames([]));
  }, []);

  useEffect(() => {
    async function loadTransactions(isSilent = false) {
      if (!isSilent) setTxLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedMonth) params.set("month", selectedMonth);
        if (selectedYear) params.set("year", selectedYear);
        if (selectedDept) params.set("departemen", selectedDept);
        const res = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } catch {
        setErrorMsg("Gagal mengambil data transaksi.");
      } finally {
        if (!isSilent) setTxLoading(false);
      }
    }
    
    loadTransactions();

    let intervalId: NodeJS.Timeout;
    if (settingsLoaded && settings.autoRefresh) {
      intervalId = setInterval(() => {
        loadTransactions(true);
      }, Math.max(5, settings.autoRefreshInterval) * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [selectedMonth, selectedYear, selectedDept, settings.autoRefresh, settings.autoRefreshInterval, settingsLoaded]);

  useEffect(() => {
    setSelectedMonth("");
    setSelectedDate("");
  }, [selectedYear]);

  useEffect(() => {
    setSelectedDate("");
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedYear && selectedMonth && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth("");
    }
  }, [selectedYear, selectedMonth, availableMonths]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        const empRes = await fetch("/api/employees", { cache: "no-store" });
        const empData = await empRes.json();
        setEmployees(Array.isArray(empData) ? empData : []);
      } catch {
        setErrorMsg("Gagal mengambil data karyawan dari database.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const today = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const todayTransactions = transactions.filter((t) => t.tanggal === today);
  const todaySuccessCount = todayTransactions.filter((t) => t.status === "BERHASIL").length;

  const countByCategory: Record<Category, number> = { EMP: 0, TR: 0, DW: 0 };
  for (const emp of employees) {
    const cat = (emp.category || String(emp.id).match(/^([A-Za-z]+)/)?.[0]?.toUpperCase()) as Category | undefined;
    if (cat && cat in countByCategory) countByCategory[cat]++;
  }

  function categoryFromId(id: string): string {
    const match = String(id).match(/^([A-Za-z]+)/);
    const code = match ? (match[1].toUpperCase() as Category) : null;
    return code && CATEGORY_LABELS[code] ? CATEGORY_LABELS[code] : "-";
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, selectedYear, selectedMonth, selectedDept, selectedDate, selectedPos]);

  function handleDownloadPdf() {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });

      const monthLabel = selectedMonth || "Semua Bulan";
      const yearLabel = selectedYear || "Semua Tahun";
      const deptLabel = selectedDept || "Semua Departemen";
      const title = `Laporan Transaksi Bengkel Makan — ${monthLabel} ${yearLabel} — ${deptLabel}`;

      doc.setFontSize(14);
      doc.text(title, 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")} — Total ${filtered.length} baris`, 14, 21);

      autoTable(doc, {
        startY: 26,
        head: [["Tanggal", "Jam", "Nama", "ID", "Kategori", "Departemen", "Status"]],
        body: filtered.map((t) => [
          t.tanggal,
          t.jam,
          t.nama,
          t.id,
          categoryFromId(t.id),
          t.departemen || "-",
          t.status === "BERHASIL" ? "Berhasil" : t.status === "DUPLIKAT" ? "Duplikat" : t.status === "DIRESET" ? "Direset" : t.status === "NONAKTIF" ? "Nonaktif" : t.status === "TIDAK DIKENAL" ? "Tidak Dikenal" : t.status,
        ]),
        headStyles: { fillColor: [17, 24, 39] },
        styles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 246, 248] },
      });

      const filenameParts = ["laporan-bengkel-makan", monthLabel, deptLabel].map((s) =>
        s.toLowerCase().replace(/\s+/g, "-")
      );
      doc.save(`${filenameParts.join("_")}.pdf`);
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleDownloadExcel() {
    setGeneratingExcel(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set("month", selectedMonth);
      if (selectedYear) params.set("year", selectedYear);
      if (selectedDept) params.set("departemen", selectedDept);

      const res = await fetch(`/api/export/excel?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal membuat file Excel");

      // Ambil nama file dari header Content-Disposition yang dikirim server,
      // supaya nama filenya konsisten dengan yang dipakai versi PDF.
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match ? match[1] : "laporan-bengkel-makan.xlsx";

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Gagal mengunduh file Excel, coba lagi.");
    } finally {
      setGeneratingExcel(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] dark:bg-gray-950">
      <Navbar />

      <div className="px-6 py-6 max-w-[1200px] mx-auto flex flex-col gap-6">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{errorMsg}</div>
        )}

        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Overview</h2>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "TOTAL EMPLOYEES",
              icon: <BadgeIcon className="w-5 h-5 text-gray-400" />,
              value: employees.length,
              sub: (
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {CATEGORIES.map((cat) => (
                    <span key={cat} className="text-[11px] text-gray-500 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-full px-2 py-0.5">
                      {CATEGORY_LABELS[cat]}: {countByCategory[cat]}
                    </span>
                  ))}
                </div>
              ),
            },
            {
              label: "TODAY'S MEAL COUNT",
              icon: <RestaurantIcon className="w-5 h-5 text-gray-400" />,
              value: todaySuccessCount,
              sub: <p className="text-xs text-gray-500 mt-1">Jatah terpakai hari ini</p>,
            },
            {
              label: "TOTAL TRANSAKSI HARI INI",
              icon: <ReceiptIcon className="w-5 h-5 text-gray-400" />,
              value: todayTransactions.length,
              sub: <p className="text-xs text-gray-500 mt-1">Termasuk scan duplikat</p>,
            },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{card.label}</span>
                {card.icon}
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{loading ? "—" : card.value}</p>
              {card.sub}
            </div>
          ))}
        </div>

        {/* Trend Chart */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tren Status Transaksi</h3>
            <p className="text-xs text-gray-500">Merespon filter tanggal dan status</p>
          </div>
          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="5 5" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} dx={-10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
                    itemStyle={{ fontWeight: '500' }}
                    formatter={(value: any, name: any) => [`${value}`, name]}
                    labelFormatter={(label) => `Tanggal: ${label}`}
                  />
                  <Legend verticalAlign="top" height={32} />
                  <Bar dataKey="BERHASIL" name="Success" stackId="a" fill="#16a34a" />
                  <Bar dataKey="DUPLIKAT" name="Duplicate" stackId="a" fill="#f97316" />
                  <Bar dataKey="DIRESET" name="Reset" stackId="a" fill="#facc15" />
                  <Bar dataKey="NONAKTIF" name="Nonaktif" stackId="a" fill="#dc2626" />
                  <Bar dataKey="TIDAK_DIKENAL" name="Tidak Dikenal" stackId="a" fill="#9ca3af" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                Belum ada data transaksi berhasil
              </div>
            )}
          </div>
        </div>

        {/* Transactions table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Data Transaksi</h3>
              <div className="relative w-full sm:w-64">
                <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama atau ID..."
                  className="w-full bg-white dark:bg-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20"
                />
              </div>
            </div>

            {/* Filter: Bulan, Departemen, Download PDF */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20"
              >
                <option value="">Semua Tahun</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={!selectedYear}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
              >
                <option value="">Semua Bulan</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>

              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={!selectedMonth}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
              >
                <option value="">Semua Tanggal</option>
                {availableDates.map((tanggal) => (
                  <option key={tanggal} value={tanggal}>{tanggal}</option>
                ))}
              </select>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20"
              >
                <option value="">Semua Departemen</option>
                <option value="IT">IT</option>
                <option value="FINANCE">FINANCE</option>
                <option value="SALES">SALES</option>
                <option value="RESERVATION">RESERVATION</option>
                <option value="FNB">FNB</option>
                <option value="KITCHEN">KITCHEN</option>
                <option value="ENGINEERING">ENGINEERING</option>
                <option value="FO">FO</option>
                <option value="HR">HR</option>
                <option value="STYLING">STYLING</option>
                <option value="LP">LP</option>
                <option value="SPA">SPA</option>
                <option value="EVENT">EVENT</option>
              </select>

              <select
                value={selectedPos}
                onChange={(e) => setSelectedPos(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20"
              >
                <option value="">Semua Jabatan</option>
                <option value="EMP">Karyawan</option>
                <option value="TR">Training</option>
                <option value="DW">Daily Worker</option>
              </select>

              <div className="flex-1" />

              <button
                onClick={handleDownloadExcel}
                disabled={generatingExcel || txLoading || filtered.length === 0}
                className="flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingExcel ? "Membuat Excel..." : "Download Excel"}
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={generatingPdf || txLoading || filtered.length === 0}
                className="flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingPdf ? "Membuat PDF..." : "Download PDF"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="py-3 px-4 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  DATE & TIME
                </th>
                {["EMPLOYEE NAME", "EMPLOYEE ID", "CATEGORY", "DEPARTEMEN", "STATUS"].map((h) => (
                  <th key={h} className="py-3 px-4 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txLoading && (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">Memuat data...</td></tr>
              )}
              {!txLoading && paginated.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada transaksi"}
                </td></tr>
              )}
              {paginated.map((t, idx) => (
                <tr key={idx} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-gray-200">{t.tanggal}</span> <span className="text-gray-400 dark:text-gray-500 ml-1">{t.jam}</span>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-200">{t.nama}</td>
                  <td className="py-3 px-4 text-sm text-blue-600 dark:text-blue-400 font-mono">{t.id}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{categoryFromId(t.id)}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{t.departemen || "-"}</td>
                  <td className="py-3 px-4">
                    {(() => {
                      const s = String(t.status || "").toUpperCase();
                      let bg = "bg-gray-50 text-gray-600";
                      let dot = "bg-gray-400";
                      let label = t.status;
                      if (s === "BERHASIL") {
                        bg = "bg-green-50 text-green-700";
                        dot = "bg-green-500";
                        label = "Success";
                      } else if (s === "DUPLIKAT") {
                        bg = "bg-orange-50 text-orange-700";
                        dot = "bg-orange-500";
                        label = "Duplicate";
                      } else if (s === "DIRESET") {
                        bg = "bg-yellow-50 text-yellow-700";
                        dot = "bg-yellow-500";
                        label = "Reset";
                      } else if (s === "NONAKTIF") {
                        bg = "bg-red-50 text-red-700";
                        dot = "bg-red-500";
                        label = "Nonaktif";
                      } else if (s === "TIDAK DIKENAL" || s === "TIDAK_DIKENAL") {
                        bg = "bg-gray-100 text-gray-700";
                        dot = "bg-gray-500";
                        label = "Tidak Dikenal";
                      }
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          {label}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {loading ? "" : `Menampilkan ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} dari ${filtered.length} transaksi`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | "…")[]>((acc, p, i, arr) => {
                  if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`e-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-7 h-7 rounded border text-xs font-medium transition-colors ${
                        currentPage === p
                          ? "bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >{p}</button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >›</button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Floating Scan Button (bottom-right corner) ===== */}
      {role === "ADMIN" && <button
        id="fab-scan-btn"
        onClick={() => router.push("/scanner")}
        title="Scan QR Code"
        className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full text-white flex items-center justify-center transition-all active:scale-90"
        style={{
          background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
          boxShadow: "0 4px 24px rgba(22,163,74,0.5), 0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <ScannerIcon className="w-7 h-7" />
      </button>}
    </div>
  );
}
