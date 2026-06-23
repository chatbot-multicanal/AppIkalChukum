import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const userRole = cookieStore.get("user_role")?.value;
  return userRole === "ADMIN";
}

// Helper recursivo para encontrar y convertir strings de fechas ISO en objetos Date
function parseDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(parseDates);
  }
  if (typeof obj === "object") {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      // Si es un string con formato de fecha ISO completo, lo convertimos
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
        newObj[key] = new Date(val);
      } else {
        newObj[key] = parseDates(val);
      }
    }
    return newObj;
  }
  return obj;
}

// POST /api/respaldos/restore - Restaurar base de datos
export async function POST(request: Request) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
    }

    const backupPayload = await request.json();
    if (!backupPayload || !backupPayload.data) {
      return NextResponse.json({ error: "Estructura de respaldo no válida." }, { status: 400 });
    }

    // Convertir todos los campos de fecha stringificados de vuelta a objetos Date
    const restoredData = parseDates(backupPayload.data);

    // Ejecutar en una transacción Prisma para asegurar consistencia
    await db.$transaction(async (tx) => {
      // 1. Limpiar tablas existentes en orden de dependencia para evitar FK constraint errors
      await tx.auditLog.deleteMany();
      await tx.comment.deleteMany();
      await tx.commission.deleteMany();
      await tx.order.deleteMany();
      await tx.quoteItem.deleteMany();
      await tx.quote.deleteMany();
      await tx.inventory.deleteMany();
      await tx.product.deleteMany();
      await tx.warehouse.deleteMany();
      await tx.user.deleteMany();
      await tx.client.deleteMany();
      await tx.systemSetting.deleteMany();

      // 2. Reinsertar datos en orden inverso para cumplir con las llaves foráneas
      if (restoredData.systemSettings && restoredData.systemSettings.length > 0) {
        await tx.systemSetting.createMany({ data: restoredData.systemSettings });
      }
      if (restoredData.clients && restoredData.clients.length > 0) {
        await tx.client.createMany({ data: restoredData.clients });
      }
      if (restoredData.warehouses && restoredData.warehouses.length > 0) {
        await tx.warehouse.createMany({ data: restoredData.warehouses });
      }
      if (restoredData.users && restoredData.users.length > 0) {
        await tx.user.createMany({ data: restoredData.users });
      }
      if (restoredData.products && restoredData.products.length > 0) {
        await tx.product.createMany({ data: restoredData.products });
      }
      if (restoredData.inventories && restoredData.inventories.length > 0) {
        await tx.inventory.createMany({ data: restoredData.inventories });
      }
      if (restoredData.quotes && restoredData.quotes.length > 0) {
        await tx.quote.createMany({ data: restoredData.quotes });
      }
      if (restoredData.quoteItems && restoredData.quoteItems.length > 0) {
        await tx.quoteItem.createMany({ data: restoredData.quoteItems });
      }
      if (restoredData.orders && restoredData.orders.length > 0) {
        await tx.order.createMany({ data: restoredData.orders });
      }
      if (restoredData.commissions && restoredData.commissions.length > 0) {
        await tx.commission.createMany({ data: restoredData.commissions });
      }
      if (restoredData.comments && restoredData.comments.length > 0) {
        await tx.comment.createMany({ data: restoredData.comments });
      }
      if (restoredData.auditLogs && restoredData.auditLogs.length > 0) {
        await tx.auditLog.createMany({ data: restoredData.auditLogs });
      }
    });

    // Registrar en auditoría el evento de restauración exitosa
    await db.auditLog.create({
      data: {
        entity: "System",
        entityId: "Restore",
        action: "UPDATE",
        details: JSON.stringify({ message: "Restauración de base de datos completada desde archivo de respaldo" })
      }
    });

    return NextResponse.json({ success: true, message: "Base de datos restaurada correctamente." });
  } catch (error: any) {
    console.error("Error en POST /api/respaldos/restore:", error);
    return NextResponse.json({ error: `Error de restauración: ${error.message}` }, { status: 500 });
  }
}
