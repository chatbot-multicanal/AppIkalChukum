import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST /api/cotizaciones - Crear una nueva cotización
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { clientId, warehouseId, currency, exchangeRate, items, shippingCost: shipCost, deliveryMethod, discount: discVal, notes, shippingCarrier, shippingDuration, shippingQuoteStatus, shippingOptions } = data;

    // VALIDACIÓN: No cotización sin al menos 1 producto
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Una cotización debe tener al menos 1 producto" }, { status: 400 });
    }

    if (!clientId || !warehouseId) {
      return NextResponse.json({ error: "Cliente y Bodega son requeridos" }, { status: 400 });
    }

    // 1. Obtener datos del cliente y de la bodega
    const client = await db.client.findUnique({ where: { id: clientId } });
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
    const adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });

    if (!client || !warehouse || !adminUser) {
      return NextResponse.json({ error: "Datos inconsistentes (cliente, bodega o usuario admin no encontrados)" }, { status: 400 });
    }

    // VALIDACIÓN: Tipo de cambio requerido si moneda de cotización ≠ moneda de bodega
    const isUsdQuote = currency === "USD";
    const isUsdWarehouse = warehouse.country === "Estados Unidos" || warehouse.name.toLowerCase().includes("miami"); // Bodega Miami es USD, Mérida es MXN
    
    if (isUsdQuote && !isUsdWarehouse && (!exchangeRate || exchangeRate <= 0)) {
      return NextResponse.json({ error: "Se requiere tipo de cambio válido para cotizar en USD en esta bodega" }, { status: 400 });
    }

    // 2. Calcular montos
    let subtotal = 0;
    const quoteItemsData: { productId: string; quantity: number; unitPrice: number; total: number; }[] = [];

    for (const item of items) {
      const product = await db.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        return NextResponse.json({ error: `Producto con ID ${item.productId} no encontrado` }, { status: 400 });
      }
      
      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;

      quoteItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemTotal
      });
    }

    const discount = parseFloat(discVal || 0) || 0;
    const shippingCost = deliveryMethod === "RECOLECTA" ? 0 : (parseFloat(shipCost || 0) || 0);

    let tax = 0;
    let total = 0;

    if (isUsdWarehouse) {
      // Miami/USD logic: Shipping is part of subtotal, no tax (IVA = 0)
      const amountBeforeDiscount = subtotal + shippingCost;
      tax = 0;
      total = Math.max(0, amountBeforeDiscount - discount);
    } else {
      // Mexico/MXN logic: Discount on products, then add shipping, then 16% IVA
      const baseSubtotal = Math.max(0, subtotal - discount) + shippingCost;
      tax = baseSubtotal * 0.16;
      total = baseSubtotal + tax;
    }


    // 3. Generar número de cotización
    const count = await db.quote.count();
    const cleanClientName = client.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15);
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const quoteNumber = `COT-${String(count + 101).padStart(4, "0")}-${cleanClientName}-${dateStr}`;

    // 4. Crear cotización y sus ítems en una transacción
    const quote = await db.$transaction(async (tx) => {
      return await tx.quote.create({
        data: {
          quoteNumber,
          clientId,
          userId: adminUser.id, // Asignado a Admin por simplicidad
          warehouseId,
          status: "DRAFT", // Estado inicial
          currency,
          exchangeRate: exchangeRate || 1.0,
          subtotal,
          shippingCost,
          discount,
          tax,
          total,
          deliveryMethod: deliveryMethod || "ENVIO",
          notes: notes || null,
          shippingCarrier: shippingCarrier || null,
          shippingDuration: shippingDuration || null,
          shippingQuoteStatus: shippingQuoteStatus || "NONE",
          shippingOptions: shippingOptions || null,
          items: {
            create: quoteItemsData
          }
        },
        include: {
          items: true
        }
      });
    });

    // Registrar auditoría
    await db.auditLog.create({
      data: {
        entity: "Quote",
        entityId: quote.id,
        action: "CREATE",
        details: JSON.stringify({ message: "Cotización creada como pendiente de aprobación", quoteNumber })
      }
    });

    return NextResponse.json({ success: true, quote });
  } catch (error: any) {
    console.error("Error en POST /api/cotizaciones:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
