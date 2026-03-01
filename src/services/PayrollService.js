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

    async update(id, data) {
        // Convert numeric fields to BigInt if they exist
        const numericFields = [
            'gaji_pokok', 'total_reimbursement', 'jumlah_tunjangan_transport', 'uang_tunjangan_transport', 'total_tunjangan_transport',
            'jumlah_tunjangan_makan', 'uang_tunjangan_makan', 'total_tunjangan_makan', 'total_tunjangan_bpjs_kesehatan',
            'total_tunjangan_bpjs_ketenagakerjaan', 'total_potongan_bpjs_kesehatan', 'total_potongan_bpjs_ketenagakerjaan',
            'jumlah_mangkir', 'uang_mangkir', 'total_mangkir', 'jumlah_lembur', 'uang_lembur', 'total_lembur',
            'jumlah_izin', 'uang_izin', 'total_izin', 'bonus_pribadi', 'bonus_team', 'bonus_jackpot',
            'jumlah_terlambat', 'uang_terlambat', 'total_terlambat', 'jumlah_kehadiran', 'uang_kehadiran', 'total_kehadiran',
            'saldo_kasbon', 'bayar_kasbon', 'jumlah_thr', 'uang_thr', 'total_thr', 'loss',
            'total_penjumlahan', 'total_pengurangan', 'grand_total'
        ];

        const updateData = { ...data };
        delete updateData.id;
        delete updateData.user;
        delete updateData.user_id;
        delete updateData.created_at;
        delete updateData.updated_at;

        numericFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updateData[field] = BigInt(Math.round(parseFloat(updateData[field]) || 0));
            }
        });

        if (updateData.tanggal_mulai) updateData.tanggal_mulai = new Date(updateData.tanggal_mulai);
        if (updateData.tanggal_akhir) updateData.tanggal_akhir = new Date(updateData.tanggal_akhir);

        const result = await prisma.payrolls.update({
            where: { id: BigInt(id) },
            data: updateData
        });

        return {
            success: true,
            message: "Berhasil memperbarui data payroll",
            data: this.serialize(result)
        };
    }

    async delete(id) {
        await prisma.payrolls.delete({
            where: { id: BigInt(id) }
        });

        return {
            success: true,
            message: "Berhasil menghapus data payroll"
        };
    }

    async generateAll(bulan, tahun, tanggalMulai, tanggalAkhir) {
        // Get all users with their related info
        const allUsers = await prisma.users.findMany({
            include: {
                jabatan: true
            }
        });

        const results = [];
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const monthIndex = monthNames.indexOf(bulan);

        const startDate = tanggalMulai ? new Date(tanggalMulai) : new Date(parseInt(tahun), monthIndex, 1);
        const endDate = tanggalAkhir ? new Date(tanggalAkhir) : new Date(parseInt(tahun), monthIndex + 1, 0);

        for (const user of allUsers) {
            // Check if payroll already exists for this user, month, and year
            const existing = await prisma.payrolls.findFirst({
                where: {
                    user_id: user.id,
                    bulan,
                    tahun
                }
            });

            if (existing) continue;

            const noGaji = `PAY-${tahun}-${bulan.toUpperCase()}-${user.id}`;

            // Basic calculation logic
            // In a real system, you'd aggregate data from absensi, lembur, etc.
            // Here we use the default values from user profile
            const gajiPokok = user.gaji_pokok || 2000000n;
            const tMakan = user.tunjangan_makan || 0n;
            const tTransport = user.tunjangan_transport || 0n;
            const tBpjsKes = user.tunjangan_bpjs_kesehatan || 0n;
            const tBpjsKet = user.tunjangan_bpjs_ketenagakerjaan || 0n;
            const pBpjsKes = user.potongan_bpjs_kesehatan || 0n;
            const pBpjsKet = user.potongan_bpjs_ketenagakerjaan || 0n;

            // Simplified totals
            const totalPenjumlahan = gajiPokok + tMakan + tTransport + tBpjsKes + tBpjsKet;
            const totalPengurangan = pBpjsKes + pBpjsKet;
            const grandTotal = totalPenjumlahan - totalPengurangan;

            const newPayroll = await prisma.payrolls.create({
                data: {
                    user_id: user.id,
                    tanggal_mulai: startDate,
                    tanggal_akhir: endDate,
                    bulan,
                    tahun,
                    persentase_kehadiran: "100%",
                    no_gaji: noGaji,
                    gaji_pokok: gajiPokok,
                    total_reimbursement: 0n,
                    jumlah_tunjangan_transport: 22n, // Default estimate
                    uang_tunjangan_transport: tTransport / 22n,
                    total_tunjangan_transport: tTransport,
                    jumlah_tunjangan_makan: 22n,
                    uang_tunjangan_makan: tMakan / 22n,
                    total_tunjangan_makan: tMakan,
                    total_tunjangan_bpjs_kesehatan: tBpjsKes,
                    total_tunjangan_bpjs_ketenagakerjaan: tBpjsKet,
                    total_potongan_bpjs_kesehatan: pBpjsKes,
                    total_potongan_bpjs_ketenagakerjaan: pBpjsKet,
                    jumlah_mangkir: 0n,
                    uang_mangkir: 0n,
                    total_mangkir: 0n,
                    jumlah_lembur: 0n,
                    uang_lembur: 0n,
                    total_lembur: 0n,
                    jumlah_izin: 0n,
                    uang_izin: 0n,
                    total_izin: 0n,
                    bonus_pribadi: user.bonus_pribadi || 0n,
                    bonus_team: user.bonus_team || 0n,
                    bonus_jackpot: user.bonus_jackpot || 0n,
                    jumlah_terlambat: 0n,
                    uang_terlambat: 0n,
                    total_terlambat: 0n,
                    jumlah_kehadiran: 22n,
                    uang_kehadiran: 0n,
                    total_kehadiran: 0n,
                    saldo_kasbon: user.saldo_kasbon || 0n,
                    bayar_kasbon: 0n,
                    jumlah_thr: 0n,
                    uang_thr: 0n,
                    total_thr: 0n,
                    loss: 0n,
                    total_penjumlahan: totalPenjumlahan,
                    total_pengurangan: totalPengurangan,
                    grand_total: grandTotal,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });

            results.push(this.serialize(newPayroll));
        }

        return {
            success: true,
            message: `Berhasil men-generate ${results.length} data payroll baru`,
            data: results
        };
    }
}

export default new PayrollService();
