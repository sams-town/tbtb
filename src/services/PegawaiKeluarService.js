import prisma from "../config/prisma.js";

class PegawaiKeluarService {
    async getAll(query = {}) {
        const search = query.search || "";
        const where = search
            ? {
                OR: [
                    { jenis: { contains: search } },
                    { alasan: { contains: search } },
                    { status: { contains: search } },
                ],
            }
            : {};
        const data = await prisma.pegawai_keluars.findMany({
            where,
            orderBy: { id: "desc" },
            include: {
                users: { select: { id: true, name: true, email: true } }
            }
        });
        return { data: this.serializeList(data) };
    }

    async getById(id) {
        const record = await prisma.pegawai_keluars.findUnique({
            where: { id: BigInt(id) },
            include: {
                users: { select: { id: true, name: true, email: true } }
            }
        });
        if (!record) return null;
        return this.serialize(record);
    }

    async create(data) {
        const payload = {};
        if (data.user_id) payload.user_id = BigInt(data.user_id);
        if (data.tanggal) payload.tanggal = new Date(data.tanggal);
        if (data.jenis !== undefined) payload.jenis = data.jenis;
        if (data.alasan !== undefined) payload.alasan = data.alasan;
        if (data.pegawai_keluar_file_path !== undefined) payload.pegawai_keluar_file_path = data.pegawai_keluar_file_path;
        if (data.pegawai_keluar_file_name !== undefined) payload.pegawai_keluar_file_name = data.pegawai_keluar_file_name;
        if (data.approved_by) payload.approved_by = BigInt(data.approved_by);
        if (data.tanggal_approval) payload.tanggal_approval = new Date(data.tanggal_approval);
        if (data.notes !== undefined) payload.notes = data.notes;
        if (data.status !== undefined) payload.status = data.status;

        const record = await prisma.pegawai_keluars.create({ data: payload });
        return this.serialize(record);
    }

    async update(id, data) {
        const existing = await prisma.pegawai_keluars.findUnique({
            where: { id: BigInt(id) },
        });
        if (!existing) return null;

        const updateData = {};
        if (data.user_id !== undefined) updateData.user_id = data.user_id ? BigInt(data.user_id) : null;
        if (data.tanggal !== undefined) updateData.tanggal = data.tanggal ? new Date(data.tanggal) : null;
        if (data.jenis !== undefined) updateData.jenis = data.jenis;
        if (data.alasan !== undefined) updateData.alasan = data.alasan;
        if (data.pegawai_keluar_file_path !== undefined) updateData.pegawai_keluar_file_path = data.pegawai_keluar_file_path;
        if (data.pegawai_keluar_file_name !== undefined) updateData.pegawai_keluar_file_name = data.pegawai_keluar_file_name;
        if (data.approved_by !== undefined) updateData.approved_by = data.approved_by ? BigInt(data.approved_by) : null;
        if (data.tanggal_approval !== undefined) updateData.tanggal_approval = data.tanggal_approval ? new Date(data.tanggal_approval) : null;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.status !== undefined) updateData.status = data.status;

        const record = await prisma.pegawai_keluars.update({
            where: { id: BigInt(id) },
            data: updateData,
        });
        return this.serialize(record);
    }

    async approve(id, data) {
        const existing = await prisma.pegawai_keluars.findUnique({
            where: { id: BigInt(id) },
        });
        if (!existing) return null;

        const approverId = data.approved_by;
        const notes = data.notes;

        const record = await prisma.pegawai_keluars.update({
            where: { id: BigInt(id) },
            data: {
                approved_by: approverId ? BigInt(approverId) : null,
                tanggal_approval: new Date(),
                status: "APPROVED",
                notes: notes !== undefined ? notes : existing.notes,
            },
            include: {
                users: { select: { id: true, name: true, email: true } }
            }
        });
        return this.serialize(record);
    }

    async delete(id) {
        const existing = await prisma.pegawai_keluars.findUnique({
            where: { id: BigInt(id) },
        });
        if (!existing) return null;

        await prisma.pegawai_keluars.delete({ where: { id: BigInt(id) } });
        return true;
    }

    serialize(record) {
        const serialized = {};
        for (const [key, value] of Object.entries(record)) {
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
        if (serialized.users) {
            serialized.approved_by_user = {
                id: serialized.users.id,
                name: serialized.users.name,
                email: serialized.users.email,
            };
            delete serialized.users;
        }
        return serialized;
    }

    serializeList(items) {
        return items.map((i) => this.serialize(i));
    }
}

export default new PegawaiKeluarService();