import { NextRequest, NextResponse } from "next/server";
import { transporter, getSender } from "@/lib/mailer";
import { getTransactions, type Transaction } from "@/lib/sheets";
import { buildTransactionsWorkbook } from "@/lib/excel";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TIMEZONE = "Asia/Makassar"; // WITA, tetap UTC+8 sepanjang tahun (tanpa DST)
const WITA_OFFSET = "+08:00";
const HOUR_MS = 60 * 60 * 1000;

const BULAN_INDO = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Baca bagian tanggal "yyyy-MM-dd", jam (0-23), tahun & bulan sebuah Date dalam WITA.
function witaParts(date: Date): { ymd: string; hour: number; y: number; m: number } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE, hour: "2-digit", hour12: false, hourCycle: "h23",
  }).format(date);
  const [y, m] = ymd.split("-").map(Number);
  return { ymd, hour: Number(hourStr), y, m };
}

// Konversi pasangan tanggal + jam sebuah transaksi (keduanya sudah dalam WITA)
// menjadi epoch ms supaya bisa dibandingkan dengan batas jendela waktu.
function transactionTimeMs(t: Transaction): number {
  const jam = (t.jam || "").trim();
  const time = jam.length === 5 ? `${jam}:00` : jam || "00:00:00";
  return new Date(`${t.tanggal}T${time}${WITA_OFFSET}`).getTime();
}

// Daftar { month, year } (nama bulan Indonesia) dari bulan `from` sampai `to`
// inklusif. Dipakai agar laporan harian tetap menangkap transaksi saat jendela
// waktu melewati batas bulan / tahun.
function monthYearList(from: Date, to: Date): { month: string; year: string }[] {
  const f = witaParts(from);
  const t = witaParts(to);
  const out: { month: string; year: string }[] = [];
  let y = f.y;
  let m = f.m;
  while (y < t.y || (y === t.y && m <= t.m)) {
    out.push({ month: BULAN_INDO[m - 1], year: String(y) });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function clampInt(raw: string | null | undefined, def: number, min: number, max: number): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const key = searchParams.get("key");
    const type = searchParams.get("type") || "daily";

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || key !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recipients = process.env.REPORT_RECIPIENTS;
    if (!recipients) {
      return NextResponse.json({ error: "No recipients configured" }, { status: 400 });
    }

    // ── Konfigurasi jendela waktu laporan ────────────────────────────────
    // startHour  : jam "cut-off" harian (WITA) tempat jendela dimulai/berakhir.
    // windowHours: berapa jam jendela membentang ke belakang dari batas cut-off.
    // Diatur lewat .env.local (REPORT_START_HOUR / REPORT_WINDOW_HOURS) dan bisa
    // di-override via query string (?startHour=7&windowHours=24) untuk tes cepat.
    const startHour = clampInt(
      searchParams.get("startHour") ?? process.env.REPORT_START_HOUR, 7, 0, 23);
    const windowHours = clampInt(
      searchParams.get("windowHours") ?? process.env.REPORT_WINDOW_HOURS, 24, 1, 24 * 31);

    const now = new Date();
    const nowP = witaParts(now);

    const fullFmt = new Intl.DateTimeFormat("id-ID", {
      timeZone: TIMEZONE, dateStyle: "full", timeStyle: "short", hourCycle: "h23",
    });

    // Batas akhir jendela = batas startHour terbaru yang SUDAH terjadi (<= now).
    // Jadi cron yang jalannya molor sedikit (mis. 07:12) tetap memakai jendela
    // yang sama: [kemarin 07:00, hari ini 07:00).
    let endMs = new Date(`${nowP.ymd}T${pad2(startHour)}:00:00${WITA_OFFSET}`).getTime();
    if (endMs > now.getTime()) endMs -= 24 * HOUR_MS;
    const end = new Date(endMs);
    const start = new Date(endMs - windowHours * HOUR_MS);

    let filteredTransactions: Transaction[];
    let periodLabel: string;

    if (type === "daily") {
      // Kumpulkan transaksi dari semua bulan yang tersentuh jendela waktu, lalu
      // saring presisi per-jam berdasarkan tanggal + jam transaksi (WITA).
      const collected: Transaction[] = [];
      for (const my of monthYearList(start, end)) {
        collected.push(...(await getTransactions(my.month, my.year)));
      }
      const sMs = start.getTime();
      const eMs = end.getTime();
      filteredTransactions = collected.filter((t) => {
        if (!t?.tanggal) return false;
        const ms = transactionTimeMs(t);
        return ms >= sMs && ms < eMs; // [start, end): start inklusif, end eksklusif
      });
      periodLabel = `Harian (${fullFmt.format(start)} - ${fullFmt.format(end)} WITA)`;
    } else {
      // Mingguan/bulanan: tetap pakai perilaku lama (berdasarkan tanggal kalender).
      const month = BULAN_INDO[nowP.m - 1];
      const year = String(nowP.y);
      const allTransactions = await getTransactions(month, year);
      const todayYMD = nowP.ymd;
      if (type === "weekly") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * HOUR_MS);
        const sevenDaysYMD = witaParts(sevenDaysAgo).ymd;
        filteredTransactions = allTransactions.filter(
          (t) => t.tanggal >= sevenDaysYMD && t.tanggal <= todayYMD);
        periodLabel = `Mingguan (${fullFmt.format(sevenDaysAgo)} - ${fullFmt.format(now)} WITA)`;
      } else {
        filteredTransactions = allTransactions;
        periodLabel = `Bulanan (${month} ${year})`;
      }
    }

    const buffer = await buildTransactionsWorkbook(filteredTransactions, {
      monthLabel: `Laporan ${periodLabel}`,
      deptLabel: "Semua Departemen",
    });

    const totalBerhasil = filteredTransactions.filter(t => t.status === "BERHASIL").length;
    const totalDuplikat = filteredTransactions.filter(t => t.status === "DUPLIKAT").length;

    const htmlBody = `
      <h2>Laporan Transaksi Bengkel Makan</h2>
      <p>Berikut adalah laporan otomatis untuk periode: <strong>${periodLabel}</strong></p>
      ${type === "daily" ? `<p><small>Jendela waktu: ${windowHours} jam, cut-off harian pukul ${pad2(startHour)}:00 WITA.</small></p>` : ""}

      <h3>Ringkasan Transaksi:</h3>
      <ul>
        <li><strong>Total Berhasil:</strong> ${totalBerhasil}</li>
        <li><strong>Total Duplikat:</strong> ${totalDuplikat}</li>
        <li><strong>Total Transaksi:</strong> ${filteredTransactions.length}</li>
      </ul>

      <p>Rincian lengkap dapat dilihat pada file Excel terlampir.</p>

      <br>
      <p><small>Laporan ini di-generate secara otomatis oleh Bengkel Makan Management System.</small></p>
    `;

    const fileDate = witaParts(type === "daily" ? end : now).ymd;
    const filename = `Laporan_Bengkel_Makan_${type}_${fileDate}.xlsx`;

    const info = await transporter.sendMail({
      from: getSender(),
      to: recipients,
      cc: process.env.REPORT_CC || "",
      subject: `[Bengkel Makan] Laporan ${periodLabel}`,
      html: htmlBody,
      attachments: [
        {
          filename: filename,
          content: Buffer.from(buffer),
        }
      ]
    });

    await logAudit({
      action: "EXPORT_DATA",
      description: `Mengirim email laporan ${type} ke ${recipients}`,
      status: "SUCCESS",
      metadata: { type, recipients, messageId: info.messageId, startHour, windowHours }
    });

    return NextResponse.json({
      status: "success",
      message: `Email sent to ${recipients}`,
      messageId: info.messageId,
      period: { start: start.toISOString(), end: end.toISOString(), windowHours, startHour },
      total: filteredTransactions.length,
    });
  } catch (err: any) {
    console.error("Gagal mengirim email:", err);
    await logAudit({
      action: "EXPORT_DATA",
      description: `Gagal mengirim email laporan: ${err.message}`,
      status: "FAILED",
    });
    return NextResponse.json({ error: "Failed to send email", details: err.message }, { status: 500 });
  }
}
