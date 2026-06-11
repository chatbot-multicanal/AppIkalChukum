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
    const allProducts = await db.product.findMany({
      where: { active: true },
      include: {
        inventory: true // Traemos el inventario para validar stock en tiempo real
      },
      orderBy: { name: "asc" }
    });

    // Separar componentes
    const sacos = allProducts.filter(p => p.sku.startsWith("SACO-"));
    const bidon = allProducts.find(p => p.sku === "BIDON-RES-001");

    // Filtrar los componentes físicos para que no se puedan cotizar directamente
    const products = allProducts.filter(p => !p.sku.startsWith("SACO-") && p.sku !== "BIDON-RES-001");

    // Calcular el stock virtual para cada Kit
    for (const kit of products) {
      if (kit.sku.startsWith("KIT-")) {
        const sacoSku = kit.sku.replace("KIT-", "SACO-");
        const matchingSaco = sacos.find(s => s.sku === sacoSku);
        
        const virtualInventory = [];

        for (const wh of warehouses) {
          const sacoInv = matchingSaco?.inventory.find(i => i.warehouseId === wh.id);
          const sacoStock = sacoInv ? sacoInv.quantity : 0;

          const bidonInv = bidon?.inventory.find(i => i.warehouseId === wh.id);
          const bidonStock = bidonInv ? bidonInv.quantity : 0;

          // Virtual kit stock = Math.min( Math.floor(sacoStock / 3), bidonStock )
          const virtualStock = Math.min(Math.floor(sacoStock / 3), bidonStock);

          virtualInventory.push({
            id: `virtual-${kit.sku}-${wh.id}`,
            warehouseId: wh.id,
            productId: kit.id,
            quantity: virtualStock,
            updatedAt: new Date()
          });
        }

        kit.inventory = virtualInventory as any;
      }
    }

    return NextResponse.json({ warehouses, products });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
