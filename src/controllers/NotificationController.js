import notificationService from "../services/NotificationService.js";

class NotificationController {
    async index(req, res) {
        try {
            const result = await notificationService.getAll(req.query);
            return res.status(200).json({ success: true, message: "Data notifications berhasil diambil", ...result });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengambil data notifications", error: error.message });
        }
    }

    async show(req, res) {
        try {
            const data = await notificationService.getById(req.params.id);
            if (!data) return res.status(404).json({ success: false, message: "Notification tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Data notification berhasil diambil", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengambil data notification", error: error.message });
        }
    }

    async store(req, res) {
        try {
            const data = await notificationService.create(req.body);
            return res.status(201).json({ success: true, message: "Notification berhasil dibuat", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal membuat notification", error: error.message });
        }
    }

    async update(req, res) {
        try {
            const data = await notificationService.update(req.params.id, req.body);
            if (!data) return res.status(404).json({ success: false, message: "Notification tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Notification berhasil diupdate", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengupdate notification", error: error.message });
        }
    }

    async markRead(req, res) {
        try {
            const data = await notificationService.markRead(req.params.id);
            if (!data) return res.status(404).json({ success: false, message: "Notification tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Notification ditandai sebagai terbaca", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal menandai notification", error: error.message });
        }
    }

    async destroy(req, res) {
        try {
            const ok = await notificationService.delete(req.params.id);
            if (!ok) return res.status(404).json({ success: false, message: "Notification tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Notification berhasil dihapus" });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal menghapus notification", error: error.message });
        }
    }
}

export default new NotificationController();