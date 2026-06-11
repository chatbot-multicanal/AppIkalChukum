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
        items: {
          include: { product: true }
        }
      }
    });

    if (!quote) {
      return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
    }

    // Si pasa a APPROVED, realizar un warning check del stock disponible de componentes físicos
    let stockWarning = null;
    if (status === "APPROVED" && quote.warehouseId) {
      const warnings: string[] = [];
      const requiredQuantities: Record<string, { qty: number; name: string }> = {};

      for (const item of quote.items) {
        const sku = item.product.sku;
        if (sku.startsWith("KIT-")) {
          const sacoSku = sku.replace("KIT-", "SACO-");
          const bidonSku = "BIDON-RES-001";

          requiredQuantities[sacoSku] = {
            qty: (requiredQuantities[sacoSku]?.qty || 0) + item.quantity * 3,
            name: item.product.name.replace("Kit", "Saco")
          };
          requiredQuantities[bidonSku] = {
            qty: (requiredQuantities[bidonSku]?.qty || 0) + item.quantity * 1,
            name: "Bidón Resina"
          };
        } else {
          requiredQuantities[sku] = {
            qty: (requiredQuantities[sku]?.qty || 0) + item.quantity,
            name: item.product.name
          };
        }
      }

      for (const [sku, req] of Object.entries(requiredQuantities)) {
        const product = await db.product.findUnique({
          where: { sku }
        });

        if (!product) {
          warnings.push(`El componente con SKU "${sku}" no existe en el catálogo`);
          continue;
        }

        const inventory = await db.inventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: quote.warehouseId,
              productId: product.id
            }
          }
        });

        const stockAvailable = inventory ? inventory.quantity : 0;

        if (stockAvailable < req.qty) {
          const unitLabel = sku.startsWith("BIDON-") ? "bidones" : "sacos";
          warnings.push(
            `El componente "${req.name}" tiene stock insuficiente (${stockAvailable} ${unitLabel} de ${req.qty} requeridos)`
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
