"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * Fetches all orders, populated with quotes, items, client, and warehouse details.
 */
export async function getOrdersAction() {
  try {
    const orders = await db.order.findMany({
      include: {
        warehouse: true,
        quote: {
          include: {
            client: true,
            user: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      orders,
    };
  } catch (error: any) {
    console.error("Error in getOrdersAction:", error);
    return {
      success: false,
      error: error.message || "Error al obtener pedidos.",
      orders: [],
    };
  }
}

/**
 * Fetches active warehouses to let users choose which one will fulfill the order.
 */
export async function getActiveWarehousesAction() {
  try {
    const warehouses = await db.warehouse.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return {
      success: true,
      warehouses,
    };
  } catch (error: any) {
    console.error("Error in getActiveWarehousesAction:", error);
    return {
      success: false,
      error: error.message || "Error al obtener bodegas activas.",
      warehouses: [],
    };
  }
}

/**
 * Transitions order status and manages warehouse stock and salesperson commissions.
 */
export async function updateOrderStatusAction(
  orderId: string,
  newStatus: "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
  warehouseId?: string
) {
  try {
    // Validar autorización a nivel backend (Solo ADMIN o GERENTE pueden cambiar estados de pedidos)
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;

    if (userRole !== "ADMIN" && userRole !== "GERENTE") {
      throw new Error("No autorizado. Solo administradores o gerentes pueden modificar pedidos.");
    }

    // 1. Fetch current order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        quote: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error("El pedido solicitado no existe.");
    }

    if (order.status === newStatus) {
      return { success: true };
    }

    // 2. Perform actions inside transaction
    await db.$transaction(async (tx) => {
      
      // LÓGICA DE STOCK: Al pasar a PREPARING (Iniciar Preparación)
      if (newStatus === "PREPARING") {
        if (!warehouseId) {
          throw new Error("Se debe seleccionar una bodega para iniciar la preparación.");
        }

        // Evitar doble deducción de stock
        if (order.status !== "PENDING") {
          throw new Error("Este pedido ya ha salido del estado pendiente y sus existencias fueron descontadas.");
        }

        // Descontar inventario por cada ítem en la cotización
        for (const item of order.quote.items) {
          const inv = await tx.inventory.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: warehouseId,
                productId: item.productId,
              },
            },
          });

          if (!inv || inv.quantity < item.quantity) {
            throw new Error(
              `Stock insuficiente para el producto "${item.product.name}" en la bodega seleccionada. Stock disponible: ${inv?.quantity || 0}, Requerido: ${item.quantity}.`
            );
          }

          // Restar cantidad
          await tx.inventory.update({
            where: {
              warehouseId_productId: {
                warehouseId: warehouseId,
                productId: item.productId,
              },
            },
            data: {
              quantity: { decrement: item.quantity },
            },
          });
        }

        // Asignar bodega y actualizar estatus
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            warehouseId: warehouseId,
          },
        });
      }
      
      // LÓGICA DE RETORNO DE STOCK: Si se CANCELA habiendo estado en preparación o enviado
      else if (newStatus === "CANCELLED") {
        const wasDeducted = order.status === "PREPARING" || order.status === "SHIPPED";
        const wId = order.warehouseId;

        if (wasDeducted && wId) {
          // Devolver sacos al inventario
          for (const item of order.quote.items) {
            await tx.inventory.update({
              where: {
                warehouseId_productId: {
                  warehouseId: wId,
                  productId: item.productId,
                },
              },
              data: {
                quantity: { increment: item.quantity },
              },
            });
          }
        }

        // Si existía comisión, la cancelamos
        await tx.commission.updateMany({
          where: { quoteId: order.quoteId },
          data: {
            status: "CANCELLED"
          }
        });

        await tx.order.update({
          where: { id: orderId },
          data: { status: newStatus },
        });
      }
      
      // LÓGICA DE COMISIONES: Al pasar a DELIVERED (Entregado)
      else if (newStatus === "DELIVERED") {
        if (order.status === "CANCELLED") {
          throw new Error("No se puede entregar un pedido que ha sido cancelado.");
        }

        // Obtener la tasa de comisión global actual de los ajustes o defecto 3%
        const setting = await tx.systemSetting.findUnique({
          where: { key: "commission_rate" }
        });
        const rate = setting ? parseFloat(setting.value) : 3.0;

        // Calcular comisión: rate% del subtotal de la cotización
        const commissionAmount = order.quote.subtotal * (rate / 100);
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 15); // Cobro en 15 días

        // Crear o actualizar la comisión en base de datos
        await tx.commission.upsert({
          where: { quoteId: order.quoteId },
          create: {
            quoteId: order.quoteId,
            userId: order.quote.userId,
            amount: commissionAmount,
            status: "PENDING",
            scheduledDate: scheduledDate,
          },
          update: {
            amount: commissionAmount,
            status: "PENDING",
            scheduledDate: scheduledDate,
          }
        });

        // Actualizar estatus del pedido y registrar fecha de entrega
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            deliveredAt: new Date(),
          },
        });
      }
      
      // Para cualquier otro cambio de estatus estándar (ej. SHIPPED)
      else {
        await tx.order.update({
          where: { id: orderId },
          data: { status: newStatus },
        });
      }

      // 3. Crear registro en la bitácora de auditoría
      await tx.auditLog.create({
        data: {
          entity: "Order",
          entityId: orderId,
          action: `UPDATE_STATUS_${newStatus}`,
          details: JSON.stringify({
            previousStatus: order.status,
            newStatus: newStatus,
            warehouseId: warehouseId || order.warehouseId,
          }),
        },
      });
    });

    // 4. Revalidar vistas
    revalidatePath("/pedidos");
    revalidatePath("/inventario");
    revalidatePath("/cotizaciones");
    revalidatePath("/");

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error in updateOrderStatusAction:", error);
    return {
      success: false,
      error: error.message || "Error al actualizar el estado del pedido.",
    };
  }
}
