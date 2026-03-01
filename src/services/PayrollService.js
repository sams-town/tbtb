import prisma from "../config/prisma.js";

class PayrollService {
    serialize(item) {
        if (!item) return null;

        const json = JSON.stringify(item, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        );
        return JSON.parse(json);
    }

    async getAll(query = {}) {
        const { bulan, tahun, search } = query;
        const where = {
            AND: [
                bulan ? { bulan } : {},
                tahun ? { tahun } : {},
                search ? {
                    user: { name: { contains: search } }
                } : {}
            ]
        };

        const result = await prisma.payrolls.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        rekening: true,
                        nama_rekening: true,
                        tgl_join: true,
                        jabatan: {
                            select: { nama_jabatan: true }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        return {
            success: true,
            message: "Berhasil mengambil data payroll",
            data: result.map(item => this.serialize(item))
        };
    }

    async getById(id) {
        const item = await prisma.payrolls.findUnique({
            where: { id: BigInt(id) },
            include: {
                user: {
                    include: {
                        jabatan: true
                    }
                }
            }
        });

        if (!item) {
            return {
                success: false,
                message: "Data payroll tidak ditemukan"
            };
        }

        return {
            success: true,
            message: "Berhasil mengambil detail payroll",
            data: this.serialize(item)
        };
    }
}

export default new PayrollService();
