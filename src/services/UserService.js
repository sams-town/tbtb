import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import fileService from "./FileService.js";

class UserService {
    /**
     * Get all users with optional pagination & search
     */
    async getAll(query = {}) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const search = query.search || "";
        const skip = (page - 1) * limit;

        const pegawaiKeluars = await prisma.pegawai_keluars.findMany({
            select: { user_id: true }
        });
        const excludedUserIds = pegawaiKeluars.map((pk) => pk.user_id);

        const where = {
            id: { notIn: excludedUserIds },
        };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { username: { contains: search } },
                { telepon: { contains: search } },
            ];
        }

        const [data, total] = await Promise.all([
            prisma.users.findMany({
                where,
                // skip,
                // take: limit,
                orderBy: { id: "desc" },
                include: { jabatan: true, lokasi: true, status_pajak: true },
            }),
            prisma.users.count({ where }),
        ]);

        const userIds = data.map((u) => u.id);
        const userRoles = await prisma.model_has_roles.findMany({
            where: { model_id: { in: userIds } },
            include: { roles: true },
        });

        const userWithFiles = await prisma.files.findMany({
            where: { user_id: { in: userIds } },
            select: { user_id: true },
        });
        const hasFilesSet = new Set(userWithFiles.map((f) => f.user_id.toString()));

        const cutiRecords = await prisma.cutis.findMany({
            where: { user_id: { in: userIds }, status_cuti: "Diterima" },
            select: { user_id: true, tanggal: true, nama_cuti: true },
        });
        const usedMap = {};
        for (const r of cutiRecords) {
            const uid = r.user_id;
            const label = (r.nama_cuti || "").toLowerCase();
            let type = "lainnya";
            if (label.includes("cuti")) type = "cuti";
            else if (label.includes("telat")) type = "telat";
            else if (label.includes("pulang")) type = "pulang_cepat";
            const t = r.tanggal || "";
            let amount = 1;
            if (type === "cuti") {
                if (t.includes(" - ")) {
                    const [start, end] = t.split(" - ");
                    const s = new Date(start);
                    const e = new Date(end);
                    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    amount = diff > 0 ? diff : 0;
                } else if (!t) {
                    amount = 0;
                }
            }
            usedMap[uid] = usedMap[uid] || { cuti: 0, telat: 0, pulang_cepat: 0, lainnya: 0 };
            usedMap[uid][type] += amount;
        }

        const dataWithRoles = data.map((user) => {
            const roles = userRoles
                .filter((ur) => ur.model_id === user.id)
                .map((ur) => ur.roles.name);
            const totalCuti = Number(user.izin_cuti || 0n);
            const totalTelat = Number(user.izin_telat || 0n);
            const totalPulangCepat = Number(user.izin_pulang_cepat || 0n);
            const totalLainnya = Number(user.izin_lainnya || 0n);
            const used = usedMap[user.id] || { cuti: 0, telat: 0, pulang_cepat: 0, lainnya: 0 };
            const sisaCuti = Math.max(totalCuti - used.cuti, 0);
            const sisaTelat = Math.max(totalTelat - used.telat, 0);
            const sisaPulangCepat = Math.max(totalPulangCepat - used.pulang_cepat, 0);
            const sisaLainnya = Math.max(totalLainnya - used.lainnya, 0);
            return {
                ...this.serialize(user),
                roles,
                has_dokumen: hasFilesSet.has(user.id.toString()),
                izin_cuti_total: String(totalCuti),
                izin_cuti_terpakai: String(used.cuti),
                izin_cuti_sisa: String(sisaCuti),
                izin_telat_total: String(totalTelat),
                izin_telat_terpakai: String(used.telat),
                izin_telat_sisa: String(sisaTelat),
                izin_pulang_cepat_total: String(totalPulangCepat),
                izin_pulang_cepat_terpakai: String(used.pulang_cepat),
                izin_pulang_cepat_sisa: String(sisaPulangCepat),
                izin_lainnya_total: String(totalLainnya),
                izin_lainnya_terpakai: String(used.lainnya),
                izin_lainnya_sisa: String(sisaLainnya),
            };
        });

        return {
            data: dataWithRoles,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get all users without pagination
     */
    async getAllNoPaginate(query = {}) {
        const search = query.search || "";
        
        const pegawaiKeluars = await prisma.pegawai_keluars.findMany({
            select: { user_id: true }
        });
        const keluarIdsSet = new Set(pegawaiKeluars.map((pk) => pk.user_id.toString()));

        const where = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { username: { contains: search } },
                { telepon: { contains: search } },
            ];
        }

        const data = await prisma.users.findMany({
            where,
            orderBy: { name: "asc" },
            include: { jabatan: true, lokasi: true, status_pajak: true },
        });

        const userIds = data.map((u) => u.id);
        const userRoles = await prisma.model_has_roles.findMany({
            where: { model_id: { in: userIds } },
            include: { roles: true },
        });

        const userWithFiles = await prisma.files.findMany({
            where: { user_id: { in: userIds } },
            select: { user_id: true },
        });
        const hasFilesSet = new Set(userWithFiles.map((f) => f.user_id.toString()));

        const cutiRecords = await prisma.cutis.findMany({
            where: { user_id: { in: userIds }, status_cuti: "Diterima" },
            select: { user_id: true, tanggal: true, nama_cuti: true },
        });

        const usedMap = {};
        for (const r of cutiRecords) {
            const uid = r.user_id;
            const label = (r.nama_cuti || "").toLowerCase();
            let type = "lainnya";
            if (label.includes("cuti")) type = "cuti";
            else if (label.includes("telat")) type = "telat";
            else if (label.includes("pulang")) type = "pulang_cepat";
            const t = r.tanggal || "";
            let amount = 1;
            if (type === "cuti") {
                if (t.includes(" - ")) {
                    const [start, end] = t.split(" - ");
                    const s = new Date(start);
                    const e = new Date(end);
                    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    amount = diff > 0 ? diff : 0;
                } else if (!t) {
                    amount = 0;
                }
            }
            usedMap[uid] = usedMap[uid] || { cuti: 0, telat: 0, pulang_cepat: 0, lainnya: 0 };
            usedMap[uid][type] += amount;
        }

        const dataWithRoles = data.map((user) => {
            const roles = userRoles
                .filter((ur) => ur.model_id === user.id)
                .map((ur) => ur.roles.name);
            
            const totalCuti = Number(user.izin_cuti || 0n);
            const totalTelat = Number(user.izin_telat || 0n);
            const totalPulangCepat = Number(user.izin_pulang_cepat || 0n);
            const totalLainnya = Number(user.izin_lainnya || 0n);
            const used = usedMap[user.id] || { cuti: 0, telat: 0, pulang_cepat: 0, lainnya: 0 };
            const sisaCuti = Math.max(totalCuti - used.cuti, 0);
            const sisaTelat = Math.max(totalTelat - used.telat, 0);
            const sisaPulangCepat = Math.max(totalPulangCepat - used.pulang_cepat, 0);
            const sisaLainnya = Math.max(totalLainnya - used.lainnya, 0);

            return {
                ...this.serialize(user),
                roles,
                is_keluar: keluarIdsSet.has(user.id.toString()),
                has_dokumen: hasFilesSet.has(user.id.toString()),
                izin_cuti_total: String(totalCuti),
                izin_cuti_terpakai: String(used.cuti),
                izin_cuti_sisa: String(sisaCuti),
                izin_telat_total: String(totalTelat),
                izin_telat_terpakai: String(used.telat),
                izin_telat_sisa: String(sisaTelat),
                izin_pulang_cepat_total: String(totalPulangCepat),
                izin_pulang_cepat_terpakai: String(used.pulang_cepat),
                izin_pulang_cepat_sisa: String(sisaPulangCepat),
                izin_lainnya_total: String(totalLainnya),
                izin_lainnya_terpakai: String(used.lainnya),
                izin_lainnya_sisa: String(sisaLainnya),
            };
        });

        return {
            data: dataWithRoles,
            total: dataWithRoles.length,
        };
    }

    /**
     * Get single user by ID
     */
    async getById(id) {
        const user = await prisma.users.findUnique({
            where: { id: BigInt(id) },
            include: { jabatan: true, lokasi: true, status_pajak: true },
        });

        if (!user) return null;

        const userRoles = await prisma.model_has_roles.findMany({
            where: { model_id: BigInt(id) },
            include: { roles: true },
        });
        const roles = userRoles.map((ur) => ur.roles.name);

        const cutiList = await prisma.cutis.findMany({
            where: { user_id: BigInt(id), status_cuti: "Diterima" },
            select: { tanggal: true, nama_cuti: true },
        });
        let used = { cuti: 0, telat: 0, pulang_cepat: 0, lainnya: 0 };
        for (const r of cutiList) {
            const label = (r.nama_cuti || "").toLowerCase();
            let type = "lainnya";
            if (label.includes("cuti")) type = "cuti";
            else if (label.includes("telat")) type = "telat";
            else if (label.includes("pulang")) type = "pulang_cepat";
            const t = r.tanggal || "";
            let amount = 1;
            if (type === "cuti") {
                if (t.includes(" - ")) {
                    const [start, end] = t.split(" - ");
                    const s = new Date(start);
                    const e = new Date(end);
                    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    amount = diff > 0 ? diff : 0;
                } else if (!t) {
                    amount = 0;
                }
            }
            used[type] += amount;
        }
        const totalCuti = Number(user.izin_cuti || 0n);
        const totalTelat = Number(user.izin_telat || 0n);
        const totalPulangCepat = Number(user.izin_pulang_cepat || 0n);
        const totalLainnya = Number(user.izin_lainnya || 0n);
        const sisaCuti = Math.max(totalCuti - used.cuti, 0);
        const sisaTelat = Math.max(totalTelat - used.telat, 0);
        const sisaPulangCepat = Math.max(totalPulangCepat - used.pulang_cepat, 0);
        const sisaLainnya = Math.max(totalLainnya - used.lainnya, 0);

        const files = await prisma.files.findMany({
            where: { user_id: BigInt(id) },
        });

        return {
            ...this.serialize(user),
            roles,
            files: files.map(f => fileService.serialize(f)),
            izin_cuti_total: String(totalCuti),
            izin_cuti_terpakai: String(used.cuti),
            izin_cuti_sisa: String(sisaCuti),
            izin_telat_total: String(totalTelat),
            izin_telat_terpakai: String(used.telat),
            izin_telat_sisa: String(sisaTelat),
            izin_pulang_cepat_total: String(totalPulangCepat),
            izin_pulang_cepat_terpakai: String(used.pulang_cepat),
            izin_pulang_cepat_sisa: String(sisaPulangCepat),
            izin_lainnya_total: String(totalLainnya),
            izin_lainnya_terpakai: String(used.lainnya),
            izin_lainnya_sisa: String(sisaLainnya),
        };
    }

    /**
     * Create a new user
     */
    /**
  * Create a new user
  */
    async create(data) {
        // Pisahkan roles dari data user (sama seperti di update)
        const { roles, jabatan, lokasi, status_pajak, ...userData } = data;

        // Hash password jika ada
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }

        const user = await prisma.users.create({
            data: this.sanitizeInput(userData),
        });

        // Assign roles jika dikirim
        let roleList = [];
        if (roles) {
            if (typeof roles === "string") {
                try { roleList = JSON.parse(roles); } // jika berupa '["admin"]'
                catch { roleList = roles.split(",").map(r => r.trim()); } // jika berupa "admin,user"
            } else if (Array.isArray(roles)) {
                roleList = roles;
            }
        }

        if (roleList.length > 0) {
            const roleRecords = await prisma.roles.findMany({
                where: { name: { in: roleList } },
            });

            if (roleRecords.length > 0) {
                await prisma.model_has_roles.createMany({
                    data: roleRecords.map((role) => ({
                        role_id: role.id,
                        model_type: "App\\Models\\User",
                        model_id: user.id,
                    })),
                });
            }
        }

        // Return data lengkap dengan roles
        return this.getById(user.id.toString());
    }

    /**
     * Update user by ID
     */
    async update(id, data) {
        const existing = await prisma.users.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        // Pisahkan roles dari data, sisa data masuk ke sanitizeInput
        const { roles, jabatan, lokasi, status_pajak, ...userData } = data;

        // Hash password jika ada
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }

        const user = await prisma.users.update({
            where: { id: BigInt(id) },
            data: this.sanitizeInput(userData),
        });

        // Sync roles jika dikirim
        let roleList = [];
        if (roles) {
            if (typeof roles === "string") {
                try { roleList = JSON.parse(roles); } // jika berupa '["admin"]'
                catch { roleList = roles.split(",").map(r => r.trim()); } // jika berupa "admin,user"
            } else if (Array.isArray(roles)) {
                roleList = roles;
            }
        }

        if (roleList.length > 0 || roles !== undefined) {
            // Hapus roles lama
            await prisma.model_has_roles.deleteMany({
                where: { model_id: BigInt(id) },
            });

            if (roleList.length > 0) {
                // Cari role_id berdasarkan nama
                const roleRecords = await prisma.roles.findMany({
                    where: { name: { in: roleList } },
                });

                // Insert roles baru
                if (roleRecords.length > 0) {
                    await prisma.model_has_roles.createMany({
                        data: roleRecords.map((role) => ({
                            role_id: role.id,
                            model_type: "App\\Models\\User",
                            model_id: BigInt(id),
                        })),
                    });
                }
            }
        }

        // Return data lengkap dengan roles
        return this.getById(id);
    }

    async updateFaceRecognition(id, photoPath) {
        const user = await prisma.users.update({
            where: { id: BigInt(id) },
            data: { foto_face_recognition: photoPath },
        });
        return this.serialize(user);
    }

    /**
     * Delete user by ID
     */
    async delete(id) {
        const userId = BigInt(id);
        const existing = await prisma.users.findUnique({
            where: { id: userId },
        });

        if (!existing) return null;

        return await prisma.$transaction(async (tx) => {
            // 1. Nullify references (optional fields where the user is an approver/manager)
            await tx.cutis.updateMany({
                where: { user_approval: userId },
                data: { user_approval: null }
            });

            await tx.pengajuan_keuangans.updateMany({
                where: { user_approval: userId },
                data: { user_approval: null }
            });

            await tx.lemburs.updateMany({
                where: { approved_by: userId },
                data: { approved_by: null }
            });

            await tx.lokasis.updateMany({
                where: { OR: [{ approved_by: userId }, { created_by: userId }] },
                data: { approved_by: null, created_by: null }
            });

            await tx.mapping_shifts.updateMany({
                where: { approved_by: userId },
                data: { approved_by: null }
            });

            await tx.pegawai_keluars.updateMany({
                where: { approved_by: userId },
                data: { approved_by: null }
            });

            await tx.jabatans.updateMany({
                where: { manager: userId },
                data: { manager: null }
            });

            // 2. Delete data that belongs to the user (required/Cascade-like)
            await tx.cutis.deleteMany({ where: { user_id: userId } });
            await tx.files.deleteMany({ where: { user_id: userId } });
            await tx.kasbons.deleteMany({ where: { user_id: userId } });
            await tx.kontraks.deleteMany({ where: { user_id: userId } });
            await tx.kunjungans.deleteMany({ where: { user_id: userId } });
            await tx.laporan_kerjas.deleteMany({ where: { user_id: userId } });
            await tx.laporan_kinerjas.deleteMany({ where: { user_id: userId } });
            await tx.lemburs.deleteMany({ where: { user_id: userId } });
            await tx.mapping_shifts.deleteMany({ where: { user_id: userId } });
            await tx.pajaks.deleteMany({ where: { user_id: userId } });
            await tx.patrolis.deleteMany({ where: { user_id: userId } });
            await tx.payrolls.deleteMany({ where: { user_id: userId } });
            await tx.pegawai_keluars.deleteMany({ where: { user_id: userId } });
            await tx.pengajuan_keuangans.deleteMany({ where: { user_id: userId } });
            await tx.rapat_notulens.deleteMany({ where: { user_id: userId } });
            await tx.rapat_pegawais.deleteMany({ where: { user_id: userId } });
            await tx.reimbursements.deleteMany({ where: { user_id: userId } });
            await tx.reimbursements_items.deleteMany({ where: { user_id: userId } });
            await tx.sips.deleteMany({ where: { user_id: userId } });
            await tx.target_kinerja_teams.deleteMany({ where: { user_id: userId } });
            await tx.model_has_roles.deleteMany({ where: { model_id: userId } });
            await tx.model_has_permissions.deleteMany({ where: { model_id: userId } });
            await tx.notifications.deleteMany({
                where: { notifiable_id: userId, notifiable_type: "App\\Models\\User" },
            });
            await tx.personal_access_tokens.deleteMany({
                where: { tokenable_id: userId, tokenable_type: "App\\Models\\User" },
            });

            // 3. Delete the user
            await tx.users.delete({
                where: { id: userId },
            });

            return true;
        });
    }

    /**
     * Sanitize input — convert numeric strings to BigInt where needed
     */
    sanitizeInput(data) {
        const allowedFields = [
            "name",
            "foto_karyawan",
            "foto_face_recognition",
            "email",
            "telepon",
            "username",
            "password",
            "tgl_lahir",
            "gender",
            "tgl_join",
            "alamat",
            "izin_cuti",
            "izin_lainnya",
            "izin_telat",
            "izin_pulang_cepat",
            "is_admin",
            "masa_berlaku",
            "status_pajak_id",
            "jabatan_id",
            "lokasi_id",
            "ktp",
            "kartu_keluarga",
            "bpjs_kesehatan",
            "bpjs_ketenagakerjaan",
            "npwp",
            "sim",
            "no_pkwt",
            "no_kontrak",
            "tanggal_mulai_pkwt",
            "tanggal_berakhir_pkwt",
            "rekening",
            "nama_rekening",
            "gaji_pokok",
            "tunjangan_makan",
            "tunjangan_transport",
            "tunjangan_bpjs_kesehatan",
            "tunjangan_bpjs_ketenagakerjaan",
            "lembur",
            "kehadiran",
            "thr",
            "bonus_pribadi",
            "bonus_team",
            "bonus_jackpot",
            "izin",
            "terlambat",
            "mangkir",
            "saldo_kasbon",
            "potongan_bpjs_kesehatan",
            "potongan_bpjs_ketenagakerjaan",
            "email_verified_at",
            "remember_token",
            "darurat_nama",
            "darurat_telepon",
            "darurat_hubungan",
            "batas_terlambat",
            "potongan_koperasi",
        ];

        const bigIntFields = [
            "izin_cuti",
            "izin_lainnya",
            "izin_telat",
            "izin_pulang_cepat",
            "status_pajak_id",
            "jabatan_id",
            "lokasi_id",
            "gaji_pokok",
            "tunjangan_makan",
            "tunjangan_transport",
            "tunjangan_bpjs_kesehatan",
            "tunjangan_bpjs_ketenagakerjaan",
            "lembur",
            "kehadiran",
            "thr",
            "bonus_pribadi",
            "bonus_team",
            "bonus_jackpot",
            "izin",
            "terlambat",
            "mangkir",
            "saldo_kasbon",
            "potongan_bpjs_kesehatan",
            "potongan_bpjs_ketenagakerjaan",
            "batas_terlambat",
            "potongan_koperasi",
        ];

        const dateFields = [
            "masa_berlaku",
            "tanggal_mulai_pkwt",
            "tanggal_berakhir_pkwt",
            "email_verified_at",
        ];

        const sanitized = {};

        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            if (!allowedFields.includes(key)) continue;

            if (bigIntFields.includes(key)) {
                // Handle null, undefined, empty string, and "null" string
                if (value === null || value === undefined || value === "" || value === "null") {
                    sanitized[key] = null;
                } else {
                    try {
                        sanitized[key] = BigInt(value);
                    } catch (e) {
                        console.warn(`Failed to convert ${key} with value ${value} to BigInt:`, e.message);
                        sanitized[key] = null;
                    }
                }
            } else if (dateFields.includes(key)) {
                sanitized[key] = value !== null && value !== undefined && value !== "" && value !== "null" ? new Date(value) : null;
            } else {
                sanitized[key] = value === "null" ? null : value;
            }
        }

        return sanitized;
    }

    /**
     * Serialize a single user — convert BigInt to string for JSON
     */
    serialize(user) {
        const serialized = {};
        for (const [key, value] of Object.entries(user)) {
            if (typeof value === "bigint") {
                serialized[key] = value.toString();
            } else if (value !== null && typeof value === "object" && !(value instanceof Date)) {
                // Handle nested relation objects (e.g. jabatan)
                const nested = {};
                for (const [k, v] of Object.entries(value)) {
                    nested[k] = typeof v === "bigint" ? v.toString() : v;
                }
                serialized[key] = nested;
            } else {
                serialized[key] = value;
            }
        }
        return serialized;
    }

    /**
     * Serialize a list of users
     */
    serializeList(users) {
        return users.map((user) => this.serialize(user));
    }
}

export default new UserService();
