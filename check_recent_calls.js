require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== ÚLTIMOS 20 AUDIT LOGS ===");
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20
  });

  logs.forEach(l => {
    console.log(`[${l.createdAt.toISOString()}] Entity: ${l.entity} | Action: ${l.action} | ID: ${l.entityId}`);
    try {
      const details = JSON.parse(l.details || "{}");
      console.log(`   Details:`, JSON.stringify(details).slice(0, 300));
    } catch (e) {
      console.log(`   Details (Raw):`, l.details ? l.details.slice(0, 300) : "null");
    }
    console.log("-----------------------------------------");
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
