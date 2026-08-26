const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

// Load .env
dotenv.config({ path: path.join(__dirname, "../.env") });

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "");
}

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const warehouses = await prisma.warehouse.findMany();
    const miamiWh = warehouses.find(wh => wh.name.toLowerCase().includes("miami"));
    if (!miamiWh) {
      console.log("Miami warehouse not found!");
      return;
    }

    // Query inventory items for Miami warehouse
    const miamiInventory = await prisma.inventory.findMany({
      where: {
        warehouseId: miamiWh.id
      },
      include: {
        product: true
      }
    });

    console.log(`--- Miami Warehouse Inventory (${miamiWh.name}) ---`);
    let totalKits = 0;
    
    miamiInventory.forEach(inv => {
      console.log(`Product: ${inv.product.name} (SKU: ${inv.product.sku}) | Qty in Stock: ${inv.quantity}`);
      if (inv.product.sku.startsWith("KIT-") || inv.product.name.toLowerCase().includes("kit")) {
        totalKits += inv.quantity;
      }
    });

    console.log(`\nTotal remaining kits in Miami: ${totalKits}`);
    console.log(`Value per kit: $300 USD`);
    console.log(`Total Value of remaining kits: $${(totalKits * 300).toFixed(2)} USD`);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
