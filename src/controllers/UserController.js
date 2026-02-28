import userService from "../services/UserService.js";

class UserController {
    /**
     * GET /api/users
     */
    async index(req, res) {
        try {
            const result = await userService.getAll(req.query);

            return res.status(200).json({
                success: true,
                message: "Data users berhasil diambil",
                ...result,
            });
        } catch (error) {
            console.error("UserController.index error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal mengambil data users",
                error: error.message,
            });
        }
    }

    /**
     * GET /api/users/:id
     */
    async show(req, res) {
        try {
            const user = await userService.getById(req.params.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User tidak ditemukan",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Data user berhasil diambil",
                data: user,
            });
        } catch (error) {
            console.error("UserController.show error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal mengambil data user",
                error: error.message,
            });
        }
    }

    /**
     * POST /api/users
     */
    async store(req, res) {
        try {
            if (!req.body.name) {
                return res.status(400).json({
                    success: false,
                    message: "Field 'name' wajib diisi",
                });
            }

            // Attach path foto jika ada
            const data = { ...req.body };
            if (req.file) {
                // Simpan nama file hasil upload dari diskStorage
                data.foto_karyawan = req.file.filename;
            }

            const user = await userService.create(data);

            return res.status(201).json({
                success: true,
                message: "User berhasil dibuat",
                data: user,
            });
        } catch (error) {
            console.error("UserController.store error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal membuat user",
                error: error.message,
            });
        }
    }

    /**
     * PUT /api/users/:id
     */
    async update(req, res) {
        try {
            const data = { ...req.body };
            if (req.file) {
                // Simpan nama file hasil upload dari diskStorage
                data.foto_karyawan = req.file.filename;
            }

            const user = await userService.update(req.params.id, data);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User tidak ditemukan",
                });
            }

            return res.status(200).json({
                success: true,
                message: "User berhasil diupdate",
                data: user,
            });
        } catch (error) {
            console.error("UserController.update error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal mengupdate user",
                error: error.message,
            });
        }
    }

    /**
     * DELETE /api/users/:id
     */
    async destroy(req, res) {
        try {
            const result = await userService.delete(req.params.id);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: "User tidak ditemukan",
                });
            }

            return res.status(200).json({
                success: true,
                message: "User berhasil dihapus",
            });
        } catch (error) {
            console.error("UserController.destroy error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal menghapus user",
                error: error.message,
            });
        }
    }
}

export default new UserController();
