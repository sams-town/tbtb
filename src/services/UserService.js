import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";

class UserService {
    /**
     * Get all users with optional pagination & search
     */
    async getAll(query = {}) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const search = query.search || "";
        const skip = (page - 1) * limit;

        const where = search
            ? {
                OR: [
                    { name: { contains: search } },
                    { email: { contains: search } },
                    { username: { contains: search } },
                    { telepon: { contains: search } },
                ],
            }
            : {};

        const [data, total] = await Promise.all([
            prisma.users.findMany({
                where,
                skip,
                take: limit,
                orderBy: { id: "desc" },
                include: { jabatan: true, lokasi: true, status_pajak: true },
            }),
            prisma.users.count({ where }),
        ]);

        // Ambil roles untuk semua users
        const userIds = data.map((u) => u.id);
        const userRoles = await prisma.model_has_roles.findMany({
            where: { model_id: { in: userIds } },
            include: { roles: true },
        });

        // Map roles ke masing-masing user
        const dataWithRoles = data.map((user) => {
            const roles = userRoles
                .filter((ur) => ur.model_id === user.id)
                .map((ur) => ur.roles.name);
            return { ...this.serialize(user), roles };
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
     * Get single user by ID
     */
    async getById(id) {
        const user = await prisma.users.findUnique({
            where: { id: BigInt(id) },
            include: { jabatan: true, lokasi: true, status_pajak: true },
        });

        if (!user) return null;

        // Ambil roles user
        const userRoles = await prisma.model_has_roles.findMany({
            where: { model_id: BigInt(id) },
            include: { roles: true },
        });

        const roles = userRoles.map((ur) => ur.roles.name);

        return { ...this.serialize(user), roles };
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

    /**
     * Delete user by ID
     */
    async delete(id) {
        const existing = await prisma.users.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        await prisma.users.delete({
            where: { id: BigInt(id) },
        });

        return true;
    }

    /**
     * Sanitize input — convert numeric strings to BigInt where needed
     */
    sanitizeInput(data) {
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

            if (bigIntFields.includes(key)) {
                sanitized[key] = value !== null && value !== "" ? BigInt(value) : null;
            } else if (dateFields.includes(key)) {
                sanitized[key] = value !== null && value !== "" ? new Date(value) : null;
            } else {
                sanitized[key] = value;
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
