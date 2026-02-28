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
router.get("/kunjungan", (req, res) => kunjunganController.index(req, res));
router.get("/kunjungan/:id", (req, res) => kunjunganController.show(req, res));
router.post("/kunjungan", (req, res) => kunjunganController.store(req, res));
router.put("/kunjungan/:id", (req, res) => kunjunganController.update(req, res));
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
router.post("/dinas-luar", (req, res) => dinasLuarController.store(req, res));
router.post("/dinas-luar/bulk", (req, res) => dinasLuarController.bulkStore(req, res));
router.put("/dinas-luar/bulk", (req, res) => dinasLuarController.bulkUpdate(req, res));
router.delete("/dinas-luar/bulk", (req, res) => dinasLuarController.bulkDestroy(req, res));
router.put("/dinas-luar/:id", (req, res) => dinasLuarController.update(req, res));
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

export default router;
