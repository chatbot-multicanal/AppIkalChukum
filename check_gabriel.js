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
  console.log("Consultando últimos clientes registrados...");
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    take: 5
  });
  
  clients.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.name} | City: ${c.city} | Phone: ${c.phone} | Created: ${c.createdAt}`);
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
