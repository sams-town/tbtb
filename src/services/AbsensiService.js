import prisma from "../config/prisma.js";

class AbsensiService {
    async getAll(query = {}) {
        const search = query.search || "";
        const where = search ? {
            OR: [
                { status_absen: { contains: search } },
                { keterangan_masuk: { contains: search } },
                { keterangan_pulang: { contains: search } },
            ]
        } : {};
        const data = await prisma.mapping_shifts.findMany({
            where,
            orderBy: { id: "desc" },
            include: {
                users: true
            }
        });
        return { data: this.serializeList(data) };
    }

    async getById(id) {
        const record = await prisma.mapping_shifts.findUnique({
            where: { id: BigInt(id) },
            include: {
                users: true
            }
        });
        if (!record) return null;
        return this.serialize(record);
    }

    async create(data) {
        const payload = { ...data };
        if (payload.user_id !== undefined) payload.user_id = BigInt(payload.user_id);
        if (payload.shift_id !== undefined) payload.shift_id = payload.shift_id ? BigInt(payload.shift_id) : null;
        if (payload.approved_by !== undefined) payload.approved_by = payload.approved_by ? BigInt(payload.approved_by) : null;
        if (payload.tanggal) {
            payload.tanggal = new Date(payload.tanggal);
        }

        const record = await prisma.mapping_shifts.create({ data: payload });
        return this.serialize(record);
    }

    async update(id, data) {
        const existing = await prisma.mapping_shifts.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;

        const updateData = { ...data };
        if (updateData.user_id !== undefined) updateData.user_id = updateData.user_id ? BigInt(updateData.user_id) : null;
        if (updateData.shift_id !== undefined) updateData.shift_id = updateData.shift_id ? BigInt(updateData.shift_id) : null;
        if (updateData.approved_by !== undefined) updateData.approved_by = updateData.approved_by ? BigInt(updateData.approved_by) : null;
        if (updateData.tanggal) {
            updateData.tanggal = new Date(updateData.tanggal);
        }

        const record = await prisma.mapping_shifts.update({ where: { id: BigInt(id) }, data: updateData });
        return this.serialize(record);
    }

    async delete(id) {
        const existing = await prisma.mapping_shifts.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;
        await prisma.mapping_shifts.delete({ where: { id: BigInt(id) } });
        return true;
    }

    serialize(record) {
        const serialized = {};
        for (const [key, value] of Object.entries(record)) {
            if (typeof value === "bigint") {
                serialized[key] = value.toString();
            } else if (value instanceof Date) {
                serialized[key] = value.toISOString();
            } else if (value && typeof value === "object" && !Array.isArray(value)) {
                serialized[key] = this.serialize(value);
            } else {
                serialized[key] = value;
            }
        }
        return serialized;
    }

    serializeList(items) {
        return items.map((i) => this.serialize(i));
    }
}

export default new AbsensiService();