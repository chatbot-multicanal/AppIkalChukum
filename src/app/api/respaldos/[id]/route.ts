import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const userRole = cookieStore.get("user_role")?.value;
  return userRole === "ADMIN";
}

// GET /api/respaldos/[id] - Descargar backup completo
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
    }

    const { id } = await params;

    const backup = await db.backup.findUnique({
      where: { id }
    });

    if (!backup) {
      return NextResponse.json({ error: "Respaldo no encontrado" }, { status: 404 });
    }

    // Retorna la data stringificada como JSON directo para descarga
    return new Response(backup.data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${backup.filename}"`
      }
    });
  } catch (error: any) {
    console.error("Error en GET /api/respaldos/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/respaldos/[id] - Eliminar registro de backup
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
    }

    const { id } = await params;

    const backup = await db.backup.findUnique({
      where: { id }
    });

    if (!backup) {
      return NextResponse.json({ error: "Respaldo no encontrado" }, { status: 404 });
    }

    await db.backup.delete({
      where: { id }
    });

    // Registrar en auditoría
    await db.auditLog.create({
      data: {
        entity: "System",
        entityId: id,
        action: "DELETE",
        details: JSON.stringify({ message: `Respaldo eliminado de base de datos: ${backup.filename}` })
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error en DELETE /api/respaldos/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
