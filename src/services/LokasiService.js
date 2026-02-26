import prisma from "../config/prisma.js";

class LokasiService {
    /**
     * Get all lokasi with optional search
     */
    async getAll(query = {}) {
        const search = query.search || "";

        const where = search
            ? {
                OR: [
                    { nama_lokasi: { contains: search } },
                    { keterangan: { contains: search } },
                ],
            }
            : {};

        const data = await prisma.lokasis.findMany({
            where,
            orderBy: { id: "asc" },
            include: {
                users_lokasis_created_byTousers: {
                    select: { id: true, name: true },
                },
                users_lokasis_approved_byTousers: {
                    select: { id: true, name: true },
                },
            },
        });

        return {
            data: this.serializeList(data),
        };
    }

    /**
     * Get single lokasi by ID
     */
    async getById(id) {
        const lokasi = await prisma.lokasis.findUnique({
            where: { id: BigInt(id) },
            include: {
                users_lokasis_created_byTousers: {
                    select: { id: true, name: true },
                },
                users_lokasis_approved_byTousers: {
                    select: { id: true, name: true },
                },
            },
        });

        if (!lokasi) return null;

        return this.serialize(lokasi);
    }

    /**
     * Create a new lokasi
     */
    async create(data) {
        const lokasi = await prisma.lokasis.create({
            data: this.sanitizeInput(data),
        });

        return this.serialize(lokasi);
    }

    /**
     * Update lokasi by ID
     */
    async update(id, data) {
        const existing = await prisma.lokasis.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        const lokasi = await prisma.lokasis.update({
            where: { id: BigInt(id) },
            data: this.sanitizeInput(data),
        });

        return this.getById(id);
    }

    /**
     * Delete lokasi by ID
     */
    async delete(id) {
        const existing = await prisma.lokasis.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        await prisma.lokasis.delete({
            where: { id: BigInt(id) },
        });

        return true;
    }

    /**
     * Sanitize input
     */
    sanitizeInput(data) {
        const bigIntFields = ["created_by", "approved_by"];

        // Exclude relasi objects
        const excludeFields = [
            "users_lokasis_created_byTousers",
            "users_lokasis_approved_byTousers",
            "user_lokasis",
        ];

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

    /**
     * Serialize — convert BigInt to string for JSON
     */
    serialize(lokasi) {
        const serialized = {};
        for (const [key, value] of Object.entries(lokasi)) {
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

    /**
     * Serialize a list
     */
    serializeList(list) {
        return list.map((item) => this.serialize(item));
    }
}

export default new LokasiService();
