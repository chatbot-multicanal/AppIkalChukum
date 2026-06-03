import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Obtener todas las bodegas activas
    const warehouses = await db.warehouse.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    });

    // 2. Obtener todos los productos y su stock por bodega para validaciones en el cliente
    const products = await db.product.findMany({
      where: { active: true },
      include: {
        inventory: true // Traemos el inventario para validar stock en tiempo real
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ warehouses, products });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
