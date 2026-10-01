"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Stage = "idle" | "scanning" | "result";

type ScanResult = {
  type: "success" | "failed" | "error";
  nama?: string;
  jam?: string;
  jamBerhasil?: string;
  message?: string;
} | null;

const POPUP_DURATION_MS = 4000;

type ScannerModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ScannerModal({ open, onClose }: ScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<ScanResult>(null);
  const [cameraError, setCameraError] = useState("");
  const isHandlingScanRef = useRef(false);
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state saat modal dibuka/ditutup
  useEffect(() => {
    if (open) {
      setStage("idle");
      setResult(null);
      setCameraError("");
      isHandlingScanRef.current = false;
    } else {
      // Matikan kamera kalau modal ditutup saat sedang scanning
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
      }
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    }
  }, [open]);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Kamera hanya aktif saat stage === "scanning" dan modal terbuka
  useEffect(() => {
    if (!open || stage !== "scanning") return;

    const qrRegionId = "qr-reader-modal";
    let isCancelled = false;
    let isStarted = false;
    isHandlingScanRef.current = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Browser tidak mendukung akses kamera, atau situs tidak diakses lewat HTTPS.");
      return;
    }

    const html5QrCode = new Html5Qrcode(qrRegionId);
    scannerRef.current = html5QrCode;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (isCancelled) return;
        if (!devices || devices.length === 0) {
          setCameraError("Tidak ada kamera yang terdeteksi.");
          return;
        }
        return html5QrCode
          .start(
            { facingMode: "user" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            handleDecoded,
            () => {}
          )
          .then(() => {
            if (isCancelled) {
              html5QrCode.stop().catch(() => {});
              return;
            }
            isStarted = true;
          });
      })
      .catch((err) => {
        if (!isCancelled)
          setCameraError("Gagal mengakses kamera: " + (err?.toString?.() || "unknown error"));
      });

    return () => {
      isCancelled = true;
      if (isStarted && scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, open]);

  // Timer kembali ke idle setelah result ditampilkan
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

    // Matikan kamera supaya tidak baca QR lain
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
    }

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: decodedText }),
      });
      const data = await res.json();

      if (data.status === "success") {
        setResult({ type: "success", nama: data.nama, jam: data.jam });
        playSound("/sounds/ting.mp3");
      } else if (data.status === "failed") {
        setResult({ type: "failed", nama: data.nama, jam: data.jam, jamBerhasil: data.jamBerhasil });
        playSound("/sounds/alarm.mp3");
      } else {
        setResult({ type: "error", message: data.message || "QR Code tidak dikenali" });
        playSound("/sounds/alarm.mp3");
      }
    } catch {
      setResult({ type: "error", message: "Gagal terhubung ke server" });
      playSound("/sounds/alarm.mp3");
    }

    setStage("result");
  }

  function playSound(src: string) {
    const audio = new Audio(src);
    audio.play().catch(() => {});
  }

  function handleClose() {
    if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
    }
    setStage("idle");
    setResult(null);
    setCameraError("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal container */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-[#111827] rounded-2xl shadow-2xl overflow-hidden border border-white/10">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white">Scan QR Code</h2>
            <p className="text-xs text-white/40 mt-0.5">Arahkan kartu QR ke kamera</p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">

          {/* ===== IDLE ===== */}
          {stage === "idle" && (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-green-400" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" strokeLinecap="round"/>
                  <rect x="9" y="9" width="6" height="6" rx="0.5"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white/70 text-sm">Kamera akan aktif setelah tombol ditekan</p>
              </div>
              <button
                id="start-scan-btn"
                onClick={() => setStage("scanning")}
                className="w-full bg-green-500 hover:bg-green-400 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-lg shadow-green-500/20"
              >
                Mulai Scan
              </button>
            </div>
          )}

          {/* ===== SCANNING ===== */}
          {stage === "scanning" && (
            <div className="flex flex-col gap-4">
              <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden">
                <div id="qr-reader-modal" className="w-full h-full" />
                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center">
                    <p className="text-sm text-red-400">{cameraError}</p>
                  </div>
                )}
                {/* Corner decorations */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-green-400 rounded-tl-md pointer-events-none" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-green-400 rounded-tr-md pointer-events-none" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-green-400 rounded-bl-md pointer-events-none" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-green-400 rounded-br-md pointer-events-none" />
              </div>
              <p className="text-center text-xs text-white/40">Scan berjalan otomatis saat QR terdeteksi</p>
            </div>
          )}

          {/* ===== RESULT: SUKSES ===== */}
          {stage === "result" && result?.type === "success" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-green-400" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-green-400">Selamat Makan!</h3>
                {result.nama && (
                  <p className="text-white/70 text-sm mt-1">
                    Kuota makan <span className="font-semibold text-white">{result.nama}</span> berhasil digunakan
                  </p>
                )}
                {result.jam && (
                  <p className="text-white/40 text-xs mt-2">Tercatat pukul {result.jam}</p>
                )}
              </div>
              {/* Progress bar countdown */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ animation: `shrinkWidth ${POPUP_DURATION_MS}ms linear forwards` }}
                />
              </div>
              <button
                onClick={() => { setStage("idle"); setResult(null); }}
                className="w-full border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-sm font-medium py-2.5 rounded-xl transition-all"
              >
                Scan Lagi
              </button>
            </div>
          )}

          {/* ===== RESULT: GAGAL / DUPLIKAT / ERROR ===== */}
          {stage === "result" && (result?.type === "failed" || result?.type === "error") && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-red-400" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-center">
                {result?.type === "failed" ? (
                  <>
                    <h3 className="text-lg font-bold text-red-400">Jatah Sudah Habis</h3>
                    {result.nama && (
                      <p className="text-white/70 text-sm mt-1">
                        {result.jamBerhasil
                          ? <>Jatah makan <span className="font-semibold text-white">{result.nama}</span> telah digunakan pukul <span className="font-semibold text-white">{result.jamBerhasil}</span></>
                          : <span className="font-semibold text-white">{result.nama}</span>
                        }
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-bold text-red-400">QR Tidak Dikenali</h3>
                    <p className="text-white/70 text-sm mt-1">{result?.message}</p>
                  </>
                )}
              </div>
              {/* Progress bar countdown */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ animation: `shrinkWidth ${POPUP_DURATION_MS}ms linear forwards` }}
                />
              </div>
              <button
                onClick={() => { setStage("idle"); setResult(null); }}
                className="w-full border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-sm font-medium py-2.5 rounded-xl transition-all"
              >
                Scan Lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
