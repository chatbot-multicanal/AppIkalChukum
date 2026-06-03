"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  color?: string;
  basePrice: number;
  costPrice?: number;
  initialStocks: Record<string, number>; // Record<warehouseId, quantity>
}

/**
 * Fetches all warehouses and all products with their stock levels.
 */
export async function getInventoryData() {
  try {
    const warehouses = await db.warehouse.findMany({
      orderBy: { createdAt: "asc" },
    });

    const products = await db.product.findMany({
      include: {
        inventory: true,
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      warehouses,
      products,
    };
  } catch (error: any) {
    console.error("Error in getInventoryData:", error);
    return {
      success: false,
      error: error.message || "Error al obtener datos de inventario",
      warehouses: [],
      products: [],
    };
  }
}

/**
 * Registers a new product and initializes its stock across all existing warehouses.
 */
export async function createProductAction(data: CreateProductInput) {
  try {
    // 1. Validaciones
    if (!data.sku || !data.name || data.basePrice <= 0) {
      throw new Error("El SKU, nombre y precio base son obligatorios y deben ser válidos.");
    }

    // Comprobar si ya existe el SKU
    const existingProduct = await db.product.findUnique({
      where: { sku: data.sku },
    });

    if (existingProduct) {
      throw new Error(`Ya existe un producto registrado con el SKU "${data.sku}".`);
    }

    // 2. Obtener todas las bodegas de la base de datos para asegurar integridad
    const warehouses = await db.warehouse.findMany();

    // 3. Crear el producto e inicializar inventarios en una transacción
    await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku: data.sku,
          name: data.name,
          description: data.description || null,
          color: data.color || null,
          basePrice: data.basePrice,
          costPrice: data.costPrice || null,
          active: true,
        },
      });

      // Crear el registro de inventario para cada bodega
      for (const wh of warehouses) {
        const qty = data.initialStocks[wh.id] || 0;
        await tx.inventory.create({
          data: {
            warehouseId: wh.id,
            productId: product.id,
            quantity: qty,
          },
        });
      }

      // 4. Crear log de auditoría
      await tx.auditLog.create({
        data: {
          entity: "Product",
          entityId: product.id,
          action: "CREATE",
          details: JSON.stringify({
            sku: product.sku,
            name: product.name,
            initialStocks: data.initialStocks,
          }),
        },
      });
    });

    // 5. Revalidar la vista de inventario
    revalidatePath("/inventario");

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error in createProductAction:", error);
    return {
      success: false,
      error: error.message || "Error interno al registrar el producto.",
    };
  }
}
