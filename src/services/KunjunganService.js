import prisma from "../config/prisma.js";

class KunjunganService {
    /**
     * Get all kunjungans with optional search
     */
    async getAll(query = {}) {
        const search = query.search || "";

        const where = search
            ? {
                OR: [
                    { status: { contains: search } },
                    { keterangan_in: { contains: search } },
                    { keterangan_out: { contains: search } }
                ]
            }
            : {};

        const data = await prisma.kunjungans.findMany({
            where,
            orderBy: { id: "desc" },
            include: {
                users: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        return {
            data: this.serializeList(data),
        };
    }

    /**
     * Get single kunjungan by ID
     */
    async getById(id) {
        const kunjungan = await prisma.kunjungans.findUnique({
            where: { id: BigInt(id) },
            include: {
                users: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        if (!kunjungan) return null;

        return this.serialize(kunjungan);
    }

    /**
     * Create a new kunjungan
     */
    async create(data) {
        const payload = { ...data };
        if (payload.user_id) payload.user_id = BigInt(payload.user_id);
        if (payload.tanggal) payload.tanggal = new Date(payload.tanggal);
        if (payload.visit_in) payload.visit_in = new Date(payload.visit_in);
        if (payload.visit_out) payload.visit_out = new Date(payload.visit_out);

        const kunjungan = await prisma.kunjungans.create({
            data: payload,
            include: {
                users: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        return this.serialize(kunjungan);
    }

    /**
     * Update kunjungan by ID
     */
    async update(id, data) {
        const existing = await prisma.kunjungans.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        const updateData = { ...data };
        if (updateData.user_id) updateData.user_id = BigInt(updateData.user_id);
        if (updateData.tanggal) updateData.tanggal = new Date(updateData.tanggal);
        if (updateData.visit_in) updateData.visit_in = new Date(updateData.visit_in);
        if (updateData.visit_out) updateData.visit_out = new Date(updateData.visit_out);

        const kunjungan = await prisma.kunjungans.update({
            where: { id: BigInt(id) },
            data: updateData,
            include: {
                users: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        return this.serialize(kunjungan);
    }

    /**
     * Delete kunjungan by ID
     */
    async delete(id) {
        const existing = await prisma.kunjungans.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        await prisma.kunjungans.delete({
            where: { id: BigInt(id) },
        });

        return true;
    }

    /**
     * Serialize a single kunjungan — convert BigInt to string for JSON
     */
    serialize(kunjungan) {
        const serialized = {};
        for (const [key, value] of Object.entries(kunjungan)) {
            if (typeof value === "bigint") {
                serialized[key] = value.toString();
            } else if (value && typeof value === 'object' && value.id !== undefined && typeof value.id === 'bigint') {
                const nested = {};
                for (const [k, v] of Object.entries(value)) {
                    if (typeof v === "bigint") {
                        nested[k] = v.toString();
                    } else {
                        nested[k] = v;
                    }
                }
                serialized[key] = nested;
            } else {
                serialized[key] = value;
            }
        }
        return serialized;
    }

    /**
     * Serialize a list of kunjungans
     */
    serializeList(kunjungans) {
        return kunjungans.map((kunjungan) => this.serialize(kunjungan));
    }
}

export default new KunjunganService();
