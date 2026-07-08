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

    // 1. Buscar el pedido junto con su cotización e ítems (incluyendo producto)
    const order = await db.order.findUnique({
      where: { id },
      include: {
        quote: {
          include: {
            client: true,
            items: {
              include: { product: true }
            }
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
        const commissionUserId = order.quote.client.userId || order.quote.userId;
        
        // Crear o actualizar registro de comisión
        await tx.commission.upsert({
          where: { quoteId: order.quoteId },
          create: {
            quoteId: order.quoteId,
            userId: commissionUserId,
            amount: commissionAmount,
            status: "PENDING",
            scheduledDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // Programada en 15 días
          },
          update: {
            userId: commissionUserId,
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
        // A. Reingresar inventario (devolver stock de componentes)
        const targetWarehouseId = (previousStatus === "PREPARING" || previousStatus === "SHIPPED") 
          ? order.warehouseId 
          : order.quote.warehouseId;

        if (targetWarehouseId) {
          // Agrupar cantidades requeridas de cada SKU (Sacos y Bidón)
          const requiredQuantities: Record<string, number> = {};

          for (const item of order.quote.items) {
            const sku = item.product.sku;
            if (sku.startsWith("KIT-")) {
              const sacoSku = sku.replace("KIT-", "SACO-");
              const bidonSku = "BIDON-RES-001";

              requiredQuantities[sacoSku] = (requiredQuantities[sacoSku] || 0) + item.quantity * 3;
              requiredQuantities[bidonSku] = (requiredQuantities[bidonSku] || 0) + item.quantity * 1;
            } else {
              requiredQuantities[sku] = (requiredQuantities[sku] || 0) + item.quantity;
            }
          }

          for (const [sku, qty] of Object.entries(requiredQuantities)) {
            const product = await tx.product.findUnique({ where: { sku } });
            if (product) {
              await tx.inventory.update({
                where: {
                  warehouseId_productId: {
                    warehouseId: targetWarehouseId,
                    productId: product.id,
                  },
                },
                data: {
                  quantity: { increment: qty },
                },
              });
            }
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
            details: JSON.stringify({ message: "Pedido cancelado. Inventario de componentes reingresado y comisión anulada." })
          }
        });
      }

      // --- Si pasa de CANCELLED a otra cosa (ej: PENDING o SHIPPED) ---
      if (previousStatus === "CANCELLED" && status !== "CANCELLED") {
        // Volver a descontar inventario (verificación de stock de componentes)
        const targetWarehouseId = (status === "PREPARING" || status === "SHIPPED") && order.warehouseId
          ? order.warehouseId
          : order.quote.warehouseId;

        if (targetWarehouseId) {
          // Agrupar cantidades requeridas de cada SKU (Sacos y Bidón)
          const requiredQuantities: Record<string, { qty: number; name: string }> = {};

          for (const item of order.quote.items) {
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

          // Validar stock
          for (const [sku, req] of Object.entries(requiredQuantities)) {
            const product = await tx.product.findUnique({ where: { sku } });
            if (!product) {
              throw new Error(`El componente con SKU "${sku}" no existe en el catálogo.`);
            }

            const inv = await tx.inventory.findUnique({
              where: {
                warehouseId_productId: {
                  warehouseId: targetWarehouseId,
                  productId: product.id,
                },
              },
            });

            const stockAvailable = inv ? inv.quantity : 0;
            if (stockAvailable < req.qty) {
              const unitLabel = sku.startsWith("BIDON-") ? "bidones" : "sacos";
              throw new Error(
                `Stock insuficiente para reabrir el pedido. Falta componente "${req.name}". Disponible: ${stockAvailable} ${unitLabel}, Requerido: ${req.qty}.`
              );
            }
          }

          // Descontar stock
          for (const [sku, req] of Object.entries(requiredQuantities)) {
            const product = await tx.product.findUnique({ where: { sku } });
            if (product) {
              await tx.inventory.update({
                where: {
                  warehouseId_productId: {
                    warehouseId: targetWarehouseId,
                    productId: product.id,
                  },
                },
                data: {
                  quantity: { decrement: req.qty },
                },
              });
            }
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
