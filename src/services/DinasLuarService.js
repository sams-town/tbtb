import prisma from "../config/prisma.js";

class DinasLuarService {
    async getAll(query = {}) {
        const search = query.search || "";
        const where = search ? { OR: [{ status_absen: { contains: search } }, { tanggal: { contains: search } }] } : {};
        const data = await prisma.dinas_luars.findMany({
            where,
            orderBy: { id: "desc" },
        });
        return { data: this.serializeList(data) };
    }

    async getById(id) {
        const record = await prisma.dinas_luars.findUnique({ where: { id: BigInt(id) } });
        if (!record) return null;
        return this.serialize(record);
    }

    async create(data) {
        const payload = { ...data };
        if (payload.user_id !== undefined) payload.user_id = BigInt(payload.user_id);
        if (payload.shift_id !== undefined) payload.shift_id = BigInt(payload.shift_id);
        const record = await prisma.dinas_luars.create({ data: payload });
        return this.serialize(record);
    }

    async update(id, data) {
        const existing = await prisma.dinas_luars.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;

        const updateData = { ...data };
        if (updateData.user_id !== undefined) updateData.user_id = updateData.user_id ? BigInt(updateData.user_id) : null;
        if (updateData.shift_id !== undefined) updateData.shift_id = updateData.shift_id ? BigInt(updateData.shift_id) : null;

        const record = await prisma.dinas_luars.update({ where: { id: BigInt(id) }, data: updateData });
        return this.serialize(record);
    }

    async delete(id) {
        const existing = await prisma.dinas_luars.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;
        await prisma.dinas_luars.delete({ where: { id: BigInt(id) } });
        return true;
    }

    serialize(record) {
        const serialized = {};
        for (const [key, value] of Object.entries(record)) {
            serialized[key] = typeof value === "bigint" ? value.toString() : value;
        }
        return serialized;
    }

    serializeList(items) {
        return items.map((i) => this.serialize(i));
    }
}

export default new DinasLuarService();
