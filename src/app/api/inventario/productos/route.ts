import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    // Validar autorización a nivel backend (Solo ADMIN puede crear productos)
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;

    if (userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "No autorizado. Solo el Administrador puede agregar productos." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, sku, color, basePrice, costPrice, description } = body;

    // Validar campos requeridos
    if (!name || !sku || basePrice === undefined) {
      return NextResponse.json(
        { error: "El nombre, SKU y precio base son requeridos." },
        { status: 400 }
      );
    }

    // Validar que el SKU sea único
    const existingProduct = await db.product.findUnique({
      where: { sku: sku.toUpperCase().trim() },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: `Ya existe un producto registrado con el SKU: ${sku.toUpperCase().trim()}` },
        { status: 400 }
      );
    }

    // Crear el producto e inicializar el stock en 0 para todas las bodegas en una transacción
    const product = await db.$transaction(async (tx) => {
      // 1. Crear el producto
      const newProduct = await tx.product.create({
        data: {
          name: name.trim(),
          sku: sku.toUpperCase().trim(),
          color: color ? color.trim() : null,
          basePrice: parseFloat(basePrice),
          costPrice: costPrice ? parseFloat(costPrice) : null,
          description: description ? description.trim() : null,
          active: true,
        },
      });

      // 2. Obtener todas las bodegas
      const warehouses = await tx.warehouse.findMany({
        where: { active: true },
      });

      // 3. Crear registro de stock = 0 para cada bodega
      for (const wh of warehouses) {
        await tx.inventory.create({
          data: {
            warehouseId: wh.id,
            productId: newProduct.id,
            quantity: 0.0,
          },
        });
      }

      // 4. Crear registro de auditoría
      await tx.auditLog.create({
        data: {
          entity: "Product",
          entityId: newProduct.id,
          action: "CREATE",
          details: JSON.stringify({ message: "Producto creado e inventario inicializado en 0 para todas las bodegas", sku: newProduct.sku }),
        },
      });

      return newProduct;
    });

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error("Error en POST /api/inventario/productos:", error);
    return NextResponse.json(
      { error: error.message || "Ocurrió un error al registrar el producto" },
      { status: 500 }
    );
  }
}
