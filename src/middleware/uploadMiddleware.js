import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Factory untuk membuat middleware upload dinamis.
 * @param {string} subfolder - nama subfolder di public/uploads (profile, pkwt, dll)
 * @param {string} prefix - prefix nama file (profile, kontrak, dsb)
 * @param {string[]} allowedMimes - array MIME type yang diizinkan
 * @param {number} maxSize - ukuran maksimal file (byte)
 * @returns {multer.Multer} - instance multer
 */
export function createUploadMiddleware(subfolder = "profile", prefix = "file", allowedMimes = ["image/jpeg", "image/png", "image/jpg"], maxSize = 2 * 1024 * 1024) {
    const uploadDir = path.join(__dirname, "../../public/uploads", subfolder);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const baseName = path.basename(file.originalname, ext)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-');
            const uniqueSuffix = Date.now();
            cb(null, `${prefix}-${baseName}-${uniqueSuffix}${ext.toLowerCase()}`);
        },
    });

    const fileFilter = (req, file, cb) => {
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipe file tidak diizinkan. Izin: ${allowedMimes.join(", ")}`), false);
        }
    };

    return multer({
        storage,
        fileFilter,
        limits: { fileSize: maxSize },
    });
}

// Default untuk backward compatibility
export const upload = createUploadMiddleware("profile", "profile");
