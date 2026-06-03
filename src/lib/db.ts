import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getClient = () => {
  let dbUrl = process.env.DATABASE_URL || "file:dev.db";
  
  // Si la ruta es relativa, la forzamos a la ruta absoluta de la bodega real para evitar apuntar a una BD vacía si se inicia desde otro CWD
  if (dbUrl === "file:./dev.db" || dbUrl === "file:dev.db") {
    dbUrl = "file:F:/AppIkalChukum/web/dev.db";
  }

  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
};

export const db = globalForPrisma.prisma ?? getClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

