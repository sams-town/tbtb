import dinasLuarService from "../services/DinasLuarService.js";

class DinasLuarController {
    async index(req, res) {
        try {
            const result = await dinasLuarService.getAll(req.query);
            return res.status(200).json({ success: true, message: "Data dinas luar berhasil diambil", ...result });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengambil data dinas luar", error: error.message });
        }
    }

    async show(req, res) {
        try {
            const data = await dinasLuarService.getById(req.params.id);
            if (!data) return res.status(404).json({ success: false, message: "Dinas luar tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Data dinas luar berhasil diambil", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengambil data dinas luar", error: error.message });
        }
    }

    async store(req, res) {
        try {
            const data = await dinasLuarService.create(req.body);
            return res.status(201).json({ success: true, message: "Dinas luar berhasil dibuat", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal membuat dinas luar", error: error.message });
        }
    }

    async update(req, res) {
        try {
            const data = await dinasLuarService.update(req.params.id, req.body);
            if (!data) return res.status(404).json({ success: false, message: "Dinas luar tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Dinas luar berhasil diupdate", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengupdate dinas luar", error: error.message });
        }
    }

    async destroy(req, res) {
        try {
            const ok = await dinasLuarService.delete(req.params.id);
            if (!ok) return res.status(404).json({ success: false, message: "Dinas luar tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Dinas luar berhasil dihapus" });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal menghapus dinas luar", error: error.message });
        }
    }
}

export default new DinasLuarController();
