import prisma from './src/config/prisma.js';
import kontrakService from './src/services/KontrakService.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    // 1. Get user 2255
    const before = await prisma.users.findUnique({
        where: { id: 2255n }
    });
    console.log("Before sync:", {
        id: before.id.toString(),
        no_kontrak: before.no_kontrak,
        tanggal_mulai_pkwt: before.tanggal_mulai_pkwt,
        tanggal_berakhir_pkwt: before.tanggal_berakhir_pkwt
    });

    // 2. Call KontrakService.create
    console.log("Creating contract...");
    const contract = await kontrakService.create({
        user_id: "2255",
        tanggal: "2026-06-29",
        jenis_kontrak: "Perjanjian Kerja Waktu Tertentu (PKWT)",
        no_kontrak: "TEST-CONTRACT-12345",
        tanggal_mulai: "2026-07-01",
        tanggal_selesai: "2026-12-31",
        keterangan: "Test contract sync"
    });
    console.log("Created contract details:", contract);

    // 3. Get user 2255 again
    const after = await prisma.users.findUnique({
        where: { id: 2255n }
    });
    console.log("After sync:", {
        id: after.id.toString(),
        no_kontrak: after.no_kontrak,
        tanggal_mulai_pkwt: after.tanggal_mulai_pkwt,
        tanggal_berakhir_pkwt: after.tanggal_berakhir_pkwt
    });

    // Clean up test contract
    await prisma.kontraks.delete({
        where: { id: BigInt(contract.id) }
    });
    console.log("Cleaned up test contract");
}

main().catch(console.error).finally(() => prisma.$disconnect());
