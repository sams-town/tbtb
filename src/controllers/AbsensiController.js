import absensiService from "../services/AbsensiService.js";
import userService from "../services/UserService.js";
import faceRecognitionService from "../services/FaceRecognitionService.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");

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

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // radius bumi dalam meter
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // jarak dalam meter
    }

    async storeWajah(req, res) {
        try {
            const payload = { ...req.body };

            let incomingPath = null;
            if (req.files) {
                let uploadedFiles = Array.isArray(req.files) ? req.files : [];
                if (!Array.isArray(req.files)) {
                    if (req.files.foto_wajah) uploadedFiles.push(...req.files.foto_wajah);
                    if (req.files.foto_jam_absen) uploadedFiles.push(...req.files.foto_jam_absen);
                    if (req.files.foto_jam_pulang) uploadedFiles.push(...req.files.foto_jam_pulang);
                }

                if (uploadedFiles.length > 0) {
                    const theFile = uploadedFiles[0];
                    incomingPath = path.join(ROOT_DIR, "public", "uploads", "absensi", theFile.filename);
                    
                    if (payload.tipe_absen === 'keluar' || payload.tipe_absen === 'pulang') {
                        payload.foto_jam_pulang = `/uploads/absensi/${theFile.filename}`;
                    } else {
                        payload.foto_jam_absen = `/uploads/absensi/${theFile.filename}`;
                    }
                }
            }

            if (!incomingPath) {
                return res.status(400).json({ success: false, message: "Foto absen wajib disertakan untuk absensi wajah." });
            }

            let user = null;
            let matchResult = { user: null, distance: null };

            // Jika user_id dikirim dari frontend, lakukan verifikasi 1:1 (lebih akurat & aman)
            if (payload.user_id) {
                user = await userService.getById(payload.user_id);
                if (!user) {
                    return res.status(404).json({ success: false, message: "User tidak ditemukan." });
                }

                if (user.lock_face === "0" || user.lock_face === 0) {
                    console.log(`Bypassing face recognition for user ${user.name} (lock_face=0)`);
                } else {
                    const verifyResult = await faceRecognitionService.verifyUserFace(incomingPath, user);
                    if (!verifyResult.isMatch) {
                        return res.status(400).json({ 
                            success: false, 
                            message: `Absensi gagal. Wajah tidak cocok dengan identitas ${user.name}.`,
                            distance: verifyResult.distance,
                            error: verifyResult.error
                        });
                    }
                    matchResult.distance = verifyResult.distance;
                }
            } else {
                // Jika tidak ada user_id, lakukan pencarian wajah ke semua user (Auto-ID)
                const usersResult = await userService.getAll({ limit: 10000 });
                const allUsers = usersResult.data || [];
                matchResult = await faceRecognitionService.findMatchingUser(incomingPath, allUsers);
                if (!matchResult.user) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Absensi gagal. Wajah tidak dikenali atau tidak cocok dengan data karyawan mana pun.",
                        error: matchResult.error
                    });
                }
                user = matchResult.user;
            }
            
            // Gunakan tanggal lokal server YYYY-MM-DD
            const now = new Date();
            const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const todayStr = payload.tanggal || localToday;

            // 1. Cek Shift hari ini (Mapping Shift)
            const existingRecords = await absensiService.getByIdUsersHistory(user.id.toString(), todayStr, todayStr);
            if (!existingRecords || existingRecords.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Anda belum mempunyai shift untuk hari ini." 
                });
            }
            const shiftRecord = existingRecords[0];

            // 1.1 Cek jika sudah absen masuk & pulang (Selesai)
            if (shiftRecord.jam_absen && shiftRecord.jam_pulang) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Anda sudah melakukan absensi masuk dan pulang untuk hari ini." 
                });
            }

            // 1.2 Cek spesifik sesuai tipe (Masuk atau Pulang)
            if (payload.tipe_absen === 'masuk' && shiftRecord.jam_absen) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Anda sudah mengisi jam masuk untuk hari ini." 
                });
            }
            if ((payload.tipe_absen === 'keluar' || payload.tipe_absen === 'pulang') && shiftRecord.jam_pulang) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Anda sudah mengisi jam pulang untuk hari ini." 
                });
            }

            // 2. Cek Lokasi dan Radius
            const isLocked = shiftRecord.lock_location === "1" || shiftRecord.lock_location === 1;

            // Jika terkunci, WAJIB ada koordinat
            if (isLocked && (!payload.lat || !payload.long)) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Lokasi (GPS) wajib aktif untuk shift ini." 
                });
            }

            if (payload.lat && payload.long) {
                if (user.lokasi) {
                    const userLat = parseFloat(payload.lat);
                    const userLong = parseFloat(payload.long);
                    const officeLat = parseFloat(user.lokasi.lat_kantor);
                    const officeLong = parseFloat(user.lokasi.long_kantor);
                    const radius = parseFloat(user.lokasi.radius || 0);

                    if (officeLat && officeLong && radius > 0) {
                        const distance = this.calculateDistance(userLat, userLong, officeLat, officeLong);
                        
                        // Cek radius HANYA jika isLocked adalah benar (1)
                        if (isLocked && distance > radius) {
                            return res.status(400).json({ 
                                success: false, 
                                message: `Absensi gagal. Anda berada di luar radius lokasi yang diizinkan (Jarak: ${Math.round(distance)}m, Izin: ${radius}m).` 
                            });
                        }

                        // Simpan info jarak 
                        if (payload.tipe_absen === 'keluar' || payload.tipe_absen === 'pulang') {
                            payload.jarak_pulang = String(Math.round(distance));
                        } else {
                            payload.jarak_masuk = String(Math.round(distance));
                        }
                    }
                } else if (isLocked) {
                    // Jika ter-lock tapi user tidak punya lokasi kantor
                    return res.status(400).json({ 
                        success: false, 
                        message: "Absensi gagal. Lokasi kantor belum diatur untuk Anda (Shift Locked)." 
                    });
                }
            }

            // Jika valid, assign user_id dan lanjutkan pembuatan absensi
            payload.user_id = user.id.toString();

            // Mapping custom frontend fields to Prisma schema fields
            if (payload.tipe_absen === 'masuk') {
                if (payload.lat) payload.lat_absen = String(payload.lat);
                if (payload.long) payload.long_absen = String(payload.long);
                payload.status_absen = 'Masuk';
            } else if (payload.tipe_absen === 'keluar' || payload.tipe_absen === 'pulang') {
                if (payload.lat) payload.lat_pulang = String(payload.lat);
                if (payload.long) payload.long_pulang = String(payload.long);
                payload.status_absen = 'Pulang';
            }

            // Cleanup fields that Prisma mapping_shifts table doesn't have
            delete payload.lat;
            delete payload.long;
            delete payload.tipe_absen;

            // Update record shift yang sudah ada (allocation) atau gunakan yang lama
            const data = await absensiService.update(shiftRecord.id, payload);

            return res.status(201).json({ 
                success: true, 
                message: `Absensi wajah berhasil, dikenali sebagai: ${user.name}`, 
                data, 
                distance: matchResult.distance,
                user: user
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