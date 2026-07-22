import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// DELETE /api/finanzas/[id] - Eliminar un registro financiero manual (Solo ADMIN)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;
    const userId = cookieStore.get("user_session")?.value;

    if (userRole !== "ADMIN" || !userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo el Administrador puede eliminar registros financieros." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const record = await db.financeRecord.findUnique({
      where: { id }
    });

    if (!record) {
      return NextResponse.json({ error: "Registro financiero no encontrado." }, { status: 404 });
    }

    await db.financeRecord.delete({
      where: { id }
    });

    // Registrar en auditoría
    await db.auditLog.create({
      data: {
        entity: "FinanceRecord",
        entityId: id,
        action: "DELETE",
        userId,
        details: JSON.stringify({ deletedRecord: record })
      }
    });

    return NextResponse.json({ success: true, message: "Registro financiero eliminado con éxito." });

  } catch (error: any) {
    console.error("Error en DELETE /api/finanzas/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
