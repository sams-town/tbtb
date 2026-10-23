import prisma from "../config/prisma.js";
import notificationService from "./NotificationService.js";

class CutiService {
    async getAll(query = {}) {
        const search = query.search || "";

        let excludeUserIds = [];
        if (query.include_dokter !== 'true') {
            const docRoles = await prisma.roles.findMany({
                where: {
                    OR: [
                        { name: { contains: 'dokter' } },
                        { name: { in: ['dokter', 'Dokter', 'DOKTER', 'doctor', 'Doctor'] } }
                    ]
                },
                select: { id: true }
            });
            const docRoleIds = docRoles.map(r => r.id);
            let roleDoctorUserIds = [];
            if (docRoleIds.length > 0) {
                const roleUsers = await prisma.model_has_roles.findMany({
                    where: { role_id: { in: docRoleIds } },
                    select: { model_id: true }
                });
                roleDoctorUserIds = roleUsers.map(ru => ru.model_id);
            }
            const doctorJabatans = await prisma.jabatans.findMany({
                where: {
                    OR: [
                        { nama_jabatan: { contains: 'dokter' } },
                        { nama_jabatan: { contains: 'Dokter' } },
                        { nama_jabatan: { contains: 'spesialis' } },
                        { nama_jabatan: { contains: 'Spesialis' } },
                        { nama_jabatan: { contains: 'Sp.' } },
                        { nama_jabatan: { contains: 'dr.' } },
                    ]
                },
                select: { id: true }
            });
            let doctorJabatanUserIds = [];
            if (doctorJabatans.length > 0) {
                const doctorJabatanUsers = await prisma.users.findMany({
                    where: { jabatan_id: { in: doctorJabatans.map(j => j.id) } },
                    select: { id: true }
                });
                doctorJabatanUserIds = doctorJabatanUsers.map(u => u.id);
            }
            const superAdmins = await prisma.users.findMany({
                where: {
                    OR: [
                        { is_admin: { in: ['superadmin', 'super admin', 'super_admin', 'admin', 'Superadmin', 'Super Admin', 'ADMIN', 'SUPERADMIN'] } },
                        { username: 'admin' },
                        { email: 'admin@admin.com' }
                    ]
                },
                select: { id: true }
            });
            const superAdminRoles = await prisma.model_has_roles.findMany({
                where: { roles: { name: { in: ['superadmin', 'super admin', 'super_admin', 'Super Admin', 'admin', 'Admin'] } } },
                select: { model_id: true }
            });

            excludeUserIds = Array.from(new Set([
                1n,
                ...doctors.map(d => d.model_id),
                ...doctorJabatanUserIds,
                ...superAdmins.map(u => u.id),
                ...superAdminRoles.map(u => u.model_id)
            ]));
        }

        const where = {};
        const andList = [];
        if (excludeUserIds.length > 0) {
            andList.push({ user_id: { notIn: excludeUserIds } });
        }
        if (search) {
            andList.push({
                OR: [
                    { nama_cuti: { contains: search } },
                    { alasan_cuti: { contains: search } },
                    { status_cuti: { contains: search } },
                ]
            });
        }
        if (andList.length > 0) {
            where.AND = andList;
        }
        const data = await prisma.cutis.findMany({
            where,
            orderBy: { id: "desc" },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        jabatan_id: true,
                        lokasi_id: true,
                        foto_karyawan: true,
                        jabatan: true,
                        lokasi: true,
                    }
                }
            },
        });
        const ids = Array.from(new Set(data.map(d => d.user_id).filter(Boolean)));
        let usersMap = {};
        if (ids.length) {
            const users = await prisma.users.findMany({
                where: { id: { in: ids } },
                select: {
                    id: true,
                    name: true,
                    jabatan_id: true,
                    lokasi_id: true,
                    foto_karyawan: true,
                    jabatan: true,
                    lokasi: true,
                },
            });
            usersMap = Object.fromEntries(users.map(u => [String(u.id), u]));
        }
        const enriched = data.map(d => ({
            ...d,
            pemohon: usersMap[String(d.user_id)] || (d.users ? {
                id: d.users.id,
                name: d.users.name,
                jabatan_id: d.users.jabatan_id,
                lokasi_id: d.users.lokasi_id,
                foto_karyawan: d.users.foto_karyawan,
                jabatan: d.users.jabatan,
                lokasi: d.users.lokasi,
            } : null)
        }));
        return { data: this.serializeList(enriched) };
    }

    async getById(id) {
        const cuti = await prisma.cutis.findUnique({
            where: { id: BigInt(id) },
            include: { users: { select: { id: true, name: true } } },
        });
        if (!cuti) return null;
        let pemohon = null;
        if (cuti.user_id) {
            const user = await prisma.users.findUnique({
                where: { id: cuti.user_id },
                select: { id: true, name: true },
            });
            pemohon = user || null;
        }
        return this.serialize({ ...cuti, pemohon });
    }

    async getByUserId(userId) {
        const cutis = await prisma.cutis.findMany({
            where: { user_id: BigInt(userId) },
            orderBy: { id: "desc" },
            include: { users: { select: { id: true, name: true, jabatan: true } } },
        });
        return this.serializeList(cutis);
    }

    async create(data) {
        const now = new Date();
        
        // Handle tanggal_mulai and tanggal_akhir mapping
        let tanggalValue = data.tanggal;
        if (data.tanggal_mulai && data.tanggal_akhir) {
            tanggalValue = `${data.tanggal_mulai} - ${data.tanggal_akhir}`;
        }
        
        const cuti = await prisma.cutis.create({
            data: {
                ...this.sanitizeInput(data),
                tanggal: tanggalValue,
                status_cuti: "Pending",
                created_at: now,
                updated_at: now,
            },
        });

        // ==========================================================
        // KIRIM NOTIFIKASI
        // ==========================================================
        try {
            const pemohon = await prisma.users.findUnique({
                where: { id: cuti.user_id },
                include: { jabatan: true }
            });

            if (pemohon && pemohon.id.toString() !== "1") {
                let managerId = "1";
                if (pemohon.jabatan && pemohon.jabatan.manager) {
                    managerId = pemohon.jabatan.manager.toString();
                }

                await notificationService.create({
                    type: 'Pengajuan Cuti',
                    notifiable_type: 'App\\Models\\User',
                    notifiable_id: managerId,
                    data: {
                        message: `${pemohon.name} mengajukan cuti: ${tanggalValue}`,
                        user_id: pemohon.id.toString(),
                        cuti_id: cuti.id.toString(),
                        status: 'Pending'
                    },
                    created_at: now,
                    updated_at: now
                });
            }
        } catch (err) {
            console.error("Gagal mengirim notifikasi cuti:", err.message);
            // Jangan gagalkan transaksi cuti hanya karena notifikasi gagal
        }

        return this.serialize(cuti);
    }

    async update(id, data) {
        const existing = await prisma.cutis.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;

        const cuti = await prisma.cutis.update({
            where: { id: BigInt(id) },
            data: { ...this.sanitizeInput(data), updated_at: new Date() },
        });
        return this.getById(id);
    }

    async delete(id) {
        const existing = await prisma.cutis.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;
        await prisma.cutis.delete({ where: { id: BigInt(id) } });
        return true;
    }

    async approve(id, body = {}) {
        return await prisma.$transaction(async (tx) => {
            const existing = await tx.cutis.findUnique({ 
                where: { id: BigInt(id) }
             });
            if (!existing) return null;

            let approver = null;
            if (body.user_approval !== undefined && body.user_approval !== null) {
                const val = String(body.user_approval).trim();
                if (val !== "" && /^\d+$/.test(val)) {
                    approver = BigInt(val);
                } else {
                    throw new Error("user_approval harus berupa angka");
                }
            } else {
                throw new Error("Field 'user_approval' wajib diisi");
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
                include: { managed_jabatans: true, jabatan: true }
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

            // ── Manager detection (expanded to cover Indonesian hospital roles) ──
            const MANAGER_JABATAN_KEYWORDS = ['manager', 'supervisor', 'spv', 'kepala', 'kabid', 'koordinator', 'head', 'direktur', 'kasubag', 'kadept', 'kasi'];
            const approverJabatanName = (approverUser.jabatan?.nama_jabatan || '').toLowerCase();
            const hasManagerJabatan = MANAGER_JABATAN_KEYWORDS.some(kw => approverJabatanName.includes(kw));

            const MANAGER_ROLE_KEYWORDS = ['manager', 'supervisor', 'spv', 'kepala', 'kabid', 'koordinator', 'head', 'direktur', 'kasubag'];
            const hasManagerRole = approverRoles.some(r => MANAGER_ROLE_KEYWORDS.some(kw => r.includes(kw))) ||
                approverUser.is_supervisor === 1 ||
                String(approverUser.is_admin || '').toLowerCase() === 'manager';

            const isDirectManager = pemohon.jabatan && pemohon.jabatan.manager != null && BigInt(pemohon.jabatan.manager) === approver;
            const managesPemohonJabatan = pemohon.jabatan_id && approverUser.managed_jabatans &&
                approverUser.managed_jabatans.some(j => j.id === pemohon.jabatan_id);

            const isManager = isDirectManager || managesPemohonJabatan || hasManagerRole || hasManagerJabatan;

            // ── Normalize status (case-insensitive comparison) ───────────────
            const existingStatusNorm = String(existing.status_cuti || '').toLowerCase().trim();
            const isPending = ['pending', 'menunggu', 'diajukan', 'menunggu persetujuan'].includes(existingStatusNorm);
            const isAlreadyManagerApproved = existingStatusNorm === 'disetujui manager';

            const isRejection = body.status === "Ditolak" || body.status === "Rejected";
            let newStatus = existing.status_cuti;
            let shouldFinalize = false;

            if (isRejection) {
                // Penolakan bisa dilakukan manager (tahap 1) atau admin (tahap final)
                if (isManager || isAdmin) {
                    newStatus = "Ditolak";
                    shouldFinalize = true;
                } else {
                    throw new Error(`Anda tidak memiliki wewenang untuk menolak. Role: [${approverRoles.join(', ')}], Jabatan: ${approverJabatanName || '-'}, is_admin: ${approverUser.is_admin || '-'}`);
                }
            } else if (isManager && isPending) {
                // ✅ Tahap 1: Manager setujui → status "Disetujui Manager" → notif dikirim ke Admin
                newStatus = "Disetujui Manager";
                // shouldFinalize = false → notif dikirim ke admin
            } else if (isManager && isAlreadyManagerApproved) {
                // ❌ Manager tidak bisa finalisasi — harus Admin yang approve tahap 2
                throw new Error("Pengajuan ini sudah Anda setujui. Menunggu persetujuan Admin untuk finalisasi.");
            } else if (isAdmin && (isPending || isAlreadyManagerApproved)) {
                // ✅ Tahap 2: Admin finalisasi → status "Diterima" → notif dikirim ke pegawai
                newStatus = "Diterima";
                shouldFinalize = true;
            } else {
                const debugInfo = `Status DB: '${existing.status_cuti}', Role: [${approverRoles.join(', ')}], Jabatan: '${approverJabatanName || '-'}', is_admin: '${approverUser.is_admin || '-'}', is_supervisor: ${approverUser.is_supervisor}`;
                throw new Error(`Anda tidak memiliki wewenang untuk menyetujui cuti ini. (${debugInfo})`);
            }

            if (newStatus === existing.status_cuti) {
                throw new Error(`Status tidak berubah. Status saat ini: '${existing.status_cuti}'. Kemungkinan sudah diproses sebelumnya.`);
            }

            // 2. Update status cuti ke status baru
            const cuti = await tx.cutis.update({
                where: { id: BigInt(id) },
                data: { user_approval: approver, status_cuti: newStatus, updated_at: new Date() },
                include: { users: { select: { id: true, name: true } } },
            });

            // 1. Hitung jumlah hari cuti (hanya jika difinalisasi oleh Admin)
            if (shouldFinalize) {
                let amount = 0;
                const t = existing.tanggal || "";
                if (t.includes(" - ")) {
                    const [start, end] = t.split(" - ");
                    const s = new Date(start);
                    const e = new Date(end);
                    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    amount = diff > 0 ? diff : 0;
                } else if (t) {
                    amount = 1;
                }

                // 3. Kurangi kuota cuti di tabel users
                if (amount > 0 && existing.user_id) {
                    const label = (existing.nama_cuti || "").toLowerCase();
                    let fieldToUpdate = "izin_lainnya";
                    if (label.includes("melahirkan")) fieldToUpdate = "cuti_melahirkan";
                    else if (label.includes("kematian") || label.includes("meninggal")) fieldToUpdate = "cuti_kematian";
                    else if (label.includes("tahunan") || (label.includes("cuti") && !label.includes("menikah"))) fieldToUpdate = "izin_cuti";
                    else if (label.includes("telat") || label.includes("terlambat")) fieldToUpdate = "izin_telat";
                    else if (label.includes("pulang")) fieldToUpdate = "izin_pulang_cepat";

                    await tx.users.update({
                        where: { id: existing.user_id },
                        data: {
                            [fieldToUpdate]: {
                                decrement: BigInt(amount)
                            }
                        }
                    });

                    // 4. Update mapping_shifts menjadi "Cuti" agar tidak dianggap Alfa
                    if (t.includes(" - ")) {
                        const [startStr, endStr] = t.split(" - ");
                        const start = new Date(startStr);
                        const end = new Date(endStr);
                        end.setDate(end.getDate() + 1); // include end date

                        await tx.mapping_shifts.updateMany({
                            where: {
                                user_id: existing.user_id,
                                tanggal: {
                                    gte: start,
                                    lt: end
                                }
                            },
                            data: {
                                status_absen: "Cuti"
                            }
                        });
                    } else if (t) {
                        const start = new Date(t);
                        const end = new Date(t);
                        end.setDate(end.getDate() + 1);

                        await tx.mapping_shifts.updateMany({
                            where: {
                                user_id: existing.user_id,
                                tanggal: {
                                    gte: start,
                                    lt: end
                                }
                            },
                            data: {
                                status_absen: "Cuti"
                            }
                        });
                    }
                }
            }

            // ==========================================================
            // KIRIM NOTIFIKASI
            // ==========================================================
            try {
                if (shouldFinalize) {
                    if (existing.user_id) {
                        await notificationService.create({
                            type: 'Persetujuan Cuti',
                            notifiable_type: 'App\\Models\\User',
                            notifiable_id: existing.user_id.toString(),
                            data: {
                                message: `Pengajuan cuti Anda telah disetujui`,
                                user_id: existing.user_id.toString(),
                                cuti_id: existing.id.toString(),
                                status: '2'
                            },
                            created_at: new Date(),
                            updated_at: new Date()
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
                            type: 'Pengajuan Cuti',
                            notifiable_type: 'App\\Models\\User',
                            notifiable_id: admin.id.toString(),
                            data: {
                                message: `${pemohon.name} mengajukan cuti: ${existing.tanggal} (Disetujui Manager)`,
                                user_id: pemohon.id.toString(),
                                cuti_id: existing.id.toString(),
                                status: 'Disetujui Manager'
                            },
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                    }
                }
            } catch (err) {
                console.error("Gagal mengirim notifikasi cuti:", err.message);
            }

            return this.serialize(cuti);
        });
    }

    sanitizeInput(data) {
        const allowedFields = [
            "lokasi_id",
            "user_id",
            "nama_cuti",
            "tanggal",
            "alasan_cuti",
            "foto_cuti",
            "status_cuti",
            "catatan",
            "user_approval",
        ];
        const bigIntFields = ["lokasi_id", "user_id", "user_approval"];
        const sanitized = {};

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                if (bigIntFields.includes(field)) {
                    sanitized[field] = data[field] !== null && data[field] !== "" ? BigInt(data[field]) : null;
                } else {
                    sanitized[field] = data[field];
                }
            }
        }
        return sanitized;
    }

    serialize(item) {
        if (item === null || item === undefined) return item;
        if (typeof item === "bigint") return item.toString();
        if (Array.isArray(item)) return item.map((i) => this.serialize(i));
        if (typeof item === "object" && !(item instanceof Date)) {
            return Object.fromEntries(
                Object.entries(item).map(([key, value]) => [key, this.serialize(value)])
            );
        }
        return item;
    }

    serializeList(list) {
        return list.map((item) => this.serialize(item));
    }
    /**
     * Export data cuti ke CSV
     * Filter: search, user_id, status_cuti, start_date, end_date
     */
    async exportCsv(query = {}) {
        const where = {};

        if (query.search) {
            where.OR = [
                { nama_cuti:   { contains: query.search } },
                { alasan_cuti: { contains: query.search } },
                { status_cuti: { contains: query.search } },
            ];
        }
        if (query.user_id) {
            where.user_id = BigInt(query.user_id);
        }
        if (query.status_cuti) {
            where.status_cuti = query.status_cuti;
        }
        if (query.start_date && query.end_date) {
            // tanggal di cutis adalah String, filter dengan LIKE atau bisa compare string
            // Karena format bisa "YYYY-MM-DD" atau "YYYY-MM-DD - YYYY-MM-DD"
            // kita filter berdasarkan created_at saja
            where.created_at = {
                gte: new Date(query.start_date + "T00:00:00.000"),
                lte: new Date(query.end_date   + "T23:59:59.999"),
            };
        }

        const data = await prisma.cutis.findMany({
            where,
            orderBy: { id: 'desc' },
            include: { users: { select: { id: true, name: true } } },
        });

        // Ambil nama pemohon (user_id → name)
        const ids = [...new Set(data.map(d => d.user_id).filter(Boolean))];
        let usersMap = {};
        if (ids.length) {
            const users = await prisma.users.findMany({
                where: { id: { in: ids } },
                select: { id: true, name: true }
            });
            usersMap = Object.fromEntries(users.map(u => [u.id.toString(), u.name]));
        }

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
        lines.push(`Export Data Cuti`);
        lines.push(`Diekspor pada,${diekspor}`);
        lines.push(`Total Data,${data.length}`);
        lines.push('');

        // Kolom tabel
        lines.push('No,Nama Karyawan,Jenis Cuti,Tanggal,Alasan,Status,Catatan,Tgl Pengajuan');

        data.forEach((row, i) => {
            const nama = usersMap[row.user_id?.toString()] ?? '-';
            lines.push([
                i + 1,
                e(nama),
                e(row.nama_cuti   ?? '-'),
                e(row.tanggal     ?? '-'),
                e(row.alasan_cuti ?? '-'),
                e(row.status_cuti ?? '-'),
                e(row.catatan     ?? '-'),
                row.created_at
                    ? new Date(row.created_at).toLocaleDateString('id-ID')
                    : '-',
            ].join(','));
        });

        return lines.join('\r\n');
    }
}

export default new CutiService();