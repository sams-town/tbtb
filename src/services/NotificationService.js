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
        return { data: this.serializeList(data) };
    }

    async getById(id) {
        const record = await prisma.notifications.findUnique({ where: { id } });
        if (!record) return null;
        return this.serialize(record);
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
        return this.serialize(record);
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
        return this.serialize(record);
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
        return this.serialize(record);
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