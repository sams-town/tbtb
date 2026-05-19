import prisma from './src/config/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const users = await prisma.users.findMany({
        select: {
            id: true,
            name: true,
            username: true,
            is_admin: true
        }
    });
    console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
