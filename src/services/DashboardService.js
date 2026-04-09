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
            },
            include: {
                users: {
                    select: {
                        name: true
                    }
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

        const calendarEvents = [];

        attendance.forEach(a => {
            if (a.status_absen === 'Masuk' || a.status_absen === 'Pulang') attendanceStats.masuk++;
            else if (a.status_absen === 'Alfa') attendanceStats.alfa++;
            else if (a.status_absen === 'Cuti') attendanceStats.cuti++;
            else if (a.status_absen === 'Izin') attendanceStats.izin++;
            else if (a.status_absen === 'Sakit') attendanceStats.sakit++;

            // Add to calendar events if specific status
            if (['Sakit', 'Cuti', 'Izin', 'Libur'].includes(a.status_absen)) {
                calendarEvents.push({
                    type: a.status_absen,
                    label: `${a.status_absen}: ${a.users?.name || 'Unknown'}`,
                    date: a.tanggal,
                    color: a.status_absen === 'Sakit' ? 'bg-rose-500' : 
                           a.status_absen === 'Cuti' ? 'bg-emerald-500' : 
                           a.status_absen === 'Izin' ? 'bg-indigo-400' : 'bg-slate-400'
                });
            }

            // Check descriptions or specific fields for permissions
            if (a.keterangan_masuk?.toLowerCase().includes('izin telat')) {
                attendanceStats.izin_telat++;
                calendarEvents.push({
                    type: 'Late',
                    label: `Late: ${a.users?.name || 'Unknown'}`,
                    date: a.tanggal,
                    color: 'bg-amber-500'
                });
            }
            if (a.keterangan_pulang?.toLowerCase().includes('izin pulang cepat')) {
                attendanceStats.izin_pulang_cepat++;
                calendarEvents.push({
                    type: 'Early Leave',
                    label: `Early Leave: ${a.users?.name || 'Unknown'}`,
                    date: a.tanggal,
                    color: 'bg-orange-500'
                });
            }
        });

        // 2.2 Dinas Luar (Business Trips)
        const dinasLuars = await prisma.dinas_luars.findMany({
            where: {
                tanggal: {
                    contains: `${currentYear}-${String(month + 1).padStart(2, '0')}`
                }
            }
        });

        // Fetch users for dinas luars to get names
        const dlUserIds = [...new Set(dinasLuars.map(dl => dl.user_id).filter(id => id !== null))];
        const dlUsers = await prisma.users.findMany({
            where: { id: { in: dlUserIds } },
            select: { id: true, name: true }
        });
        const dlUserMap = Object.fromEntries(dlUsers.map(u => [u.id.toString(), u]));

        dinasLuars.forEach(dl => {
            const userName = dl.user_id ? dlUserMap[dl.user_id.toString()]?.name : 'Unknown';
            calendarEvents.push({
                type: 'Dinas Luar',
                label: `Dinas Luar: ${userName || 'Unknown'}`,
                date: dl.tanggal ? new Date(dl.tanggal) : null,
                color: 'bg-cyan-500'
            });
        });

        // 2.3 Approved Cuti (from cutis table for ranges)
        const approvedCutis = await prisma.cutis.findMany({
            where: {
                status_cuti: 'Diterima',
                OR: [
                    { tanggal: { contains: `${currentYear}-${String(month + 1).padStart(2, '0')}` } }
                ]
            },
            include: { users: { select: { name: true } } }
        });

        approvedCutis.forEach(c => {
            const t = c.tanggal || "";
            if (t.includes(" - ")) {
                const [startStr, endStr] = t.split(" - ");
                const start = new Date(startStr);
                const end = new Date(endStr);
                
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    // Iterasi setiap hari dalam range
                    let curr = new Date(start);
                    while (curr <= end) {
                        if (curr.getMonth() === month && curr.getFullYear() === year) {
                            calendarEvents.push({
                                type: 'Cuti',
                                label: `Cuti: ${c.users?.name || 'Unknown'}`,
                                date: new Date(curr),
                                color: 'bg-emerald-500'
                            });
                        }
                        curr.setDate(curr.getDate() + 1);
                    }
                }
            } else if (t) {
                const d = new Date(t);
                if (!isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year) {
                    calendarEvents.push({
                        type: 'Cuti',
                        label: `Cuti: ${c.users?.name || 'Unknown'}`,
                        date: d,
                        color: 'bg-emerald-500'
                    });
                }
            }
        });

        // 2.4 Approved Overtime
        const approvedLemburs = await prisma.lemburs.findMany({
            where: {
                tanggal: {
                    contains: `${currentYear}-${String(month + 1).padStart(2, '0')}`
                },
                status: 'Approved'
            },
            include: {
                karyawan: {
                    select: {
                        name: true
                    }
                }
            }
        });

        approvedLemburs.forEach(l => {
            calendarEvents.push({
                type: 'Overtime',
                label: `Lembur: ${l.karyawan?.name || 'Unknown'}`,
                date: l.tanggal ? new Date(l.tanggal) : null,
                color: 'bg-violet-500'
            });
        });

        // 2.5 Birthdays
        const allUsers = await prisma.users.findMany({
            where: { tgl_lahir: { not: null } },
            select: { name: true, tgl_lahir: true }
        });

        allUsers.forEach(u => {
            try {
                // Support YYYY-MM-DD or DD-MM-YYYY
                const parts = u.tgl_lahir.includes('-') ? u.tgl_lahir.split('-') : u.tgl_lahir.split('/');
                if (parts.length === 3) {
                    let bDay, bMonth;
                    if (parts[0].length === 4) { // YYYY-MM-DD
                        bMonth = parseInt(parts[1]);
                        bDay = parseInt(parts[2]);
                    } else { // DD-MM-YYYY
                        bDay = parseInt(parts[0]);
                        bMonth = parseInt(parts[1]);
                    }

                    if (bMonth === month + 1) {
                        calendarEvents.push({
                            type: 'Birthday',
                            label: `Birthday: ${u.name}`,
                            date: new Date(year, month, bDay),
                            color: 'bg-indigo-500'
                        });
                    }
                }
            } catch (e) {
                console.error("Error parsing birthday for user:", u.name, e);
            }
        });

        // 3. Finalize Events (Deduplicate)
        const uniqueEvents = [];
        const seen = new Set();
        calendarEvents.forEach(e => {
            if (!e.date) return;
            const d = new Date(e.date);
            if (isNaN(d.getTime())) return;

            const key = `${e.type}-${e.label}-${d.toISOString().split('T')[0]}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueEvents.push(e);
            }
        });

        // 4. Lembur Count (Selected Month)
        attendanceStats.lembur = approvedLemburs.length;

        // 5. Payroll Total (Selected Month)
        const payrollTotal = await prisma.payrolls.aggregate({
            where: {
                bulan: currentMonthName,
                tahun: currentYear
            },
            _sum: {
                grand_total: true
            }
        });

        // 6. Kasbon Total (Selected Month)
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

        // 7. Reimbursement Total (Selected Month)
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
            calendar_events: uniqueEvents,
            finance: serializeBigInt({
                payroll: payrollTotal._sum.grand_total || 0,
                kasbon: kasbonTotal._sum.nominal || 0,
                reimbursement: reimbursementTotal._sum.total || 0,
                month: currentMonthName,
                year: currentYear
            })
        };
    }
}

export default new DashboardService();
