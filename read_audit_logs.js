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
  console.log("Consultando los logs de auditoría de Sofía...");
  const logs = await prisma.auditLog.findMany({
    where: { entity: "SofiaChat" },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  if (logs.length === 0) {
    console.log("No se encontraron registros de auditoría para SofiaChat.");
    return;
  }

  logs.forEach(l => {
    console.log(`[${l.createdAt.toLocaleString()}] [${l.entityId}] [${l.action}]`);
    console.log(JSON.stringify(JSON.parse(l.details), null, 2));
    console.log("--------------------------------------------------");
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
