import lokasiService from "../services/LokasiService.js";

class LokasiController {
    /**
     * GET /api/lokasi
     */
    async index(req, res) {
        try {
            const result = await lokasiService.getAll(req.query);

            return res.status(200).json({
                success: true,
                message: "Data lokasi berhasil diambil",
                ...result,
            });
        } catch (error) {
            console.error("LokasiController.index error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal mengambil data lokasi",
                error: error.message,
            });
        }
    }

    /**
     * GET /api/lokasi/:id
     */
    async show(req, res) {
        try {
            const lokasi = await lokasiService.getById(req.params.id);

            if (!lokasi) {
                return res.status(404).json({
                    success: false,
                    message: "Lokasi tidak ditemukan",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Data lokasi berhasil diambil",
                data: lokasi,
            });
        } catch (error) {
            console.error("LokasiController.show error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal mengambil data lokasi",
                error: error.message,
            });
        }
    }

    /**
     * POST /api/lokasi
     */
    async store(req, res) {
        try {
            if (!req.body.nama_lokasi) {
                return res.status(400).json({
                    success: false,
                    message: "Field 'nama_lokasi' wajib diisi",
                });
            }

            const lokasi = await lokasiService.create(req.body);

            return res.status(201).json({
                success: true,
                message: "Lokasi berhasil dibuat",
                data: lokasi,
            });
        } catch (error) {
            console.error("LokasiController.store error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal membuat lokasi",
                error: error.message,
            });
        }
    }

    /**
     * PUT /api/lokasi/:id
     */
    async update(req, res) {
        try {
            const lokasi = await lokasiService.update(req.params.id, req.body);

            if (!lokasi) {
                return res.status(404).json({
                    success: false,
                    message: "Lokasi tidak ditemukan",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Lokasi berhasil diupdate",
                data: lokasi,
            });
        } catch (error) {
            console.error("LokasiController.update error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal mengupdate lokasi",
                error: error.message,
            });
        }
    }

    /**
     * DELETE /api/lokasi/:id
     */
    async destroy(req, res) {
        try {
            const result = await lokasiService.delete(req.params.id);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: "Lokasi tidak ditemukan",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Lokasi berhasil dihapus",
            });
        } catch (error) {
            console.error("LokasiController.destroy error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal menghapus lokasi",
                error: error.message,
            });
        }
    }
}

export default new LokasiController();
