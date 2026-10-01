import { NextRequest, NextResponse } from "next/server";
import { transporter, getSender } from "@/lib/mailer";
import { getTransactions } from "@/lib/sheets";
import { buildTransactionsWorkbook } from "@/lib/excel";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

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

    // Tentukan rentang waktu berdasarkan tipe (daily/weekly/monthly)
    const now = new Date();
    
    // Konversi ke WITA (Asia/Makassar) untuk format label
    const formatter = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      dateStyle: "full",
    });
    
    // Ambil data transaksi
    // Untuk laporan harian, kita bisa filter yang tanggalnya hari ini.
    // getTransactions mendukung filter by month dan year. Kita ambil semua bulan ini dan filter manual di sini.
    const monthFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Makassar", month: "numeric" });
    const yearFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Makassar", year: "numeric" });
    const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }); // YYYY-MM-DD
    
    const bulanIndo = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    
    const month = bulanIndo[Number(monthFormatter.format(now)) - 1];
    const year = yearFormatter.format(now);
    const todayYMD = dayFormatter.format(now); // yyyy-mm-dd
    
    const allTransactions = await getTransactions(month, year);
    
    let filteredTransactions = allTransactions;
    let periodLabel = "";
    
    if (type === "daily") {
      filteredTransactions = allTransactions.filter(t => t.tanggal === todayYMD);
      periodLabel = `Harian (${formatter.format(now)})`;
    } else if (type === "weekly") {
      // 7 hari terakhir
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysYMD = dayFormatter.format(sevenDaysAgo);
      filteredTransactions = allTransactions.filter(t => t.tanggal >= sevenDaysYMD && t.tanggal <= todayYMD);
      periodLabel = `Mingguan (${formatter.format(sevenDaysAgo)} - ${formatter.format(now)})`;
    } else {
      // Monthly
      periodLabel = `Bulanan (${month} ${year})`;
    }

    const buffer = await buildTransactionsWorkbook(filteredTransactions, { 
      monthLabel: `Laporan ${periodLabel}`, 
      deptLabel: "Semua Departemen" 
    });

    const totalBerhasil = filteredTransactions.filter(t => t.status === "BERHASIL").length;
    const totalDuplikat = filteredTransactions.filter(t => t.status === "DUPLIKAT").length;
    
    const htmlBody = `
      <h2>Laporan Transaksi Bengkel Makan</h2>
      <p>Berikut adalah laporan otomatis untuk periode: <strong>${periodLabel}</strong></p>
      
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

    const filename = `Laporan_Bengkel_Makan_${type}_${todayYMD}.xlsx`;

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
      metadata: { type, recipients, messageId: info.messageId }
    });

    return NextResponse.json({ status: "success", message: `Email sent to ${recipients}`, messageId: info.messageId });
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
