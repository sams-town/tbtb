import prisma from "../config/prisma.js";
import { randomUUID } from "crypto";

class NotificationService {
    async getAll(query = {}) {
        const search = query.search || "";
        const notifiableId = query.notifiable_id;
        const where = {};
        if (search) {
            where.OR = [
                { type: { contains: search } },
                { notifiable_type: { contains: search } },
            ];
        }
        if (notifiableId !== undefined) {
            where.notifiable_id = BigInt(notifiableId);
        }
        const data = await prisma.notifications.findMany({
            where,
            orderBy: { created_at: "desc" },
        });

        // Parse data JSON dan kumpulkan semua user_id unik
        const serialized = this.serializeList(data);
        const userIds = new Set();
        for (const item of serialized) {
            if (item.data && typeof item.data === "string") {
                try {
                    item.data = JSON.parse(item.data);
                } catch { /* biarkan string */ }
            }
            if (item.data && item.data.user_id) {
                userIds.add(BigInt(item.data.user_id));
            }
        }

        // Fetch semua user terkait sekaligus
        let usersMap = {};
        if (userIds.size > 0) {
            const users = await prisma.users.findMany({
                where: { id: { in: Array.from(userIds) } },
                select: { id: true, name: true, foto_karyawan: true }
            });
            const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
            usersMap = Object.fromEntries(users.map(u => [
                u.id.toString(),
                {
                    id: u.id.toString(),
                    name: u.name,
                    foto_karyawan: u.foto_karyawan
                        ? (u.foto_karyawan.startsWith('http') ? u.foto_karyawan : `${baseUrl}/uploads/profile/${u.foto_karyawan}`)
                        : null
                }
            ]));
        }

        // Attach user ke setiap notifikasi
        for (const item of serialized) {
            const uid = item.data?.user_id;
            item.user = uid ? (usersMap[String(uid)] || null) : null;
        }

        return { data: serialized };
    }

    async getById(id) {
        const record = await prisma.notifications.findUnique({ where: { id } });
        if (!record) return null;
        const serialized = this.serialize(record);

        // Parse data JSON
        if (serialized.data && typeof serialized.data === "string") {
            try {
                serialized.data = JSON.parse(serialized.data);
            } catch { /* biarkan string */ }
        }

        // Fetch user terkait
        if (serialized.data?.user_id) {
            const user = await prisma.users.findUnique({
                where: { id: BigInt(serialized.data.user_id) },
                select: { id: true, name: true, foto_karyawan: true }
            });
            const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
            serialized.user = user ? {
                id: user.id.toString(),
                name: user.name,
                foto_karyawan: user.foto_karyawan
                    ? (user.foto_karyawan.startsWith('http') ? user.foto_karyawan : `${baseUrl}/uploads/profile/${user.foto_karyawan}`)
                    : null
            } : null;
        } else {
            serialized.user = null;
        }

        return serialized;
    }

    async create(data) {
        const payload = { ...data };
        payload.id = payload.id || randomUUID();
        if (payload.notifiable_id !== undefined) payload.notifiable_id = BigInt(payload.notifiable_id);
        if (payload.data && typeof payload.data === "object") payload.data = JSON.stringify(payload.data);
        if (payload.read_at) payload.read_at = new Date(payload.read_at);
        if (payload.created_at) payload.created_at = new Date(payload.created_at);
        if (payload.updated_at) payload.updated_at = new Date(payload.updated_at);

        const record = await prisma.notifications.create({ data: payload });
        return this.getById(record.id);
    }

    async update(id, data) {
        const existing = await prisma.notifications.findUnique({ where: { id } });
        if (!existing) return null;

        const updateData = { ...data };
        if (updateData.notifiable_id !== undefined) updateData.notifiable_id = updateData.notifiable_id ? BigInt(updateData.notifiable_id) : null;
        if (updateData.data && typeof updateData.data === "object") updateData.data = JSON.stringify(updateData.data);
        if (updateData.read_at) updateData.read_at = new Date(updateData.read_at);
        updateData.updated_at = new Date();

        const record = await prisma.notifications.update({ where: { id }, data: updateData });
        return this.getById(record.id);
    }

    async delete(id) {
        const existing = await prisma.notifications.findUnique({ where: { id } });
        if (!existing) return null;
        await prisma.notifications.delete({ where: { id } });
        return true;
    }

    async markRead(id) {
        const existing = await prisma.notifications.findUnique({ where: { id } });
        if (!existing) return null;
        const record = await prisma.notifications.update({ where: { id }, data: { read_at: new Date() } });
        return this.getById(record.id);
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

export default new NotificationService();