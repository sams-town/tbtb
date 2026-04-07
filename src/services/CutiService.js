import prisma from "../config/prisma.js";
import notificationService from "./NotificationService.js";

class CutiService {
    async getAll(query = {}) {
        const search = query.search || "";
        const where = search
            ? {
                OR: [
                    { nama_cuti: { contains: search } },
                    { alasan_cuti: { contains: search } },
                    { status_cuti: { contains: search } },
                ],
            }
            : {};
        const data = await prisma.cutis.findMany({
            where,
            orderBy: { id: "desc" },
            include: { users: { select: { id: true, name: true } } },
        });
        const ids = Array.from(new Set(data.map(d => d.user_id).filter(Boolean)));
        let usersMap = {};
        if (ids.length) {
            const users = await prisma.users.findMany({
                where: { id: { in: ids } },
                select: { id: true, name: true },
            });
            usersMap = Object.fromEntries(users.map(u => [u.id, u]));
        }
        const enriched = data.map(d => ({ ...d, pemohon: usersMap[d.user_id] || null }));
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

            if (pemohon) {
                // Pengirim/Penerima notifikasi
                const recipients = new Set();
                
                // 1. Ambil semua Admin
                const adminRoles = await prisma.roles.findMany({
                    where: { name: { in: ['admin', 'super-admin'] } }
                });
                const adminIds = adminRoles.length > 0 ? await prisma.model_has_roles.findMany({
                    where: { role_id: { in: adminRoles.map(r => r.id) } }
                }) : [];
                adminIds.forEach(a => recipients.add(a.model_id.toString()));

                // 2. Ambil Manager Jabatan pemohon
                if (pemohon.jabatan && pemohon.jabatan.manager) {
                    recipients.add(pemohon.jabatan.manager.toString());
                }

                // Buat notifikasi untuk setiap recipient
                for (const recipientId of recipients) {
                    // Jangan notifikasi diri sendiri jika recipient adalah pemohon
                    if (recipientId === pemohon.id.toString()) continue;

                    await notificationService.create({
                        type: 'Pengajuan Cuti',
                        notifiable_type: 'App\\Models\\User',
                        notifiable_id: recipientId,
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
                where: { id: BigInt(id) },
                include: { users: true }
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

            // 1. Hitung jumlah hari cuti
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

            // 2. Update status cuti ke Diterima
            const cuti = await tx.cutis.update({
                where: { id: BigInt(id) },
                data: { user_approval: approver, status_cuti: "Diterima", updated_at: new Date() },
                include: { users: { select: { id: true, name: true } } },
            });

            // 3. Kurangi kuota cuti di tabel users
            if (amount > 0 && existing.user_id) {
                const label = (existing.nama_cuti || "").toLowerCase();
                let fieldToUpdate = "izin_lainnya";
                if (label.includes("cuti")) fieldToUpdate = "izin_cuti";
                else if (label.includes("telat")) fieldToUpdate = "izin_telat";
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

            return this.serialize(cuti);
        });
    }

    sanitizeInput(data) {
        const bigIntFields = ["lokasi_id", "user_id", "user_approval"];
        const excludeFields = ["users", "tanggal_mulai", "tanggal_akhir"]; // Exclude tanggal fields
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            if (excludeFields.includes(key)) continue;
            if (bigIntFields.includes(key)) {
                sanitized[key] = value !== null && value !== "" ? BigInt(value) : null;
            } else {
                sanitized[key] = value;
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
}

export default new CutiService();