import prisma from "../config/prisma.js";

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
        const existing = await prisma.cutis.findUnique({ where: { id: BigInt(id) } });
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

        const cuti = await prisma.cutis.update({
            where: { id: BigInt(id) },
            data: { user_approval: approver, status_cuti: "Diterima", updated_at: new Date() },
            include: { users: { select: { id: true, name: true } } },
        });
        return this.serialize(cuti);
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
        const serialized = {};
        for (const [key, value] of Object.entries(item)) {
            if (typeof value === "bigint") {
                serialized[key] = value.toString();
            } else if (value !== null && typeof value === "object" && !(value instanceof Date)) {
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

    serializeList(list) {
        return list.map((item) => this.serialize(item));
    }
}

export default new CutiService();