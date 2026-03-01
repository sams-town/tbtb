import prisma from "../config/prisma.js";

class AbsensiService {
    async getAll(query = {}) {
        const search = query.search || "";
        const where = {
            ... (search ? {
                OR: [
                    { status_absen: { contains: search } },
                    { keterangan_masuk: { contains: search } },
                    { keterangan_pulang: { contains: search } },
                ]
            } : {})
        };
        if (query.user_id && query.user_id !== "undefined") where.user_id = BigInt(query.user_id);
        if (query.start_date && query.end_date) {
            where.tanggal = {
                gte: new Date(query.start_date),
                lte: new Date(query.end_date)
            };
        }
        const data = await prisma.mapping_shifts.findMany({
            where,
            orderBy: { id: "desc" },
            include: {
                users: {
                    include: {
                        lokasi: true
                    }
                },
                shifts: true
            }
        });
        return { data: this.serializeList(data) };
    }

    async getById(id) {
        const record = await prisma.mapping_shifts.findUnique({
            where: { id: BigInt(id) },
            include: {
                users: {
                    include: {
                        lokasi: true
                    }
                },
                shifts: true
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

        const updateData = {};
        for (const [key, value] of Object.entries(data)) {
            // Filter invalid keys if there's any JSON empty brace issue or _method spoofing
            if (key === "{}" || key === "_method") continue;

            if (["user_id", "shift_id", "approved_by"].includes(key)) {
                updateData[key] = value ? BigInt(value) : null;
            } else if (key === "tanggal") {
                updateData[key] = new Date(value);
            } else {
                updateData[key] = value;
            }
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
            } else if (key === 'foto_jam_absen' && value) {
                const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
                serialized[key] = value.startsWith('http') ? value : (value.startsWith('/') ? `${baseUrl}${value}` : `${baseUrl}/${value}`);
            } else if (key === 'foto_jam_pulang' && value) {
                const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
                serialized[key] = value.startsWith('http') ? value : (value.startsWith('/') ? `${baseUrl}${value}` : `${baseUrl}/${value}`);
            } else if (value && typeof value === "object" && !Array.isArray(value)) {
                serialized[key] = this.serialize(value);
            } else {
                serialized[key] = value;
            }
        }
        return serialized;
    }

    async getRecap(startDate, endDate) {
        const users = await prisma.users.findMany({
            select: {
                id: true,
                name: true,
                foto_karyawan: true
            }
        });

        const where = {};
        if (startDate && endDate) {
            where.tanggal = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const attendance = await prisma.mapping_shifts.findMany({
            where,
            include: { shifts: true }
        });

        const result = users.map(user => {
            const userAttendance = attendance.filter(a => a.user_id === user.id);

            const stats = {
                total_cuti: 0,
                total_izin_masuk: 0,
                total_sakit: 0,
                total_izin_pulang_cepat: 0,
                total_hadir: 0,
                total_alfa: 0,
                total_libur: 0,
                total_telat: 0,
                total_pulang_cepat: 0,
                total_lembur_minutes: 0
            };

            userAttendance.forEach(a => {
                if (a.status_absen === 'Cuti') stats.total_cuti++;
                else if (a.status_absen === 'Izin') stats.total_izin_masuk++;
                else if (a.status_absen === 'Sakit') stats.total_sakit++;
                else if (a.status_absen === 'Masuk' || a.status_absen === 'Pulang') stats.total_hadir++;
                else if (a.status_absen === 'Alfa') stats.total_alfa++;
                else if (a.status_absen === 'Libur') stats.total_libur++;

                if (a.telat) stats.total_telat += parseInt(a.telat);
                if (a.pulang_cepat) stats.total_pulang_cepat += parseInt(a.pulang_cepat);

                // Simplified overtime calculation if available in status/description or separate table
                // For now following the fields we see in the UI mockup requirements
            });

            const totalPossibleDays = stats.total_hadir + stats.total_alfa + stats.total_izin_masuk + stats.total_sakit + stats.total_cuti;
            const presencePercentage = totalPossibleDays > 0 ? Math.round((stats.total_hadir / totalPossibleDays) * 100) : 0;

            return {
                user_id: user.id.toString(),
                user: {
                    name: user.name,
                    foto_karyawan: user.foto_karyawan
                },
                ...stats,
                total_lembur: "0 Jam 0 Menit", // Placeholder for actual calculation
                persentase_kehadiran: presencePercentage
            };
        });

        return result;
    }

    serializeList(items) {
        return items.map((i) => this.serialize(i));
    }
}

export default new AbsensiService();