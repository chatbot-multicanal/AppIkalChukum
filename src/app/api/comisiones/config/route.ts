import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: "commission_rate" },
    });

    const rate = setting ? parseFloat(setting.value) : 3.0;

    return NextResponse.json({ success: true, commission_rate: rate });
  } catch (error: any) {
    console.error("Error en GET /api/comisiones/config:", error);
    return NextResponse.json(
      { error: "Error al consultar la configuración" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Protección a nivel backend
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;

    if (userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "No autorizado. Solo administradores pueden realizar esta acción." },
        { status: 403 }
      );
    }

    const { commission_rate } = await request.json();

    if (commission_rate === undefined || isNaN(Number(commission_rate))) {
      return NextResponse.json(
        { error: "Porcentaje de comisión inválido" },
        { status: 400 }
      );
    }

    const rateNum = Number(commission_rate);
    if (rateNum < 0 || rateNum > 100) {
      return NextResponse.json(
        { error: "La comisión debe estar entre 0% y 100%" },
        { status: 400 }
      );
    }

    // Guardar en la base de datos
    const setting = await db.systemSetting.upsert({
      where: { key: "commission_rate" },
      update: { value: rateNum.toFixed(1) },
      create: { key: "commission_rate", value: rateNum.toFixed(1) },
    });

    // Registrar en bitácora de auditoría
    await db.auditLog.create({
      data: {
        entity: "SystemSetting",
        entityId: "commission_rate",
        action: "UPDATE",
        details: JSON.stringify({ message: "Porcentaje de comisión global actualizado", value: setting.value }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Tasa de comisión actualizada correctamente",
      commission_rate: rateNum,
    });
  } catch (error: any) {
    console.error("Error en POST /api/comisiones/config:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al guardar la configuración" },
      { status: 500 }
    );
  }
}
