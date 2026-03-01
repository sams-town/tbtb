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
}

export default new PayrollController();
