import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await request.json();

    // Validar autorización a nivel backend (Solo ADMIN o GERENTE pueden cambiar estados de pedidos)
    const { cookies } = require("next/headers");
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;

    if (userRole !== "ADMIN" && userRole !== "GERENTE") {
      return NextResponse.json(
        { error: "No autorizado. Solo administradores o gerentes pueden modificar pedidos." },
        { status: 403 }
      );
    }

    // 1. Buscar el pedido junto con su cotización e ítems
    const order = await db.order.findUnique({
      where: { id },
      include: {
        quote: {
          include: {
            items: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const previousStatus = order.status;

    // Si no hay cambios en el estado, retornar el pedido
    if (previousStatus === status) {
      return NextResponse.json({ success: true, order });
    }

    // 2. Ejecutar transacciones de base de datos según el cambio de estado
    await db.$transaction(async (tx) => {
      // --- AUTOMATIZACIÓN 1: Pedido -> Entregado (DELIVERED) ---
      if (status === "DELIVERED" && previousStatus !== "DELIVERED") {
        // Obtener la tasa de comisión global actual de los ajustes
        const setting = await tx.systemSetting.findUnique({
          where: { key: "commission_rate" }
        });
        const rate = setting ? parseFloat(setting.value) : 3.0;

        // Calcular comisión del vendedor: tasa % del subtotal de la cotización
        const commissionAmount = order.quote.subtotal * (rate / 100);
        
        // Crear o actualizar registro de comisión
        await tx.commission.upsert({
          where: { quoteId: order.quoteId },
          create: {
            quoteId: order.quoteId,
            userId: order.quote.userId,
            amount: commissionAmount,
            status: "PENDING",
            scheduledDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // Programada en 15 días
          },
          update: {
            amount: commissionAmount,
            status: "PENDING",
            scheduledDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
          }
        });

        // Registrar auditoría
        await tx.auditLog.create({
          data: {
            entity: "Order",
            entityId: order.id,
            action: "UPDATE",
            details: JSON.stringify({ message: "Pedido entregado. Comisión de vendedor creada.", commissionAmount })
          }
        });
      }

      // --- AUTOMATIZACIÓN 2: Pedido Cancelado (CANCELLED) ---
      if (status === "CANCELLED" && previousStatus !== "CANCELLED") {
        // A. Reingresar inventario (devolver stock de los kits a la bodega original)
        if (order.quote.warehouseId) {
          for (const item of order.quote.items) {
            // Incrementar cantidad de stock
            await tx.inventory.update({
              where: {
                warehouseId_productId: {
                  warehouseId: order.quote.warehouseId,
                  productId: item.productId
                }
              },
              data: {
                quantity: {
                  increment: item.quantity
                }
              }
            });
          }
        }

        // B. Anular comisión si existía
        await tx.commission.updateMany({
          where: { quoteId: order.quoteId },
          data: {
            status: "CANCELLED"
          }
        });

        // Registrar auditoría
        await tx.auditLog.create({
          data: {
            entity: "Order",
            entityId: order.id,
            action: "UPDATE",
            details: JSON.stringify({ message: "Pedido cancelado. Inventario reingresado y comisión anulada." })
          }
        });
      }

      // --- Si pasa de CANCELLED a otra cosa (ej: PENDING o SHIPPED) ---
      if (previousStatus === "CANCELLED" && status !== "CANCELLED") {
        // Volver a descontar inventario (verificación de stock)
        if (order.quote.warehouseId) {
          for (const item of order.quote.items) {
            const inventory = await tx.inventory.findUnique({
              where: {
                warehouseId_productId: {
                  warehouseId: order.quote.warehouseId,
                  productId: item.productId
                }
              }
            });

            if (!inventory || inventory.quantity < item.quantity) {
              throw new Error(`Stock insuficiente en bodega para reabrir el pedido: ${item.productId}`);
            }

            await tx.inventory.update({
              where: {
                warehouseId_productId: {
                  warehouseId: order.quote.warehouseId,
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
        }
      }

      // 3. Actualizar el estado del pedido
      await tx.order.update({
        where: { id },
        data: {
          status,
          deliveredAt: status === "DELIVERED" ? new Date() : undefined
        }
      });
    });

    return NextResponse.json({ success: true, message: `Estado de pedido actualizado a ${status}` });
  } catch (error: any) {
    console.error("Error en PATCH /api/pedidos/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al procesar la actualización" }, { status: 500 });
  }
}
