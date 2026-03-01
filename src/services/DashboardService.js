import prisma from "../config/prisma.js";

class DashboardService {
    async getStats(requestedMonth, requestedYear) {
        const now = new Date();
        const year = requestedYear ? parseInt(requestedYear) : now.getFullYear();
        const month = requestedMonth ? parseInt(requestedMonth) - 1 : now.getMonth(); // Adjust month to be 0-indexed

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);

        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const currentMonthName = monthNames[month];
        const currentYear = year.toString();

        // 1. Total Pegawai
        const totalPegawai = await prisma.users.count();

        // 2. Attendance Stats (Current Month)
        const attendance = await prisma.mapping_shifts.findMany({
            where: {
                tanggal: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        });

        const attendanceStats = {
            masuk: 0,
            alfa: 0,
            cuti: 0,
            izin: 0,
            sakit: 0,
            lembur: 0,
            izin_telat: 0,
            izin_pulang_cepat: 0
        };

        attendance.forEach(a => {
            if (a.status_absen === 'Masuk' || a.status_absen === 'Pulang') attendanceStats.masuk++;
            else if (a.status_absen === 'Alfa') attendanceStats.alfa++;
            else if (a.status_absen === 'Cuti') attendanceStats.cuti++;
            else if (a.status_absen === 'Izin') attendanceStats.izin++;
            else if (a.status_absen === 'Sakit') attendanceStats.sakit++;

            // Check descriptions or specific fields for permissions
            if (a.keterangan_masuk?.toLowerCase().includes('izin telat')) attendanceStats.izin_telat++;
            if (a.keterangan_pulang?.toLowerCase().includes('izin pulang cepat')) attendanceStats.izin_pulang_cepat++;
        });

        // 3. Lembur (Selected Month)
        const totalLembur = await prisma.lemburs.count({
            where: {
                tanggal: {
                    contains: `${currentYear}-${String(month + 1).padStart(2, '0')}`
                },
                status: 'Approved'
            }
        });
        attendanceStats.lembur = totalLembur;

        // 4. Payroll Total (Selected Month)
        const payrollTotal = await prisma.payrolls.aggregate({
            where: {
                bulan: currentMonthName,
                tahun: currentYear
            },
            _sum: {
                grand_total: true
            }
        });

        // 5. Kasbon Total (Selected Month)
        const kasbonTotal = await prisma.kasbons.aggregate({
            where: {
                tanggal: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                status: 'APPROVED'
            },
            _sum: {
                nominal: true
            }
        });

        // 6. Reimbursement Total (Selected Month)
        const reimbursementTotal = await prisma.reimbursements.aggregate({
            where: {
                tanggal: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                status: 'APPROVED'
            },
            _sum: {
                total: true
            }
        });

        const serializeBigInt = (obj) => {
            return JSON.parse(JSON.stringify(obj, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            ));
        };

        return {
            total_pegawai: totalPegawai,
            attendance: attendanceStats,
            finance: serializeBigInt({
                payroll: payrollTotal._sum.grand_total || 0n,
                kasbon: kasbonTotal._sum.nominal || 0n,
                reimbursement: reimbursementTotal._sum.total || 0n,
                month: currentMonthName,
                year: currentYear
            })
        };
    }
}

export default new DashboardService();
