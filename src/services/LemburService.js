import prisma from "../config/prisma.js";
import { saveBase64Image } from "../middleware/uploadMiddleware.js";

class LemburService {
    async getAll(query = {}) {
        const where = {};
        if (query.user_id) where.user_id = BigInt(query.user_id);
        if (query.status) where.status = query.status;
        if (query.start_date && query.end_date) {
            where.tanggal = {
                gte: query.start_date,
                lte: query.end_date
            };
        }

        const data = await prisma.lemburs.findMany({
            where,
            orderBy: { id: "desc" },
            include: {
                karyawan: true,
                lokasi: true,
                approver: true,
            }
        });

        return { data: this.serializeList(data) };
    }

    async getById(id) {
        const record = await prisma.lemburs.findUnique({
            where: { id: BigInt(id) },
            include: {
                karyawan: true,
                lokasi: true,
                approver: true,
            }
        });
        if (!record) return null;
        return this.serialize(record);
    }

    async create(data, baseUrl = null) {
        const payload = { ...data };
        if (payload.user_id) payload.user_id = BigInt(payload.user_id);
        if (payload.lokasi_id) payload.lokasi_id = BigInt(payload.lokasi_id);
        if (payload.approved_by) payload.approved_by = BigInt(payload.approved_by);

        const currentBaseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:4000';

        // Handle Base64
        if (payload.foto_jam_masuk && payload.foto_jam_masuk.startsWith("data:image")) {
            payload.foto_jam_masuk = saveBase64Image(payload.foto_jam_masuk, "lemburs", "lembur-in", false);
        }
        if (payload.foto_jam_keluar && payload.foto_jam_keluar.startsWith("data:image")) {
            payload.foto_jam_keluar = saveBase64Image(payload.foto_jam_keluar, "lemburs", "lembur-out", false);
        }

        // Prepend baseUrl if path is relative
        if (payload.foto_jam_masuk && !payload.foto_jam_masuk.startsWith('http')) {
            const cleanPath = payload.foto_jam_masuk.startsWith('/') ? payload.foto_jam_masuk : `/${payload.foto_jam_masuk}`;
            payload.foto_jam_masuk = `${currentBaseUrl}${cleanPath}`;
        }
        if (payload.foto_jam_keluar && !payload.foto_jam_keluar.startsWith('http')) {
            const cleanPath = payload.foto_jam_keluar.startsWith('/') ? payload.foto_jam_keluar : `/${payload.foto_jam_keluar}`;
            payload.foto_jam_keluar = `${currentBaseUrl}${cleanPath}`;
        }

        // Default status
        payload.status = payload.status || "Pending";

        // Calculate total_lembur if both times exist
        if (payload.jam_masuk && payload.jam_keluar) {
            payload.total_lembur = this.calculateTotalLembur(payload.jam_masuk, payload.jam_keluar);
        }

        // Ensure mandatory fields
        payload.lat_masuk = payload.lat_masuk || "";
        payload.long_masuk = payload.long_masuk || "";
        payload.jarak_masuk = payload.jarak_masuk || "0";
        payload.foto_jam_masuk = payload.foto_jam_masuk || "";

        const record = await prisma.lemburs.create({ data: payload });
        return this.serialize(record);
    }

    async approve(id, data) {
        const { status, approved_by, notes } = data;
        const updateData = {
            status: status || "Approved",
            approved_by: BigInt(approved_by),
        };
        if (notes !== undefined) updateData.notes = notes;

        const record = await prisma.lemburs.update({
            where: { id: BigInt(id) },
            data: updateData,
            include: {
                karyawan: true,
                lokasi: true,
                approver: true,
            }
        });
        return this.serialize(record);
    }

    async update(id, data, baseUrl = null) {
        const existing = await prisma.lemburs.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;

        const updateData = { ...data };
        if (updateData.user_id) updateData.user_id = BigInt(updateData.user_id);
        if (updateData.lokasi_id) updateData.lokasi_id = BigInt(updateData.lokasi_id);
        if (updateData.approved_by) updateData.approved_by = BigInt(updateData.approved_by);

        const currentBaseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:4000';

        // Handle Base64
        if (updateData.foto_jam_masuk && updateData.foto_jam_masuk.startsWith("data:image")) {
            updateData.foto_jam_masuk = saveBase64Image(updateData.foto_jam_masuk, "lemburs", "lembur-in", false);
        }
        if (updateData.foto_jam_keluar && updateData.foto_jam_keluar.startsWith("data:image")) {
            updateData.foto_jam_keluar = saveBase64Image(updateData.foto_jam_keluar, "lemburs", "lembur-out", false);
        }

        // Prepend baseUrl if path is relative
        if (updateData.foto_jam_masuk && !updateData.foto_jam_masuk.startsWith('http')) {
            const cleanPath = updateData.foto_jam_masuk.startsWith('/') ? updateData.foto_jam_masuk : `/${updateData.foto_jam_masuk}`;
            updateData.foto_jam_masuk = `${currentBaseUrl}${cleanPath}`;
        }
        if (updateData.foto_jam_keluar && !updateData.foto_jam_keluar.startsWith('http')) {
            const cleanPath = updateData.foto_jam_keluar.startsWith('/') ? updateData.foto_jam_keluar : `/${updateData.foto_jam_keluar}`;
            updateData.foto_jam_keluar = `${currentBaseUrl}${cleanPath}`;
        }

        // Re-calculate total_lembur if times are updated
        const jamMataIn = updateData.jam_masuk || existing.jam_masuk;
        const jamMataOut = updateData.jam_keluar || existing.jam_keluar;
        if (jamMataIn && jamMataOut) {
            updateData.total_lembur = this.calculateTotalLembur(jamMataIn, jamMataOut);
        }

        const record = await prisma.lemburs.update({
            where: { id: BigInt(id) },
            data: updateData
        });
        return this.serialize(record);
    }

    async delete(id) {
        const existing = await prisma.lemburs.findUnique({ where: { id: BigInt(id) } });
        if (!existing) return null;

        await prisma.lemburs.delete({ where: { id: BigInt(id) } });
        return true;
    }

    calculateTotalLembur(start, end) {
        try {
            const startDate = new Date(start.replace(/-/g, "/"));
            const endDate = new Date(end.replace(/-/g, "/"));
            const diffMs = endDate - startDate;
            if (diffMs < 0) return "0";
            return Math.floor(diffMs / 1000).toString(); // Return seconds as string
        } catch (e) {
            return "0";
        }
    }

    serialize(obj) {
        if (obj === null || obj === undefined) return obj;

        if (typeof obj === "bigint") {
            return obj.toString();
        }

        if (obj instanceof Date) {
            return obj.toISOString();
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.serialize(item));
        }

        if (typeof obj === "object") {
            const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
            const serialized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (["foto_jam_masuk", "foto_jam_keluar"].includes(key) && value) {
                    // Logic in serialize to ensure returned data always has full URL
                    serialized[key] = value.startsWith('http') ? value : (value.startsWith('/') ? `${baseUrl}${value}` : `${baseUrl}/${value}`);
                } else {
                    serialized[key] = this.serialize(value);
                }
            }
            return serialized;
        }

        return obj;
    }

    serializeList(items) {
        return items.map((i) => this.serialize(i));
    }
}

export default new LemburService();
