import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST /api/cotizaciones/[id]/pedido - Convertir cotización aprobada en Pedido
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Obtener la cotización con sus ítems
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

    // VALIDACIÓN: No pedido sin cotización aprobada
    if (quote.status !== "APPROVED") {
      return NextResponse.json({ error: "No se puede crear un pedido desde una cotización que no esté Aprobada" }, { status: 400 });
    }

    // VALIDACIÓN: No duplicar pedido por cotización
    const existingOrder = await db.order.findUnique({
      where: { quoteId: id }
    });

    if (existingOrder) {
      return NextResponse.json({ error: "Ya existe un pedido asociado a esta cotización" }, { status: 400 });
    }

    // 2. Realizar validación de stock y descuento en una transacción
    await db.$transaction(async (tx) => {
      if (!quote.warehouseId) {
        throw new Error("La cotización no tiene una bodega asignada.");
      }

      // VALIDACIÓN: Stock suficiente al crear pedido (hard block)
      for (const item of quote.items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: quote.warehouseId,
              productId: item.productId
            }
          }
        });

        const stockAvailable = inventory ? inventory.quantity : 0;

        if (stockAvailable < item.quantity) {
          throw new Error(
            `STOCK INSUFICIENTE (Bloqueo): El producto "${item.product.name}" solo tiene ${stockAvailable} sacos disponibles en esta bodega, pero se solicitaron ${item.quantity}.`
          );
        }

        // DESCONTAR INVENTARIO
        await tx.inventory.update({
          where: {
            warehouseId_productId: {
              warehouseId: quote.warehouseId,
              productId: item.productId
            }
          },
          data: {
            quantity: {
              decrement: item.quantity
            }
          }
        });
      }

      // 3. Crear el Pedido
      await tx.order.create({
        data: {
          quoteId: quote.id,
          status: "PENDING",
          scheduledDeliveryAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Programado en 3 días
        }
      });

      // Registrar auditoría
      await tx.auditLog.create({
        data: {
          entity: "Order",
          entityId: quote.id,
          action: "CREATE",
          details: JSON.stringify({ message: "Pedido creado y stock descontado con éxito" })
        }
      });
    });

    return NextResponse.json({ success: true, message: "Pedido creado exitosamente e inventario descontado." });
  } catch (error: any) {
    console.error("Error al crear pedido de cotización:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
