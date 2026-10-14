import prisma from "../config/prisma.js";

class KontrakService {
    async getAll(query = {}) {
        const search    = query.search || "";
        const andConds  = [];

        // ── Filter user_id ────────────────────────────────────────
        if (query.user_id) {
            andConds.push({ user_id: BigInt(query.user_id) });
        }

        // ── Filter jenis_kontrak ──────────────────────────────────
        if (query.jenis_kontrak) {
            andConds.push({ jenis_kontrak: { contains: query.jenis_kontrak } });
        }

        // ── Filter masa berlaku (akan berakhir / sudah berakhir) ──
        if (query.status_kontrak === "aktif") {
            andConds.push({ tanggal_selesai: { gte: new Date() } });
        } else if (query.status_kontrak === "berakhir") {
            andConds.push({ tanggal_selesai: { lt: new Date() } });
        }

        // ── Search: nama karyawan, jenis_kontrak, no_kontrak, keterangan ──
        if (search) {
            // Cari user_id yang namanya cocok dulu
            const matchedUsers = await prisma.users.findMany({
                where: { name: { contains: search } },
                select: { id: true }
            });
            const matchedUserIds = matchedUsers.map(u => u.id);

            andConds.push({
                OR: [
                    { jenis_kontrak: { contains: search } },
                    { no_kontrak:    { contains: search } },
                    { keterangan:    { contains: search } },
                    ...(matchedUserIds.length > 0
                        ? [{ user_id: { in: matchedUserIds } }]
                        : [])
                ]
            });
        }

        const where = andConds.length > 0 ? { AND: andConds } : {};

        const data = await prisma.kontraks.findMany({
            where,
            orderBy: [{ tanggal_selesai: "asc" }, { id: "desc" }],
        });

        // Enrich dengan nama karyawan
        const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
        let usersMap = {};
        if (userIds.length) {
            const users = await prisma.users.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, jabatan: { select: { nama_jabatan: true } } }
            });
            usersMap = Object.fromEntries(users.map(u => [u.id.toString(), u]));
        }

        const enriched = data.map(k => {
            const serialized = this.serialize(k);
            const user = usersMap[k.user_id?.toString()] ?? null;
            serialized.nama_karyawan = user?.name ?? '-';
            serialized.jabatan = user?.jabatan?.nama_jabatan ?? '-';
            return serialized;
        });

        return { data: enriched };
    }

    async getByUserId(userId) {
        const contracts = await prisma.kontraks.findMany({
            where: { user_id: BigInt(userId) },
            orderBy: { id: "desc" },
        });

        // Enrich dengan data karyawan
        let user = null;
        try {
            user = await prisma.users.findUnique({
                where: { id: BigInt(userId) },
                select: { id: true, name: true, jabatan: { select: { nama_jabatan: true } } }
            });
        } catch (_) {}

        return contracts.map(k => {
            const s = this.serialize(k);
            s.nama_karyawan = user?.name ?? '-';
            s.jabatan = user?.jabatan?.nama_jabatan ?? '-';
            return s;
        });
    }

    async getById(id) {
        const kontrak = await prisma.kontraks.findUnique({
            where: { id: BigInt(id) },
        });
        if (!kontrak) return null;

        const serialized = this.serialize(kontrak);

        // Enrich dengan data karyawan agar halaman detail tidak blank
        if (kontrak.user_id) {
            const user = await prisma.users.findUnique({
                where: { id: kontrak.user_id },
                select: {
                    id: true, name: true, username: true,
                    jabatan: { select: { nama_jabatan: true } },
                    lokasi:  { select: { nama_lokasi:  true } },
                    foto_karyawan: true,
                }
            });
            if (user) {
                serialized.users = {
                    id:           user.id.toString(),
                    name:         user.name,
                    username:     user.username,
                    jabatan:      user.jabatan?.nama_jabatan ?? null,
                    lokasi:       user.lokasi?.nama_lokasi   ?? null,
                    foto_karyawan: user.foto_karyawan ?? null,
                };
                serialized.nama_karyawan = user.name;
            }
        }

        return serialized;
    }

    async create(data) {
        const payload = {};
        // tanggal default hari ini, bisa diubah
        payload.tanggal = data.tanggal ? new Date(data.tanggal) : new Date();
        if (data.user_id) payload.user_id = BigInt(data.user_id);
        if (data.jenis_kontrak !== undefined) payload.jenis_kontrak = data.jenis_kontrak;
        if (data.tanggal_mulai) payload.tanggal_mulai = new Date(data.tanggal_mulai);
        if (data.tanggal_selesai) payload.tanggal_selesai = new Date(data.tanggal_selesai);
        if (data.keterangan !== undefined) payload.keterangan = data.keterangan;
        if (data.kontrak_file_path !== undefined) payload.kontrak_file_path = data.kontrak_file_path;
        if (data.kontrak_file_name !== undefined) payload.kontrak_file_name = data.kontrak_file_name;

        const kontrak = await prisma.kontraks.create({ data: payload });

        if (data.user_id) {
            const userUpdateData = {};
            if (data.no_kontrak !== undefined) userUpdateData.no_kontrak = data.no_kontrak;
            if (data.tanggal_mulai !== undefined) userUpdateData.tanggal_mulai_pkwt = data.tanggal_mulai ? new Date(data.tanggal_mulai) : null;
            if (data.tanggal_selesai !== undefined) userUpdateData.tanggal_berakhir_pkwt = data.tanggal_selesai ? new Date(data.tanggal_selesai) : null;

            if (Object.keys(userUpdateData).length > 0) {
                await prisma.users.update({
                    where: { id: BigInt(data.user_id) },
                    data: userUpdateData
                });
            }
        }

        return this.serialize(kontrak);
    }

    async update(id, data) {
        const existing = await prisma.kontraks.findUnique({
            where: { id: BigInt(id) },
        });
        if (!existing) return null;

        const updateData = {};
        if (data.user_id !== undefined) updateData.user_id = data.user_id ? BigInt(data.user_id) : null;
        if (data.tanggal !== undefined) updateData.tanggal = data.tanggal ? new Date(data.tanggal) : null;
        if (data.jenis_kontrak !== undefined) updateData.jenis_kontrak = data.jenis_kontrak;
        if (data.tanggal_mulai !== undefined) updateData.tanggal_mulai = data.tanggal_mulai ? new Date(data.tanggal_mulai) : null;
        if (data.tanggal_selesai !== undefined) updateData.tanggal_selesai = data.tanggal_selesai ? new Date(data.tanggal_selesai) : null;

        if (data.keterangan !== undefined) updateData.keterangan = data.keterangan;
        if (data.kontrak_file_path !== undefined) updateData.kontrak_file_path = data.kontrak_file_path;
        if (data.kontrak_file_name !== undefined) updateData.kontrak_file_name = data.kontrak_file_name;

        const kontrak = await prisma.kontraks.update({
            where: { id: BigInt(id) },
            data: updateData,
        });

        if (updateData.user_id || existing.user_id) {
            const finalUserId = updateData.user_id || existing.user_id;
            const userUpdateData = {};
            if (data.no_kontrak !== undefined) userUpdateData.no_kontrak = data.no_kontrak;
            if (data.tanggal_mulai !== undefined) userUpdateData.tanggal_mulai_pkwt = data.tanggal_mulai ? new Date(data.tanggal_mulai) : null;
            if (data.tanggal_selesai !== undefined) userUpdateData.tanggal_berakhir_pkwt = data.tanggal_selesai ? new Date(data.tanggal_selesai) : null;

            if (Object.keys(userUpdateData).length > 0) {
                await prisma.users.update({
                    where: { id: finalUserId },
                    data: userUpdateData
                });
            }
        }

        return this.serialize(kontrak);
    }

    async delete(id) {
        const existing = await prisma.kontraks.findUnique({
            where: { id: BigInt(id) },
        });
        if (!existing) return null;

        await prisma.kontraks.delete({ where: { id: BigInt(id) } });
        return true;
    }

    serialize(kontrak) {
        const serialized = {};
        for (const [key, value] of Object.entries(kontrak)) {
            if (typeof value === "bigint") {
                serialized[key] = value.toString();
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

export default new KontrakService();