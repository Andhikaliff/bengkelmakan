"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { useSettings } from "@/lib/use-settings";
import SettingsModal from "@/components/SettingsModal";

type Stage = "idle" | "scanning" | "result";

type ScanResult = {
  type: "success" | "failed" | "error";
  nama?: string;
  jam?: string;
  jamBerhasil?: string;
  message?: string;
} | null;

const POPUP_DURATION_MS = 3000;

export default function ScannerPage() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { settings, loaded: settingsLoaded } = useSettings();
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<ScanResult>(null);
  const [cameraError, setCameraError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isHandlingScanRef = useRef(false);
  const isCameraStartedRef = useRef(false);
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/admin/login");
    } catch {
      setLoggingOut(false);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopCamera() {
    if (isCameraStartedRef.current && scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      isCameraStartedRef.current = false;
    }
  }

  // Kamera aktif hanya saat stage === "scanning"
  useEffect(() => {
    if (stage !== "scanning") return;

    isHandlingScanRef.current = false;
    isCameraStartedRef.current = false;
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser tidak mendukung akses kamera, atau situs belum HTTPS.");
      return;
    }

    const qrCode = new Html5Qrcode("qr-reader");
    scannerRef.current = qrCode;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled || !devices?.length) {
          if (!cancelled) setCameraError("Tidak ada kamera yang terdeteksi.");
          return;
        }
        return qrCode
          .start(
            { facingMode: "user" },
            { fps: 10, qrbox: { width: 260, height: 260 } },
            handleDecoded,
            () => {}
          )
          .then(() => {
            if (cancelled) {
              qrCode.stop().catch(() => {});
            } else {
              isCameraStartedRef.current = true;
            }
          });
      })
      .catch((err) => {
        if (!cancelled)
          setCameraError("Gagal akses kamera: " + (err?.toString?.() ?? "unknown"));
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Timer kembali ke idle setelah result
  useEffect(() => {
    if (stage !== "result") return;

    returnTimerRef.current = setTimeout(() => {
      setResult(null);
      setCameraError("");
      setStage("idle");
    }, POPUP_DURATION_MS);

    return () => {
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    };
  }, [stage]);

  async function handleDecoded(decodedText: string) {
    if (isHandlingScanRef.current) return;
    isHandlingScanRef.current = true;

    // Stop camera immediately
    await stopCamera();

    let newResult: ScanResult;

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: decodedText }),
      });
      const data = await res.json();

      if (data.status === "success") {
        newResult = { type: "success", nama: data.nama, jam: data.jam };
        playSound("/sounds/ting.mp3");
      } else if (data.status === "failed") {
        newResult = { type: "failed", nama: data.nama, jam: data.jam, jamBerhasil: data.jamBerhasil };
        playSound("/sounds/alarm.mp3");
      } else {
        newResult = { type: "error", message: data.message || "QR Code tidak dikenali" };
        playSound("/sounds/alarm.mp3");
      }
    } catch {
      newResult = { type: "error", message: "Gagal terhubung ke server" };
      playSound("/sounds/alarm.mp3");
    }

    // Set result first, then change stage — React 18 batches these together
    setResult(newResult);
    setStage("result");
  }

  function playSound(src: string) {
    if (!settings.scannerSoundEnabled) return;
    try {
      const audio = new Audio(src);
      audio.volume = settings.scannerVolume;
      audio.play().catch(() => {});
    } catch {}
  }

  const isSuccess = stage === "result" && result?.type === "success";
  const isFailure = stage === "result" && (result?.type === "failed" || result?.type === "error");

  return (
    <>
      {/* 
        Render the main scanner UI (idle/scanning) always as the base layer.
        Result popups are rendered as true portals on top (fixed full-screen),
        completely independent of the parent overflow settings.
      */}
      {/* Settings and Logout buttons — always visible except during result popup */}
      {stage !== "result" && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5 transition-all"
            title="Settings"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2">
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            id="scanner-logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-500 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-white/5 transition-all"
            title="Sign out"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
            </svg>
            <span>{loggingOut ? "..." : "Sign out"}</span>
          </button>
        </div>
      )}
      <div
        className="min-h-screen flex flex-col items-center justify-center relative bg-slate-50 dark:bg-[#0f172a]"
      >
        {/* ===== IDLE: Tombol hijau besar ===== */}
        {stage === "idle" && (
          <div className="flex flex-col items-center text-center gap-10 px-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Stasiun Scan Bengkel Makan</h1>
              <p className="text-base text-gray-500 dark:text-white/40 mt-2">Tekan tombol di bawah untuk mulai scan</p>
            </div>
            <button
              id="start-scan-btn"
              onClick={() => setStage("scanning")}
              className="w-64 h-64 rounded-full text-white flex flex-col items-center justify-center gap-4 transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                boxShadow: "0 0 60px rgba(22,163,74,0.5), 0 20px 40px rgba(0,0,0,0.4)",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-20 h-20" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" strokeLinecap="round"/>
                <rect x="9" y="9" width="6" height="6" rx="0.5"/>
              </svg>
              <span className="text-3xl font-black tracking-widest">SCAN</span>
            </button>
          </div>
        )}

        {/* ===== SCANNING: Kamera ===== */}
        {stage === "scanning" && (
          <div className="flex flex-col items-center gap-6 w-full px-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Arahkan QR Code ke Kamera</h1>
              <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Scan berjalan otomatis</p>
            </div>
            <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 0 0 4000px rgba(0,0,0,0.6)" }}
            >
              <div id="qr-reader" className="w-full h-full" />
              {/* Corner markers */}
              <div className="absolute top-3 left-3 w-10 h-10 border-t-2 border-l-2 border-green-400 rounded-tl-lg pointer-events-none" />
              <div className="absolute top-3 right-3 w-10 h-10 border-t-2 border-r-2 border-green-400 rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-10 h-10 border-b-2 border-l-2 border-green-400 rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-10 h-10 border-b-2 border-r-2 border-green-400 rounded-br-lg pointer-events-none" />
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-[#0f172a]/90 p-6 text-center">
                  <p className="text-sm text-red-500 dark:text-red-400">{cameraError}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => { setStage("idle"); setCameraError(""); }}
              className="text-sm text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white/60 transition-colors mt-2"
            >
              Batal
            </button>
          </div>
        )}

        {/* Placeholder saat result — konten tersembunyi, popup di atas */}
        {stage === "result" && <div />}
      </div>

      {/* ===== RESULT: SUKSES — fixed full-screen, di luar overflow apapun ===== */}
      {isSuccess && (
        <div
          key="result-success"
          className="fixed inset-0 flex flex-col items-center justify-center px-8 z-[9999]"
          style={{ background: "#16a34a" }}
        >
          {/* Animated ring */}
          <div className="relative mb-8">
            <div
              className="w-36 h-36 rounded-full"
              style={{
                background: "rgba(255,255,255,0.15)",
                boxShadow: "0 0 0 0 rgba(255,255,255,0.4)",
                animation: "pulse-ring 1.5s ease-out infinite",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 text-white" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <h2 className="text-white text-5xl font-black text-center mb-4">Selamat Makan!</h2>
          {result?.nama && (
            <p className="text-white/80 text-xl text-center">
              Kuota makan <span className="font-bold text-white">{result.nama}</span> berhasil digunakan
            </p>
          )}
          {result?.jam && (
            <p className="text-white/50 text-base mt-3">Tercatat pukul {result.jam}</p>
          )}
          <div className="mt-10 w-56 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/70 rounded-full"
              style={{ animation: `shrinkWidth ${POPUP_DURATION_MS}ms linear forwards` }}
            />
          </div>
        </div>
      )}

      {/* ===== RESULT: GAGAL / ERROR — fixed full-screen ===== */}
      {isFailure && (
        <div
          key="result-failure"
          className="fixed inset-0 flex flex-col items-center justify-center px-8 z-[9999]"
          style={{ background: "#dc2626" }}
        >
          <div className="relative mb-8">
            <div
              className="w-36 h-36 rounded-full"
              style={{
                background: "rgba(255,255,255,0.15)",
                boxShadow: "0 0 0 0 rgba(255,255,255,0.3)",
                animation: "pulse-ring 1.5s ease-out infinite",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 text-white" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          {result?.type === "failed" ? (
            <>
              <h2 className="text-white text-4xl font-black text-center mb-4">Jatah Sudah Habis</h2>
              {result.nama && (
                <p className="text-white/80 text-xl text-center">
                  {result.jamBerhasil ? (
                    <>Jatah makan <span className="font-bold text-white">{result.nama}</span> telah digunakan pada pukul <span className="font-bold text-white">{result.jamBerhasil}</span></>
                  ) : (
                    <span className="font-bold text-white">{result.nama}</span>
                  )}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-white text-4xl font-black text-center mb-4">QR Tidak Dikenali</h2>
              <p className="text-white/80 text-xl text-center">{result?.message}</p>
            </>
          )}
          <div className="mt-10 w-56 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/50 rounded-full"
              style={{ animation: `shrinkWidth ${POPUP_DURATION_MS}ms linear forwards` }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
          70%  { box-shadow: 0 0 0 30px rgba(255,255,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        }
        @keyframes shrinkWidth {
          from { width: 100%; }
          to   { width: 0%; }
        }
        #qr-reader video { object-fit: cover; width: 100% !important; height: 100% !important; style="transform: scaleX(-1);" }
        #qr-reader img   { display: none !important; }
        #qr-reader > div[style] { border: none !important; }
      `}</style>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
