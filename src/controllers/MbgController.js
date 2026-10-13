import mbgService from "../services/MbgService.js";

class MbgController {

    // ═══════════════════════════════════════════════
    //  SETTINGS
    // ═══════════════════════════════════════════════

    /** GET /api/mbg/settings */
    async getSetting(req, res) {
        try {
            const data = await mbgService.getSetting();
            return res.status(200).json({ success: true, message: "Berhasil mengambil setting MBG", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /** GET /api/mbg/settings/all */
    async getAllSettings(req, res) {
        try {
            const data = await mbgService.getAllSettings();
            return res.status(200).json({ success: true, message: "Berhasil mengambil riwayat setting MBG", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /** POST /api/mbg/settings — body: { harga, keterangan? } */
    async upsertSetting(req, res) {
        try {
            const { harga, keterangan } = req.body;
            if (!harga) {
                return res.status(400).json({ success: false, message: "Field 'harga' wajib diisi." });
            }
            const data = await mbgService.upsertSetting({ harga, keterangan });
            return res.status(200).json({ success: true, message: "Harga MBG berhasil diperbarui", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ═══════════════════════════════════════════════
    //  KLAIM
    // ═══════════════════════════════════════════════

    /** POST /api/mbg/klaim — body: { user_id, lat, long } */
    async klaim(req, res) {
        try {
            const { user_id, lat, long } = req.body;

            if (!user_id) {
                return res.status(400).json({ success: false, message: "Field 'user_id' wajib diisi." });
            }
            if (!lat || !long) {
                return res.status(400).json({ success: false, message: "GPS (lat & long) wajib dikirimkan." });
            }

            const data = await mbgService.klaim({ user_id, lat, long });
            return res.status(201).json({ success: true, message: "Klaim makan siang bergizi berhasil!", data });

        } catch (error) {
            // Bedakan error validasi bisnis vs error server
            const validasiKeywords = [
                "jam 12:00", "belum melakukan absensi",
                "sudah melakukan klaim", "radius kantor",
                "GPS", "lokasi kantor", "tidak ditemukan",
                "Koordinat kantor"
            ];
            const isValidasi = validasiKeywords.some(k => error.message.includes(k));
            return res.status(isValidasi ? 400 : 500).json({ success: false, message: error.message });
        }
    }

    /** GET /api/mbg/status/:user_id */
    async statusHariIni(req, res) {
        try {
            const data = await mbgService.statusHariIni(req.params.user_id);
            return res.status(200).json({ success: true, message: "Berhasil mengambil status klaim MBG hari ini", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ═══════════════════════════════════════════════
    //  REKAP — JSON (admin panel)
    // ═══════════════════════════════════════════════

    /** GET /api/mbg/rekap/harian?tanggal=2026-10-05 */
    async rekapHarian(req, res) {
        try {
            const data = await mbgService.rekapHarian(req.query.tanggal);
            return res.status(200).json({ success: true, message: "Berhasil mengambil rekap MBG harian", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /** GET /api/mbg/rekap/bulanan?bulan=10&tahun=2026 */
    async rekapBulanan(req, res) {
        try {
            const { bulan, tahun } = req.query;
            if (!bulan || !tahun) {
                return res.status(400).json({ success: false, message: "Query 'bulan' dan 'tahun' wajib diisi." });
            }
            const data = await mbgService.rekapBulanan(bulan, tahun);
            return res.status(200).json({ success: true, message: "Berhasil mengambil rekap MBG bulanan", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /** GET /api/mbg/rekap/user/:user_id?start_date=2026-10-01&end_date=2026-10-31 */
    async rekapPerUser(req, res) {
        try {
            const { user_id }             = req.params;
            const { start_date, end_date } = req.query;
            if (!start_date || !end_date) {
                return res.status(400).json({ success: false, message: "Query 'start_date' dan 'end_date' wajib diisi." });
            }
            const data = await mbgService.rekapPerUser(user_id, start_date, end_date);
            return res.status(200).json({ success: true, message: "Berhasil mengambil rekap MBG per karyawan", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ═══════════════════════════════════════════════
    //  CSV EXPORT — tanpa library tambahan
    // ═══════════════════════════════════════════════

    /** GET /api/mbg/export/bulanan?bulan=10&tahun=2026 */
    async exportCsvBulanan(req, res) {
        try {
            const { bulan, tahun } = req.query;
            if (!bulan || !tahun) {
                return res.status(400).json({ success: false, message: "Query 'bulan' dan 'tahun' wajib diisi." });
            }

            const csv = await mbgService.exportCsvBulanan(bulan, tahun);

            const monthNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
            const namaBulan  = monthNames[parseInt(bulan)] ?? bulan;
            const filename   = `rekap-mbg-${namaBulan}-${tahun}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            // BOM agar Excel langsung baca karakter UTF-8 dengan benar
            return res.status(200).send('\uFEFF' + csv);
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /** GET /api/mbg/export/harian?tanggal=2026-10-05 */
    async exportCsvHarian(req, res) {
        try {
            const { tanggal } = req.query;
            if (!tanggal) {
                return res.status(400).json({ success: false, message: "Query 'tanggal' wajib diisi." });
            }

            const csv      = await mbgService.exportCsvHarian(tanggal);
            const filename = `rekap-mbg-harian-${tanggal}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.status(200).send('\uFEFF' + csv);
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

export default new MbgController();
