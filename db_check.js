import prisma from './src/config/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("=== USER 2315 DETAILS ===");
    const user2315 = await prisma.users.findUnique({
        where: { id: 2315n }
    });
    console.log(user2315 ? {
        id: user2315.id.toString(),
        name: user2315.name,
        no_pkwt: user2315.no_pkwt,
        no_kontrak: user2315.no_kontrak,
        tanggal_mulai_pkwt: user2315.tanggal_mulai_pkwt,
        tanggal_berakhir_pkwt: user2315.tanggal_berakhir_pkwt
    } : "Not found");

    console.log("\n=== USER 2465 DETAILS ===");
    const user2465 = await prisma.users.findUnique({
        where: { id: 2465n }
    });
    console.log(user2465 ? {
        id: user2465.id.toString(),
        name: user2465.name,
        no_pkwt: user2465.no_pkwt,
        no_kontrak: user2465.no_kontrak,
        tanggal_mulai_pkwt: user2465.tanggal_mulai_pkwt,
        tanggal_berakhir_pkwt: user2465.tanggal_berakhir_pkwt
    } : "Not found");
}

main().catch(console.error).finally(() => prisma.$disconnect());
