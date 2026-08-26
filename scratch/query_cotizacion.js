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
    const quote = await prisma.quote.findFirst({
      where: {
        quoteNumber: {
          contains: "COT-0114"
        }
      },
      include: {
        order: {
          include: {
            warehouse: true
          }
        },
        warehouse: true
      }
    });

    console.log("--- Quote COT-0114 ---");
    if (!quote) {
      console.log("Quote not found!");
      return;
    }

    console.log("Quote Number:", quote.quoteNumber);
    console.log("Quote Status:", quote.status);
    console.log("Quote Warehouse:", quote.warehouse ? `${quote.warehouse.name} (ID: ${quote.warehouse.id})` : "None");
    
    console.log("\n--- Associated Order ---");
    if (!quote.order) {
      console.log("No order associated with this quote.");
    } else {
      console.log("Order ID:", quote.order.id);
      console.log("Order Status:", quote.order.status);
      console.log("Order Supplying Warehouse (warehouseId):", quote.order.warehouseId);
      console.log("Order Warehouse Details:", quote.order.warehouse ? `${quote.order.warehouse.name}` : "None");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
