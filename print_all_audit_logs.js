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
  console.log("Consultando los últimos 20 logs de auditoría en la base de datos...");
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20
  });

  if (logs.length === 0) {
    console.log("No se encontraron registros de auditoría.");
    return;
  }

  logs.forEach(l => {
    console.log(`[${l.createdAt.toLocaleString()}] [Entity: ${l.entity}] [ID: ${l.entityId}] [Action: ${l.action}]`);
    console.log("Details:", l.details);
    console.log("--------------------------------------------------");
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
