import prisma from "../config/prisma.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Hitung jarak dua koordinat GPS — Haversine, hasil dalam meter */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R    = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Ambil "YYYY-MM-DD" dalam timezone Jakarta */
function getJakartaDateString(d = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
}

/** Ambil "HH:MM" dalam timezone Jakarta */
function getJakartaTimeString(d = new Date()) {
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(d).replace('.', ':');
}

// ─── Serializers ─────────────────────────────────────────────────────────────

function serializeSetting(row) {
    if (!row) return null;
    return {
        id:         row.id.toString(),
        harga:      row.harga.toString(),
        keterangan: row.keterangan,
        aktif:      row.aktif,
        created_at: row.created_at?.toISOString() ?? null,
        updated_at: row.updated_at?.toISOString() ?? null,
    };
}

function serializeKlaim(row) {
    if (!row) return null;
    return {
        id:        row.id.toString(),
        user_id:   row.user_id.toString(),
        tanggal:   row.tanggal instanceof Date
            ? row.tanggal.toISOString().slice(0, 10)
            : String(row.tanggal).slice(0, 10),
        jam_klaim: row.jam_klaim,
        harga:     row.harga.toString(),
        lat:       row.lat  ?? null,
        long:      row.long ?? null,
        jarak:     row.jarak ?? null,
        status:    row.status,
        created_at: row.created_at?.toISOString() ?? null,
        updated_at: row.updated_at?.toISOString() ?? null,
        users: row.users ? {
            id:      row.users.id.toString(),
            name:    row.users.name,
            jabatan: row.users.jabatan?.nama_jabatan ?? null,
            lokasi:  row.users.lokasi ? {
                id:          row.users.lokasi.id.toString(),
                nama_lokasi: row.users.lokasi.nama_lokasi,
                lat_kantor:  row.users.lokasi.lat_kantor,
                long_kantor: row.users.lokasi.long_kantor,
                radius:      row.users.lokasi.radius,
            } : null,
        } : undefined,
    };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class MbgService {

    // ═══════════════════════════════════════════════════════════════
    //  SETTINGS
    // ═══════════════════════════════════════════════════════════════

    /** Ambil setting MBG yang sedang aktif */
    async getSetting() {
        const row = await prisma.mbg_settings.findFirst({
            where:   { aktif: 1 },
            orderBy: { id: 'desc' }
        });
        return row ? serializeSetting(row) : null;
    }

    /** Riwayat semua setting (untuk admin) */
    async getAllSettings() {
        const rows = await prisma.mbg_settings.findMany({ orderBy: { id: 'desc' } });
        return rows.map(serializeSetting);
    }

    /**
     * Set harga MBG baru.
     * Cara kerja: nonaktifkan setting lama → buat baru.
     */
    async upsertSetting(data) {
        const now = new Date();
        await prisma.mbg_settings.updateMany({
            where: { aktif: 1 },
            data:  { aktif: 0, updated_at: now }
        });
        const row = await prisma.mbg_settings.create({
            data: {
                harga:      BigInt(data.harga),
                keterangan: data.keterangan ?? null,
                aktif:      1,
                created_at: now,
                updated_at: now,
            }
        });
        return serializeSetting(row);
    }

    // ═══════════════════════════════════════════════════════════════
    //  KLAIM MAKAN
    // ═══════════════════════════════════════════════════════════════

    /**
     * Karyawan klaim makan siang.
     * Validasi urutan:
     *   1. Jam klaim 12:00 – 18:00 WIB
     *   2. Karyawan sudah absen masuk hari ini
     *   3. Belum pernah klaim hari ini
     *   4. GPS dalam radius kantor
     */
    async klaim(data) {
        const now      = new Date();
        const todayStr = getJakartaDateString(now);
        const jamKlaim = getJakartaTimeString(now);

        // 1. Validasi jam klaim
        const [h, m]   = jamKlaim.split(':').map(Number);
        const menit    = h * 60 + m;
        if (menit < 12 * 60 || menit > 18 * 60) {
            throw new Error("Klaim makan hanya bisa dilakukan antara jam 12:00 – 18:00 WIB.");
        }

        // 2. Ambil data user + lokasi kantor
        const user = await prisma.users.findUnique({
            where:   { id: BigInt(data.user_id) },
            include: { lokasi: true, jabatan: true }
        });
        if (!user) throw new Error("Karyawan tidak ditemukan.");

        // 3. Cek sudah absen masuk hari ini
        const todayStart = new Date(todayStr + "T00:00:00.000");
        const todayEnd   = new Date(todayStr + "T23:59:59.999");

        const absensiHariIni = await prisma.mapping_shifts.findFirst({
            where: {
                user_id:      BigInt(data.user_id),
                tanggal:      { gte: todayStart, lte: todayEnd },
                jam_absen:    { not: null },
                status_absen: { in: ['Masuk', 'Pulang'] }
            }
        });
        if (!absensiHariIni) {
            throw new Error("Klaim makan gagal. Anda belum melakukan absensi masuk hari ini.");
        }

        // 4. Cek belum pernah klaim hari ini
        const sudahKlaim = await prisma.mbg_klaims.findFirst({
            where: {
                user_id: BigInt(data.user_id),
                tanggal: { gte: todayStart, lte: todayEnd }
            }
        });
        if (sudahKlaim) {
            throw new Error("Anda sudah melakukan klaim makan siang hari ini.");
        }

        // 5. Validasi GPS radius kantor
        if (!data.lat || !data.long) {
            throw new Error("GPS (lat & long) wajib dikirimkan untuk klaim makan.");
        }

        if (!user.lokasi) {
            throw new Error("Anda belum memiliki lokasi kantor yang ditugaskan.");
        }

        const officeLat  = parseFloat(user.lokasi.lat_kantor);
        const officeLong = parseFloat(user.lokasi.long_kantor);
        const radius     = parseFloat(user.lokasi.radius || 0);

        if (isNaN(officeLat) || isNaN(officeLong) ||
            (Math.abs(officeLat) < 0.0001 && Math.abs(officeLong) < 0.0001)) {
            throw new Error("Koordinat kantor belum diatur dengan benar.");
        }

        const jarak     = calculateDistance(
            parseFloat(data.lat), parseFloat(data.long),
            officeLat, officeLong
        );
        const jarakValue = Math.round(jarak);

        if (radius > 0 && jarak > radius) {
            throw new Error(
                `Klaim gagal. Anda berada di luar radius kantor.\n` +
                `Jarak Anda: ${jarakValue}m | Batas: ${radius}m`
            );
        }

        // 6. Ambil harga MBG aktif
        const setting = await prisma.mbg_settings.findFirst({
            where:   { aktif: 1 },
            orderBy: { id: 'desc' }
        });
        const harga = setting ? setting.harga : 0n;

        // 7. Simpan klaim
        const klaim = await prisma.mbg_klaims.create({
            data: {
                user_id:    BigInt(data.user_id),
                tanggal:    new Date(todayStr),
                jam_klaim:  jamKlaim,
                harga,
                lat:        String(data.lat),
                long:       String(data.long),
                jarak:      String(jarakValue),
                status:     'Claimed',
                created_at: now,
                updated_at: now,
            },
            include: {
                users: { include: { lokasi: true, jabatan: true } }
            }
        });

        return serializeKlaim(klaim);
    }

    /**
     * Cek status klaim hari ini untuk satu user.
     * Dipakai tombol di app karyawan.
     */
    async statusHariIni(userId) {
        const todayStr   = getJakartaDateString();
        const todayStart = new Date(todayStr + "T00:00:00.000");
        const todayEnd   = new Date(todayStr + "T23:59:59.999");

        const klaim = await prisma.mbg_klaims.findFirst({
            where: {
                user_id: BigInt(userId),
                tanggal: { gte: todayStart, lte: todayEnd }
            },
            include: {
                users: { include: { lokasi: true, jabatan: true } }
            }
        });

        const jamNow   = getJakartaTimeString();
        const [h, m]   = jamNow.split(':').map(Number);
        const menit    = h * 60 + m;
        const dalamJam = menit >= 12 * 60 && menit <= 18 * 60;

        return {
            sudah_klaim:     !!klaim,
            dalam_jam_klaim: dalamJam,
            jam_sekarang:    jamNow,
            data:            klaim ? serializeKlaim(klaim) : null,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  REKAP — JSON untuk admin panel
    // ═══════════════════════════════════════════════════════════════

    /** Rekap harian: siapa saja yang klaim di tanggal tertentu */
    async rekapHarian(tanggal) {
        const tStr = tanggal || getJakartaDateString();
        const start = new Date(tStr + "T00:00:00.000");
        const end   = new Date(tStr + "T23:59:59.999");

        const rows = await prisma.mbg_klaims.findMany({
            where:   { tanggal: { gte: start, lte: end } },
            include: {
                users: {
                    select: {
                        id:      true,
                        name:    true,
                        jabatan: { select: { nama_jabatan: true } },
                        lokasi:  { select: { nama_lokasi: true } }
                    }
                }
            },
            orderBy: { jam_klaim: 'asc' }
        });

        const totalBiaya = rows.reduce((sum, r) => sum + Number(r.harga), 0);

        return {
            tanggal:        tStr,
            total_karyawan: rows.length,
            total_biaya:    totalBiaya.toString(),
            data:           rows.map(serializeKlaim)
        };
    }

    /**
     * Rekap bulanan + ringkasan per karyawan + total biaya
     * bulan: "1"–"12", tahun: "2026"
     */
    async rekapBulanan(bulan, tahun) {
        if (!bulan || !tahun) throw new Error("Bulan dan tahun wajib diisi.");

        const monthIndex = parseInt(bulan) - 1;
        const year       = parseInt(tahun);
        const start      = new Date(year, monthIndex, 1);
        const end        = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

        const rows = await prisma.mbg_klaims.findMany({
            where:   { tanggal: { gte: start, lte: end } },
            include: {
                users: {
                    select: {
                        id:      true,
                        name:    true,
                        jabatan: { select: { nama_jabatan: true } },
                        lokasi:  { select: { nama_lokasi: true } }
                    }
                }
            },
            orderBy: [{ tanggal: 'asc' }, { jam_klaim: 'asc' }]
        });

        // Agregat per karyawan
        const perKaryawan = {};
        rows.forEach(r => {
            const uid = r.user_id.toString();
            if (!perKaryawan[uid]) {
                perKaryawan[uid] = {
                    user_id:     uid,
                    nama:        r.users?.name ?? '-',
                    jabatan:     r.users?.jabatan?.nama_jabatan ?? '-',
                    lokasi:      r.users?.lokasi?.nama_lokasi  ?? '-',
                    total_klaim: 0,
                    total_biaya: 0,
                };
            }
            perKaryawan[uid].total_klaim++;
            perKaryawan[uid].total_biaya += Number(r.harga);
        });

        const totalBiaya = rows.reduce((sum, r) => sum + Number(r.harga), 0);

        return {
            bulan,
            tahun,
            total_transaksi: rows.length,
            total_biaya:     totalBiaya.toString(),
            per_karyawan:    Object.values(perKaryawan).map(k => ({
                ...k,
                total_biaya: k.total_biaya.toString()
            })),
            data: rows.map(serializeKlaim)
        };
    }

    /** Rekap detail per karyawan dalam rentang tanggal */
    async rekapPerUser(userId, startDate, endDate) {
        const start = new Date(startDate + "T00:00:00.000");
        const end   = new Date(endDate   + "T23:59:59.999");

        const rows = await prisma.mbg_klaims.findMany({
            where: {
                user_id: BigInt(userId),
                tanggal: { gte: start, lte: end }
            },
            include: {
                users: {
                    select: {
                        id:      true,
                        name:    true,
                        jabatan: { select: { nama_jabatan: true } },
                        lokasi:  { select: { nama_lokasi: true } }
                    }
                }
            },
            orderBy: { tanggal: 'asc' }
        });

        const totalBiaya = rows.reduce((sum, r) => sum + Number(r.harga), 0);

        return {
            user_id:     userId,
            start_date:  startDate,
            end_date:    endDate,
            total_klaim: rows.length,
            total_biaya: totalBiaya.toString(),
            data:        rows.map(serializeKlaim)
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  CSV EXPORT — tanpa library tambahan
    // ═══════════════════════════════════════════════════════════════

    /** Bungkus nilai CSV, escape tanda kutip dan koma */
    _csvEscape(val) {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    }

    /** Generate string CSV rekap bulanan */
    async exportCsvBulanan(bulan, tahun) {
        const rekap = await this.rekapBulanan(bulan, tahun);
        const e     = (v) => this._csvEscape(v);

        const monthNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const namaBulan  = monthNames[parseInt(bulan)] ?? bulan;
        const diekspor   = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const lines = [];

        // Blok header
        lines.push(`Rekap Makan Bergizi (MBG) - ${namaBulan} ${tahun}`);
        lines.push(`Diekspor pada,${diekspor}`);
        lines.push(`Total Transaksi,${rekap.total_transaksi}`);
        lines.push(`Total Biaya,${rekap.total_biaya}`);
        lines.push('');

        // Tabel detail
        lines.push('No,Nama Karyawan,Jabatan,Lokasi,Tanggal,Jam Klaim,Harga,Jarak (m),Status');
        rekap.data.forEach((row, i) => {
            lines.push([
                i + 1,
                e(row.users?.name    ?? '-'),
                e(row.users?.jabatan ?? '-'),
                e(row.users?.lokasi  ?? '-'),
                row.tanggal,
                row.jam_klaim,
                row.harga,
                row.jarak ?? '-',
                row.status,
            ].join(','));
        });

        lines.push('');

        // Ringkasan per karyawan
        lines.push('Ringkasan Per Karyawan');
        lines.push('Nama,Jabatan,Lokasi,Total Klaim,Total Biaya');
        rekap.per_karyawan.forEach(k => {
            lines.push([
                e(k.nama),
                e(k.jabatan),
                e(k.lokasi),
                k.total_klaim,
                k.total_biaya,
            ].join(','));
        });

        return lines.join('\r\n');
    }

    /** Generate string CSV rekap harian */
    async exportCsvHarian(tanggal) {
        const rekap = await this.rekapHarian(tanggal);
        const e     = (v) => this._csvEscape(v);
        const diekspor = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const lines = [];
        lines.push(`Rekap MBG Harian - ${tanggal}`);
        lines.push(`Diekspor pada,${diekspor}`);
        lines.push(`Total Karyawan,${rekap.total_karyawan}`);
        lines.push(`Total Biaya,${rekap.total_biaya}`);
        lines.push('');
        lines.push('No,Nama Karyawan,Jabatan,Lokasi,Jam Klaim,Harga,Jarak (m),Status');

        rekap.data.forEach((row, i) => {
            lines.push([
                i + 1,
                e(row.users?.name    ?? '-'),
                e(row.users?.jabatan ?? '-'),
                e(row.users?.lokasi  ?? '-'),
                row.jam_klaim,
                row.harga,
                row.jarak ?? '-',
                row.status,
            ].join(','));
        });

        return lines.join('\r\n');
    }
}

export default new MbgService();
