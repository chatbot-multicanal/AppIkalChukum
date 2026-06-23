import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Auxiliar: Verificar si el usuario es ADMIN
async function verifyAdmin() {
  const cookieStore = await cookies();
  const userRole = cookieStore.get("user_role")?.value;
  return userRole === "ADMIN";
}

// GET /api/respaldos - Obtener lista de respaldos sin los datos pesados
export async function GET() {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
    }

    const backups = await db.backup.findMany({
      orderBy: { createdAt: "desc" }
    });

    // Mapear para no enviar la data pesada del JSON en la lista y calcular el tamaño
    const backupsList = backups.map(b => ({
      id: b.id,
      filename: b.filename,
      createdAt: b.createdAt,
      sizeBytes: b.data.length
    }));

    return NextResponse.json(backupsList);
  } catch (error: any) {
    console.error("Error en GET /api/respaldos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/respaldos - Crear un respaldo completo de la base de datos
export async function POST() {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
    }

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

    // 2. Generar nombre de archivo
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const filename = `respaldo_${dateStr}_${timeStr}.json`;

    // 3. Guardar en base de datos
    const backup = await db.backup.create({
      data: {
        filename,
        data: JSON.stringify(backupData)
      }
    });

    // Registrar en auditoría
    await db.auditLog.create({
      data: {
        entity: "System",
        entityId: backup.id,
        action: "CREATE",
        details: JSON.stringify({ message: `Respaldo manual creado con éxito: ${filename}` })
      }
    });

    return NextResponse.json({
      success: true,
      backup: {
        id: backup.id,
        filename: backup.filename,
        createdAt: backup.createdAt,
        sizeBytes: backup.data.length
      }
    });
  } catch (error: any) {
    console.error("Error en POST /api/respaldos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
