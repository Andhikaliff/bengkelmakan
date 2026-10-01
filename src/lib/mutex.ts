// Pengganti LockService.getScriptLock() dari Google Apps Script.
//
// Dulu: kalau 2 request scan untuk ID yang sama datang nyaris bersamaan, Apps Script
// pakai LockService supaya diproses berurutan (bukan paralel) — mencegah keduanya
// lolos sebagai "belum scan hari ini" secara bersamaan.
//
// Sekarang aplikasi jalan sebagai 1 proses Node.js lokal (bukan lagi banyak eksekusi
// Apps Script yang terpisah-pisah di server Google), jadi cukup 1 antrian sederhana
// di dalam memori proses ini — jauh lebih simpel dan instan (tidak ada round-trip
// jaringan), tapi tetap menjamin operasi baca-lalu-tulis tidak saling tabrakan.
//
// File ini dipakai baik di Tahap 1 (penyimpanan in-memory) maupun Tahap 2 nanti
// (Prisma + SQLite) — tidak perlu diubah sama sekali saat pindah tahap.
//
// Cara kerja: setiap pemanggilan withLock() ditambahkan ke rantai promise `queue`.
// Task baru baru dijalankan setelah task sebelumnya selesai (berhasil ATAU gagal),
// sehingga semua pemanggilan withLock() di seluruh aplikasi terjamin berjalan
// satu-per-satu, tidak pernah tumpang tindih.
const queues = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const current = queues.get(key) ?? Promise.resolve();
  const result = current.then(task, task);
  
  // Simpan lanjutan rantai terlepas dari task ini berhasil atau gagal
  queues.set(key, result.then(() => undefined, () => undefined));
  
  // Cleanup finished queues supaya Map tidak membengkak
  result.finally(() => {
    if (queues.get(key) === result) queues.delete(key);
  });
  
  return result;
}
