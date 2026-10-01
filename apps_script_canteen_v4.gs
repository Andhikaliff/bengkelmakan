// ====== KONFIGURASI ======
const SPREADSHEET_ID = "1UgxsnAzgwNIVr0chcu4_2NSiOorhTthyK2gSTGm7EMQ";

const CATEGORY_SHEETS = {
  EMP: "Karyawan",
  TR: "Training",
  DW: "DW"
};

// Prefix nama tab transaksi bulanan. Setiap bulan baru, sheet baru otomatis dibuat
// dengan nama "Transaksi <NamaBulan> <Tahun>", contoh: "Transaksi Juli 2026".
// Format nama ini mencegah tab bulan yang sama dari tahun berbeda tercampur.
const TRANSAKSI_PREFIX = "Transaksi ";

const BULAN_INDO = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function parseTransactionSheetName(name) {
  const cleaned = String(name).trim();
  if (!cleaned.startsWith(TRANSAKSI_PREFIX)) {
    return { month: "", year: "" };
  }
  const payload = cleaned.substring(TRANSAKSI_PREFIX.length).trim();
  const match = payload.match(/^(.*?)(?:\s+(\d{4}))?$/);
  return {
    month: match ? String(match[1] || "").trim() : "",
    year: match && match[2] ? String(match[2]) : "",
  };
}

// Daftar departemen yang tersedia (untuk referensi/validasi ringan; dropdown utama ada di frontend)
const DEPARTMENTS = [
  "IT", "FO", "Styling", "B&F", "Engineering", "Kitchen",
  "Sales", "HR", "Finance", "LP", "Spa", "Reservation"
];

function getMasterSheetByCategory(ss, category) {
  const sheetName = CATEGORY_SHEETS[category];
  if (!sheetName) return null;
  return ss.getSheetByName(sheetName);
}

function getCategoryFromId(id) {
  const match = String(id).trim().match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : null;
}

function normalizeId(id) {
  return String(id).trim().toUpperCase();
}

// ====== SHEET TRANSAKSI BULANAN ======

// Nama sheet transaksi untuk suatu tanggal, contoh: "Transaksi Juli 2026"
function getMonthSheetName(date) {
  const monthIndex = Number(Utilities.formatDate(date, "Asia/Makassar", "M")) - 1;
  const year = Utilities.formatDate(date, "Asia/Makassar", "yyyy");
  return `${TRANSAKSI_PREFIX}${BULAN_INDO[monthIndex]} ${year}`;
}

// Ambil sheet transaksi bulan ini; kalau belum ada, buat otomatis lengkap dengan
// header, freeze row, dan conditional formatting warna (hijau/merah/kuning)
// supaya tampilannya rapi tanpa perlu di-setup manual tiap bulan.
function getOrCreateMonthSheet(ss, date) {
  const sheetName = getMonthSheetName(date);
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, 6).setValues([["ID", "NAMA", "DEPARTEMEN", "TANGGAL", "JAM", "STATUS"]]);
    sheet.getRange(1, 1, 1, 6)
      .setFontWeight("bold")
      .setFontColor("#ffffff")
      .setBackground("#dc6f6f");
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 6, 120);
    applyStatusConditionalFormatting(sheet);
  }

  return sheet;
}

// Terapkan conditional formatting otomatis: BERHASIL=hijau, DUPLIKAT=merah, DIRESET=kuning.
// Kolom STATUS ada di kolom F (index 6).
function applyStatusConditionalFormatting(sheet) {
  const range = sheet.getRange("A2:F1000");

  const ruleBerhasil = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$F2="BERHASIL"')
    .setBackground("#d1fae5")
    .setFontColor("#065f46")
    .setRanges([range])
    .build();

  const ruleDuplikat = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$F2="DUPLIKAT"')
    .setBackground("#fee2e2")
    .setFontColor("#991b1b")
    .setRanges([range])
    .build();

  const ruleDireset = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$F2="DIRESET"')
    .setBackground("#fef9c3")
    .setFontColor("#854d0e")
    .setRanges([range])
    .build();

  const ruleTidakDikenal = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$F2="TIDAK DIKENAL"')
    .setBackground("#f3f4f6")
    .setFontColor("#374151")
    .setRanges([range])
    .build();

  const ruleNonaktif = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$F2="NONAKTIF"')
    .setBackground("#e5e7eb")
    .setFontColor("#4b5563")
    .setRanges([range])
    .build();

  sheet.setConditionalFormatRules([ruleBerhasil, ruleDuplikat, ruleDireset, ruleTidakDikenal, ruleNonaktif]);
}

// Daftar semua sheet transaksi yang ada (untuk dropdown filter bulan di frontend).
// Urutan terbaru duluan (asumsi sheet baru selalu ditambah di paling kanan).
function getAvailableMonths() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const months = [];

  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name.indexOf(TRANSAKSI_PREFIX) === 0) {
      months.push(name);
    }
  }

  return months.reverse();
}

function getAvailableYears() {
  const sheetNames = getAvailableMonths();
  const years = sheetNames
    .map((name) => parseTransactionSheetName(name).year)
    .filter(Boolean);
  return Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));
}

function getAvailableDates(month, year) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetNames = getAvailableMonths();
  const dates = new Set();

  for (let i = 0; i < sheetNames.length; i++) {
    const parsed = parseTransactionSheetName(sheetNames[i]);
    if (month && parsed.month !== month) continue;
    if (year && parsed.year !== year) continue;

    const sheet = ss.getSheetByName(sheetNames[i]);
    if (!sheet) continue;

    const data = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).getValues();
    for (let j = 0; j < data.length; j++) {
      const rawTanggal = data[j][0];
      if (rawTanggal) {
        const tanggal = rawTanggal instanceof Date ? formatTanggal(rawTanggal) : String(rawTanggal).trim();
        if (tanggal) dates.add(tanggal);
      }
    }
  }

  return Array.from(dates).sort();
}

// Cari nama karyawan + departemen + status dari sheet master berdasarkan ID
function lookupEmployeeInfo(ss, category, id) {
  const masterSheet = getMasterSheetByCategory(ss, category);
  if (!masterSheet) return null;

  const masterData = masterSheet.getDataRange().getValues();
  for (let i = 1; i < masterData.length; i++) {
    if (normalizeId(masterData[i][0]) === id) {
      return { 
        nama: masterData[i][1], 
        departemen: masterData[i][2] || "",
        status: String(masterData[i][3] || "AKTIF").trim().toUpperCase()
      };
    }
  }
  return null;
}

// ====== ENTRY POINT UNTUK WEB APP ======
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "getEmployees") {
      return jsonResponse(getAllEmployeesAllCategories());
    }
    if (action === "getEmployeesByCategory") {
      const category = e.parameter.category;
      return jsonResponse(getEmployeesByCategory(category));
    }
    if (action === "getTransactions") {
      const month = e.parameter.month || "";
      const year = e.parameter.year || "";
      const departemen = e.parameter.departemen || "";
      return jsonResponse(getAllTransactions(month, year, departemen));
    }
    if (action === "getMonths") {
      return jsonResponse(getAvailableMonths());
    }

    return jsonResponse({ error: "Action tidak dikenali" });
  } catch (err) {
    return jsonResponse({ error: err && err.message ? err.message : String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "scan") {
      return jsonResponse(handleScan(body.id));
    }
    if (action === "addEmployee") {
      return jsonResponse(addEmployee(body.category, body.nama, body.departemen));
    }
    if (action === "bulkAddEmployee") {
      return jsonResponse(bulkAddEmployee(body.category, body.namas, body.departemen));
    }
    if (action === "editEmployee") {
      return jsonResponse(editEmployee(body.category, body.id, body.nama, body.departemen));
    }
    if (action === "toggleEmployeeStatus") {
      return jsonResponse(toggleEmployeeStatus(body.category, body.id));
    }
    if (action === "deleteEmployee") {
      return jsonResponse(deleteEmployee(body.category, body.id));
    }
    if (action === "resetToday") {
      return jsonResponse(resetTodayQuota(body.id));
    }

    return jsonResponse({ error: "Action tidak dikenali" });
  } catch (err) {
    return jsonResponse({ error: err && err.message ? err.message : String(err) });
  }
}

function handleScan(rawId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const id = normalizeId(rawId);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const now = new Date();
    const tanggalSekarang = formatTanggal(now);
    const jamSekarang = formatJam(now);
    const transaksiSheet = getOrCreateMonthSheet(ss, now);

    const category = getCategoryFromId(id);
    const isUnrecognizedCategory = !category || !CATEGORY_SHEETS[category];
    let info = null;
    if (!isUnrecognizedCategory) {
      info = lookupEmployeeInfo(ss, category, id);
    }

    if (isUnrecognizedCategory || !info) {
      // Tulis transaksi gagal (TIDAK DIKENAL) ke database
      const targetRow = transaksiSheet.getLastRow() + 1;
      transaksiSheet.getRange(targetRow, 1, 1, 6).setValues([[id, "TIDAK DIKENAL", "N/A", tanggalSekarang, jamSekarang, "TIDAK DIKENAL"]]);
      transaksiSheet.getRange(targetRow, 4, 1, 2).setNumberFormat("@");
      SpreadsheetApp.flush();
      return { status: "error", message: "QR Code tidak dikenali" };
    }

    if (info.status === "NONAKTIF") {
      // Tulis transaksi gagal (NONAKTIF) ke database
      const targetRow = transaksiSheet.getLastRow() + 1;
      transaksiSheet.getRange(targetRow, 1, 1, 6).setValues([[id, info.nama, info.departemen || "", tanggalSekarang, jamSekarang, "NONAKTIF"]]);
      transaksiSheet.getRange(targetRow, 4, 1, 2).setNumberFormat("@");
      SpreadsheetApp.flush();
      return { status: "error", message: "QR Code ini sedang dinonaktifkan sementara" };
    }

    // Cek apakah sudah scan BERHASIL hari ini (cukup cek di sheet bulan ini saja,
    // karena "hari ini" pasti berada di dalam bulan berjalan)
    const transaksiData = transaksiSheet.getDataRange().getValues();
    let sudahScanHariIni = false;
    let jamBerhasil = null;

    for (let i = 1; i < transaksiData.length; i++) {
      const rowId = normalizeId(transaksiData[i][0]);
      const rawTanggal = transaksiData[i][3];
      const rowTanggal = rawTanggal instanceof Date ? formatTanggal(rawTanggal) : String(rawTanggal).trim();
      const rowStatus = String(transaksiData[i][5]).trim().toUpperCase();

      if (rowId === id && rowTanggal === tanggalSekarang && rowStatus === "BERHASIL") {
        sudahScanHariIni = true;
        jamBerhasil = transaksiData[i][4] instanceof Date ? formatJam(transaksiData[i][4]) : String(transaksiData[i][4]).trim();
        break;
      }
    }

    let statusBaru, resultStatus, resultMessage;

    if (sudahScanHariIni) {
      statusBaru = "DUPLIKAT";
      resultStatus = "failed";
      resultMessage = "Jatah makan hari ini sudah habis";
    } else {
      statusBaru = "BERHASIL";
      resultStatus = "success";
      resultMessage = "Selamat Makan!";
    }

    const targetRow = transaksiSheet.getLastRow() + 1;
    transaksiSheet.getRange(targetRow, 1, 1, 6).setValues([[id, info.nama, info.departemen, tanggalSekarang, jamSekarang, statusBaru]]);
    transaksiSheet.getRange(targetRow, 4, 1, 2).setNumberFormat("@"); // paksa Tanggal & Jam sebagai Text

    SpreadsheetApp.flush();

    return {
      status: resultStatus,
      message: resultMessage,
      nama: info.nama,
      jam: jamSekarang,
      jamBerhasil: jamBerhasil
    };
  } finally {
    lock.releaseLock();
  }
}

// ====== RESET JATAH HARI INI UNTUK 1 ORANG ======
function resetTodayQuota(rawId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const id = normalizeId(rawId);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const now = new Date();
    const sheetName = getMonthSheetName(now);
    const transaksiSheet = ss.getSheetByName(sheetName);

    if (!transaksiSheet) {
      return { status: "error", message: "Belum ada transaksi bulan ini" };
    }

    const data = transaksiSheet.getDataRange().getValues();
    const tanggalSekarang = formatTanggal(now);
    let rowsReset = 0;

    for (let i = data.length - 1; i >= 1; i--) {
      const rowId = normalizeId(data[i][0]);
      const rawTanggal = data[i][3];
      const rowTanggal = rawTanggal instanceof Date ? formatTanggal(rawTanggal) : String(rawTanggal).trim();
      const rowStatus = String(data[i][5]).trim().toUpperCase();

      if (rowId === id && rowTanggal === tanggalSekarang && rowStatus === "BERHASIL") {
        transaksiSheet.getRange(i + 1, 6).setValue("DIRESET");
        rowsReset++;
      }
    }

    if (rowsReset === 0) {
      return { status: "error", message: "Tidak ada transaksi berhasil hari ini untuk direset" };
    }

    return { status: "success", message: "Jatah hari ini berhasil direset (" + rowsReset + " riwayat diupdate)" };
  } finally {
    lock.releaseLock();
  }
}

// ====== GENERATE ID BERIKUTNYA UNTUK SUATU KATEGORI ======
function generateNextId(category, sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNumber = 0;

  for (let i = 1; i < data.length; i++) {
    const idValue = String(data[i][0]).trim();
    const match = idValue.match(/^[A-Za-z]+(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }

  return maxNumber;
}

// ====== TAMBAH SATU ORANG ======
function addEmployee(category, nama, departemen) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getMasterSheetByCategory(ss, category);

    if (!sheet) {
      return { status: "error", message: "Kategori tidak dikenali" };
    }
    if (!nama || String(nama).trim() === "") {
      return { status: "error", message: "Nama wajib diisi" };
    }

    const maxNumber = generateNextId(category, sheet);
    const newId = category + String(maxNumber + 1).padStart(3, "0");
    const targetRow = sheet.getLastRow() + 1;
    // Kolom A: ID, Kolom B: Nama, Kolom C: Departemen, Kolom D: Status
    sheet.getRange(targetRow, 1, 1, 4).setValues([[newId, nama, departemen || "", "AKTIF"]]);
    sheet.getRange(targetRow, 1, 1, 1).setNumberFormat("@");

    SpreadsheetApp.flush();

    return { status: "success", message: "Berhasil ditambahkan", id: newId, nama: nama };
  } finally {
    lock.releaseLock();
  }
}

// ====== TAMBAH BANYAK ORANG SEKALIGUS (1 departemen sama, nama berbeda-beda) ======
function bulkAddEmployee(category, namas, departemen) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getMasterSheetByCategory(ss, category);

    if (!sheet) {
      return { status: "error", message: "Kategori tidak dikenali", added: [] };
    }
    if (!Array.isArray(namas) || namas.length === 0) {
      return { status: "error", message: "Daftar nama kosong", added: [] };
    }

    // Bersihkan nama: buang baris kosong / whitespace saja
    const cleanNamas = namas.map((n) => String(n).trim()).filter((n) => n.length > 0);
    if (cleanNamas.length === 0) {
      return { status: "error", message: "Daftar nama kosong setelah dibersihkan", added: [] };
    }

    // Hitung nomor ID mulai dari nomor terbesar yang sudah ada + 1,
    // lalu increment lokal untuk tiap nama (tidak perlu baca ulang sheet tiap loop)
    let nextNumber = generateNextId(category, sheet) + 1;
    const rows = [];
    const added = [];

    for (let i = 0; i < cleanNamas.length; i++) {
      const newId = category + String(nextNumber).padStart(3, "0");
      rows.push([newId, cleanNamas[i], departemen || "", "AKTIF"]);
      added.push({ id: newId, nama: cleanNamas[i], departemen: departemen || "", status: "AKTIF" });
      nextNumber++;
    }

    const targetRow = sheet.getLastRow() + 1;
    sheet.getRange(targetRow, 1, rows.length, 4).setValues(rows);
    sheet.getRange(targetRow, 1, rows.length, 1).setNumberFormat("@");

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: added.length + " orang berhasil ditambahkan",
      added: added
    };
  } finally {
    lock.releaseLock();
  }
}

// ====== EDIT ORANG ======
function editEmployee(category, rawId, newNama, newDepartemen) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const id = normalizeId(rawId);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getMasterSheetByCategory(ss, category);

    if (!sheet) {
      return { status: "error", message: "Kategori tidak dikenali" };
    }
    if (!newNama || String(newNama).trim() === "") {
      return { status: "error", message: "Nama wajib diisi" };
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (normalizeId(data[i][0]) === id) {
        // Baris ke (i + 1), kolom B (2) dan C (3)
        sheet.getRange(i + 1, 2, 1, 2).setValues([[newNama, newDepartemen || ""]]);
        SpreadsheetApp.flush();
        return { status: "success", message: "Data berhasil diubah" };
      }
    }

    return { status: "error", message: "ID tidak ditemukan" };
  } finally {
    lock.releaseLock();
  }
}

// ====== TOGGLE STATUS ORANG ======
function toggleEmployeeStatus(category, rawId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const id = normalizeId(rawId);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getMasterSheetByCategory(ss, category);

    if (!sheet) {
      return { status: "error", message: "Kategori tidak dikenali" };
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (normalizeId(data[i][0]) === id) {
        // Baris ke (i + 1), kolom D (4)
        const currentStatus = String(data[i][3] || "AKTIF").trim().toUpperCase();
        const newStatus = (currentStatus === "NONAKTIF") ? "AKTIF" : "NONAKTIF";
        
        sheet.getRange(i + 1, 4).setValue(newStatus);
        SpreadsheetApp.flush();
        return { status: "success", message: "Status berhasil diubah menjadi " + newStatus, newStatus: newStatus };
      }
    }

    return { status: "error", message: "ID tidak ditemukan" };
  } finally {
    lock.releaseLock();
  }
}

// ====== HAPUS DATA ORANG ======
function deleteEmployee(category, rawId) {
  const id = normalizeId(rawId);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getMasterSheetByCategory(ss, category);

  if (!sheet) {
    return { status: "error", message: "Kategori tidak dikenali" };
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeId(data[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return { status: "success", message: "Data berhasil dihapus" };
    }
  }

  return { status: "error", message: "ID tidak ditemukan" };
}

// ====== AMBIL DATA SATU KATEGORI ======
function getEmployeesByCategory(category) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getMasterSheetByCategory(ss, category);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === "") continue;
    const status = String(data[i][3] || "AKTIF").trim().toUpperCase();
    result.push({ id: data[i][0], nama: data[i][1], departemen: data[i][2] || "", status: status, category: category });
  }
  return result;
}

function getAllEmployeesAllCategories() {
  let result = [];
  for (const category in CATEGORY_SHEETS) {
    result = result.concat(getEmployeesByCategory(category));
  }
  return result;
}

// ====== AMBIL TRANSAKSI, DENGAN FILTER OPSIONAL BULAN, TAHUN & DEPARTEMEN ======
// month: nama bulan saja, contoh "Juli". Kosong = semua bulan.
// year: 4 digit, contoh "2026". Kosong = semua tahun.
// departemen: nama departemen persis, contoh "IT". Kosong = semua departemen.
function getAllTransactions(month, year, departemen) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const deptFilter = (departemen || "").trim().toLowerCase();
  const monthFilter = (month || "").trim();
  const yearFilter = (year || "").trim();

  const allSheets = ss.getSheets();
  const sheetsToRead = [];

  for (let i = 0; i < allSheets.length; i++) {
    const sheetName = allSheets[i].getName();
    if (sheetName.indexOf(TRANSAKSI_PREFIX) !== 0) continue;

    const parsed = parseTransactionSheetName(sheetName);
    if (monthFilter && parsed.month !== monthFilter) continue;
    if (yearFilter && parsed.year !== yearFilter) continue;
    sheetsToRead.push(allSheets[i]);
  }

  const result = [];

  for (let s = 0; s < sheetsToRead.length; s++) {
    const sheet = sheetsToRead[s];
    const sheetName = sheet.getName();
    const parsed = parseTransactionSheetName(sheetName);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === "") continue;

      const rowDepartemen = String(data[i][2] || "").trim();
      if (deptFilter !== "" && rowDepartemen.toLowerCase() !== deptFilter) continue;

      const rawTanggal = data[i][3];
      const rawJam = data[i][4];
      const tanggal = rawTanggal instanceof Date ? formatTanggal(rawTanggal) : String(rawTanggal);
      const jam = rawJam instanceof Date ? formatJam(rawJam) : String(rawJam);

      result.push({
        id: data[i][0],
        nama: data[i][1],
        departemen: rowDepartemen,
        tanggal: tanggal,
        jam: jam,
        status: data[i][5],
        bulan: sheetName
      });
    }
  }

  return result;
}

function formatTanggal(date) {
  return Utilities.formatDate(date, "Asia/Makassar", "yyyy-MM-dd");
}

function formatJam(date) {
  return Utilities.formatDate(date, "Asia/Makassar", "HH:mm:ss");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
