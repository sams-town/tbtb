import prisma from './src/config/prisma.js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const baseUrl = 'https://api-absen.hris-thb.id';
const oldDomain = 'meandpay.hermansyahali07.my.id';

async function main() {
    console.log("Reading backup SQL...");
    const sql = fs.readFileSync('/www/backup/database/Dump20260908hris.sql', 'utf8');

    // Ambil blok INSERT users
    const insertMatch = sql.match(/INSERT INTO `users` VALUES ([\s\S]+?);(\r?\n|$)/);
    if (!insertMatch) {
        console.log("INSERT users not found");
        return;
    }

    console.log("Found INSERT users, extracting rows...");

    // Extract setiap row: cari pola (id,'name','foto_karyawan','foto_face_recognition',
    // Kolom: id, name, foto_karyawan, foto_face_recognition
    const rowRegex = /\((\d+),'[^']*','([^']*)','([^']*)'/g;
    let match;
    let updated = 0;
    let skipped = 0;

    while ((match = rowRegex.exec(sql)) !== null) {
        const userId = match[1];
        const fotoKaryawan = match[2];
        const fotoFace = match[3];

        // Hanya proses jika ada URL foto (mengandung http)
        if (!fotoKaryawan.includes('http') && !fotoFace.includes('http')) {
            continue;
        }

        // Ganti domain lama dengan domain baru
        const newFotoKaryawan = fotoKaryawan
            ? fotoKaryawan.replace(`http://${oldDomain}`, baseUrl).replace(`https://${oldDomain}`, baseUrl)
            : null;
        const newFotoFace = fotoFace
            ? fotoFace.replace(`http://${oldDomain}`, baseUrl).replace(`https://${oldDomain}`, baseUrl)
            : null;

        try {
            await prisma.users.update({
                where: { id: BigInt(userId) },
                data: {
                    foto_karyawan: newFotoKaryawan || undefined,
                    foto_face_recognition: newFotoFace || undefined,
                }
            });
            updated++;
            if (updated <= 3) console.log(`Updated user ${userId}: ${newFotoKaryawan?.slice(0, 60)}`);
        } catch (e) {
            skipped++;
        }
    }

    console.log(`Done! Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
