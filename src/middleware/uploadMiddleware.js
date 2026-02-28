import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tentukan lokasi folder penyimpanan
const uploadDir = path.join(__dirname, "../../public/uploads/profile");

// Buat folder jika belum ada
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Parse ekstensi dan nama file aslinya
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-'); // ganti spasi/karakter aneh dengan strip "-"

        // Format rapi: profile-[nama-asli]-[timestamp][ekstensi]
        const uniqueSuffix = Date.now();
        cb(null, `profile-${baseName}-${uniqueSuffix}${ext.toLowerCase()}`);
    },
});

export const upload = multer({ storage: storage });
