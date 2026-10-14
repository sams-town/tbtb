import prisma from "../config/prisma.js";

class JabatanService {
    /**
     * Get all jabatans with optional search
     */
    async getAll(query = {}) {
        const search = query.search || "";

        const where = search
            ? {
                nama_jabatan: { contains: search },
            }
            : {};

        const data = await prisma.jabatans.findMany({
            where,
            orderBy: { id: "desc" },
            include: {
                users: { // manager relation
                    select: { id: true, name: true, email: true }
                },
                user_jabatans: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        return {
            data: this.serializeList(data),
        };
    }

    /**
     * Get single jabatan by ID
     */
    async getById(id) {
        const jabatan = await prisma.jabatans.findUnique({
            where: { id: BigInt(id) },
            include: {
                users: { // manager relation
                    select: { id: true, name: true, email: true }
                },
                user_jabatans: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        if (!jabatan) return null;

        return this.serialize(jabatan);
    }

    /**
     * Create a new jabatan
     */
    async create(data) {
        const payload = {
            nama_jabatan: data.nama_jabatan,
        };

        if (data.manager) {
            payload.manager = BigInt(data.manager);
        }

        const jabatan = await prisma.jabatans.create({
            data: payload,
            include: {
                users: {
                    select: { id: true, name: true, email: true }
                },
                user_jabatans: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        return this.serialize(jabatan);
    }

    /**
     * Update jabatan by ID
     */
    async update(id, data) {
        const existing = await prisma.jabatans.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        const updateData = {};
        if (data.nama_jabatan !== undefined) updateData.nama_jabatan = data.nama_jabatan;
        if (data.manager !== undefined) {
            updateData.manager = data.manager ? BigInt(data.manager) : null;
        }

        const jabatan = await prisma.jabatans.update({
            where: { id: BigInt(id) },
            data: updateData,
            include: {
                users: {
                    select: { id: true, name: true, email: true }
                },
                user_jabatans: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        return this.serialize(jabatan);
    }

    /**
     * Delete jabatan by ID
     */
    async delete(id) {
        const existing = await prisma.jabatans.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        await prisma.jabatans.delete({
            where: { id: BigInt(id) },
        });

        return true;
    }

    /**
     * Serialize a single jabatan — convert BigInt to string for JSON
     */
    serialize(jabatan) {
        return {
            id: typeof jabatan.id === "bigint" ? jabatan.id.toString() : jabatan.id,
            nama_jabatan: jabatan.nama_jabatan,
            manager: jabatan.manager !== undefined && jabatan.manager !== null ? jabatan.manager.toString() : null,
            manager_name: jabatan.users ? jabatan.users.name : null,
            manager_email: jabatan.users ? jabatan.users.email : null,
            created_at: jabatan.created_at,
            updated_at: jabatan.updated_at,
            users: Array.isArray(jabatan.user_jabatans) ? jabatan.user_jabatans.map((u) => ({
                id: typeof u.id === "bigint" ? u.id.toString() : u.id,
                name: u.name,
                email: u.email,
            })) : [],
        };
    }

    /**
     * Serialize a list of jabatans
     */
    serializeList(jabatans) {
        return jabatans.map((jabatan) => this.serialize(jabatan));
    }
    /**
     * Get jabatans yang hanya dipakai oleh user dengan role tertentu
     * Dipakai untuk filter divisi di halaman Data Dokter agar tidak campur dengan divisi lain
     */
    async getByRole(roleName) {
        if (!roleName) return this.getAll();

        // Ambil semua user_id yang punya role tersebut
        const roleUsers = await prisma.model_has_roles.findMany({
            where: { roles: { name: roleName } },
            select: { model_id: true }
        });
        const userIds = roleUsers.map(r => r.model_id);

        if (userIds.length === 0) return { data: [] };

        // Ambil jabatan_id yang dipakai user-user tersebut
        const users = await prisma.users.findMany({
            where: {
                id:         { in: userIds },
                jabatan_id: { not: null }
            },
            select: { jabatan_id: true }
        });

        const jabatanIds = [...new Set(
            users.map(u => u.jabatan_id).filter(Boolean)
        )];

        if (jabatanIds.length === 0) return { data: [] };

        const data = await prisma.jabatans.findMany({
            where: { id: { in: jabatanIds } },
            orderBy: { nama_jabatan: 'asc' },
        });

        return { data: this.serializeList(data) };
    }
}

export default new JabatanService();
