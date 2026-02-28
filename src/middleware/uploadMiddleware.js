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

export function saveBase64Image(base64String, subfolder, prefix) {
    if (!base64String || typeof base64String !== 'string' || !base64String.startsWith("data:image")) return base64String;

    const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64String;

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `${prefix}-base64-${Date.now()}.${extension}`;
    const uploadDir = path.join(__dirname, "../../public/uploads", subfolder);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fullPath = path.join(uploadDir, filename);
    fs.writeFileSync(fullPath, buffer);
    return `/uploads/${subfolder}/${filename}`;
}
