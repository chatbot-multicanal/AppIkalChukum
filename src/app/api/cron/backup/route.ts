import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // En producción, Vercel envía un header de autorización Bearer con la clave secreta del cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return new Response("No autorizado", { status: 401 });
    }
  }

  try {
    // 1. Obtener todos los datos de todas las tablas
    const users = await db.user.findMany();
    const clients = await db.client.findMany();
    const warehouses = await db.warehouse.findMany();
    const products = await db.product.findMany();
    const inventories = await db.inventory.findMany();
    const quotes = await db.quote.findMany();
    const quoteItems = await db.quoteItem.findMany();
    const orders = await db.order.findMany();
    const commissions = await db.commission.findMany();
    const comments = await db.comment.findMany();
    const systemSettings = await db.systemSetting.findMany();
    const auditLogs = await db.auditLog.findMany();

    const backupData = {
      version: "2026.06",
      timestamp: new Date().toISOString(),
      data: {
        users,
        clients,
        warehouses,
        products,
        inventories,
        quotes,
        quoteItems,
        orders,
        commissions,
        comments,
        systemSettings,
        auditLogs
      }
    };

    // 2. Generar nombre de archivo automático semanal
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `respaldo_semanal_auto_${dateStr}.json`;

    // 3. Crear el respaldo
    const backup = await db.backup.create({
      data: {
        filename,
        data: JSON.stringify(backupData)
      }
    });

    // 4. Limpieza: Eliminar backups automáticos que tengan más de 35 días (5 semanas)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 35);

    const deleted = await db.backup.deleteMany({
      where: {
        filename: {
          startsWith: "respaldo_semanal_auto_"
        },
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    // Registrar en auditoría
    await db.auditLog.create({
      data: {
        entity: "System",
        entityId: backup.id,
        action: "CREATE",
        details: JSON.stringify({ 
          message: `Respaldo automático semanal creado: ${filename}. Se eliminaron ${deleted.count} respaldos obsoletos.` 
        })
      }
    });

    return NextResponse.json({
      success: true,
      filename,
      deletedCount: deleted.count
    });

  } catch (error: any) {
    console.error("Error en Cron Backup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
