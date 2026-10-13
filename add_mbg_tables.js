import prisma from './src/config/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        // ── mbg_settings ──────────────────────────────────────────
        const settingsCheck = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE 'mbg_settings'`);
        if (settingsCheck.length === 0) {
            console.log("Creating table mbg_settings...");
            await prisma.$executeRawUnsafe(`
                CREATE TABLE mbg_settings (
                    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    harga      BIGINT NOT NULL DEFAULT 0,
                    keterangan VARCHAR(255) NULL,
                    aktif      INT NOT NULL DEFAULT 1,
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
            // Seed harga default
            await prisma.$executeRawUnsafe(`
                INSERT INTO mbg_settings (harga, keterangan, aktif, created_at, updated_at)
                VALUES (15000, 'Harga default makan siang bergizi', 1, NOW(), NOW());
            `);
            console.log("Table mbg_settings created + seeded harga default Rp 15.000.");
        } else {
            console.log("Table mbg_settings already exists, skipping.");
        }

        // ── mbg_klaims ────────────────────────────────────────────
        const klaimsCheck = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE 'mbg_klaims'`);
        if (klaimsCheck.length === 0) {
            console.log("Creating table mbg_klaims...");
            await prisma.$executeRawUnsafe(`
                CREATE TABLE mbg_klaims (
                    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    user_id    BIGINT UNSIGNED NOT NULL,
                    tanggal    DATE NOT NULL,
                    jam_klaim  VARCHAR(10) NOT NULL,
                    harga      BIGINT NOT NULL DEFAULT 0,
                    lat        VARCHAR(50) NULL,
                    long       VARCHAR(50) NULL,
                    jarak      VARCHAR(20) NULL,
                    status     VARCHAR(50) NOT NULL DEFAULT 'Claimed',
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL,
                    CONSTRAINT mbg_klaims_user_id_foreign
                        FOREIGN KEY (user_id) REFERENCES users (id)
                        ON DELETE NO ACTION ON UPDATE NO ACTION,
                    UNIQUE KEY mbg_klaims_user_id_tanggal_unique (user_id, tanggal)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
            console.log("Table mbg_klaims created.");
        } else {
            console.log("Table mbg_klaims already exists, skipping.");
        }

        console.log("\nDone! Jalankan: npx prisma generate");
    } catch (e) {
        console.error("Error:", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
