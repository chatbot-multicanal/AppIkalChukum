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

      // Agrupar cantidades requeridas de cada SKU (Sacos y Bidón)
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

      // VALIDACIÓN: Stock suficiente de componentes (hard block)
      for (const [sku, req] of Object.entries(requiredQuantities)) {
        const product = await tx.product.findUnique({
          where: { sku }
        });

        if (!product) {
          throw new Error(`El componente con SKU "${sku}" no existe en el catálogo.`);
        }

        const inventory = await tx.inventory.findUnique({
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
          throw new Error(
            `STOCK INSUFICIENTE (Bloqueo): El componente "${req.name}" solo tiene ${stockAvailable} ${unitLabel} disponibles en esta bodega, pero se requieren ${req.qty} para surtir los kits.`
          );
        }
      }

      // DESCONTAR INVENTARIO DE COMPONENTES
      for (const [sku, req] of Object.entries(requiredQuantities)) {
        const product = await tx.product.findUnique({
          where: { sku }
        });
        
        if (product) {
          await tx.inventory.update({
            where: {
              warehouseId_productId: {
                warehouseId: quote.warehouseId,
                productId: product.id
              }
            },
            data: {
              quantity: {
                decrement: req.qty
              }
            }
          });
        }
      }

      // 3. Crear el Pedido
      await tx.order.create({
        data: {
          quoteId: quote.id,
          status: "PENDING",
          warehouseId: quote.warehouseId, // Asignar automáticamente la bodega de la cotización
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
