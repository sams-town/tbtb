import prisma from "../config/prisma.js";

class MappingShiftService {
    async getAll(query = {}) {
        const search = query.search || "";
        const where = {
            ... (search ? {
                OR: [
                    { status_pengajuan: { contains: search } },
                    { deskripsi: { contains: search } },
                ]
            } : {})
        };

        if (query.user_id) where.user_id = BigInt(query.user_id);
        if (query.start_date && query.end_date) {
            where.tanggal = {
                gte: new Date(query.start_date),
                lte: new Date(query.end_date)
            };
        }

        const data = await prisma.mapping_shifts.findMany({
            where,
            orderBy: { tanggal: "desc" },
            include: {
                users: true,
                shifts: true
            }
        });

        return { data: this.serializeList(data) };
    }

    async getById(id) {
        const record = await prisma.mapping_shifts.findUnique({
            where: { id: BigInt(id) },
            include: {
                users: true,
                shifts: true
            }
        });
        if (!record) return null;
        return this.serialize(record);
    }

    async bulkCreateRange(data) {
        const { user_id, shift_id, start_date, end_date, lock_location } = data;
        const start = new Date(start_date);
        const end = new Date(end_date);
        const createdRecords = [];

        let current = new Date(start);
        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];

            const record = await prisma.mapping_shifts.create({
                data: {
                    user_id: BigInt(user_id),
                    shift_id: shift_id ? BigInt(shift_id) : null,
                    tanggal: new Date(dateStr),
                    lock_location: lock_location ? lock_location.toString() : "0"
                    // Status default or keep it empty for manual attendance
                }
            });

            createdRecords.push(this.serialize(record));
            current.setDate(current.getDate() + 1);
        }

        return { data: createdRecords };
    }

    async bulkUpdateRange(data) {
        const { user_id, start_date, end_date, shift_id, lock_location } = data;

        const result = await prisma.mapping_shifts.updateMany({
            where: {
                user_id: BigInt(user_id),
                tanggal: {
                    gte: new Date(start_date),
                    lte: new Date(end_date)
                }
            },
            data: {
                shift_id: shift_id ? BigInt(shift_id) : null,
                lock_location: lock_location !== undefined ? lock_location.toString() : undefined
            }
        });

        return { count: result.count };
    }

    async bulkDeleteRange(data) {
        const { user_id, start_date, end_date } = data;

        const result = await prisma.mapping_shifts.deleteMany({
            where: {
                user_id: BigInt(user_id),
                tanggal: {
                    gte: new Date(start_date),
                    lte: new Date(end_date)
                }
            }
        });

        return { count: result.count };
    }

    serialize(record) {
        const serialized = {};
        for (const [key, value] of Object.entries(record)) {
            if (typeof value === "bigint") {
                serialized[key] = value.toString();
            } else if (value instanceof Date) {
                serialized[key] = value.toISOString();
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

export default new MappingShiftService();
