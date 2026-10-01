"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { SearchIcon, ScannerIcon } from "@/components/Icons";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DEPARTMENTS,
  type Category,
  type Employee,
} from "@/lib/canteen-shared";
import { useCurrentRole } from "@/lib/use-current-role";

export default function EmployeeManagementPage() {
  const router = useRouter();
  const role = useCurrentRole();
  const [activeCategory, setActiveCategory] = useState<Category>("EMP");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Paginasi & Filter Direktori
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  
  // Validasi Nama Duplikat (Seluruh Kategori)
  const [allExistingNames, setAllExistingNames] = useState<string[]>([]);
  
  // Add Employee
  const [showModal, setShowModal] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newDepartemen, setNewDepartemen] = useState(DEPARTMENTS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit Employee
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editDepartemen, setEditDepartemen] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  
  const [qrPreview, setQrPreview] = useState<Employee | null>(null);
  const [resetMsg, setResetMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk Add
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkNamesText, setBulkNamesText] = useState("");
  const [bulkDepartemen, setBulkDepartemen] = useState(DEPARTMENTS[0]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState<{ id: string; nama: string; departemen: string }[] | null>(null);

  // Mass Print
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printingId, setPrintingId] = useState(false);

  const requestIdRef = useRef(0);

  async function loadAllNamesForValidation() {
    try {
      const res = await fetch("/api/employees", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllExistingNames(data.map((emp: any) => String(emp.nama || "").trim().toLowerCase()));
      }
    } catch (e) {
      console.error("Failed to load names for validation", e);
    }
  }

  async function loadEmployees(category: Category) {
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?category=${category}`, { cache: "no-store" });
      const data = await res.json();
      if (requestIdRef.current === myRequestId) {
        setEmployees(Array.isArray(data) ? data : []);
      }
      loadAllNamesForValidation();
    } catch {
      if (requestIdRef.current === myRequestId) {
        setEmployees([]);
      }
    } finally {
      if (requestIdRef.current === myRequestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    setEmployees([]);
    setSearchQuery("");
    setSelectedIds(new Set());
    setSelectedDept("");
    setSelectedStatus("");
    setPage(1);
    loadEmployees(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedDept, selectedStatus]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = employees;

    if (selectedDept) {
      const target = selectedDept.toUpperCase();
      result = result.filter(emp => (emp.departemen || "").toUpperCase() === target);
    }

    if (selectedStatus) {
      const target = selectedStatus.toUpperCase();
      result = result.filter(emp => String(emp.status || "AKTIF").toUpperCase() === target);
    }

    if (!q) return result;
    return result.filter(
      (emp) => emp.nama.toLowerCase().includes(q) || emp.id.toLowerCase().includes(q)
    );
  }, [employees, searchQuery, selectedDept, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectAll = filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length;

  function toggleSelectAll() {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map(e => e.id)));
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const cleanName = newNama.trim().toLowerCase();
    if (allExistingNames.includes(cleanName)) {
      setFormError(`Nama "${newNama.trim()}" sudah ada di dalam data karyawan.`);
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeCategory,
          nama: newNama.trim(),
          departemen: newDepartemen.trim(),
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setShowModal(false);
        setQrPreview({ id: data.id, nama: data.nama, departemen: newDepartemen, category: activeCategory });
        setNewNama("");
        setNewDepartemen(DEPARTMENTS[0]);
        loadEmployees(activeCategory);
      } else {
        setFormError(data.message || "Gagal menambah karyawan");
      }
    } catch {
      setFormError("Terjadi kesalahan, coba lagi");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;
    setEditError("");
    setEditSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeCategory,
          id: editingEmployee.id,
          nama: editNama.trim(),
          departemen: editDepartemen.trim(),
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setEditingEmployee(null);
        loadEmployees(activeCategory);
      } else {
        setEditError(data.message || "Gagal mengubah karyawan");
      }
    } catch {
      setEditError("Terjadi kesalahan, coba lagi");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();
    setBulkError("");
    const names = bulkNamesText.split("\n").map((n) => n.trim()).filter((n) => n.length > 0);
    if (names.length === 0) {
      setBulkError("Masukkan minimal 1 nama");
      return;
    }

    // 1. Pengecekan nama duplikat dalam input text area sendiri
    const inputNamesLower = names.map(n => n.toLowerCase());
    const inputSet = new Set(inputNamesLower);
    if (inputSet.size !== names.length) {
      const duplicatesInInput = names.filter((n, idx) => inputNamesLower.indexOf(n.toLowerCase()) !== idx);
      setBulkError(`Ada nama duplikat di dalam daftar input Anda: ${Array.from(new Set(duplicatesInInput)).join(", ")}`);
      return;
    }

    // 2. Pengecekan nama duplikat terhadap database yang ada (Seluruh Kategori)
    const duplicatesInDb = names.filter(n => allExistingNames.includes(n.toLowerCase()));
    if (duplicatesInDb.length > 0) {
      setBulkError(`Nama berikut sudah terdaftar di sistem: ${duplicatesInDb.join(", ")}`);
      return;
    }

    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/employees/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeCategory,
          namas: names,
          departemen: bulkDepartemen,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setShowBulkModal(false);
        setBulkResult(data.added || []);
        setBulkNamesText("");
        setBulkDepartemen(DEPARTMENTS[0]);
        loadEmployees(activeCategory);
      } else {
        setBulkError(data.message || "Gagal menambah karyawan secara massal");
      }
    } catch {
      setBulkError("Terjadi kesalahan, coba lagi");
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleToggleStatus(emp: Employee) {
    setTogglingId(emp.id);
    try {
      const res = await fetch("/api/employees/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: activeCategory, id: emp.id }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setEmployees(employees.map(e => e.id === emp.id ? { ...e, status: data.newStatus } : e));
      } else {
        alert(data.message || "Gagal mengubah status");
      }
    } catch {
      alert("Terjadi kesalahan, coba lagi");
    } finally {
      setTogglingId(null);
    }
  }

  async function downloadQRWithMetadata(emp: Employee) {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#111827"; 
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(emp.nama, 300, 100);

    ctx.fillStyle = "#2563eb"; 
    ctx.font = "30px monospace";
    ctx.fillText(emp.id, 300, 150);

    ctx.fillStyle = "#6b7280"; 
    ctx.font = "24px sans-serif";
    ctx.fillText(`${CATEGORY_LABELS[activeCategory]} • ${emp.departemen || "-"}`, 300, 200);

    const qrCanvas = document.getElementById(`qr-print-${emp.id}`) as HTMLCanvasElement;
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 100, 250, 400, 400);
    }

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `QR_${emp.id}_${emp.nama}.png`;
    link.click();
  }

  async function generateIdCards() {
    setPrintingId(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const cards = employees.filter(e => selectedIds.has(e.id));
      
      const cardWidth = 85;
      const cardHeight = 55;
      const marginX = 15;
      const marginY = 15;
      const gapX = 10;
      const gapY = 10;
      
      let x = marginX;
      let y = marginY;
      let countOnPage = 0;

      for (let i = 0; i < cards.length; i++) {
        const emp = cards[i];

        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, cardWidth, cardHeight);

        doc.setFillColor(22, 163, 74);
        doc.rect(x, y, cardWidth, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("BENGKEL MAKAN", x + cardWidth/2, y + 8, { align: "center" });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(emp.nama, x + cardWidth/2, y + 20, { align: "center" });
        
        doc.setTextColor(37, 99, 235);
        doc.setFontSize(10);
        doc.setFont("courier", "normal");
        doc.text(emp.id, x + cardWidth/2, y + 26, { align: "center" });

        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`${CATEGORY_LABELS[activeCategory]} • ${emp.departemen || "-"}`, x + cardWidth/2, y + 31, { align: "center" });

        const qrCanvas = document.getElementById(`qr-print-${emp.id}`) as HTMLCanvasElement;
        if (qrCanvas) {
          const qrData = qrCanvas.toDataURL("image/png");
          doc.addImage(qrData, 'PNG', x + (cardWidth - 20)/2, y + 33, 20, 20);
        }

        countOnPage++;
        if (countOnPage % 2 === 0) {
          x = marginX;
          y += cardHeight + gapY;
        } else {
          x += cardWidth + gapX;
        }

        if (countOnPage === 8 && i < cards.length - 1) {
          doc.addPage();
          x = marginX;
          y = marginY;
          countOnPage = 0;
        }
      }

      doc.save(`ID_Cards_${CATEGORY_LABELS[activeCategory]}.pdf`);
    } catch (e) {
      alert("Gagal membuat PDF ID Card");
    } finally {
      setPrintingId(false);
    }
  }

  async function handleResetToday(emp: Employee) {
    if (!window.confirm(`Reset jatah makan hari ini untuk ${emp.nama} (${emp.id})?`)) return;
    setResettingId(emp.id);
    setResetMsg(null);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id }),
      });
      const data = await res.json();
      setResetMsg({ id: emp.id, text: data.message, ok: data.status === "success" });
    } catch {
      setResetMsg({ id: emp.id, text: "Gagal reset, coba lagi", ok: false });
    } finally {
      setResettingId(null);
      setTimeout(() => setResetMsg(null), 4000);
    }
  }

  async function handleDeleteEmployee(emp: Employee) {
    if (!window.confirm(`Hapus ${emp.nama} (${emp.id})?`)) return;
    setDeletingId(emp.id);
    try {
      const res = await fetch("/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: activeCategory, id: emp.id }),
      });
      const data = await res.json();
      if (data.status === "success") {
        loadEmployees(activeCategory);
      } else {
        alert(data.message || "Gagal menghapus karyawan");
      }
    } catch {
      alert("Terjadi kesalahan, coba lagi");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] dark:bg-gray-950">
      <Navbar />

      <div className="px-6 py-6 max-w-[1200px] mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Employee Directory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage Bengkel Makan access and QR code generation for staff.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 rounded-lg p-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeCategory === cat ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="relative w-full sm:w-48 mt-2 sm:mt-0">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari nama atau ID...`}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20 bg-white dark:bg-gray-900 dark:text-white"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20"
          >
            <option value="">Semua Departemen</option>
            {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/20"
          >
            <option value="">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="NONAKTIF">Nonaktif</option>
          </select>

          {role === "ADMIN" && <>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-base leading-none">+</span> Add {CATEGORY_LABELS[activeCategory]}
            </button>
            <button onClick={() => setShowBulkModal(true)} className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-base leading-none">+</span> Bulk Add
            </button>
          </>}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="py-3 px-4 w-12 text-center">
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
                </th>
                {["EMPLOYEE", "EMPLOYEE ID", "DEPARTEMEN", "STATUS", "QR CODE", "ACTIONS"].map((h) => (
                  <th key={h} className="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Memuat data...</td></tr>}
              {!loading && employees.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Belum ada data</td></tr>}
              {!loading && employees.length > 0 && paginatedEmployees.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Tidak ada hasil</td></tr>}
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-4 text-center">
                    <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)} className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 shrink-0">
                        {emp.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{emp.nama}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-blue-600 dark:text-blue-400 font-mono">{emp.id}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{emp.departemen || "-"}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${emp.status === "NONAKTIF" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.status === "NONAKTIF" ? "bg-red-500" : "bg-green-500"}`} />
                      {emp.status === "NONAKTIF" ? "Nonaktif" : "Aktif"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <QRCodeCanvas id={`qr-${emp.id}`} value={emp.id} size={40} includeMargin={true} />
                    {/* Hidden canvas for high-res download and PDF print */}
                    <div className="hidden">
                      <QRCodeCanvas id={`qr-print-${emp.id}`} value={emp.id} size={512} includeMargin={true} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => setQrPreview(emp)} className="text-xs font-medium text-gray-600 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors">QR</button>
                      {role === "ADMIN" && <>
                        <button onClick={() => { setEditingEmployee(emp); setEditNama(emp.nama); setEditDepartemen(emp.departemen || DEPARTMENTS[0]); }} className="text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md px-2 py-1 hover:bg-indigo-50 transition-colors">Edit</button>
                        <button onClick={() => handleToggleStatus(emp)} disabled={togglingId === emp.id} className="text-xs font-medium text-orange-600 border border-orange-200 rounded-md px-2 py-1 hover:bg-orange-50 transition-colors disabled:opacity-50">
                          {togglingId === emp.id ? "..." : (emp.status === "NONAKTIF" ? "Aktifkan" : "Nonaktifkan")}
                        </button>
                        <button onClick={() => handleResetToday(emp)} disabled={resettingId === emp.id} className="text-xs font-medium text-amber-600 border border-amber-200 rounded-md px-2 py-1 hover:bg-amber-50 transition-colors disabled:opacity-50">
                          {resettingId === emp.id ? "..." : "Reset"}
                        </button>
                        <button onClick={() => handleDeleteEmployee(emp)} disabled={deletingId === emp.id} className="text-xs font-medium text-red-600 border border-red-200 rounded-md px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-50">
                          {deletingId === emp.id ? "..." : "Hapus"}
                        </button>
                      </>}
                    </div>
                    {resetMsg?.id === emp.id && (
                      <p className={`text-[11px] mt-1 ${resetMsg.ok ? "text-green-600" : "text-red-500"}`}>{resetMsg.text}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {/* Pagination */}
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {loading ? "" : `Menampilkan ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredEmployees.length)} dari ${filteredEmployees.length} karyawan`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
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
                          ? "bg-gray-900 dark:bg-gray-200 border-gray-900 dark:border-white text-white dark:text-gray-900"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >{p}</button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >›</button>
            </div>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 px-6 flex items-center justify-between z-40">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedIds.size} karyawan dipilih</p>
          <div className="flex gap-3">
            <button onClick={() => setSelectedIds(new Set())} className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors px-4 py-2">
              Batal
            </button>
            <button onClick={generateIdCards} disabled={printingId} className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-6 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">
              {printingId ? "Menyusun PDF..." : "Cetak Kartu ID (PDF)"}
            </button>
          </div>
        </div>
      )}

      {role === "ADMIN" && <button id="fab-scan-btn" onClick={() => router.push("/scanner")} title="Scan QR Code" className="fixed bottom-24 right-6 z-40 w-16 h-16 rounded-full text-white flex items-center justify-center transition-all active:scale-90" style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", boxShadow: "0 4px 24px rgba(22,163,74,0.5), 0 2px 8px rgba(0,0,0,0.3)" }}>
        <ScannerIcon className="w-7 h-7" />
      </button>}

      {/* Modal Tambah */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Tambah {CATEGORY_LABELS[activeCategory]}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">ID akan dibuat otomatis.</p>
            <form onSubmit={handleAddEmployee} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">Nama Lengkap</label>
                <input type="text" value={newNama} onChange={(e) => setNewNama(e.target.value)} required autoFocus placeholder="contoh: Budi Santoso" className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/15 dark:focus:ring-white/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">Departemen</label>
                <select value={newDepartemen} onChange={(e) => setNewDepartemen(e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/15 dark:focus:ring-white/20">
                  {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => { setShowModal(false); setFormError(""); setNewNama(""); setNewDepartemen(DEPARTMENTS[0]); }} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Batal</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">{submitting ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Edit {CATEGORY_LABELS[activeCategory]}</h3>
            <form onSubmit={handleEditEmployee} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">Nama Lengkap</label>
                <input type="text" value={editNama} onChange={(e) => setEditNama(e.target.value)} required autoFocus className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/15 dark:focus:ring-white/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">Departemen</label>
                <select value={editDepartemen} onChange={(e) => setEditDepartemen(e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/15 dark:focus:ring-white/20">
                  {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>
              {editError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</p>}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setEditingEmployee(null)} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Batal</button>
                <button type="submit" disabled={editSubmitting} className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">{editSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bulk Add */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Bulk Add {CATEGORY_LABELS[activeCategory]}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Tulis satu nama per baris.</p>
            <form onSubmit={handleBulkAdd} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">Daftar Nama</label>
                <textarea value={bulkNamesText} onChange={(e) => setBulkNamesText(e.target.value)} required autoFocus rows={7} placeholder={"contoh:\nBudi Santoso\nSiti Aminah"} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/15 dark:focus:ring-white/20 font-mono resize-none" />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{bulkNamesText.split("\n").map((n) => n.trim()).filter((n) => n.length > 0).length} nama terdeteksi</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">Departemen (untuk semua)</label>
                <select value={bulkDepartemen} onChange={(e) => setBulkDepartemen(e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/15 dark:focus:ring-white/20">
                  {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>
              {bulkError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{bulkError}</p>}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => { setShowBulkModal(false); setBulkError(""); setBulkNamesText(""); setBulkDepartemen(DEPARTMENTS[0]); }} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Batal</button>
                <button type="submit" disabled={bulkSubmitting} className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">{bulkSubmitting ? "Menyimpan..." : "Simpan Semua"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hasil Bulk Add */}
      {bulkResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[85vh] flex flex-col">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3 shrink-0"><span className="text-green-600 text-xl">✓</span></div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 text-center">{bulkResult.length} Orang Berhasil Ditambahkan</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 text-center">Tutup lalu klik Cetak Kartu ID untuk print massal, atau download satu per satu</p>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 -mx-1 px-1">
              {bulkResult.map((person) => (
                <div key={person.id} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{person.nama}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">{person.id}</p>
                  </div>
                  <button onClick={() => downloadQRWithMetadata({ ...person, category: activeCategory })} className="shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Download QR</button>
                  <div className="hidden"><QRCodeCanvas id={`qr-print-${person.id}`} value={person.id} size={512} includeMargin={true} /></div>
                </div>
              ))}
            </div>
            <button onClick={() => setBulkResult(null)} className="mt-4 w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shrink-0">Selesai</button>
          </div>
        </div>
      )}

      {/* Modal QR Preview */}
      {qrPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-xs text-center shadow-xl">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">QR Code Preview</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{qrPreview.nama} — <span className="font-mono text-blue-600 dark:text-blue-400">{qrPreview.id}</span></p>
            <div className="flex justify-center mb-5 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <QRCodeCanvas id={`qr-display-${qrPreview.id}`} value={qrPreview.id} size={220} includeMargin={true} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setQrPreview(null)} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Tutup</button>
              <button onClick={() => downloadQRWithMetadata(qrPreview)} className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">Download QR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
