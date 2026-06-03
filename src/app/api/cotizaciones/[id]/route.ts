import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// PATCH /api/cotizaciones/[id] - Actualizar estado de una cotización
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await request.json(); // APPROVED, SENT, REJECTED

    // Validar autorización a nivel backend (Solo ADMIN puede aprobar cotizaciones)
    if (status === "APPROVED") {
      const cookieStore = await cookies();
      const userRole = cookieStore.get("user_role")?.value;

      if (userRole !== "ADMIN") {
        return NextResponse.json(
          { error: "No autorizado. Solo el Administrador puede aprobar cotizaciones." },
          { status: 403 }
        );
      }
    }

    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!quote) {
      return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
    }

    // Si pasa a APPROVED, realizar un warning check del stock disponible
    let stockWarning = null;
    if (status === "APPROVED" && quote.warehouseId) {
      const warnings: string[] = [];
      
      for (const item of quote.items) {
        const inventory = await db.inventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: quote.warehouseId,
              productId: item.productId
            }
          },
          include: { product: true }
        });

        if (!inventory || inventory.quantity < item.quantity) {
          warnings.push(
            `El producto "${inventory?.product.name || item.productId}" tiene stock insuficiente (${inventory?.quantity || 0} sacos de ${item.quantity} solicitados)`
          );
        }
      }

      if (warnings.length > 0) {
        stockWarning = warnings.join(". ");
      }
    }

    // Actualizar estado de la cotización
    const updatedQuote = await db.quote.update({
      where: { id },
      data: { status }
    });

    // Registrar auditoría
    await db.auditLog.create({
      data: {
        entity: "Quote",
        entityId: id,
        action: "UPDATE",
        details: JSON.stringify({ message: `Estado actualizado a ${status}`, stockWarning })
      }
    });

    return NextResponse.json({ 
      success: true, 
      quote: updatedQuote, 
      warning: stockWarning // Retorna el warning si aplica
    });
  } catch (error: any) {
    console.error("Error en PATCH /api/cotizaciones/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
