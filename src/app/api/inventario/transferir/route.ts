import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    // Validar autorización a nivel backend (Solo ADMIN puede transferir inventario)
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;

    if (userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "No autorizado. Solo el Administrador puede realizar transferencias de bodega." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { productId, originWarehouseId, destinationWarehouseId, quantity } = body;

    // 1. Validar campos
    if (!productId || !originWarehouseId || !destinationWarehouseId || quantity === undefined) {
      return NextResponse.json(
        { error: "El producto, bodega origen, bodega destino y cantidad son requeridos." },
        { status: 400 }
      );
    }

    const transferQty = parseFloat(quantity);
    if (isNaN(transferQty) || transferQty <= 0) {
      return NextResponse.json(
        { error: "La cantidad a transferir debe ser un número mayor a cero." },
        { status: 400 }
      );
    }

    if (originWarehouseId === destinationWarehouseId) {
      return NextResponse.json(
        { error: "La bodega de origen y destino no pueden ser la misma." },
        { status: 400 }
      );
    }

    // 2. Verificar existencia de stock en origen
    const originStock = await db.inventory.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: originWarehouseId,
          productId,
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
    });

    if (!originStock || originStock.quantity < transferQty) {
      return NextResponse.json(
        {
          error: `Stock insuficiente en la bodega de origen. Disponible: ${
            originStock ? originStock.quantity.toFixed(1) : "0.0"
          } unidades.`,
        },
        { status: 400 }
      );
    }

    const destinationWarehouse = await db.warehouse.findUnique({
      where: { id: destinationWarehouseId },
    });

    if (!destinationWarehouse) {
      return NextResponse.json(
        { error: "Bodega de destino no encontrada." },
        { status: 400 }
      );
    }

    // 3. Ejecutar la transferencia en una transacción ACID
    await db.$transaction(async (tx) => {
      // A. Restar de la bodega origen
      await tx.inventory.update({
        where: {
          warehouseId_productId: {
            warehouseId: originWarehouseId,
            productId,
          },
        },
        data: {
          quantity: {
            decrement: transferQty,
          },
        },
      });

      // B. Sumar a la bodega destino (usar upsert para prevenir inconsistencias de stock)
      await tx.inventory.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: destinationWarehouseId,
            productId,
          },
        },
        create: {
          warehouseId: destinationWarehouseId,
          productId,
          quantity: transferQty,
        },
        update: {
          quantity: {
            increment: transferQty,
          },
        },
      });

      // C. Registrar auditoría
      await tx.auditLog.create({
        data: {
          entity: "Inventory",
          entityId: productId,
          action: "UPDATE",
          details: JSON.stringify({
            message: "Transferencia de mercancía realizada con éxito",
            productSku: originStock.product.sku,
            originWarehouse: originStock.warehouse.name,
            destinationWarehouse: destinationWarehouse.name,
            quantity: transferQty,
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Transferencia de stock completada exitosamente.",
    });
  } catch (error: any) {
    console.error("Error en POST /api/inventario/transferir:", error);
    return NextResponse.json(
      { error: error.message || "Ocurrió un error al procesar la transferencia" },
      { status: 500 }
    );
  }
}
