import prisma from './src/config/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        console.log("Checking if no_kontrak column exists in kontraks table...");
        const columns = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM kontraks LIKE 'no_kontrak'`);
        if (columns.length === 0) {
            console.log("Column no_kontrak does not exist. Adding column...");
            await prisma.$executeRawUnsafe(`ALTER TABLE kontraks ADD COLUMN no_kontrak VARCHAR(255) NULL AFTER jenis_kontrak`);
            console.log("Column no_kontrak added successfully!");
        } else {
            console.log("Column no_kontrak already exists.");
        }
    } catch (e) {
        console.error("Error executing query:", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
