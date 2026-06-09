"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * Adjusts the stock of a product in a warehouse manually, validating permissions and logging to the AuditLog.
 */
export async function adjustStockAction(
  warehouseId: string,
  productId: string,
  quantityAdjustment: number,
  reason: string
) {
  try {
    // 1. Validar rol del usuario (Solo ADMIN o GERENTE pueden ajustar inventario)
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;

    if (userRole !== "ADMIN" && userRole !== "GERENTE") {
      throw new Error("No autorizado. Solo administradores o gerentes pueden ajustar inventario.");
    }

    if (isNaN(quantityAdjustment) || quantityAdjustment === 0) {
      throw new Error("El ajuste debe ser una cantidad numérica diferente de cero.");
    }

    // 2. Ejecutar ajuste en transacción
    const result = await db.$transaction(async (tx) => {
      // Obtener registro actual
      const inv = await tx.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId,
          },
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      if (!inv) {
        throw new Error("El registro de inventario no existe.");
      }

      const newQty = inv.quantity + quantityAdjustment;
      if (newQty < 0) {
        throw new Error(`Ajuste inválido. El stock restante no puede ser menor a cero (Stock actual: ${inv.quantity}, Ajuste: ${quantityAdjustment}).`);
      }

      // Actualizar cantidad
      const updated = await tx.inventory.update({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId,
          },
        },
        data: {
          quantity: newQty,
        },
      });

      // Crear log de auditoría
      await tx.auditLog.create({
        data: {
          entity: "Inventory",
          entityId: productId,
          action: "ADJUST_STOCK",
          details: JSON.stringify({
            message: `Ajuste manual de stock en ${inv.warehouse.name}: ${quantityAdjustment >= 0 ? "+" : ""}${quantityAdjustment} sacos de ${inv.product.name}.`,
            warehouseId,
            warehouseName: inv.warehouse.name,
            productId,
            productName: inv.product.name,
            productSku: inv.product.sku,
            adjustment: quantityAdjustment,
            previousQuantity: inv.quantity,
            newQuantity: newQty,
            reason: reason || "Ajuste manual",
          }),
        },
      });

      return updated;
    });

    // 3. Revalidar caches de Next.js
    revalidatePath("/inventario");
    revalidatePath("/");

    return {
      success: true,
      inventory: result,
    };
  } catch (error: any) {
    console.error("Error in adjustStockAction:", error);
    return {
      success: false,
      error: error.message || "Error al ajustar el inventario.",
    };
  }
}

/**
 * Fetches the audit history log for a specific product and warehouse.
 */
export async function getInventoryHistoryAction(warehouseId: string, productId: string) {
  try {
    // 1. Obtener la bodega y el producto para comparar por nombre/id en logs
    const warehouse = await db.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse) {
      throw new Error("La bodega seleccionada no existe.");
    }

    // 2. Obtener los logs de la entidad Inventory para este producto
    const logs = await db.auditLog.findMany({
      where: {
        entity: "Inventory",
        entityId: productId,
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Filtrar logs que involucren a esta bodega (ajustes directos o transferencias origen/destino)
    const history = logs
      .map((log) => {
        try {
          const details = JSON.parse(log.details || "{}");
          
          const isAdjustmentForThisWarehouse = 
            log.action === "ADJUST_STOCK" && details.warehouseId === warehouseId;
          
          const isTransferInvolvingThisWarehouse = 
            log.action === "UPDATE" && 
            (details.originWarehouse === warehouse.name || details.destinationWarehouse === warehouse.name);

          if (isAdjustmentForThisWarehouse || isTransferInvolvingThisWarehouse) {
            return {
              id: log.id,
              action: log.action,
              createdAt: log.createdAt,
              details,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter((h) => h !== null);

    return {
      success: true,
      history,
    };
  } catch (error: any) {
    console.error("Error in getInventoryHistoryAction:", error);
    return {
      success: false,
      error: error.message || "Error al obtener historial de inventario.",
      history: [],
    };
  }
}
