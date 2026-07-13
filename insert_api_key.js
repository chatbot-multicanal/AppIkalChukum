require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "");
}

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const apiKey = process.argv[2];

async function main() {
  if (!apiKey || !apiKey.startsWith("sk-")) {
    console.error("❌ Error: Debes proporcionar una clave API de OpenAI válida que inicie con 'sk-'.");
    console.log("Uso: node insert_api_key.js sk-XXXXXX...");
    process.exit(1);
  }

  console.log("Conectando a la base de datos...");
  
  // Insertar o actualizar la clave
  await prisma.systemSetting.upsert({
    where: { key: "OPENAI_API_KEY" },
    update: { value: apiKey.trim() },
    create: { key: "OPENAI_API_KEY", value: apiKey.trim() }
  });

  console.log("✅ ¡Clave API de OpenAI guardada exitosamente en la base de datos!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
