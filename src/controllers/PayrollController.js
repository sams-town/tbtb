import PayrollService from "../services/PayrollService.js";

class PayrollController {
    async index(req, res) {
        try {
            const result = await PayrollService.getAll(req.query);
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: "Gagal mengambil data payroll",
                error: error.message
            });
        }
    }

    async show(req, res) {
        try {
            const result = await PayrollService.getById(req.params.id);
            if (!result.success) {
                return res.status(404).json(result);
            }
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: "Gagal mengambil detail payroll",
                error: error.message
            });
        }
    }
    async showUser(req, res) {
         try {
            const result = await PayrollService.getWhere({ user_id: BigInt(req.params.id),bulan:req.params.bulan,tahun:req.params.tahun }).first();
            if (!result.success) {
                return res.status(404).json(result);
            }
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: "Gagal mengambil detail payroll",
                error: error.message
            });
        }
    }
        

    async update(req, res) {
        try {
            const result = await PayrollService.update(req.params.id, req.body);
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: "Gagal memperbarui data payroll",
                error: error.message
            });
        }
    }

    async destroy(req, res) {
        try {
            const ok = await PayrollService.delete(req.params.id);
            return res.status(200).json({ success: true, message: "Payroll berhasil dihapus" });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal menghapus payroll", error: error.message });
        }
    }

    async generate(req, res) {
        try {
            const { user_id, bulan, tahun, tanggal_mulai, tanggal_akhir } = req.body;
            const result = await PayrollService.generate(user_id, bulan, tahun, tanggal_mulai, tanggal_akhir);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal men-generate payroll", error: error.message });
        }
    }

    async generateAll(req, res) {
        try {
            const { bulan, tahun, tanggal_mulai, tanggal_akhir } = req.body;
            const result = await PayrollService.generateAll(bulan, tahun, tanggal_mulai, tanggal_akhir);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal men-generate payroll", error: error.message });
        }
    }

    async bulkImport(req, res) {
        try {
            const { bulan, tahun, payrolls } = req.body;
            const result = await PayrollService.bulkImport(bulan, tahun, payrolls);
            return res.status(200).json(result);
        } catch (error) {
            console.error("PayrollController.bulkImport error:", error);
            return res.status(500).json({ success: false, message: "Gagal meng-import payroll", error: error.message });
        }
    }
}

export default new PayrollController();
