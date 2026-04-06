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

    getWhere(conditions) {
        const self = this;
        return {
            async first() {
                const item = await prisma.payrolls.findFirst({
                    where: conditions,
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
                    data: self.serialize(item)
                };
            }
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
            'total_penjumlahan', 'total_pengurangan', 'grand_total', 'potongan_koperasi'
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
        // Get all users who are not admins
        const allUsers = await prisma.users.findMany({
            where: {
                is_admin: { not: "admin" }
            },
            include: {
                jabatan: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        const results = [];
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const monthIndex = monthNames.indexOf(bulan);

        const startDate = tanggalMulai ? new Date(tanggalMulai) : new Date(parseInt(tahun), monthIndex, 1);
        const endDate = tanggalAkhir ? new Date(tanggalAkhir) : new Date(parseInt(tahun), monthIndex + 1, 0);

        // Fetch attendance recap
        const absensiService = (await import("./AbsensiService.js")).default;
        const recap = await absensiService.getRecap(startDate, endDate);

        // Fetch all approved lemburs in the period
        const allLemburs = await prisma.lemburs.findMany({
            where: {
                status: 'Approved',
                tanggal: {
                    gte: startDate.toISOString().split('T')[0],
                    lte: endDate.toISOString().split('T')[0]
                }
            }
        });

        // Fetch all mapping_shifts in the period
        const allMappingShifts = await prisma.mapping_shifts.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: { shifts: true }
        });

        // Fetch all approved reimbursements in the period
        const allReimbursements = await prisma.reimbursements.findMany({
            where: {
                status: 'Approved',
                tanggal: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        // Fetch all reimbursement items
        const allReimbursementItems = await prisma.reimbursements_items.findMany();

        // Fetch all approved kasbons in the period
        const allKasbons = await prisma.kasbons.findMany({
            where: {
                status: 'Approved',
                tanggal: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        // Fetch all cutis (for izin count)
        const allCutis = await prisma.cutis.findMany({
            where: {
                status_cuti: 'Diterima',
                tanggal: {
                    gte: startDate.toISOString().split('T')[0],
                    lte: endDate.toISOString().split('T')[0]
                }
            }
        });

        let counterRecord = await prisma.counters.findFirst({ where: { name: 'Gaji' } });
        if (!counterRecord) {
            counterRecord = await prisma.counters.create({ data: { name: 'Gaji', counter: 0, text: 'GJ' } });
        }

        const jumlahHari = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        for (const user of allUsers) {
            // Check if payroll already exists for this user, month, and year
            const existing = await prisma.payrolls.findFirst({
                where: {
                    user_id: user.id,
                    bulan,
                    tahun
                }
            });

            const userMappingShifts = allMappingShifts.filter(m => m.user_id === user.id);
            const userCutis = allCutis.filter(c => c.user_id === user.id);

            let noGaji;
            if (existing) {
                noGaji = existing.no_gaji;
            } else {
                counterRecord = await prisma.counters.update({
                    where: { id: counterRecord.id },
                    data: { counter: counterRecord.counter + 1 }
                });
                const nextNumber = counterRecord.counter.toString().padStart(6, '0');
                noGaji = `${counterRecord.text || 'GJ'}/${nextNumber}`;
            }

            // Attendance calculations
            const hadir = userMappingShifts.filter(m => ['Masuk', 'Pulang'].includes(m.status_absen)).length;
            const izinTelat = userMappingShifts.filter(m => m.status_absen === 'Izin Telat').length;
            const izinPulangCepat = userMappingShifts.filter(m => m.status_absen === 'Izin Pulang Cepat').length;
            const libur = userMappingShifts.filter(m => m.status_absen === 'Libur').length;
            const cuti = userMappingShifts.filter(m => m.status_absen === 'Cuti').length;
            const izinMasukMapping = userMappingShifts.filter(m => m.status_absen === 'Izin Masuk').length;
            const sakit = userMappingShifts.filter(m => m.status_absen === 'Sakit').length;

            const persentaseKehadiran = (jumlahHari > 0) ? 
                ((hadir + izinTelat + izinPulangCepat + libur) / jumlahHari) * 100 : 0;

            const totalAlfa = Math.max(0, jumlahHari - hadir - cuti - izinMasukMapping - libur - sakit);

            // ... (overtime, reimbursement, etc.) ...
            // Overtime
            const userLemburs = allLemburs.filter(l => l.user_id === user.id);
            const totalLemburDetik = userLemburs.reduce((acc, l) => acc + BigInt(l.total_lembur || 0), 0n);
            const jamLembur = totalLemburDetik / 3600n;
            const totalLemburUang = jamLembur * (user.lembur || 0n);

            // Reimbursement
            const userReimbursements = allReimbursements.filter(r => r.user_id === user.id);
            const sisaReimbursement = userReimbursements.reduce((acc, r) => acc + (r.sisa || 0n), 0n);
            const feeReimbursement = allReimbursementItems
                .filter(item => {
                    const parent = allReimbursements.find(r => r.id === item.reimbursement_id);
                    return parent && parent.user_id === user.id;
                })
                .filter(item => item.user_id === user.id)
                .reduce((acc, item) => acc + (item.fee || 0n), 0n);
            const totalReimbursementUang = sisaReimbursement + feeReimbursement;

            // Izin count from cutis table
            const countIzin = userCutis.filter(c => c.nama_cuti === 'Izin Masuk').length;

            // Lateness calculation per minute (synced with shifts)
            let totalMenitTelat = 0n;
            const tolerance = user.batas_terlambat ? Number(user.batas_terlambat) : 0;
            
            userMappingShifts.forEach(m => {
                let telatMins = 0;
                if (m.shifts && m.jam_absen && m.shifts.jam_masuk) {
                    const diff = absensiService.timeToMinutes(m.jam_absen) - absensiService.timeToMinutes(m.shifts.jam_masuk);
                    telatMins = diff > 0 ? diff : 0;
                } else if (m.telat) {
                    telatMins = parseInt(m.telat);
                }

                if (telatMins > tolerance) {
                    totalMenitTelat += BigInt(telatMins - tolerance);
                }
            });

            const potonganPerMenit = user.terlambat || 1000n; 
            const totalTerlambat = totalMenitTelat * potonganPerMenit;

            // Presence Bonus (100% attendance only)
            const jumlahKehadiranIndicator = (persentaseKehadiran === 100) ? 1n : 0n;
            const totalKehadiranBonus = jumlahKehadiranIndicator * (user.kehadiran || 0n);

            // Mangkir deduction
            const uangMangkir = user.mangkir || 0n;
            const totalMangkir = BigInt(totalAlfa) * uangMangkir;
            
            // Izin deduction
            const uangIzin = user.izin || 0n;
            const totalIzin = BigInt(countIzin) * uangIzin;

            // Others
            const gajiPokok = user.gaji_pokok || 0n;
            const tMakan = user.tunjangan_makan || 0n;
            const tTransport = user.tunjangan_transport || 0n;
            const tBpjsKes = user.tunjangan_bpjs_kesehatan || 0n;
            const tBpjsKet = user.tunjangan_bpjs_ketenagakerjaan || 0n;
            const pBpjsKes = user.potongan_bpjs_kesehatan || 0n;
            const pBpjsKet = user.potongan_bpjs_ketenagakerjaan || 0n;
            const pKoperasi = user.potongan_koperasi || 0n;
            const bPribadi = user.bonus_pribadi || 0n;
            const bTeam = user.bonus_team || 0n;
            const bJackpot = user.bonus_jackpot || 0n;
            const totalThr = user.thr || 0n;

            // Kasbon payment (half of balance)
            const bayarKasbon = (user.saldo_kasbon || 0n) / 2n;

            const totalPenjumlahan = gajiPokok
                + totalReimbursementUang
                + (tTransport * BigInt(hadir))
                + (tMakan * BigInt(hadir))
                + tBpjsKes + tBpjsKet
                + totalLemburUang
                + bPribadi + bTeam + bJackpot
                + totalKehadiranBonus + totalThr;

            const totalPengurangan = pBpjsKes + pBpjsKet + totalMangkir + totalIzin + totalTerlambat + bayarKasbon + pKoperasi;
            const grandTotal = totalPenjumlahan - totalPengurangan;

            const payrollData = {
                user_id: user.id,
                tanggal_mulai: startDate,
                tanggal_akhir: endDate,
                bulan,
                tahun,
                persentase_kehadiran: `${persentaseKehadiran.toFixed(0)}%`,
                no_gaji: noGaji,
                gaji_pokok: gajiPokok,
                total_reimbursement: totalReimbursementUang,
                jumlah_tunjangan_transport: BigInt(hadir),
                uang_tunjangan_transport: tTransport,
                total_tunjangan_transport: tTransport * BigInt(hadir),
                jumlah_tunjangan_makan: BigInt(hadir),
                uang_tunjangan_makan: tMakan,
                total_tunjangan_makan: tMakan * BigInt(hadir),
                total_tunjangan_bpjs_kesehatan: tBpjsKes,
                total_tunjangan_bpjs_ketenagakerjaan: tBpjsKet,
                total_potongan_bpjs_kesehatan: pBpjsKes,
                total_potongan_bpjs_ketenagakerjaan: pBpjsKet,
                jumlah_mangkir: BigInt(totalAlfa),
                uang_mangkir: uangMangkir,
                total_mangkir: totalMangkir,
                jumlah_lembur: jamLembur,
                uang_lembur: user.lembur || 0n,
                total_lembur: totalLemburUang,
                jumlah_izin: BigInt(countIzin),
                uang_izin: uangIzin,
                total_izin: totalIzin,
                bonus_pribadi: bPribadi,
                bonus_team: bTeam,
                bonus_jackpot: bJackpot,
                jumlah_terlambat: totalMenitTelat, 
                uang_terlambat: potonganPerMenit,
                total_terlambat: totalTerlambat,
                jumlah_kehadiran: jumlahKehadiranIndicator,
                uang_kehadiran: user.kehadiran || 0n,
                total_kehadiran: totalKehadiranBonus,
                saldo_kasbon: user.saldo_kasbon || 0n,
                bayar_kasbon: bayarKasbon,
                jumlah_thr: totalThr > 0n ? 1n : 0n,
                uang_thr: totalThr,
                total_thr: totalThr,
                loss: 0n,
                total_penjumlahan: totalPenjumlahan,
                total_pengurangan: totalPengurangan,
                grand_total: grandTotal,
                potongan_koperasi: pKoperasi,
                updated_at: new Date()
            };

            let newPayroll;
            if (existing) {
                newPayroll = await prisma.payrolls.update({
                    where: { id: existing.id },
                    data: payrollData
                });
            } else {
                newPayroll = await prisma.payrolls.create({
                    data: {
                        ...payrollData,
                        created_at: new Date()
                    }
                });
            }

            // Update user's bonuses and kasbon balance
            await prisma.users.update({
                where: { id: user.id },
                data: {
                    saldo_kasbon: (user.saldo_kasbon || 0n) - bayarKasbon,
                    bonus_pribadi: 0n,
                    bonus_team: 0n,
                    bonus_jackpot: 0n,
                }
            });

            const serialized = this.serialize(newPayroll);
            results.push(serialized);
        }

        return {
            success: true,
            message: `Berhasil men-generate ${results.length} data payroll baru`,
            data: results
        };
    }

    async generate(userId, bulan, tahun, tanggalMulai, tanggalAkhir) {
        if (!userId || userId === "undefined") throw new Error("User ID tidak valid");
        const user = await prisma.users.findUnique({
            where: { id: BigInt(userId) },
            include: { jabatan: true }
        });

        if (!user) throw new Error("User tidak ditemukan");

        const existing = await prisma.payrolls.findFirst({
            where: {
                user_id: user.id,
                bulan,
                tahun
            }
        });

        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const monthIndex = monthNames.indexOf(bulan);
        const startDate_ = tanggalMulai ? new Date(tanggalMulai) : new Date(parseInt(tahun), monthIndex, 1);
        const endDate_ = tanggalAkhir ? new Date(tanggalAkhir) : new Date(parseInt(tahun), monthIndex + 1, 0);

        // Fetch specific records for this user in the period
        const userMappingShifts = await prisma.mapping_shifts.findMany({
            where: {
                user_id: user.id,
                tanggal: {
                    gte: startDate_,
                    lte: endDate_
                }
            },
            include: { shifts: true }
        });

        const userLemburs = await prisma.lemburs.findMany({
            where: {
                user_id: user.id,
                status: 'Approved',
                tanggal: {
                    gte: startDate_.toISOString().split('T')[0],
                    lte: endDate_.toISOString().split('T')[0]
                }
            }
        });

        const userReimbursements = await prisma.reimbursements.findMany({
            where: {
                user_id: user.id,
                status: 'Approved',
                tanggal: {
                    gte: startDate_,
                    lte: endDate_
                }
            }
        });

        const userReimbursementItems = await prisma.reimbursements_items.findMany({
            where: {
                user_id: user.id
            }
        });

        const userKasbons = await prisma.kasbons.findMany({
            where: {
                user_id: user.id,
                status: 'Approved',
                tanggal: {
                    gte: startDate_,
                    lte: endDate_
                }
            }
        });

        const userCutis = await prisma.cutis.findMany({
            where: {
                user_id: user.id,
                status_cuti: 'Diterima',
                tanggal: {
                    gte: startDate_.toISOString().split('T')[0],
                    lte: endDate_.toISOString().split('T')[0]
                }
            }
        });

        const counter = await prisma.counters.findFirst({ where: { name: 'Gaji' } });
        let noGaji;
        if (existing) {
            noGaji = existing.no_gaji;
        } else {
            const updatedCounter = await prisma.counters.update({
                where: { id: counter.id },
                data: { counter: counter.counter + 1 }
            });
            const nextNumber = updatedCounter.counter.toString().padStart(6, '0');
            noGaji = `${updatedCounter.text || 'GJ'}/${nextNumber}`;
        }

        const jumlahHari = Math.floor((endDate_.getTime() - startDate_.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Attendance calculations
        const hadir = userMappingShifts.filter(m => ['Masuk', 'Pulang'].includes(m.status_absen)).length;
        const izinTelat = userMappingShifts.filter(m => m.status_absen === 'Izin Telat').length;
        const izinPulangCepat = userMappingShifts.filter(m => m.status_absen === 'Izin Pulang Cepat').length;
        const libur = userMappingShifts.filter(m => m.status_absen === 'Libur').length;
        const cuti = userMappingShifts.filter(m => m.status_absen === 'Cuti').length;
        const izinMasukMapping = userMappingShifts.filter(m => m.status_absen === 'Izin Masuk').length;
        const sakit = userMappingShifts.filter(m => m.status_absen === 'Sakit').length;

        const persentaseKehadiran = (jumlahHari > 0) ? 
            ((hadir + izinTelat + izinPulangCepat + libur) / jumlahHari) * 100 : 0;

        const totalAlfa = Math.max(0, jumlahHari - hadir - cuti - izinMasukMapping - libur - sakit);

        // Overtime
        const totalLemburDetik = userLemburs.reduce((acc, l) => acc + BigInt(l.total_lembur || 0), 0n);
        const jamLembur = totalLemburDetik / 3600n;
        const totalLemburUang = jamLembur * (user.lembur || 0n);

        // Reimbursement
        const sisaReimbursement = userReimbursements.reduce((acc, r) => acc + (r.sisa || 0n), 0n);
        const feeReimbursement = userReimbursementItems.reduce((acc, item) => acc + (item.fee || 0n), 0n);
        const totalReimbursementUang = sisaReimbursement + feeReimbursement;

        // Izin from cutis table
        const countIzin = userCutis.filter(c => c.nama_cuti === 'Izin Masuk').length;

        // Lateness
        let totalMenitTelat = 0n;
        const tolerance = user.batas_terlambat ? Number(user.batas_terlambat) : 0;
        const absensiService = (await import("./AbsensiService.js")).default;
        
        userMappingShifts.forEach(m => {
            let telatMins = 0;
            if (m.shifts && m.jam_absen && m.shifts.jam_masuk) {
                const diff = absensiService.timeToMinutes(m.jam_absen) - absensiService.timeToMinutes(m.shifts.jam_masuk);
                telatMins = diff > 0 ? diff : 0;
            } else if (m.telat) {
                telatMins = parseInt(m.telat);
            }

            if (telatMins > tolerance) {
                totalMenitTelat += BigInt(telatMins - tolerance);
            }
        });
        
        const potonganPerMenit = user.terlambat || 1000n;
        const totalTerlambat = totalMenitTelat * potonganPerMenit;

        // Presence Bonus (100% only)
        const jumlahKehadiranIndicator = (persentaseKehadiran === 100) ? 1n : 0n;
        const totalKehadiranBonus = jumlahKehadiranIndicator * (user.kehadiran || 0n);

        // Mangkir deduction
        const uangMangkir = user.mangkir || 0n;
        const totalMangkir = BigInt(totalAlfa) * uangMangkir;
        
        // Izin deduction
        const uangIzin = user.izin || 0n;
        const totalIzin = BigInt(countIzin) * uangIzin;

        // Basic fields
        const gajiPokok = user.gaji_pokok || 0n;
        const tMakan = user.tunjangan_makan || 0n;
        const tTransport = user.tunjangan_transport || 0n;
        const tBpjsKes = user.tunjangan_bpjs_kesehatan || 0n;
        const tBpjsKet = user.tunjangan_bpjs_ketenagakerjaan || 0n;
        const pBpjsKes = user.potongan_bpjs_kesehatan || 0n;
        const pBpjsKet = user.potongan_bpjs_ketenagakerjaan || 0n;
        const pKoperasi = user.potongan_koperasi || 0n;
        const bPribadi = user.bonus_pribadi || 0n;
        const bTeam = user.bonus_team || 0n;
        const bJackpot = user.bonus_jackpot || 0n;
        const totalThr = user.thr || 0n;

        // Kasbon
        const bayarKasbon = (user.saldo_kasbon || 0n) / 2n;

        const totalPenjumlahan = gajiPokok + totalReimbursementUang + (tTransport * BigInt(hadir)) + (tMakan * BigInt(hadir)) + tBpjsKes + tBpjsKet + totalLemburUang + bPribadi + bTeam + bJackpot + totalKehadiranBonus + totalThr;
        const totalPengurangan = pBpjsKes + pBpjsKet + totalMangkir + totalIzin + totalTerlambat + bayarKasbon + pKoperasi;
        const grandTotal = totalPenjumlahan - totalPengurangan;

        const payrollData = {
            user_id: user.id,
            tanggal_mulai: startDate_,
            tanggal_akhir: endDate_,
            bulan,
            tahun,
            persentase_kehadiran: `${persentaseKehadiran.toFixed(0)}%`,
            no_gaji: noGaji,
            gaji_pokok: gajiPokok,
            total_reimbursement: totalReimbursementUang,
            jumlah_tunjangan_transport: BigInt(hadir),
            uang_tunjangan_transport: tTransport,
            total_tunjangan_transport: tTransport * BigInt(hadir),
            jumlah_tunjangan_makan: BigInt(hadir),
            uang_tunjangan_makan: tMakan,
            total_tunjangan_makan: tMakan * BigInt(hadir),
            total_tunjangan_bpjs_kesehatan: tBpjsKes,
            total_tunjangan_bpjs_ketenagakerjaan: tBpjsKet,
            total_potongan_bpjs_kesehatan: pBpjsKes,
            total_potongan_bpjs_ketenagakerjaan: pBpjsKet,
            jumlah_mangkir: BigInt(totalAlfa),
            uang_mangkir: uangMangkir,
            total_mangkir: totalMangkir,
            jumlah_lembur: jamLembur,
            uang_lembur: user.lembur || 0n,
            total_lembur: totalLemburUang,
            jumlah_izin: BigInt(countIzin),
            uang_izin: uangIzin,
            total_izin: totalIzin,
            bonus_pribadi: bPribadi,
            bonus_team: bTeam,
            bonus_jackpot: bJackpot,
            jumlah_terlambat: totalMenitTelat,
            uang_terlambat: potonganPerMenit,
            total_terlambat: totalTerlambat,
            jumlah_kehadiran: jumlahKehadiranIndicator,
            uang_kehadiran: user.kehadiran || 0n,
            total_kehadiran: totalKehadiranBonus,
            saldo_kasbon: user.saldo_kasbon || 0n,
            bayar_kasbon: bayarKasbon,
            jumlah_thr: totalThr > 0n ? 1n : 0n,
            uang_thr: totalThr,
            total_thr: totalThr,
            loss: 0n,
            total_penjumlahan: totalPenjumlahan,
            total_pengurangan: totalPengurangan,
            grand_total: grandTotal,
            potongan_koperasi: pKoperasi,
            updated_at: new Date()
        };

        let newPayroll;
        if (existing) {
            newPayroll = await prisma.payrolls.update({
                where: { id: existing.id },
                data: payrollData
            });
        } else {
            newPayroll = await prisma.payrolls.create({
                data: {
                    ...payrollData,
                    created_at: new Date()
                }
            });
        }

        // Update user's bonuses and kasbon balance
        await prisma.users.update({
            where: { id: user.id },
            data: {
                saldo_kasbon: (user.saldo_kasbon || 0n) - bayarKasbon,
                bonus_pribadi: 0n,
                bonus_team: 0n,
                bonus_jackpot: 0n,
            }
        });

        const serialized = this.serialize(newPayroll);
        return {
            success: true,
            message: "Payroll berhasil di-generate",
            data: serialized
        };
    }
}

export default new PayrollService();
