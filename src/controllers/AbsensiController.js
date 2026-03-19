import absensiService from "../services/AbsensiService.js";
import userService from "../services/UserService.js";
import faceRecognitionService from "../services/FaceRecognitionService.js";
import path from "path";

class AbsensiController {
    async index(req, res) {
        try {
            const result = await absensiService.getAll(req.query);
            return res.status(200).json({ success: true, message: "Data absensi berhasil diambil", ...result });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengambil data absensi", error: error.message });
        }
    }

    async show(req, res) {
        try {
            const data = await absensiService.getById(req.params.id);
            if (!data) return res.status(404).json({ success: false, message: "Absensi tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Data absensi berhasil diambil", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengambil data absensi", error: error.message });
        }
    }

    async showUser(req, res) {
        try {
            const data = await absensiService.getByIdUsers(req.params.id);
            if (!data) return res.status(404).json({ success: false, message: "Absensi tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Data absensi berhasil diambil", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengambil data absensi", error: error.message });
        }
    }
    async showUserHistory(req, res) {
        try {
            const data = await absensiService.getByIdUsersHistory(req.params.id, req.params.tanggal_mulai, req.params.tanggal_akhir);
            if (!data) return res.status(404).json({ success: false, message: "Absensi tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Data absensi berhasil diambil", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengambil data absensi", error: error.message });
        }
    }

    async store(req, res) {
        try {
            const payload = { ...req.body };
            if (req.files) {
                if (req.files.foto_jam_absen && req.files.foto_jam_absen.length > 0) {
                    payload.foto_jam_absen = `/uploads/absensi/${req.files.foto_jam_absen[0].filename}`;
                }
                if (req.files.foto_jam_pulang && req.files.foto_jam_pulang.length > 0) {
                    payload.foto_jam_pulang = `/uploads/absensi/${req.files.foto_jam_pulang[0].filename}`;
                }
            }

            const data = await absensiService.create(payload);
            return res.status(201).json({ success: true, message: "Absensi berhasil dibuat", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal membuat absensi", error: error.message });
        }
    }

    async storeWajah(req, res) {
        try {
            const payload = { ...req.body };

            let incomingPath = null;
            if (req.files) {
                let uploadedFiles = Array.isArray(req.files) ? req.files : [];
                if (!Array.isArray(req.files)) {
                    if (req.files.foto_jam_absen) uploadedFiles.push(...req.files.foto_jam_absen);
                    if (req.files.foto_jam_pulang) uploadedFiles.push(...req.files.foto_jam_pulang);
                }

                if (uploadedFiles.length > 0) {
                    const theFile = uploadedFiles[0];
                    incomingPath = path.join(process.cwd(), "public", "uploads", "absensi", theFile.filename);
                    
                    if (theFile.fieldname === 'foto_jam_pulang') {
                        payload.foto_jam_pulang = `/uploads/absensi/${theFile.filename}`;
                    } else {
                        payload.foto_jam_absen = `/uploads/absensi/${theFile.filename}`;
                    }
                }
            }

            if (!incomingPath) {
                return res.status(400).json({ success: false, message: "Foto absen wajib disertakan untuk absensi wajah." });
            }

            const usersResult = await userService.getAll({ limit: 10000 });
            const allUsers = usersResult.data || [];

            const matchResult = await faceRecognitionService.findMatchingUser(incomingPath, allUsers);
            if (!matchResult.user) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Wajah tidak dikenali atau tidak cocok dengan data karyawan mana pun.",
                    error: matchResult.error
                });
            }

            // Jika valid, assign user_id dan lanjutkan pembuatan absensi
            payload.user_id = matchResult.user.id.toString();

            // Mapping custom frontend fields to Prisma schema fields
            if (payload.tipe_absen === 'masuk') {
                if (payload.lat) payload.lat_absen = String(payload.lat);
                if (payload.long) payload.long_absen = String(payload.long);
            } else if (payload.tipe_absen === 'pulang') {
                if (payload.lat) payload.lat_pulang = String(payload.lat);
                if (payload.long) payload.long_pulang = String(payload.long);
            }

            // Cleanup fields that Prisma mapping_shifts table doesn't have
            delete payload.lat;
            delete payload.long;
            delete payload.tipe_absen;

            const data = await absensiService.create(payload);
            return res.status(201).json({ 
                success: true, 
                message: `Absensi wajah berhasil, dikenali sebagai: ${matchResult.user.name}`, 
                data, 
                distance: matchResult.distance,
                user: { id: matchResult.user.id.toString(), name: matchResult.user.name }
            });
        } catch (error) {
            console.error("AbsensiController.storeWajah error:", error);
            return res.status(500).json({ success: false, message: "Gagal membuat absensi wajah", error: error.message });
        }
    }


    async update(req, res) {
        try {
            // Check if req.body is defined, if not fallback to empty object
            const payload = req.body ? { ...req.body } : {};

            if (req.files) {
                if (req.files.foto_jam_absen && req.files.foto_jam_absen.length > 0) {
                    payload.foto_jam_absen = `/uploads/absensi/${req.files.foto_jam_absen[0].filename}`;
                }
                if (req.files.foto_jam_pulang && req.files.foto_jam_pulang.length > 0) {
                    payload.foto_jam_pulang = `/uploads/absensi/${req.files.foto_jam_pulang[0].filename}`;
                }
            }

            const data = await absensiService.update(req.params.id, payload);
            if (!data) return res.status(404).json({ success: false, message: "Absensi tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Absensi berhasil diupdate", data });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal mengupdate absensi", error: error.message });
        }
    }

    async destroy(req, res) {
        try {
            const ok = await absensiService.delete(req.params.id);
            if (!ok) return res.status(404).json({ success: false, message: "Absensi tidak ditemukan" });
            return res.status(200).json({ success: true, message: "Absensi berhasil dihapus" });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Gagal menghapus absensi", error: error.message });
        }
    }

    async recap(req, res) {
        try {
            const { start_date, end_date } = req.query;
            const result = await absensiService.getRecap(start_date, end_date);
            return res.status(200).json({ success: true, message: "Data rekap berhasil diambil", data: result });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: "Gagal mengambil data rekap", error: error.message });
        }
    }
}

export default new AbsensiController();