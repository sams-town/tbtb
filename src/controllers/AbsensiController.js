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

            // 2. Identify User
            if (payload.user_id) {
                user = await userService.getById(payload.user_id);
                if (!user) {
                    return res.status(404).json({ success: false, message: "User tidak ditemukan." });
                }
            }

            // 3. Determine Shift and Attendance Type (Check shift BEFORE face recognition)
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);

            const formatDate = (d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            // Use date from payload if available, otherwise use server local date
            const tStr = payload.tanggal || formatDate(now);
            const yStr = formatDate(yesterday);

            const isSameDay = (dateInput, targetStr) => {
                if (!dateInput) return false;
                const d = new Date(dateInput);
                const dStr = formatDate(d);
                return dStr === targetStr;
            };

            console.log(`Checking shifts for user ${user ? user.name : 'Unknown'} targeting ${tStr}`);
            
            let recentShifts = [];
            if (user) {
                // Fetch a range to handle yesterday's shifts that might still be open
                recentShifts = await absensiService.getByIdUsersHistory(user.id.toString(), yStr, tStr);
            }

            // Filter out records that are "Off" days (no shift_id) if we want to strictly require a shift
            const activeShifts = recentShifts.filter(s => s.shift_id);

            if (payload.user_id && (!activeShifts || activeShifts.length === 0)) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Absensi gagal. Anda tidak memiliki jadwal shift (Mapping Shift) yang aktif untuk hari ini." 
                });
            }

            let shiftRecord = null;
            let tipe_absen = payload.tipe_absen; // 'masuk' or 'pulang'

            if (user) {
                // SMART LOGIC: Find the best shift record among ACTIVE shifts
                if (tipe_absen === 'pulang' || tipe_absen === 'keluar') {
                    shiftRecord = activeShifts.find(s => s.jam_absen && !s.jam_pulang);
                    if (!shiftRecord) {
                        shiftRecord = activeShifts.find(s => isSameDay(s.tanggal, tStr));
                    }
                    tipe_absen = 'pulang';
                } else if (tipe_absen === 'masuk') {
                    shiftRecord = activeShifts.find(s => isSameDay(s.tanggal, tStr) && !s.jam_absen);
                    if (!shiftRecord) {
                        const alreadyIn = activeShifts.find(s => isSameDay(s.tanggal, tStr) && s.jam_absen);
                        if (alreadyIn) {
                            return res.status(400).json({ success: false, message: "Absensi gagal. Anda sudah melakukan absensi masuk untuk shift hari ini." });
                        }
                    }
                } else {
                    const openShift = activeShifts.find(s => s.jam_absen && !s.jam_pulang);
                    if (openShift) {
                        shiftRecord = openShift;
                        tipe_absen = 'pulang';
                    } else {
                        const todayShift = activeShifts.find(s => isSameDay(s.tanggal, tStr));
                        if (todayShift) {
                            if (todayShift.jam_absen && todayShift.jam_pulang) {
                                return res.status(400).json({ success: false, message: "Absensi gagal. Jadwal shift hari ini sudah selesai." });
                            }
                            shiftRecord = todayShift;
                            tipe_absen = todayShift.jam_absen ? 'pulang' : 'masuk';
                        }
                    }
                }

                if (!shiftRecord) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Absensi gagal. Tidak ditemukan jadwal shift aktif yang sesuai untuk melakukan absensi saat ini." 
                    });
                }
            }

            // 4. Face Recognition (Only if shift check passed)
            if (payload.user_id) {
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
                console.log("Identifying user via face recognition...");
                const allUsers = await userService.getAllForFaceRecognition();
                matchResult = await faceRecognitionService.findMatchingUser(incomingPath, allUsers);
                if (!matchResult.user) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Absensi gagal. Wajah tidak dikenali atau tidak cocok dengan data karyawan mana pun.",
                        error: matchResult.error
                    });
                }
                user = matchResult.user;
                
                // Re-fetch shifts for the identified user
                recentShifts = await absensiService.getByIdUsersHistory(user.id.toString(), yStr, tStr);
                // (Need to repeat the shift find logic here if identified by face, 
                // but usually mobile app always sends user_id)
                const todayShift = recentShifts.find(s => isSameDay(s.tanggal, tStr));
                if (!todayShift) {
                     return res.status(400).json({ success: false, message: `Absensi gagal. ${user.name} tidak memiliki jadwal shift hari ini.` });
                }
                shiftRecord = todayShift;
                tipe_absen = shiftRecord.jam_absen ? 'pulang' : 'masuk';
            }

            if (tipe_absen === 'pulang' && shiftRecord.jam_pulang) {
                return res.status(400).json({ success: false, message: "Absensi gagal. Anda sudah mengisi jam pulang untuk shift ini." });
            }

            // 3. Location and Radius Check
            const isLocked = shiftRecord.lock_location === "1" || shiftRecord.lock_location === 1;
            let distanceValue = null;

            if (payload.lat && payload.long) {
                if (user.lokasi) {
                    const officeLat = parseFloat(user.lokasi.lat_kantor);
                    const officeLong = parseFloat(user.lokasi.long_kantor);
                    
                    // Validate office coordinates
                    if (isNaN(officeLat) || isNaN(officeLong) || (Math.abs(officeLat) < 0.0001 && Math.abs(officeLong) < 0.0001)) {
                        console.warn(`User ${user.name} has invalid office coordinates: ${officeLat}, ${officeLong}`);
                        if (isLocked) {
                            return res.status(400).json({ 
                                success: false, 
                                message: "Absensi gagal. Koordinat kantor tidak valid atau belum diatur dengan benar." 
                            });
                        }
                    } else {
                        const distance = this.calculateDistance(
                            parseFloat(payload.lat), parseFloat(payload.long),
                            officeLat, officeLong
                        );
                        const radius = parseFloat(user.lokasi.radius || 0);
                        distanceValue = Math.round(distance);

                        console.log(`[ABSEN] User: ${user.name}, Jarak: ${distanceValue}m, Radius: ${radius}m, Locked: ${isLocked}`);

                        if (isLocked && radius > 0 && distance > radius) {
                            return res.status(400).json({ 
                                success: false, 
                                message: `Absensi gagal. Anda berada di luar radius kantor.\nJarak Anda: ${distanceValue}m\nBatas Izin: ${radius}m\n\nSilakan mendekat ke lokasi kantor.` 
                            });
                        }
                    }
                } else if (isLocked) {
                    return res.status(400).json({ success: false, message: "Absensi gagal. Anda belum memiliki lokasi kantor yang ditugaskan (Shift Terkunci)." });
                }
            } else if (isLocked) {
                return res.status(400).json({ success: false, message: "Absensi gagal. Izin lokasi (GPS) wajib aktif untuk melakukan absensi pada shift ini." });
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
                if (distanceValue !== null) updatePayload.jarak_masuk = String(distanceValue);
                updatePayload.status_absen = 'Masuk';
            } else {
                updatePayload.jam_pulang = timeStr;
                updatePayload.foto_jam_pulang = `/uploads/absensi/${filename}`;
                if (payload.lat) updatePayload.lat_pulang = String(payload.lat);
                if (payload.long) updatePayload.long_pulang = String(payload.long);
                if (distanceValue !== null) updatePayload.jarak_pulang = String(distanceValue);
                updatePayload.status_absen = 'Pulang';
            }

            console.log(`Finalizing attendance for ${user.name} on shift ${shiftRecord.id}. Payload:`, JSON.stringify(updatePayload));
            const data = await absensiService.update(shiftRecord.id, updatePayload);

            return res.status(201).json({ 
                success: true, 
                message: `Absensi ${tipe_absen} wajah berhasil: ${user.name}`, 
                data, 
                distance: matchResult.distance,
                user: user
            });

        } catch (error) {
            console.error("AbsensiController.storeWajah FATAL ERROR:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Gagal memproses absensi wajah di server.", 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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