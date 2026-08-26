import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Helper para formatear meses en español
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// GET /api/finanzas - Obtener reportes y resúmenes financieros (Solo ADMIN)
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;

    if (userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "No autorizado. Solo el Administrador puede ver los datos financieros." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get("months") || "6"; // Por defecto, últimos 6 meses
    const limitMonths = parseInt(monthsParam);
    const warehouseQuery = searchParams.get("warehouseId") || "ALL";

    const manualWhere: any = {};
    const quoteWhere: any = { status: "APPROVED" };

    if (warehouseQuery !== "ALL") {
      if (warehouseQuery === "GLOBAL" || warehouseQuery === "NONE") {
        manualWhere.warehouseId = null;
        quoteWhere.warehouseId = null;
      } else {
        manualWhere.warehouseId = warehouseQuery;
        quoteWhere.warehouseId = warehouseQuery;
      }
    }

    // 1. Obtener todos los registros financieros manuales
    const manualRecords = await db.financeRecord.findMany({
      where: manualWhere,
      include: {
        warehouse: {
          select: { name: true }
        },
        user: {
          select: { name: true }
        }
      },
      orderBy: { date: "desc" }
    });

    // 2. Obtener todas las cotizaciones aprobadas (Ventas automáticas)
    const approvedQuotes = await db.quote.findMany({
      where: quoteWhere,
      include: {
        warehouse: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // 3. Cálculos de Resumen General (Unificados a MXN usando el exchangeRate)
    let salesIncome = 0;
    approvedQuotes.forEach((quote) => {
      salesIncome += quote.total * quote.exchangeRate;
    });

    let manualIncome = 0;
    let totalExpenses = 0;

    manualRecords.forEach((record) => {
      const convertedAmount = record.amount * record.exchangeRate;
      if (record.type === "INCOME") {
        manualIncome += convertedAmount;
      } else if (record.type === "EXPENSE") {
        totalExpenses += convertedAmount;
      }
    });

    const totalIncome = salesIncome + manualIncome;
    const netProfit = totalIncome - totalExpenses;

    // 4. Agrupación mensual para la gráfica histórica (Últimos N meses)
    const chartDataMap: Record<string, { monthKey: string; monthLabel: string; income: number; expense: number; orderIndex: number }> = {};
    
    // Inicializar los últimos N meses en el mapa para garantizar que salgan en orden
    const now = new Date();
    for (let i = limitMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[month]} ${String(year).slice(-2)}`;
      chartDataMap[key] = {
        monthKey: key,
        monthLabel: label,
        income: 0,
        expense: 0,
        orderIndex: i
      };
    }

    // Sumar ventas automáticas a la gráfica mensual
    approvedQuotes.forEach((quote) => {
      const date = new Date(quote.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (chartDataMap[key]) {
        chartDataMap[key].income += quote.total * quote.exchangeRate;
      }
    });

    // Sumar registros manuales (ingresos/gastos) a la gráfica mensual
    manualRecords.forEach((record) => {
      const date = new Date(record.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (chartDataMap[key]) {
        const converted = record.amount * record.exchangeRate;
        if (record.type === "INCOME") {
          chartDataMap[key].income += converted;
        } else if (record.type === "EXPENSE") {
          chartDataMap[key].expense += converted;
        }
      }
    });

    // Convertir mapa de gráfica a array ordenado cronológicamente
    const chartData = Object.values(chartDataMap).sort((a, b) => b.orderIndex - a.orderIndex);

    // 5. Agrupación por categoría de gastos (breakdown) en MXN
    const categoryBreakdownMap: Record<string, number> = {
      RENTA: 0,
      SUELDOS: 0,
      MATERIALES: 0,
      SERVICIOS: 0,
      IMPUESTOS: 0,
      BODEGA_OPERACION: 0,
      OTROS: 0
    };

    manualRecords.forEach((record) => {
      if (record.type === "EXPENSE") {
        const converted = record.amount * record.exchangeRate;
        if (categoryBreakdownMap[record.category] !== undefined) {
          categoryBreakdownMap[record.category] += converted;
        } else {
          categoryBreakdownMap.OTROS += converted;
        }
      }
    });

    const categoryBreakdown = Object.entries(categoryBreakdownMap).map(([category, value]) => ({
      category,
      value
    }));

    // Obtener todas las bodegas activas
    const warehouses = await db.warehouse.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    });

    // Calcular valor de inventario de producto en bodega (kits de componentes)
    let inventoryWhere: any = {};
    if (warehouseQuery !== "ALL") {
      if (warehouseQuery === "GLOBAL" || warehouseQuery === "NONE") {
        inventoryWhere.warehouseId = "NONE";
      } else {
        inventoryWhere.warehouseId = warehouseQuery;
      }
    }

    const inventoryItems = await db.inventory.findMany({
      where: inventoryWhere,
      include: {
        product: {
          select: {
            sku: true,
            name: true,
            basePrice: true
          }
        },
        warehouse: {
          select: {
            name: true,
            country: true
          }
        }
      }
    });

    const itemsByWarehouse: Record<string, typeof inventoryItems> = {};
    inventoryItems.forEach(item => {
      if (!itemsByWarehouse[item.warehouseId]) {
        itemsByWarehouse[item.warehouseId] = [];
      }
      itemsByWarehouse[item.warehouseId].push(item);
    });

    let totalInventoryUSD = 0;
    let totalInventoryMXN = 0;

    for (const [whId, items] of Object.entries(itemsByWarehouse)) {
      const firstItem = items[0];
      const isMiami = firstItem.warehouse?.country === "Estados Unidos" || firstItem.warehouse?.name.toLowerCase().includes("miami");

      let resinStock = 0;
      const sacosByColor: Record<string, number> = {};

      items.forEach(inv => {
        const sku = inv.product.sku;
        if (sku === "BIDON-RES-001") {
          resinStock = inv.quantity;
        } else if (sku.startsWith("SACO-")) {
          const color = sku.replace("SACO-", "");
          sacosByColor[color] = (sacosByColor[color] || 0) + inv.quantity;
        }
      });

      let totalKitsBySacos = 0;
      for (const [color, qty] of Object.entries(sacosByColor)) {
        totalKitsBySacos += Math.floor(qty / 3);
      }

      const buildableKits = Math.min(totalKitsBySacos, resinStock);

      if (isMiami) {
        const valUSD = buildableKits * 300;
        totalInventoryUSD += valUSD;
        totalInventoryMXN += valUSD * 20.0;
      } else {
        const valMXN = buildableKits * 1300;
        totalInventoryMXN += valMXN;
        totalInventoryUSD += valMXN / 20.0;
      }
    }

    // Calcular ingresos de ventas agrupados por mes
    const salesIncomeByMonth: Record<string, number> = {};
    approvedQuotes.forEach((quote) => {
      const date = new Date(quote.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      salesIncomeByMonth[key] = (salesIncomeByMonth[key] || 0) + (quote.total * quote.exchangeRate);
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalIncome,
        salesIncome,
        manualIncome,
        totalExpenses,
        netProfit
      },
      salesIncomeByMonth,
      inventoryValue: {
        usd: totalInventoryUSD,
        mxn: totalInventoryMXN
      },
      chartData,
      categoryBreakdown,
      records: manualRecords,
      warehouses
    });

  } catch (error: any) {
    console.error("Error en GET /api/finanzas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/finanzas - Crear un registro financiero manual (Admin / Bodega)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;
    const userId = cookieStore.get("user_session")?.value;

    if (!userId) {
      return NextResponse.json({ error: "No autorizado. Sesión inválida." }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const data = await request.json();
    let { type, category, amount, currency, exchangeRate, description, date, warehouseId, status } = data;

    // Validación y formateo de datos según el rol
    if (userRole === "BODEGA") {
      // Los bodegueros solo pueden registrar GASTOS DE OPERACIÓN para su bodega asignada
      if (!user.warehouseId) {
        return NextResponse.json({ error: "El bodeguero no tiene una bodega asignada." }, { status: 400 });
      }
      type = "EXPENSE";
      category = "BODEGA_OPERACION";
      warehouseId = user.warehouseId;
      
      const warehouse = await db.warehouse.findUnique({
        where: { id: user.warehouseId }
      });
      // Miami maneja USD por defecto, Mérida MXN
      const isMiami = warehouse?.country === "Estados Unidos" || warehouse?.name.toLowerCase().includes("miami");
      currency = isMiami ? "USD" : "MXN";
    } else if (userRole === "ADMIN") {
      // El administrador tiene control total de validación
      if (!type || !category || !amount) {
        return NextResponse.json({ error: "Tipo, Categoría y Monto son requeridos." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Rol no autorizado para registrar movimientos financieros." }, { status: 403 });
    }

    const recordAmount = parseFloat(amount);
    if (isNaN(recordAmount) || recordAmount <= 0) {
      return NextResponse.json({ error: "El monto debe ser un número positivo." }, { status: 400 });
    }

    const rate = parseFloat(exchangeRate) || 1.0;

    const record = await db.financeRecord.create({
      data: {
        type,
        category,
        amount: recordAmount,
        currency: currency || "MXN",
        exchangeRate: rate,
        description: description?.trim() || null,
        date: date ? new Date(date) : new Date(),
        status: status || "PAGADO",
        warehouseId: warehouseId || null,
        userId
      }
    });

    // Registrar en auditoría
    await db.auditLog.create({
      data: {
        entity: "FinanceRecord",
        entityId: record.id,
        action: "CREATE",
        userId,
        details: JSON.stringify({ type, category, amount: recordAmount, currency, warehouseId })
      }
    });

    return NextResponse.json({ success: true, record });

  } catch (error: any) {
    console.error("Error en POST /api/finanzas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/finanzas - Actualizar un registro financiero manual (ej. estatus de pago o edición completa)
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;
    const userId = cookieStore.get("user_session")?.value;

    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Solo administradores pueden modificar registros financieros." }, { status: 403 });
    }

    const data = await request.json();
    const { id, type, category, amount, currency, exchangeRate, description, date, status, warehouseId } = data;

    if (!id) {
      return NextResponse.json({ error: "El ID del registro es requerido." }, { status: 400 });
    }

    const updateData: any = {};
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) {
      const recordAmount = parseFloat(amount);
      if (isNaN(recordAmount) || recordAmount <= 0) {
        return NextResponse.json({ error: "El monto debe ser un número positivo." }, { status: 400 });
      }
      updateData.amount = recordAmount;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (exchangeRate !== undefined) {
      const rate = parseFloat(exchangeRate);
      updateData.exchangeRate = isNaN(rate) ? 1.0 : rate;
    }
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (date !== undefined) updateData.date = new Date(date);
    if (status !== undefined) updateData.status = status;
    if (warehouseId !== undefined) updateData.warehouseId = warehouseId || null;

    const record = await db.financeRecord.update({
      where: { id },
      data: updateData
    });

    // Registrar en auditoría
    await db.auditLog.create({
      data: {
        entity: "FinanceRecord",
        entityId: id,
        action: "UPDATE",
        userId: userId || "",
        details: JSON.stringify(updateData)
      }
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error("Error en PUT /api/finanzas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
