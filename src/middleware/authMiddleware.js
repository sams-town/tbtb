import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Akses ditolak. Token tidak ditemukan atau format salah.",
            });
        }

        const token = authHeader.split(" ")[1];

        // Verifikasi token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret_key");

        // Simpan data user (dari payload token) ke object request
        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Token tidak valid atau sudah kadaluarsa.",
        });
    }
};
