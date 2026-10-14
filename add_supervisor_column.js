import prisma from './src/config/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        // Tambah kolom is_supervisor ke tabel users
        const col = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM users LIKE 'is_supervisor'`);
        if (col.length === 0) {
            console.log("Adding column is_supervisor to users...");
            await prisma.$executeRawUnsafe(
                `ALTER TABLE users ADD COLUMN is_supervisor TINYINT(1) NOT NULL DEFAULT 0 AFTER is_admin`
            );
            console.log("Column is_supervisor added!");
        } else {
            console.log("Column is_supervisor already exists.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
