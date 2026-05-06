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
                    
                    // We will set the final photo path later after determining if it's 'masuk' or 'pulang'
                }
            }

            if (!incomingPath) {
                return res.status(400).json({ success: false, message: "Foto absen wajib disertakan untuk absensi wajah." });
            }

            let user = null;
            let matchResult = { user: null, distance: null };

            // 1. Identify User
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

            // 2. Determine Shift and Attendance Type
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

            // Fetch shifts for yesterday and today
            const recentShifts = await absensiService.getByIdUsersHistory(user.id.toString(), yesterdayStr, todayStr);
            
            if (!recentShifts || recentShifts.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Anda tidak memiliki jadwal shift (Mapping Shift) untuk kemarin atau hari ini." 
                });
            }

            const isSameDay = (dateInput, targetStr) => {
                const d1 = new Date(dateInput);
                const d2 = new Date(targetStr);
                return d1.getFullYear() === d2.getFullYear() &&
                       d1.getMonth() === d2.getMonth() &&
                       d1.getDate() === d2.getDate();
            };

            let shiftRecord = null;
            let tipe_absen = payload.tipe_absen; // 'masuk' or 'pulang'

            // SMART LOGIC: Find the best shift record
            if (tipe_absen === 'pulang' || tipe_absen === 'keluar') {
                // If marking home, prioritize the record that has 'masuk' but NO 'pulang'
                shiftRecord = recentShifts.find(s => s.jam_absen && !s.jam_pulang);
                if (!shiftRecord) {
                    // Fallback to today's record even if 'masuk' is empty (maybe they forgot to clock in but want to clock out)
                    shiftRecord = recentShifts.find(s => isSameDay(s.tanggal, todayStr));
                }
            } else if (tipe_absen === 'masuk') {
                // If marking in, prioritize today's record that hasn't been clocked in
                shiftRecord = recentShifts.find(s => isSameDay(s.tanggal, todayStr) && !s.jam_absen);
                if (!shiftRecord) {
                    // Check if they already clocked in today
                    const alreadyIn = recentShifts.find(s => isSameDay(s.tanggal, todayStr) && s.jam_absen);
                    if (alreadyIn) {
                        return res.status(400).json({ success: false, message: "Absensi gagal. Anda sudah melakukan absensi masuk untuk shift hari ini." });
                    }
                }
            } else {
                // AUTO DETECTION if tipe_absen is not provided
                // 1. Is there an open shift from yesterday or today?
                const openShift = recentShifts.find(s => s.jam_absen && !s.jam_pulang);
                if (openShift) {
                    shiftRecord = openShift;
                    tipe_absen = 'pulang';
                } else {
                    // 2. No open shift, try to mark 'masuk' for today
                    const todayShift = recentShifts.find(s => isSameDay(s.tanggal, todayStr));
                    if (todayShift) {
                        if (todayShift.jam_absen && todayShift.jam_pulang) {
                            return res.status(400).json({ success: false, message: "Absensi gagal. Jadwal shift hari ini sudah selesai (Sudah Masuk & Pulang)." });
                        }
                        shiftRecord = todayShift;
                        tipe_absen = todayShift.jam_absen ? 'pulang' : 'masuk';
                    }
                }
            }

            if (!shiftRecord) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Tidak ditemukan jadwal shift yang sesuai untuk melakukan absensi saat ini." 
                });
            }

            // Final check: if we decided it's 'pulang' but it's already filled
            if (tipe_absen === 'pulang' && shiftRecord.jam_pulang) {
                return res.status(400).json({ success: false, message: "Absensi gagal. Anda sudah mengisi jam pulang untuk shift ini." });
            }

            // 3. Location and Radius Check
            const isLocked = shiftRecord.lock_location === "1" || shiftRecord.lock_location === 1;
            if (isLocked && (!payload.lat || !payload.long)) {
                return res.status(400).json({ success: false, message: "Absensi gagal. Lokasi (GPS) wajib aktif untuk shift ini." });
            }

            if (payload.lat && payload.long) {
                if (user.lokasi) {
                    const distance = this.calculateDistance(
                        parseFloat(payload.lat), parseFloat(payload.long),
                        parseFloat(user.lokasi.lat_kantor), parseFloat(user.lokasi.long_kantor)
                    );
                    const radius = parseFloat(user.lokasi.radius || 0);

                    if (isLocked && radius > 0 && distance > radius) {
                        return res.status(400).json({ 
                            success: false, 
                            message: `Absensi gagal. Anda berada di luar radius (Jarak: ${Math.round(distance)}m, Izin: ${radius}m).` 
                        });
                    }

                    if (tipe_absen === 'pulang') payload.jarak_pulang = String(Math.round(distance));
                    else payload.jarak_masuk = String(Math.round(distance));
                } else if (isLocked) {
                    return res.status(400).json({ success: false, message: "Absensi gagal. Lokasi kantor belum diatur (Shift Terkunci)." });
                }
            }

            // 4. Update Database
            const updatePayload = {
                user_id: user.id.toString()
            };

            const filename = path.basename(incomingPath);
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

            if (tipe_absen === 'masuk') {
                updatePayload.jam_absen = timeStr;
                updatePayload.foto_jam_absen = `/uploads/absensi/${filename}`;
                if (payload.lat) updatePayload.lat_absen = String(payload.lat);
                if (payload.long) updatePayload.long_absen = String(payload.long);
                if (payload.jarak_masuk) updatePayload.jarak_masuk = String(payload.jarak_masuk);
                updatePayload.status_absen = 'Masuk';
            } else {
                updatePayload.jam_pulang = timeStr;
                updatePayload.foto_jam_pulang = `/uploads/absensi/${filename}`;
                if (payload.lat) updatePayload.lat_pulang = String(payload.lat);
                if (payload.long) updatePayload.long_pulang = String(payload.long);
                if (payload.jarak_pulang) updatePayload.jarak_pulang = String(payload.jarak_pulang);
                updatePayload.status_absen = 'Pulang';
            }

            console.log("Updating shift record:", shiftRecord.id, "with payload:", updatePayload);
            const data = await absensiService.update(shiftRecord.id, updatePayload);

            return res.status(201).json({ 
                success: true, 
                message: `Absensi ${tipe_absen} wajah berhasil: ${user.name}`, 
                data, 
                distance: matchResult.distance,
                user: user
            });

        } catch (error) {
            console.error("AbsensiController.storeWajah error details:", {
                message: error.message,
                stack: error.stack,
                payload: req.body
            });
            return res.status(500).json({ 
                success: false, 
                message: "Gagal membuat absensi wajah", 
                error: error.message,
                debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
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