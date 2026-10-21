import prisma from "../config/prisma.js";
import { saveBase64Image } from "../middleware/uploadMiddleware.js";
import notificationService from "./NotificationService.js";

class LemburService {
    async getAll(query = {}) {
        const where = {};
        if (query.user_id) where.user_id = BigInt(query.user_id);
        if (query.status) where.status = query.status;
        if (query.start_date && query.end_date) {
            where.tanggal = {
                gte: query.start_date,
                lte: query.end_date
            };
        }

        const data = await prisma.lemburs.findMany({
            where,
            orderBy: { id: "desc" },
            include: {
                karyawan: true,
                lokasi: true,
                approver: true,
            }
        });

        return { data: this.serializeList(data) };
    }

    async getById(id) {
        const record = await prisma.lemburs.findUnique({
            where: { id: BigInt(id) },
            include: {
                karyawan: true,
                lokasi: true,
                approver: true,
            }
        });
        if (!record) return null;
        return this.serialize(record);
    }

    async getByUserId(user_id) {
        const record = await prisma.lemburs.findMany({
            where: { user_id: BigInt(user_id) },
            include: {
                karyawan: true,
                lokasi: true,
                approver: true,
            }
        });
        if (!record) return null;
        return this.serializeList(record);
    }

    async create(data, baseUrl = null) {
        const sanitizedData = this.sanitizeInput(data);
        const payload = { ...sanitizedData };
        if (payload.user_id) payload.user_id = BigInt(payload.user_id);
        if (payload.lokasi_id) payload.lokasi_id = BigInt(payload.lokasi_id);
        if (payload.approved_by) payload.approved_by = BigInt(payload.approved_by);

        const currentBaseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:4000';

        // Handle Base64
        if (payload.foto_jam_masuk && payload.foto_jam_masuk.startsWith("data:image")) {
            payload.foto_jam_masuk = saveBase64Image(payload.foto_jam_masuk, "lemburs", "lembur-in", false);
        }
        if (payload.foto_jam_keluar && payload.foto_jam_keluar.startsWith("data:image")) {
            payload.foto_jam_keluar = saveBase64Image(payload.foto_jam_keluar, "lemburs", "lembur-out", false);
        }
        if (payload.file_lembur && (payload.file_lembur.startsWith("data:image") || payload.file_lembur.startsWith("data:application"))) {
            payload.file_lembur = saveBase64Image(payload.file_lembur, "lemburs", "lembur-file", false);
        }

        // Prepend baseUrl if path is relative
        if (payload.foto_jam_masuk && !payload.foto_jam_masuk.startsWith('http')) {
            const cleanPath = payload.foto_jam_masuk.startsWith('/') ? payload.foto_jam_masuk : `/${payload.foto_jam_masuk}`;
            payload.foto_jam_masuk = `${currentBaseUrl}${cleanPath}`;
        }
        if (payload.foto_jam_keluar && !payload.foto_jam_keluar.startsWith('http')) {
            const cleanPath = payload.foto_jam_keluar.startsWith('/') ? payload.foto_jam_keluar : `/${payload.foto_jam_keluar}`;
            payload.foto_jam_keluar = `${currentBaseUrl}${cleanPath}`;
        }
        if (payload.file_lembur && !payload.file_lembur.startsWith('http')) {
            const cleanPath = payload.file_lembur.startsWith('/') ? payload.file_lembur : `/${payload.file_lembur}`;
            payload.file_lembur = `${currentBaseUrl}${cleanPath}`;
        }

        // Default status
        payload.status = payload.status || "Pending";

        // Calculate total_lembur if both times exist
        if (payload.jam_masuk && payload.jam_keluar) {
            payload.total_lembur = this.calculateTotalLembur(payload.jam_masuk, payload.jam_keluar);
        }

        // Ensure mandatory fields
        payload.lat_masuk = payload.lat_masuk || "";
        payload.long_masuk = payload.long_masuk || "";
        payload.jarak_masuk = payload.jarak_masuk || "0";
        payload.foto_jam_masuk = payload.foto_jam_masuk || "";

        const record = await prisma.lemburs.create({ data: payload });

        // ==========================================================
        // KIRIM NOTIFIKASI
        // ==========================================================
        try {
            const pemohon = await prisma.users.findUnique({
                where: { id: record.user_id },
                include: { jabatan: true }
            });

            if (pemohon && pemohon.id.toString() !== "1") {
                let managerId = "1";
                if (pemohon.jabatan && pemohon.jabatan.manager) {
                    managerId = pemohon.jabatan.manager.toString();
                }

                const notificationService = (await import("./NotificationService.js")).default;
                await notificationService.create({
                    type: 'Pengajuan Lembur',
                    notifiable_type: 'App\\Models\\User',
                    notifiable_id: managerId,
                    data: {
                        message: `${pemohon.name} mengajukan lembur tanggal: ${record.tanggal}`,
                        user_id: pemohon.id.toString(),
                        lembur_id: record.id.toString(),
                        status: 'Pending'
                    }
                });
            }
        } catch (err) {
            console.error("Gagal mengirim notifikasi lembur:", err.message);
        }

        return this.serialize(record);
    }



    async update(id, data, baseUrl = null) {
        const existing = await prisma.lemburs.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;
        
        const sanitizedData = this.sanitizeInput(data);
        const updateData = { ...sanitizedData };
        if (updateData.user_id) updateData.user_id = BigInt(updateData.user_id);
        if (updateData.lokasi_id) updateData.lokasi_id = BigInt(updateData.lokasi_id);
        if (updateData.approved_by) updateData.approved_by = BigInt(updateData.approved_by);

        const currentBaseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:4000';

        // Handle Base64
        if (updateData.foto_jam_masuk && updateData.foto_jam_masuk.startsWith("data:image")) {
            updateData.foto_jam_masuk = saveBase64Image(updateData.foto_jam_masuk, "lemburs", "lembur-in", false);
        }
        if (updateData.foto_jam_keluar && updateData.foto_jam_keluar.startsWith("data:image")) {
            updateData.foto_jam_keluar = saveBase64Image(updateData.foto_jam_keluar, "lemburs", "lembur-out", false);
        }
        if (updateData.file_lembur && (updateData.file_lembur.startsWith("data:image") || updateData.file_lembur.startsWith("data:application"))) {
            updateData.file_lembur = saveBase64Image(updateData.file_lembur, "lemburs", "lembur-file", false);
        }

        // Prepend baseUrl if path is relative
        if (updateData.foto_jam_masuk && !updateData.foto_jam_masuk.startsWith('http')) {
            const cleanPath = updateData.foto_jam_masuk.startsWith('/') ? updateData.foto_jam_masuk : `/${updateData.foto_jam_masuk}`;
            updateData.foto_jam_masuk = `${currentBaseUrl}${cleanPath}`;
        }
        if (updateData.foto_jam_keluar && !updateData.foto_jam_keluar.startsWith('http')) {
            const cleanPath = updateData.foto_jam_keluar.startsWith('/') ? updateData.foto_jam_keluar : `/${updateData.foto_jam_keluar}`;
            updateData.foto_jam_keluar = `${currentBaseUrl}${cleanPath}`;
        }
        if (updateData.file_lembur && !updateData.file_lembur.startsWith('http')) {
            const cleanPath = updateData.file_lembur.startsWith('/') ? updateData.file_lembur : `/${updateData.file_lembur}`;
            updateData.file_lembur = `${currentBaseUrl}${cleanPath}`;
        }

        // Re-calculate total_lembur if times are updated
        const jamMataIn = updateData.jam_masuk || existing.jam_masuk;
        const jamMataOut = updateData.jam_keluar || existing.jam_keluar;
        if (jamMataIn && jamMataOut) {
            updateData.total_lembur = this.calculateTotalLembur(jamMataIn, jamMataOut);
        }

        const record = await prisma.lemburs.update({
            where: { id: BigInt(id) },
            data: updateData
        });
        return this.serialize(record);
    }

    async approve(id, body = {}) {
        return await prisma.$transaction(async (tx) => {
            const existing = await tx.lemburs.findUnique({ 
                where: { id: BigInt(id) }
            });
            if (!existing) return null;

            let approver = null;
            if (body.approved_by !== undefined && body.approved_by !== null) {
                const val = String(body.approved_by).trim();
                if (val !== "" && /^\d+$/.test(val)) {
                    approver = BigInt(val);
                } else {
                    throw new Error("approved_by harus berupa angka");
                }
            } else {
                throw new Error("Field 'approved_by' wajib diisi");
            }

            const pemohon = await tx.users.findUnique({
                where: { id: existing.user_id },
                include: { jabatan: true }
            });

            if (!pemohon) {
                throw new Error("Karyawan pemohon tidak ditemukan");
            }

            const approverUser = await tx.users.findUnique({
                where: { id: approver },
                include: { managed_jabatans: true }
            });

            if (!approverUser) {
                throw new Error("Approver user tidak ditemukan");
            }

            const approverRolesRecords = await tx.model_has_roles.findMany({
                where: { model_id: approver },
                include: { roles: true }
            });
            const approverRoles = approverRolesRecords.map(r => (r.roles?.name || "").toLowerCase());

            const isAdmin = approver === 1n ||
                ['admin', 'superadmin', 'super admin', 'super_admin'].includes(String(approverUser.is_admin || '').toLowerCase()) ||
                approverRoles.includes('admin') ||
                approverRoles.includes('superadmin');

            const isDirectManager = pemohon.jabatan && pemohon.jabatan.manager && pemohon.jabatan.manager === approver;
            const managesPemohonJabatan = pemohon.jabatan_id && approverUser.managed_jabatans && approverUser.managed_jabatans.some(j => j.id === pemohon.jabatan_id);
            const hasManagerRole = approverRoles.includes('manager') || approverRoles.includes('supervisor') || approverUser.is_supervisor === 1 || String(approverUser.is_admin || '').toLowerCase() === 'manager';

            const isManager = isDirectManager || managesPemohonJabatan || hasManagerRole;

            const isRejection = body.status === "Rejected" || body.status === "Ditolak";
            let newStatus = existing.status;
            let shouldFinalize = false;

            if (isRejection) {
                if (isManager || isAdmin) {
                    newStatus = body.status;
                    shouldFinalize = true;
                } else {
                    throw new Error("Anda tidak memiliki wewenang untuk menolak pengajuan lembur ini.");
                }
            } else if (isManager && (existing.status === "Pending" || existing.status === "Menunggu")) {
                newStatus = "Disetujui Manager";
            } else if (isAdmin) {
                if (existing.status === "Disetujui Manager" || existing.status === "Pending" || existing.status === "Menunggu") {
                    newStatus = body.status || "Approved";
                    shouldFinalize = true;
                }
            } else {
                throw new Error("Anda tidak memiliki wewenang untuk menyetujui pengajuan ini pada tahap ini.");
            }

            if (newStatus === existing.status) {
                throw new Error("Status pengajuan lembur tidak berubah atau Anda tidak berwenang pada tahap ini.");
            }

            const record = await tx.lemburs.update({
                where: { id: BigInt(id) },
                data: {
                    approved_by: approver,
                    status: newStatus,
                    notes: body.notes || existing.notes
                },
                include: {
                    karyawan: true,
                    lokasi: true,
                    approver: true,
                }
            });

            // ==========================================================
            // KIRIM NOTIFIKASI
            // ==========================================================
            try {
                if (shouldFinalize) {
                    if (existing.user_id) {
                        await notificationService.create({
                            type: 'Persetujuan Lembur',
                            notifiable_type: 'App\\Models\\User',
                            notifiable_id: existing.user_id.toString(),
                            data: {
                                message: (newStatus === "Rejected" || newStatus === "Ditolak")
                                    ? `Pengajuan lembur Anda telah ditolak`
                                    : `Pengajuan lembur Anda telah disetujui`,
                                user_id: existing.user_id.toString(),
                                lembur_id: existing.id.toString(),
                                status: newStatus
                            }
                        });
                    }
                } else {
                    // Notifikasi ke admin bahwa manager menyetujui
                    const admins = await tx.users.findMany({
                        where: {
                            OR: [
                                { is_admin: 'admin' },
                                { is_admin: 'superadmin' },
                                { id: 1n }
                            ]
                        },
                        select: { id: true }
                    });

                    for (const admin of admins) {
                        await notificationService.create({
                            type: 'Pengajuan Lembur',
                            notifiable_type: 'App\\Models\\User',
                            notifiable_id: admin.id.toString(),
                            data: {
                                message: `${pemohon.name} mengajukan lembur: ${existing.tanggal} (Disetujui Manager)`,
                                user_id: pemohon.id.toString(),
                                lembur_id: existing.id.toString(),
                                status: 'Disetujui Manager'
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("Gagal mengirim notifikasi lembur:", err.message);
            }

            return this.serialize(record);
        });
    }

    async delete(id) {
        const existing = await prisma.lemburs.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;

        await prisma.lemburs.delete({ where: { id: BigInt(id) } });
        return true;
    }

    /**
     * Format detik ke string jam & menit yang rapi
     * contoh: 3844 detik → "1j 4m"
     */
    formatDurasi(totalLembur) {
        if (!totalLembur || totalLembur === "0" || totalLembur === 0) return "0j 0m";
        const totalDetik = parseInt(totalLembur);
        if (isNaN(totalDetik) || totalDetik <= 0) return "0j 0m";
        const jam   = Math.floor(totalDetik / 3600);
        const menit = Math.floor((totalDetik % 3600) / 60);
        return `${jam}j ${menit}m`;
    }

    /**
     * Export data lembur ke CSV berdasarkan rentang tanggal
     * Diurutkan tanggal ASC, durasi dihitung ulang dari jam_masuk & jam_keluar
     */
    async exportCsv(startDate, endDate) {
        if (!startDate || !endDate) throw new Error("start_date dan end_date wajib diisi.");

        const data = await prisma.lemburs.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate,
                }
            },
            orderBy: [
                { tanggal: 'asc' },
                { jam_masuk: 'asc' }
            ],
            include: {
                karyawan: {
                    select: { id: true, name: true, username: true }
                },
                lokasi: {
                    select: { nama_lokasi: true }
                },
                approver: {
                    select: { name: true }
                }
            }
        });

        // CSV escape helper
        const e = (val) => {
            const s = String(val ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        const diekspor = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const lines = [];

        // Header info
        lines.push(`Export Data Lembur`);
        lines.push(`Periode,${startDate} s/d ${endDate}`);
        lines.push(`Diekspor pada,${diekspor}`);
        lines.push(`Total Data,${data.length}`);
        lines.push('');

        // Header kolom — sesuai format Excel yang ada
        lines.push('No,Nama Pegawai,Username,Lokasi,Tanggal,Masuk Lembur,Keluar Lembur,Durasi,Notes,Status,Approver');

        data.forEach((row, i) => {
            // Hitung ulang durasi dari jam_masuk & jam_keluar
            let durasi = '0j 0m';
            let keluarLembur = row.jam_keluar ?? '-';

            if (row.jam_masuk && row.jam_keluar) {
                // Hitung dari jam string langsung
                const totalDetik = this.calculateTotalLembur(row.jam_masuk, row.jam_keluar);
                durasi = this.formatDurasi(totalDetik);
            } else if (row.jam_masuk && !row.jam_keluar) {
                // Belum clock out
                durasi = 'Belum Selesai';
                keluarLembur = '-';
            }

            // Gunakan total_lembur dari DB jika tersedia dan jam_keluar ada
            if (row.total_lembur && row.jam_keluar) {
                durasi = this.formatDurasi(row.total_lembur);
            }

            lines.push([
                i + 1,
                e(row.karyawan?.name     ?? '-'),
                e(row.karyawan?.username ?? '-'),
                e(row.lokasi?.nama_lokasi ?? '-'),
                e(row.tanggal ?? '-'),
                e(row.jam_masuk ?? '-'),
                e(keluarLembur),
                e(durasi),
                e(row.notes ?? '-'),
                e(row.status ?? '-'),
                e(row.approver?.name ?? '-'),
            ].join(','));
        });

        return lines.join('\r\n');
    }

    calculateTotalLembur(start, end) {
        try {
            const startDate = new Date(start.replace(/-/g, "/"));
            const endDate = new Date(end.replace(/-/g, "/"));
            const diffMs = endDate - startDate;
            if (diffMs < 0) return "0";
            return Math.floor(diffMs / 1000).toString(); // Return seconds as string
        } catch (e) {
            return "0";
        }
    }

    serialize(obj) {
        if (obj === null || obj === undefined) return obj;

        if (typeof obj === "bigint") {
            return obj.toString();
        }

        if (obj instanceof Date) {
            return obj.toISOString();
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.serialize(item));
        }

        if (typeof obj === "object") {
            const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
            const serialized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (["foto_jam_masuk", "foto_jam_keluar", "file_lembur"].includes(key) && value) {
                    // Logic in serialize to ensure returned data always has full URL
                    serialized[key] = value.startsWith('http') ? value : (value.startsWith('/') ? `${baseUrl}${value}` : `${baseUrl}/${value}`);
                } else {
                    serialized[key] = this.serialize(value);
                }
            }
            return serialized;
        }

        return obj;
    }

    serializeList(items) {
        return items.map((i) => this.serialize(i));
    }

    sanitizeInput(data) {
        const allowedFields = [
            'user_id', 'lokasi_id', 'tanggal', 'jam_masuk', 'lat_masuk', 'long_masuk',
            'jarak_masuk', 'foto_jam_masuk', 'jam_keluar', 'lat_keluar', 'long_keluar',
            'jarak_keluar', 'foto_jam_keluar', 'total_lembur', 'status', 'notes',
            'approved_by', 'file_lembur'
        ];

        const sanitized = {};
        
        // Mapping
        if (data.keterangan && !data.notes) data.notes = data.keterangan;
        if (data.status_lembur && !data.status) data.status = data.status_lembur;
        if (data.lama_lembur && !data.total_lembur) {
            // Assume lama_lembur is in hours if it's a small number, or just pass it as is
            // But let's just pass it as is for now to avoid wrong calculation
            data.total_lembur = data.lama_lembur;
        }

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                sanitized[field] = data[field];
            }
        }

        return sanitized;
    }
}

export default new LemburService();
