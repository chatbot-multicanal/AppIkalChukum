require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Insertando usuarios de bodega de forma segura...");

  // Buscar bodegas existentes
  const whMiami = await prisma.warehouse.findFirst({
    where: { name: { contains: "Miami" } }
  });

  const whMerida = await prisma.warehouse.findFirst({
    where: { name: { contains: "Mérida" } }
  });

  if (!whMiami || !whMerida) {
    console.error("Error: No se encontraron las bodegas de Miami o Mérida. Primero deben existir las bodegas.");
    return;
  }

  // Crear o actualizar usuario Mérida
  await prisma.user.upsert({
    where: { email: "bodega@ikalchukum.com" },
    update: { warehouseId: whMerida.id },
    create: {
      email: "bodega@ikalchukum.com",
      name: "Encargado Bodega",
      role: "BODEGA",
      password: "password123",
      active: true,
      warehouseId: whMerida.id,
    }
  });
  console.log("✓ Usuario bodega@ikalchukum.com listo.");

  // Crear o actualizar usuario Miami (default)
  await prisma.user.upsert({
    where: { email: "bodega_miami@ikalchukum.com" },
    update: { warehouseId: whMiami.id },
    create: {
      email: "bodega_miami@ikalchukum.com",
      name: "Encargado Miami",
      role: "BODEGA",
      password: "password123",
      active: true,
      warehouseId: whMiami.id,
    }
  });
  console.log("✓ Usuario bodega_miami@ikalchukum.com listo.");

  // Crear o actualizar usuario Miami (Patricio)
  await prisma.user.upsert({
    where: { email: "ppupiales@rcbglobal.com" },
    update: { warehouseId: whMiami.id, password: "rcb12345" },
    create: {
      email: "ppupiales@rcbglobal.com",
      name: "Patricio Pupiales",
      role: "BODEGA",
      password: "rcb12345",
      active: true,
      warehouseId: whMiami.id,
    }
  });
  console.log("✓ Usuario ppupiales@rcbglobal.com listo.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
