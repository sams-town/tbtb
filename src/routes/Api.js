import express from "express";
import userController from "../controllers/UserController.js";
import roleController from "../controllers/RoleController.js";
import authController from "../controllers/AuthController.js";
import lokasiController from "../controllers/LokasiController.js";
import jabatanController from "../controllers/JabatanController.js";
import kunjunganController from "../controllers/KunjunganController.js";
import shiftController from "../controllers/ShiftController.js";
import kontrakController from "../controllers/KontrakController.js";
import pegawaiKeluarController from "../controllers/PegawaiKeluarController.js";
import cutiController from "../controllers/CutiController.js";
import notificationController from "../controllers/NotificationController.js";
import absensiController from "../controllers/AbsensiController.js";
import dinasLuarController from "../controllers/DinasLuarController.js";
import statusPajakController from "../controllers/StatusPajakController.js";
import mappingShiftController from "../controllers/MappingShiftController.js";
import lemburController from "../controllers/LemburController.js";
import inventoryController from "../controllers/InventoryController.js";
import fileController from "../controllers/FileController.js";
import settingController from "../controllers/SettingController.js";
import beritaController from "../controllers/BeritaController.js";
import penugasanController from "../controllers/PenugasanController.js";
import rapatController from "../controllers/RapatController.js";
import jenisKinerjaController from "../controllers/JenisKinerjaController.js";
import laporanKinerjaController from "../controllers/LaporanKinerjaController.js";
import kinerjaPegawaiController from "../controllers/KinerjaPegawaiController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { upload, createUploadMiddleware } from "../middleware/uploadMiddleware.js";
const router = express.Router();

// ========================
// AUTH ROUTES
// ========================
router.post("/login", (req, res) => authController.login(req, res));
router.get("/me", authMiddleware, (req, res) => authController.getProfile(req, res));
router.put("/me", authMiddleware, (req, res) => authController.updateProfile(req, res));

// ========================
// USER ROUTES
// ========================
router.get("/users", (req, res) => userController.index(req, res));
router.get("/users/:id", (req, res) => userController.show(req, res));
router.post("/users", upload.single("foto_karyawan"), (req, res) => userController.store(req, res));
router.put("/users/:id", upload.single("foto_karyawan"), (req, res) => userController.update(req, res));
router.post("/users/face-recognition", upload.single("foto_face_recognition"), (req, res) => userController.faceRecognition(req, res));
router.post("/users/:id/face-recognition", upload.single("foto_face_recognition"), (req, res) => userController.faceRecognition(req, res));
router.delete("/users/:id", (req, res) => userController.destroy(req, res));

// ========================
// ROLE ROUTES
// ========================
router.get("/roles", (req, res) => roleController.index(req, res));
router.get("/roles/:id", (req, res) => roleController.show(req, res));
router.post("/roles", (req, res) => roleController.store(req, res));
router.put("/roles/:id", (req, res) => roleController.update(req, res));
router.delete("/roles/:id", (req, res) => roleController.destroy(req, res));

// ========================
// LOKASI ROUTES
// ========================
router.get("/lokasi", (req, res) => lokasiController.index(req, res));
router.get("/lokasi/pending", (req, res) => lokasiController.pending(req, res));
router.get("/lokasi/:id", (req, res) => lokasiController.show(req, res));
router.post("/lokasi", authMiddleware, (req, res) => lokasiController.store(req, res));
router.put("/lokasi/:id", (req, res) => lokasiController.update(req, res));
router.put("/lokasi/:id/approve", upload.none(), (req, res) => lokasiController.approve(req, res));
router.delete("/lokasi/:id", (req, res) => lokasiController.destroy(req, res));

// ========================
// JABATAN ROUTES
// ========================
router.get("/jabatans", (req, res) => jabatanController.index(req, res));
router.get("/jabatans/:id", (req, res) => jabatanController.show(req, res));
router.post("/jabatans", (req, res) => jabatanController.store(req, res));
router.put("/jabatans/:id", (req, res) => jabatanController.update(req, res));
router.delete("/jabatans/:id", (req, res) => jabatanController.destroy(req, res));

// ========================
// KUNJUNGAN ROUTES
// ========================
const kunjunganUpload = createUploadMiddleware("kunjungans", "kunjungan");
router.get("/kunjungan", (req, res) => kunjunganController.index(req, res));
router.get("/kunjungan/:id", (req, res) => kunjunganController.show(req, res));
router.post("/kunjungan", kunjunganUpload.single("foto"), (req, res) => kunjunganController.store(req, res));
router.put("/kunjungan/:id", kunjunganUpload.single("foto"), (req, res) => kunjunganController.update(req, res));
router.delete("/kunjungan/:id", (req, res) => kunjunganController.destroy(req, res));

// ========================
// SHIFT ROUTES
// ========================
router.get("/shifts", (req, res) => shiftController.index(req, res));
router.get("/shifts/:id", (req, res) => shiftController.show(req, res));
router.post("/shifts", (req, res) => shiftController.store(req, res));
router.put("/shifts/:id", (req, res) => shiftController.update(req, res));
router.delete("/shifts/:id", (req, res) => shiftController.destroy(req, res));

// ========================
// CUTI ROUTES
// ========================
router.get("/cutis", (req, res) => cutiController.index(req, res));
router.get("/cutis/:id", (req, res) => cutiController.show(req, res));
const cutiUpload = createUploadMiddleware("cuti", "cuti");
router.post("/cutis", authMiddleware, cutiUpload.single("foto_cuti"), (req, res) => cutiController.store(req, res));
router.put("/cutis/:id", cutiUpload.single("foto_cuti"), (req, res) => cutiController.update(req, res));
router.put("/cutis/:id/approve", upload.none(), (req, res) => cutiController.approve(req, res));
router.delete("/cutis/:id", (req, res) => cutiController.destroy(req, res));

// ========================
// KONTRAK ROUTES
// ========================
router.get("/kontraks", (req, res) => kontrakController.index(req, res));
router.get("/kontraks/user/:userId", (req, res) => kontrakController.showByUserId(req, res));
router.get("/kontraks/:id", (req, res) => kontrakController.show(req, res));
router.post("/kontraks", (req, res) => kontrakController.store(req, res));
router.put("/kontraks/:id", (req, res) => kontrakController.update(req, res));
router.delete("/kontraks/:id", (req, res) => kontrakController.destroy(req, res));

// ========================
// PEGAWAI KELUAR ROUTES
// ========================
router.get("/pegawai-keluar", (req, res) => pegawaiKeluarController.index(req, res));
router.get("/pegawai-keluar/:id", (req, res) => pegawaiKeluarController.show(req, res));
router.post("/pegawai-keluar", (req, res) => pegawaiKeluarController.store(req, res));
router.put("/pegawai-keluar/:id", (req, res) => pegawaiKeluarController.update(req, res));
router.put("/pegawai-keluar/:id/approve", upload.none(), (req, res) => pegawaiKeluarController.approve(req, res));
router.delete("/pegawai-keluar/:id", (req, res) => pegawaiKeluarController.destroy(req, res));

// ========================
// NOTIFICATIONS ROUTES
// ========================
router.get("/notifications", (req, res) => notificationController.index(req, res));
router.get("/notifications/:id", (req, res) => notificationController.show(req, res));
router.post("/notifications", (req, res) => notificationController.store(req, res));
router.put("/notifications/:id", (req, res) => notificationController.update(req, res));
router.put("/notifications/:id/read", (req, res) => notificationController.markRead(req, res));
router.delete("/notifications/:id", (req, res) => notificationController.destroy(req, res));

// ========================
// ABSENSI ROUTES
// ========================
const absensiUpload = createUploadMiddleware("absensi", "absensi");
router.get("/absensi", (req, res) => absensiController.index(req, res));
router.get("/absensi/:id", (req, res) => absensiController.show(req, res));
router.post("/absensi", absensiUpload.fields([{ name: "foto_jam_absen", maxCount: 1 }, { name: "foto_jam_pulang", maxCount: 1 }]), (req, res) => absensiController.store(req, res));
router.put("/absensi/:id", absensiUpload.fields([{ name: "foto_jam_absen", maxCount: 1 }, { name: "foto_jam_pulang", maxCount: 1 }]), (req, res) => absensiController.update(req, res));
router.post("/absensi/:id", absensiUpload.fields([{ name: "foto_jam_absen", maxCount: 1 }, { name: "foto_jam_pulang", maxCount: 1 }]), (req, res) => absensiController.update(req, res)); // Fallback for forms that use POST
router.delete("/absensi/:id", (req, res) => absensiController.destroy(req, res));

// ========================
// DINAS LUAR ROUTES
// ========================
router.get("/dinas-luar", (req, res) => dinasLuarController.index(req, res));
router.get("/dinas-luar/:id", (req, res) => dinasLuarController.show(req, res));
router.post("/dinas-luar", (req, res) => dinasLuarController.store(req, res)); // Normal post
const dinasUpload = createUploadMiddleware("dinasluar", "dl");
router.post("/dinas-luar/bulk", (req, res) => dinasLuarController.bulkStore(req, res));
router.put("/dinas-luar/bulk", (req, res) => dinasLuarController.bulkUpdate(req, res));
router.delete("/dinas-luar/bulk", (req, res) => dinasLuarController.bulkDestroy(req, res));
router.put("/dinas-luar/:id", dinasUpload.fields([{ name: "foto_jam_absen", maxCount: 1 }, { name: "foto_jam_pulang", maxCount: 1 }]), (req, res) => dinasLuarController.update(req, res));
router.post("/dinas-luar/:id", dinasUpload.fields([{ name: "foto_jam_absen", maxCount: 1 }, { name: "foto_jam_pulang", maxCount: 1 }]), (req, res) => dinasLuarController.update(req, res)); // Fallback
router.delete("/dinas-luar/:id", (req, res) => dinasLuarController.destroy(req, res));

// ========================
// STATUS PAJAK ROUTES
// ========================
router.get("/status-pajak", (req, res) => statusPajakController.index(req, res));
router.get("/status-pajak/:id", (req, res) => statusPajakController.show(req, res));
router.post("/status-pajak", (req, res) => statusPajakController.store(req, res));
router.put("/status-pajak/:id", (req, res) => statusPajakController.update(req, res));
router.delete("/status-pajak/:id", (req, res) => statusPajakController.destroy(req, res));

// ========================
// MAPPING SHIFT ROUTES
// ========================
router.get("/mapping-shifts", (req, res) => mappingShiftController.index(req, res));
router.get("/mapping-shifts/:id", (req, res) => mappingShiftController.show(req, res));
router.post("/mapping-shifts/bulk", (req, res) => mappingShiftController.bulkStore(req, res));
router.put("/mapping-shifts/bulk", (req, res) => mappingShiftController.bulkUpdate(req, res));
router.delete("/mapping-shifts/bulk", (req, res) => mappingShiftController.bulkDestroy(req, res));

// ========================
// LEMBUR ROUTES
// ========================
const lemburUpload = createUploadMiddleware("lemburs", "lembur", undefined, undefined, false);
router.get("/lemburs", (req, res) => lemburController.index(req, res));
router.get("/lemburs/:id", (req, res) => lemburController.show(req, res));
router.post("/lemburs", lemburUpload.fields([{ name: "foto_jam_masuk", maxCount: 1 }, { name: "foto_jam_keluar", maxCount: 1 }]), (req, res) => lemburController.store(req, res));
router.put("/lemburs/:id", lemburUpload.fields([{ name: "foto_jam_masuk", maxCount: 1 }, { name: "foto_jam_keluar", maxCount: 1 }]), (req, res) => lemburController.update(req, res));
router.post("/lemburs/:id", lemburUpload.fields([{ name: "foto_jam_masuk", maxCount: 1 }, { name: "foto_jam_keluar", maxCount: 1 }]), (req, res) => lemburController.update(req, res)); // Fallback
router.put("/lemburs/:id/approve", upload.none(), (req, res) => lemburController.approve(req, res));
router.post("/lemburs/:id/approve", upload.none(), (req, res) => lemburController.approve(req, res)); // Fallback
router.delete("/lemburs/:id", (req, res) => lemburController.destroy(req, res));

// ========================
// INVENTORY ROUTES
// ========================
router.get("/inventories", (req, res) => inventoryController.index(req, res));
router.get("/inventories/:id", (req, res) => inventoryController.show(req, res));
router.post("/inventories", (req, res) => inventoryController.store(req, res));
router.put("/inventories/:id", (req, res) => inventoryController.update(req, res));
router.delete("/inventories/:id", (req, res) => inventoryController.destroy(req, res));

// ========================
// DOCUMENT ROUTES
// ========================
const documentUpload = createUploadMiddleware(
    "dokumen_pegawai",
    "doc",
    [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ],
    10 * 1024 * 1024 // Max 10MB
);
router.get("/documents", (req, res) => fileController.index(req, res));
router.post("/documents", documentUpload.single("file"), (req, res) => fileController.store(req, res));
router.put("/documents/:id", documentUpload.single("file"), (req, res) => fileController.update(req, res));
router.delete("/documents/:id", (req, res) => fileController.destroy(req, res));

// ========================
// SETTING ROUTES
// ========================
const settingUpload = createUploadMiddleware("logos", "logo");
router.get("/settings", (req, res) => settingController.index(req, res));
router.get("/settings/:id", (req, res) => settingController.show(req, res));
router.post("/settings", settingUpload.single("logo"), (req, res) => settingController.store(req, res));
router.put("/settings/:id", settingUpload.single("logo"), (req, res) => settingController.update(req, res));
router.delete("/settings/:id", (req, res) => settingController.destroy(req, res));

// ========================
// BERITA ROUTES
// ========================
const beritaUpload = createUploadMiddleware("beritas", "file", ["image/jpeg", "image/png", "image/jpg", "application/pdf"], 5 * 1024 * 1024, false);
router.get("/beritas", (req, res) => beritaController.index(req, res));
router.get("/beritas/:id", (req, res) => beritaController.show(req, res));
router.post("/beritas", beritaUpload.single("gambar"), (req, res) => beritaController.store(req, res));
router.put("/beritas/:id", beritaUpload.single("gambar"), (req, res) => beritaController.update(req, res));
router.delete("/beritas/:id", (req, res) => beritaController.destroy(req, res));

// ========================
// PENUGASAN ROUTES
// ========================
router.get("/penugasans", (req, res) => penugasanController.index(req, res));
router.get("/penugasans/:id", (req, res) => penugasanController.show(req, res));
router.post("/penugasans", (req, res) => penugasanController.store(req, res));
router.put("/penugasans/:id", (req, res) => penugasanController.update(req, res));
router.delete("/penugasans/:id", (req, res) => penugasanController.destroy(req, res));

// ========================
// RAPAT ROUTES
// ========================
router.get("/rapats", (req, res) => rapatController.index(req, res));
router.get("/rapats/:id", (req, res) => rapatController.show(req, res));
router.post("/rapats", (req, res) => rapatController.store(req, res));
router.put("/rapats/:id", (req, res) => rapatController.update(req, res));
router.delete("/rapats/:id", (req, res) => rapatController.destroy(req, res));

// ========================
// JENIS KINERJA ROUTES
// ========================
router.get("/jenis-kinerjas", (req, res) => jenisKinerjaController.index(req, res));
router.get("/jenis-kinerjas/:id", (req, res) => jenisKinerjaController.show(req, res));
router.post("/jenis-kinerjas", (req, res) => jenisKinerjaController.store(req, res));
router.put("/jenis-kinerjas/:id", (req, res) => jenisKinerjaController.update(req, res));
router.delete("/jenis-kinerjas/:id", (req, res) => jenisKinerjaController.destroy(req, res));

// ========================
// LAPORAN KINERJA ROUTES
// ========================
router.get("/laporan-kinerjas", (req, res) => laporanKinerjaController.index(req, res));

// ========================
// KINERJA PEGAWAI (SUMMARY) ROUTES
// ========================
router.get("/kinerja-pegawais", (req, res) => kinerjaPegawaiController.index(req, res));

export default router;
