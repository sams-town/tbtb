import express from "express";
import userController from "../controllers/UserController.js";
import roleController from "../controllers/RoleController.js";
import authController from "../controllers/AuthController.js";
import lokasiController from "../controllers/LokasiController.js";
import jabatanController from "../controllers/JabatanController.js";
import kunjunganController from "../controllers/KunjunganController.js";
import shiftController from "../controllers/ShiftController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";
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
router.get("/lokasi/:id", (req, res) => lokasiController.show(req, res));
router.post("/lokasi", (req, res) => lokasiController.store(req, res));
router.put("/lokasi/:id", (req, res) => lokasiController.update(req, res));
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

export default router;
