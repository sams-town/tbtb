import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import fileService from "./FileService.js";

class UserService {
    /**
     * Get all users with optional pagination & search
     */
    async getAll(query = {}, authUser = null) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 100;
        const search = query.search || "";
        const skip = (page - 1) * limit;

        const pegawaiKeluars = await prisma.pegawai_keluars.findMany({
            select: { user_id: true }
        });
        const excludedUserIds = pegawaiKeluars.map((pk) => pk.user_id);

        const where = {
            id: { notIn: excludedUserIds }
        };

        const filterLokasiId = query.lokasi_id ? BigInt(query.lokasi_id) : null;
        let filterJabatanId = null;
        let showEmptyJabatan = false;

        if (query.jabatan_id === "null" || query.jabatan_id === "kosong") {
            showEmptyJabatan = true;
        } else if (query.jabatan_id) {
            filterJabatanId = BigInt(query.jabatan_id);
        }

        const isSuperAdmin = authUser && (String(authUser.id) === "1" || (authUser.roles && authUser.roles.some(r => r.toLowerCase().replace(/\s/g, "") === "superadmin")));
        
        if (!isSuperAdmin) {
            where.id = { ...where.id, not: 1n };

            if (authUser && authUser.id) {
                const managedJabatans = await prisma.jabatans.findMany({
                    where: { manager: BigInt(authUser.id) },
                    select: { id: true }
                });
                const managedIds = managedJabatans.map(j => j.id);

                if (managedIds.length > 0) {
                    if (filterJabatanId) {
                        where.jabatan_id = (managedIds.includes(filterJabatanId)) ? { in: [filterJabatanId, null] } : null;
                    } else if (showEmptyJabatan) {
                        where.jabatan_id = null;
                    } else {
                        where.jabatan_id = { in: [...managedIds, null] };
                    }
                } else {
                    const currentUser = await prisma.users.findUnique({
                        where: { id: BigInt(authUser.id) },
                        select: { jabatan_id: true }
                    });
                    const userJabatanId = currentUser?.jabatan_id || null;
                    
                    if (filterJabatanId) {
                        where.jabatan_id = (userJabatanId === filterJabatanId) ? { in: [filterJabatanId, null] } : null;
                    } else if (showEmptyJabatan) {
                        where.jabatan_id = (userJabatanId === null) ? null : { in: [] };
                    } else {
                        where.jabatan_id = { in: [userJabatanId, null] };
                    }
                }
            }
        } else {
            if (filterJabatanId) {
                where.jabatan_id = { in: [filterJabatanId, null] };
            } else if (showEmptyJabatan) {
                where.jabatan_id = null;
            }
        }

        if (filterLokasiId) {
            where.lokasi_id = filterLokasiId;
        }

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { username: { contains: search } },
                { telepon: { contains: search } },
                { provinsi: { contains: search } },
                { kota_kabupaten: { contains: search } },
                { kecamatan: { contains: search } },
                { kelurahan: { contains: search } },
            ];
        }

        if (query.role) {
            const roleUsers = await prisma.model_has_roles.findMany({
                where: {
                    roles: {
                        name: query.role
                    }
                },
                select: { model_id: true }
            });
            const roleUserIds = roleUsers.map(ru => ru.model_id);
            if (where.id) {
                where.id = { ...where.id, in: roleUserIds };
            } else {
                where.id = { in: roleUserIds };
            }
        }

        const [data, total] = await Promise.all([
            prisma.users.findMany({
                where,
                skip,
                take: limit,
                orderBy: { id: "desc" },
                include: { jabatan: true, lokasi: true, status_pajak: true },
            }),
            prisma.users.count({ where }),
        ]);

        const userIds = data.map((u) => u.id);
        const userRoles = await prisma.model_has_roles.findMany({
            where: { model_id: { in: userIds } },
            include: { roles: true },
        });

        const userWithFiles = await prisma.files.findMany({
            where: { user_id: { in: userIds } },
            select: { user_id: true },
        });
        const hasFilesSet = new Set(userWithFiles.map((f) => f.user_id.toString()));

        const cutiRecords = await prisma.cutis.findMany({
            where: { user_id: { in: userIds }, status_cuti: "Diterima" },
            select: { user_id: true, tanggal: true, nama_cuti: true },
        });
        const usedMap = {};
        for (const r of cutiRecords) {
            const uid = r.user_id;
            const label = (r.nama_cuti || "").toLowerCase();
            let type = "lainnya";
            if (label.includes("melahirkan")) type = "melahirkan";
            else if (label.includes("kematian")) type = "kematian";
            else if (label.includes("cuti")) type = "cuti";
            else if (label.includes("telat")) type = "telat";
            else if (label.includes("pulang")) type = "pulang_cepat";
            const t = r.tanggal || "";
            let amount = 1;
            if (["cuti", "melahirkan", "kematian"].includes(type)) {
                if (t.includes(" - ")) {
                    const [start, end] = t.split(" - ");
                    const s = new Date(start);
                    const e = new Date(end);
                    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    amount = diff > 0 ? diff : 0;
                } else if (!t) {
                    amount = 0;
                }
            }
            usedMap[uid] = usedMap[uid] || { cuti: 0, telat: 0, pulang_cepat: 0, melahirkan: 0, kematian: 0, lainnya: 0 };
            usedMap[uid][type] += amount;
        }

        const dataWithRoles = data.map((user) => {
            const roles = userRoles
                .filter((ur) => ur.model_id === user.id)
                .map((ur) => ur.roles.name);
            const sisaCuti = Number(user.izin_cuti || 0n);
            const sisaTelat = Number(user.izin_telat || 0n);
            const sisaPulangCepat = Number(user.izin_pulang_cepat || 0n);
            const sisaLainnya = Number(user.izin_lainnya || 0n);
            const sisaMelahirkan = Number(user.cuti_melahirkan || 0n);
            const sisaKematian = Number(user.cuti_kematian || 0n);
            const used = usedMap[user.id] || { cuti: 0, telat: 0, pulang_cepat: 0, melahirkan: 0, kematian: 0, lainnya: 0 };
            
            return {
                ...this.serialize(user),
                roles,
                has_dokumen: hasFilesSet.has(user.id.toString()),
                izin_cuti_total: String(sisaCuti + used.cuti),
                izin_cuti_terpakai: String(used.cuti),
                izin_cuti_sisa: String(sisaCuti),
                izin_telat_total: String(sisaTelat + used.telat),
                izin_telat_terpakai: String(used.telat),
                izin_telat_sisa: String(sisaTelat),
                izin_pulang_cepat_total: String(sisaPulangCepat + used.pulang_cepat),
                izin_pulang_cepat_terpakai: String(used.pulang_cepat),
                izin_pulang_cepat_sisa: String(sisaPulangCepat),
                izin_lainnya_total: String(sisaLainnya + used.lainnya),
                izin_lainnya_terpakai: String(used.lainnya),
                izin_lainnya_sisa: String(sisaLainnya),
                cuti_melahirkan_total: String(sisaMelahirkan + used.melahirkan),
                cuti_melahirkan_terpakai: String(used.melahirkan),
                cuti_melahirkan_sisa: String(sisaMelahirkan),
                cuti_kematian_total: String(sisaKematian + used.kematian),
                cuti_kematian_terpakai: String(used.kematian),
                cuti_kematian_sisa: String(sisaKematian),
            };
        });

        return {
            data: dataWithRoles,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get all users without pagination
     */
    async getAllNoPaginate(query = {}, authUser = null) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 100;
        const skip = (page - 1) * limit;
        const search = query.search || "";
        
        const pegawaiKeluars = await prisma.pegawai_keluars.findMany({
            select: { user_id: true }
        });
        const keluarIdsSet = new Set(pegawaiKeluars.map((pk) => pk.user_id.toString()));

        const where = {};

        const filterLokasiId = query.lokasi_id ? BigInt(query.lokasi_id) : null;
        let filterJabatanId = null;
        let showEmptyJabatan = false;

        if (query.jabatan_id === "null" || query.jabatan_id === "kosong") {
            showEmptyJabatan = true;
        } else if (query.jabatan_id) {
            filterJabatanId = BigInt(query.jabatan_id);
        }

        if (filterLokasiId) {
            where.lokasi_id = filterLokasiId;
        }

        const isSuperAdmin = authUser && (String(authUser.id) === "1" || (authUser.roles && authUser.roles.some(r => r.toLowerCase().replace(/\s/g, "") === "superadmin")));
        
        if (!isSuperAdmin) {
            where.id = { not: 1n };

            if (authUser && authUser.id) {
                const managedJabatans = await prisma.jabatans.findMany({
                    where: { manager: BigInt(authUser.id) },
                    select: { id: true }
                });
                const managedIds = managedJabatans.map(j => j.id);

                if (managedIds.length > 0) {
                    if (filterJabatanId) {
                        where.jabatan_id = (managedIds.includes(filterJabatanId)) ? { in: [filterJabatanId, null] } : null;
                    } else if (showEmptyJabatan) {
                        where.jabatan_id = null;
                    } else {
                        where.jabatan_id = { in: [...managedIds, null] };
                    }
                } else {
                    const currentUser = await prisma.users.findUnique({
                        where: { id: BigInt(authUser.id) },
                        select: { jabatan_id: true }
                    });
                    const userJabatanId = currentUser?.jabatan_id || null;
                    
                    if (filterJabatanId) {
                        where.jabatan_id = (userJabatanId === filterJabatanId) ? { in: [filterJabatanId, null] } : null;
                    } else if (showEmptyJabatan) {
                        where.jabatan_id = (userJabatanId === null) ? null : { in: [] };
                    } else {
                        where.jabatan_id = { in: [userJabatanId, null] };
                    }
                }
            }
        } else {
            if (filterJabatanId) {
                where.jabatan_id = { in: [filterJabatanId, null] };
            } else if (showEmptyJabatan) {
                where.jabatan_id = null;
            }
        }

        if (filterLokasiId) {
            where.lokasi_id = filterLokasiId;
        }

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { username: { contains: search } },
                { telepon: { contains: search } },
                { provinsi: { contains: search } },
                { kota_kabupaten: { contains: search } },
                { kecamatan: { contains: search } },
                { kelurahan: { contains: search } },
            ];
        }

        if (query.role) {
            const roleUsers = await prisma.model_has_roles.findMany({
                where: {
                    roles: {
                        name: query.role
                    }
                },
                select: { model_id: true }
            });
            const roleUserIds = roleUsers.map(ru => ru.model_id);
            if (where.id) {
                where.id = { ...where.id, in: roleUserIds };
            } else {
                where.id = { in: roleUserIds };
            }
        }

        const [data, total] = await Promise.all([
            prisma.users.findMany({
                where,
                skip: query.page ? skip : undefined,
                take: query.page ? limit : undefined,
                orderBy: { name: "asc" },
                include: { jabatan: true, lokasi: true, status_pajak: true },
            }),
            prisma.users.count({ where }),
        ]);

        const userIds = data.map((u) => u.id);
        const userRoles = await prisma.model_has_roles.findMany({
            where: { model_id: { in: userIds } },
            include: { roles: true },
        });

        const userWithFiles = await prisma.files.findMany({
            where: { user_id: { in: userIds } },
            select: { user_id: true },
        });
        const hasFilesSet = new Set(userWithFiles.map((f) => f.user_id.toString()));

        const cutiRecords = await prisma.cutis.findMany({
            where: { user_id: { in: userIds }, status_cuti: "Diterima" },
            select: { user_id: true, tanggal: true, nama_cuti: true },
        });

        const usedMap = {};
        for (const r of cutiRecords) {
            const uid = r.user_id;
            const label = (r.nama_cuti || "").toLowerCase();
            let type = "lainnya";
            if (label.includes("melahirkan")) type = "melahirkan";
            else if (label.includes("kematian")) type = "kematian";
            else if (label.includes("cuti")) type = "cuti";
            else if (label.includes("telat")) type = "telat";
            else if (label.includes("pulang")) type = "pulang_cepat";
            const t = r.tanggal || "";
            let amount = 1;
            if (["cuti", "melahirkan", "kematian"].includes(type)) {
                if (t.includes(" - ")) {
                    const [start, end] = t.split(" - ");
                    const s = new Date(start);
                    const e = new Date(end);
                    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    amount = diff > 0 ? diff : 0;
                } else if (!t) {
                    amount = 0;
                }
            }
            usedMap[uid] = usedMap[uid] || { cuti: 0, telat: 0, pulang_cepat: 0, melahirkan: 0, kematian: 0, lainnya: 0 };
            usedMap[uid][type] += amount;
        }

        const dataWithRoles = data.map((user) => {
            const roles = userRoles
                .filter((ur) => ur.model_id === user.id)
                .map((ur) => ur.roles.name);
            
            const sisaCuti = Number(user.izin_cuti || 0n);
            const sisaTelat = Number(user.izin_telat || 0n);
            const sisaPulangCepat = Number(user.izin_pulang_cepat || 0n);
            const sisaLainnya = Number(user.izin_lainnya || 0n);
            const sisaMelahirkan = Number(user.cuti_melahirkan || 0n);
            const sisaKematian = Number(user.cuti_kematian || 0n);
            const used = usedMap[user.id] || { cuti: 0, telat: 0, pulang_cepat: 0, melahirkan: 0, kematian: 0, lainnya: 0 };

            return {
                ...this.serialize(user),
                roles,
                is_keluar: keluarIdsSet.has(user.id.toString()),
                has_dokumen: hasFilesSet.has(user.id.toString()),
                izin_cuti_total: String(sisaCuti + used.cuti),
                izin_cuti_terpakai: String(used.cuti),
                izin_cuti_sisa: String(sisaCuti),
                izin_telat_total: String(sisaTelat + used.telat),
                izin_telat_terpakai: String(used.telat),
                izin_telat_sisa: String(sisaTelat),
                izin_pulang_cepat_total: String(sisaPulangCepat + used.pulang_cepat),
                izin_pulang_cepat_terpakai: String(used.pulang_cepat),
                izin_pulang_cepat_sisa: String(sisaPulangCepat),
                izin_lainnya_total: String(sisaLainnya + used.lainnya),
                izin_lainnya_terpakai: String(used.lainnya),
                izin_lainnya_sisa: String(sisaLainnya),
                cuti_melahirkan_total: String(sisaMelahirkan + used.melahirkan),
                cuti_melahirkan_terpakai: String(used.melahirkan),
                cuti_melahirkan_sisa: String(sisaMelahirkan),
                cuti_kematian_total: String(sisaKematian + used.kematian),
                cuti_kematian_terpakai: String(used.kematian),
                cuti_kematian_sisa: String(sisaKematian),
            };
        });

        return {
            data: dataWithRoles,
            meta: query.page ? {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            } : undefined,
            total: dataWithRoles.length,
        };
    }

    /**
     * Get single user by ID
     */
    async getById(id, authUser = null) {
        const userId = BigInt(id);
        const authId = authUser ? BigInt(authUser.id) : null;

        // Selain id=1 atau super admin maka data id=1 tidak bisa dilihat atau dihide
        const isSuperAdmin = authUser && (authId === 1n || (authUser.roles && authUser.roles.some(r => r.toLowerCase().replace(/\s/g, "") === "superadmin")));
        if (userId === 1n && !isSuperAdmin) {
            return null;
        }

        const user = await prisma.users.findUnique({
            where: { id: userId },
            include: { jabatan: true, lokasi: true, status_pajak: true },
        });

        if (!user) return null;

        // Division check (Skip if it's the user themselves or no authUser)
        if (!isSuperAdmin && authId && authId !== userId) {
            const managedJabatans = await prisma.jabatans.findMany({
                where: { manager: authId },
                select: { id: true }
            });

            if (managedJabatans.length > 0) {
                const managedIds = managedJabatans.map(j => j.id);
                if (!user.jabatan_id || !managedIds.includes(user.jabatan_id)) {
                    return null;
                }
            } else {
                const currentUser = await prisma.users.findUnique({
                    where: { id: authId },
                    select: { jabatan_id: true }
                });
                if (user.jabatan_id !== currentUser?.jabatan_id) {
                    return null;
                }
            }
        }

        const userRoles = await prisma.model_has_roles.findMany({
            where: { model_id: BigInt(id) },
            include: { roles: true },
        });
        const roles = userRoles.map((ur) => ur.roles.name);

        const cutiList = await prisma.cutis.findMany({
            where: { user_id: BigInt(id), status_cuti: "Diterima" },
            select: { tanggal: true, nama_cuti: true },
        });
        let used = { cuti: 0, telat: 0, pulang_cepat: 0, melahirkan: 0, kematian: 0, lainnya: 0 };
        for (const r of cutiList) {
            const label = (r.nama_cuti || "").toLowerCase();
            let type = "lainnya";
            if (label.includes("melahirkan")) type = "melahirkan";
            else if (label.includes("kematian")) type = "kematian";
            else if (label.includes("cuti")) type = "cuti";
            else if (label.includes("telat")) type = "telat";
            else if (label.includes("pulang")) type = "pulang_cepat";
            const t = r.tanggal || "";
            let amount = 1;
            if (["cuti", "melahirkan", "kematian"].includes(type)) {
                if (t.includes(" - ")) {
                    const [start, end] = t.split(" - ");
                    const s = new Date(start);
                    const e = new Date(end);
                    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    amount = diff > 0 ? diff : 0;
                } else if (!t) {
                    amount = 0;
                }
            }
            used[type] += amount;
        }
        const sisaCuti = Number(user.izin_cuti || 0n);
        const sisaTelat = Number(user.izin_telat || 0n);
        const sisaPulangCepat = Number(user.izin_pulang_cepat || 0n);
        const sisaLainnya = Number(user.izin_lainnya || 0n);
        const sisaMelahirkan = Number(user.cuti_melahirkan || 0n);
        const sisaKematian = Number(user.cuti_kematian || 0n);

        const files = await prisma.files.findMany({
            where: { user_id: BigInt(id) },
        });

        return {
            ...this.serialize(user),
            roles,
            files: files.map(f => fileService.serialize(f)),
            izin_cuti_total: String(sisaCuti + used.cuti),
            izin_cuti_terpakai: String(used.cuti),
            izin_cuti_sisa: String(sisaCuti),
            izin_telat_total: String(sisaTelat + used.telat),
            izin_telat_terpakai: String(used.telat),
            izin_telat_sisa: String(sisaTelat),
            izin_pulang_cepat_total: String(sisaPulangCepat + used.pulang_cepat),
            izin_pulang_cepat_terpakai: String(used.pulang_cepat),
            izin_pulang_cepat_sisa: String(sisaPulangCepat),
            izin_lainnya_total: String(sisaLainnya + used.lainnya),
            izin_lainnya_terpakai: String(used.lainnya),
            izin_lainnya_sisa: String(sisaLainnya),
            cuti_melahirkan_total: String(sisaMelahirkan + used.melahirkan),
            cuti_melahirkan_terpakai: String(used.melahirkan),
            cuti_melahirkan_sisa: String(sisaMelahirkan),
            cuti_kematian_total: String(sisaKematian + used.kematian),
            cuti_kematian_terpakai: String(used.kematian),
            cuti_kematian_sisa: String(sisaKematian),
        };
    }

    /**
     * Create a new user
     */
    /**
  * Create a new user
  */
    async create(data) {
        // Pisahkan roles dari data user (sama seperti di update)
        const { roles, jabatan, lokasi, status_pajak, ...userData } = data;

        // Mapping name to IDs if provided (useful for import)
        if (data.jabatan_name && !userData.jabatan_id) {
            const jab = await prisma.jabatans.findFirst({ where: { nama_jabatan: data.jabatan_name } });
            if (jab) userData.jabatan_id = jab.id;
        }
        if (data.lokasi_name && !userData.lokasi_id) {
            const lok = await prisma.lokasi.findFirst({ where: { nama_lokasi: data.lokasi_name } });
            if (lok) userData.lokasi_id = lok.id;
        }
        if (data.status_pajak_name && !userData.status_pajak_id) {
            const stp = await prisma.status_pajak.findFirst({ where: { name: data.status_pajak_name } });
            if (stp) userData.status_pajak_id = stp.id;
        }

        // Cek apakah user sudah ada berdasarkan email atau username
        const conditions = [];
        if (userData.email) conditions.push({ email: userData.email });
        if (userData.username) conditions.push({ username: userData.username });

        if (conditions.length > 0) {
            const existingUser = await prisma.users.findFirst({
                where: {
                    OR: conditions
                }
            });

            if (existingUser) {
                // Jika data ditemukan, lakukan update
                return this.update(existingUser.id.toString(), data);
            }
        }

        // Hash password jika ada
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }

        const user = await prisma.users.create({
            data: this.sanitizeInput(userData),
        });

        // Assign roles jika dikirim
        let roleList = [];
        if (roles) {
            if (typeof roles === "string") {
                try { roleList = JSON.parse(roles); } // jika berupa '["admin"]'
                catch { roleList = roles.split(",").map(r => r.trim()); } // jika berupa "admin,user"
            } else if (Array.isArray(roles)) {
                roleList = roles;
            }
        }

        if (roleList.length > 0) {
            const roleRecords = await prisma.roles.findMany({
                where: { name: { in: roleList } },
            });

            if (roleRecords.length > 0) {
                await prisma.model_has_roles.createMany({
                    data: roleRecords.map((role) => ({
                        role_id: role.id,
                        model_type: "App\\Models\\User",
                        model_id: user.id,
                    })),
                });
            }
        }

        // Return data lengkap dengan roles
        return this.getById(user.id.toString());
    }

    /**
     * Update user by ID
     */
    async update(id, data, authUser = null) {
        const userId = BigInt(id);
        const authId = authUser ? BigInt(authUser.id) : null;

        // Selain id=1 atau super admin maka data id=1 tidak bisa diedit
        const isSuperAdmin = authUser && (authId === 1n || (authUser.roles && authUser.roles.some(r => r.toLowerCase().replace(/\s/g, "") === "superadmin")));
        if (userId === 1n && !isSuperAdmin) {
            return null;
        }

        const existing = await prisma.users.findUnique({
            where: { id: userId },
        });
        if (!existing) return null;

        // Division check (Skip if it's the user themselves or no authUser)
        if (!isSuperAdmin && authId && authId !== userId) {
            const managedJabatans = await prisma.jabatans.findMany({
                where: { manager: authId },
                select: { id: true }
            });

            if (managedJabatans.length > 0) {
                const managedIds = managedJabatans.map(j => j.id);
                if (!existing.jabatan_id || !managedIds.includes(existing.jabatan_id)) {
                    return null;
                }
            } else {
                const currentUser = await prisma.users.findUnique({
                    where: { id: authId },
                    select: { jabatan_id: true }
                });
                if (existing.jabatan_id !== currentUser?.jabatan_id) {
                    return null;
                }
            }
        }

        if (!existing) return null;

        // Pisahkan roles dari data, sisa data masuk ke sanitizeInput
        const { roles, jabatan, lokasi, status_pajak, ...userData } = data;

        // Mapping name to IDs if provided (useful for import)
        if (data.jabatan_name && !userData.jabatan_id) {
            const jab = await prisma.jabatans.findFirst({ where: { nama_jabatan: data.jabatan_name } });
            if (jab) userData.jabatan_id = jab.id;
        }
        if (data.lokasi_name && !userData.lokasi_id) {
            const lok = await prisma.lokasi.findFirst({ where: { nama_lokasi: data.lokasi_name } });
            if (lok) userData.lokasi_id = lok.id;
        }
        if (data.status_pajak_name && !userData.status_pajak_id) {
            const stp = await prisma.status_pajak.findFirst({ where: { name: data.status_pajak_name } });
            if (stp) userData.status_pajak_id = stp.id;
        }

        // Hash password jika ada
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }

        const user = await prisma.users.update({
            where: { id: BigInt(id) },
            data: this.sanitizeInput(userData),
        });

        // Sync roles jika dikirim
        let roleList = [];
        if (roles) {
            if (typeof roles === "string") {
                try { roleList = JSON.parse(roles); } // jika berupa '["admin"]'
                catch { roleList = roles.split(",").map(r => r.trim()); } // jika berupa "admin,user"
            } else if (Array.isArray(roles)) {
                roleList = roles;
            }
        }

        if (roleList.length > 0 || roles !== undefined) {
            // Hapus roles lama
            await prisma.model_has_roles.deleteMany({
                where: { model_id: BigInt(id) },
            });

            if (roleList.length > 0) {
                // Cari role_id berdasarkan nama
                const roleRecords = await prisma.roles.findMany({
                    where: { name: { in: roleList } },
                });

                // Insert roles baru
                if (roleRecords.length > 0) {
                    await prisma.model_has_roles.createMany({
                        data: roleRecords.map((role) => ({
                            role_id: role.id,
                            model_type: "App\\Models\\User",
                            model_id: BigInt(id),
                        })),
                    });
                }
            }
        }

        // Return data lengkap dengan roles
        return this.getById(id);
    }

    async updateFaceRecognition(id, photoPath, authUser = null) {
        // Selain id=1 atau super admin maka data id=1 tidak bisa diedit
        const isSuperAdmin = authUser && (String(authUser.id) === "1" || (authUser.roles && authUser.roles.some(r => r.toLowerCase().replace(/\s/g, "") === "superadmin")));
        if (String(id) === "1" && !isSuperAdmin) {
            return null;
        }
        const user = await prisma.users.update({
            where: { id: BigInt(id) },
            data: { foto_face_recognition: photoPath },
        });
        return this.serialize(user);
    }

    /**
     * Delete user by ID
     */
    async delete(id, authUser = null) {
        // Selain id=1 atau super admin maka data id=1 tidak bisa dihapus
        const isSuperAdmin = authUser && (String(authUser.id) === "1" || (authUser.roles && authUser.roles.some(r => r.toLowerCase().replace(/\s/g, "") === "superadmin")));
        if (String(id) === "1" && !isSuperAdmin) {
            return null;
        }
        const userId = BigInt(id);
        const existing = await prisma.users.findUnique({
            where: { id: userId },
        });
        if (!existing) return null;

        // Division check (Skip if no authUser)
        if (!isSuperAdmin && authUser && authUser.id) {
            const managedJabatans = await prisma.jabatans.findMany({
                where: { manager: BigInt(authUser.id) },
                select: { id: true }
            });

            if (managedJabatans.length > 0) {
                const managedIds = managedJabatans.map(j => j.id);
                if (!existing.jabatan_id || !managedIds.includes(existing.jabatan_id)) {
                    return null;
                }
            } else {
                const currentUser = await prisma.users.findUnique({
                    where: { id: BigInt(authUser.id) },
                    select: { jabatan_id: true }
                });
                if (!existing.jabatan_id || existing.jabatan_id !== currentUser?.jabatan_id) {
                    return null;
                }
            }
        }

        if (!existing) return null;

        return await prisma.$transaction(async (tx) => {
            // 1. Nullify references (optional fields where the user is an approver/manager)
            await tx.cutis.updateMany({
                where: { user_approval: userId },
                data: { user_approval: null }
            });

            await tx.pengajuan_keuangans.updateMany({
                where: { user_approval: userId },
                data: { user_approval: null }
            });

            await tx.lemburs.updateMany({
                where: { approved_by: userId },
                data: { approved_by: null }
            });

            await tx.lokasis.updateMany({
                where: { OR: [{ approved_by: userId }, { created_by: userId }] },
                data: { approved_by: null, created_by: null }
            });

            await tx.mapping_shifts.updateMany({
                where: { approved_by: userId },
                data: { approved_by: null }
            });

            await tx.pegawai_keluars.updateMany({
                where: { approved_by: userId },
                data: { approved_by: null }
            });

            await tx.jabatans.updateMany({
                where: { manager: userId },
                data: { manager: null }
            });

            // 2. Delete data that belongs to the user (required/Cascade-like)
            await tx.cutis.deleteMany({ where: { user_id: userId } });
            await tx.files.deleteMany({ where: { user_id: userId } });
            await tx.kasbons.deleteMany({ where: { user_id: userId } });
            await tx.kontraks.deleteMany({ where: { user_id: userId } });
            await tx.kunjungans.deleteMany({ where: { user_id: userId } });
            await tx.laporan_kerjas.deleteMany({ where: { user_id: userId } });
            await tx.laporan_kinerjas.deleteMany({ where: { user_id: userId } });
            await tx.lemburs.deleteMany({ where: { user_id: userId } });
            await tx.mapping_shifts.deleteMany({ where: { user_id: userId } });
            await tx.pajaks.deleteMany({ where: { user_id: userId } });
            await tx.patrolis.deleteMany({ where: { user_id: userId } });
            await tx.payrolls.deleteMany({ where: { user_id: userId } });
            await tx.pegawai_keluars.deleteMany({ where: { user_id: userId } });
            await tx.pengajuan_keuangans.deleteMany({ where: { user_id: userId } });
            await tx.rapat_notulens.deleteMany({ where: { user_id: userId } });
            await tx.rapat_pegawais.deleteMany({ where: { user_id: userId } });
            await tx.reimbursements.deleteMany({ where: { user_id: userId } });
            await tx.reimbursements_items.deleteMany({ where: { user_id: userId } });
            await tx.sips.deleteMany({ where: { user_id: userId } });
            await tx.target_kinerja_teams.deleteMany({ where: { user_id: userId } });
            await tx.model_has_roles.deleteMany({ where: { model_id: userId } });
            await tx.model_has_permissions.deleteMany({ where: { model_id: userId } });
            await tx.notifications.deleteMany({
                where: { notifiable_id: userId, notifiable_type: "App\\Models\\User" },
            });
            await tx.personal_access_tokens.deleteMany({
                where: { tokenable_id: userId, tokenable_type: "App\\Models\\User" },
            });

            // 3. Delete the user
            await tx.users.delete({
                where: { id: userId },
            });

            return true;
        });
    }

    /**
     * Delete multiple users by IDs
     */
    async bulkDelete(ids, authUser = null) {
        if (!Array.isArray(ids) || ids.length === 0) return false;

        const isSuperAdmin = authUser && (String(authUser.id) === "1" || (authUser.roles && authUser.roles.some(r => r.toLowerCase().replace(/\s/g, "") === "superadmin")));

        // Filter out ID 1 if not Super Admin
        let targetIds = ids.map(id => BigInt(id));
        if (!isSuperAdmin) {
            targetIds = targetIds.filter(id => id !== 1n);
        }

        if (targetIds.length === 0) return false;

        // Perform deletions in sequence or transaction
        // For simplicity and to reuse the logic in delete(), we can use a loop or a more optimized transaction
        return await prisma.$transaction(async (tx) => {
            for (const userId of targetIds) {
                // We should ideally check permissions for each user if not superadmin
                // but for bulk delete by admin, we assume they have rights or we filter by division if needed.
                // Reusing the reference nullification and delete logic from delete()
                
                await tx.cutis.updateMany({ where: { user_approval: userId }, data: { user_approval: null } });
                await tx.pengajuan_keuangans.updateMany({ where: { user_approval: userId }, data: { user_approval: null } });
                await tx.lemburs.updateMany({ where: { approved_by: userId }, data: { approved_by: null } });
                await tx.lokasis.updateMany({ where: { OR: [{ approved_by: userId }, { created_by: userId }] }, data: { approved_by: null, created_by: null } });
                await tx.mapping_shifts.updateMany({ where: { approved_by: userId }, data: { approved_by: null } });
                await tx.pegawai_keluars.updateMany({ where: { approved_by: userId }, data: { approved_by: null } });
                await tx.jabatans.updateMany({ where: { manager: userId }, data: { manager: null } });

                await tx.cutis.deleteMany({ where: { user_id: userId } });
                await tx.files.deleteMany({ where: { user_id: userId } });
                await tx.kasbons.deleteMany({ where: { user_id: userId } });
                await tx.kontraks.deleteMany({ where: { user_id: userId } });
                await tx.kunjungans.deleteMany({ where: { user_id: userId } });
                await tx.laporan_kerjas.deleteMany({ where: { user_id: userId } });
                await tx.laporan_kinerjas.deleteMany({ where: { user_id: userId } });
                await tx.lemburs.deleteMany({ where: { user_id: userId } });
                await tx.mapping_shifts.deleteMany({ where: { user_id: userId } });
                await tx.pajaks.deleteMany({ where: { user_id: userId } });
                await tx.patrolis.deleteMany({ where: { user_id: userId } });
                await tx.payrolls.deleteMany({ where: { user_id: userId } });
                await tx.pegawai_keluars.deleteMany({ where: { user_id: userId } });
                await tx.pengajuan_keuangans.deleteMany({ where: { user_id: userId } });
                await tx.rapat_notulens.deleteMany({ where: { user_id: userId } });
                await tx.rapat_pegawais.deleteMany({ where: { user_id: userId } });
                await tx.reimbursements.deleteMany({ where: { user_id: userId } });
                await tx.reimbursements_items.deleteMany({ where: { user_id: userId } });
                await tx.sips.deleteMany({ where: { user_id: userId } });
                await tx.target_kinerja_teams.deleteMany({ where: { user_id: userId } });
                await tx.model_has_roles.deleteMany({ where: { model_id: userId } });
                await tx.model_has_permissions.deleteMany({ where: { model_id: userId } });
                await tx.notifications.deleteMany({ where: { notifiable_id: userId, notifiable_type: "App\\Models\\User" } });
                await tx.personal_access_tokens.deleteMany({ where: { tokenable_id: userId, tokenable_type: "App\\Models\\User" } });
                
                await tx.users.delete({ where: { id: userId } });
            }
            return true;
        });
    }

    sanitizeInput(data) {
        const allowedFields = [
            "name",
            "foto_karyawan",
            "foto_face_recognition",
            "email",
            "telepon",
            "username",
            "password",
            "tgl_lahir",
            "gender",
            "tgl_join",
            "alamat",
            "izin_cuti",
            "izin_lainnya",
            "izin_telat",
            "izin_pulang_cepat",
            "is_admin",
            "masa_berlaku",
            "status_pajak_id",
            "jabatan_id",
            "lokasi_id",
            "ktp",
            "kartu_keluarga",
            "bpjs_kesehatan",
            "bpjs_ketenagakerjaan",
            "npwp",
            "sim",
            "no_pkwt",
            "no_kontrak",
            "tanggal_mulai_pkwt",
            "tanggal_berakhir_pkwt",
            "rekening",
            "nama_rekening",
            "gaji_pokok",
            "tunjangan_makan",
            "tunjangan_transport",
            "tunjangan_bpjs_kesehatan",
            "tunjangan_bpjs_ketenagakerjaan",
            "lembur",
            "kehadiran",
            "thr",
            "bonus_pribadi",
            "bonus_team",
            "bonus_jackpot",
            "izin",
            "terlambat",
            "mangkir",
            "saldo_kasbon",
            "potongan_bpjs_kesehatan",
            "potongan_bpjs_ketenagakerjaan",
            "email_verified_at",
            "remember_token",
            "darurat_nama",
            "darurat_telepon",
            "darurat_hubungan",
            "batas_terlambat",
            "potongan_koperasi",
            "provinsi",
            "kota_kabupaten",
            "kecamatan",
            "kelurahan",
            "lock_face",
            "cuti_melahirkan",
            "cuti_kematian",
        ];

        const bigIntFields = [
            "izin_cuti",
            "izin_lainnya",
            "izin_telat",
            "izin_pulang_cepat",
            "status_pajak_id",
            "jabatan_id",
            "lokasi_id",
            "gaji_pokok",
            "tunjangan_makan",
            "tunjangan_transport",
            "tunjangan_bpjs_kesehatan",
            "tunjangan_bpjs_ketenagakerjaan",
            "lembur",
            "kehadiran",
            "thr",
            "bonus_pribadi",
            "bonus_team",
            "bonus_jackpot",
            "izin",
            "terlambat",
            "mangkir",
            "saldo_kasbon",
            "potongan_bpjs_kesehatan",
            "potongan_bpjs_ketenagakerjaan",
            "batas_terlambat",
            "potongan_koperasi",
            "cuti_melahirkan",
            "cuti_kematian",
        ];

        const dateFields = [
            "masa_berlaku",
            "tanggal_mulai_pkwt",
            "tanggal_berakhir_pkwt",
            "email_verified_at",
        ];

        const sanitized = {};

        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            if (!allowedFields.includes(key)) continue;

            if (bigIntFields.includes(key)) {
                // Handle null, undefined, empty string, and "null" string
                if (value === null || value === undefined || value === "" || value === "null") {
                    sanitized[key] = null;
                } else {
                    try {
                        sanitized[key] = BigInt(value);
                    } catch (e) {
                        console.warn(`Failed to convert ${key} with value ${value} to BigInt:`, e.message);
                        sanitized[key] = null;
                    }
                }
            } else if (dateFields.includes(key)) {
                sanitized[key] = value !== null && value !== undefined && value !== "" && value !== "null" ? new Date(value) : null;
            } else if (["tgl_lahir", "tgl_join"].includes(key)) {
                if (value !== null && value !== undefined && value !== "" && value !== "null") {
                    const d = new Date(value);
                    if (!isNaN(d.getTime())) {
                        sanitized[key] = d.toISOString().split('T')[0];
                    } else {
                        sanitized[key] = value;
                    }
                } else {
                    sanitized[key] = null;
                }
            } else {
                sanitized[key] = value === "null" ? null : value;
            }
        }

        return sanitized;
    }

    /**
     * Serialize a single user — convert BigInt to string for JSON
     */
    serialize(user) {
        const serialized = {};
        for (const [key, value] of Object.entries(user)) {
            if (typeof value === "bigint") {
                serialized[key] = value.toString();
            } else if (value !== null && typeof value === "object" && !(value instanceof Date)) {
                // Handle nested relation objects (e.g. jabatan)
                const nested = {};
                for (const [k, v] of Object.entries(value)) {
                    nested[k] = typeof v === "bigint" ? v.toString() : v;
                }
                serialized[key] = nested;
            } else {
                serialized[key] = value;
            }
        }
        return serialized;
    }

    /**
     * Serialize a list of users
     */
    serializeList(users) {
        return users.map((user) => this.serialize(user));
    }
}

export default new UserService();
