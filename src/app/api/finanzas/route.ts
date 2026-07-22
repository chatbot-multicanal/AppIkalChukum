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

    // 1. Obtener todos los registros financieros manuales
    const manualRecords = await db.financeRecord.findMany({
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
      where: {
        status: "APPROVED"
      },
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

    return NextResponse.json({
      success: true,
      summary: {
        totalIncome,
        salesIncome,
        manualIncome,
        totalExpenses,
        netProfit
      },
      chartData,
      categoryBreakdown,
      records: manualRecords
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
    let { type, category, amount, currency, exchangeRate, description, date, warehouseId } = data;

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
