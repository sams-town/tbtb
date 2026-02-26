import prisma from "../config/prisma.js";

class RoleService {
    /**
     * Get all roles with optional pagination & search
     */
    async getAll(query = {}) {
        const search = query.search || "";

        const where = search
            ? {
                OR: [
                    { name: { contains: search } },
                    { guard_name: { contains: search } },
                ],
            }
            : {};

        const data = await prisma.roles.findMany({
            where,
            orderBy: { id: "asc" },
        });

        return {
            data: this.serializeList(data),
        };
    }

    /**
     * Get single role by ID
     */
    async getById(id) {
        const role = await prisma.roles.findUnique({
            where: { id: BigInt(id) },
        });

        if (!role) return null;

        return this.serialize(role);
    }

    /**
     * Create a new role
     */
    async create(data) {
        const role = await prisma.roles.create({
            data: {
                name: data.name,
                guard_name: data.guard_name || "web",
            },
        });

        return this.serialize(role);
    }

    /**
     * Update role by ID
     */
    async update(id, data) {
        const existing = await prisma.roles.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        const updateData = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.guard_name !== undefined) updateData.guard_name = data.guard_name;

        const role = await prisma.roles.update({
            where: { id: BigInt(id) },
            data: updateData,
        });

        return this.serialize(role);
    }

    /**
     * Delete role by ID
     */
    async delete(id) {
        const existing = await prisma.roles.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing) return null;

        await prisma.roles.delete({
            where: { id: BigInt(id) },
        });

        return true;
    }

    /**
     * Serialize a single role — convert BigInt to string for JSON
     */
    serialize(role) {
        const serialized = {};
        for (const [key, value] of Object.entries(role)) {
            if (typeof value === "bigint") {
                serialized[key] = value.toString();
            } else {
                serialized[key] = value;
            }
        }
        return serialized;
    }

    /**
     * Serialize a list of roles
     */
    serializeList(roles) {
        return roles.map((role) => this.serialize(role));
    }
}

export default new RoleService();
