import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date().toISOString();
    // Realizar una escritura real (upsert) en la base de datos para que Supabase
    // registre actividad de escritura y NUNCA pause el proyecto por inactividad.
    await db.systemSetting.upsert({
      where: { key: "LAST_DB_PING" },
      update: { value: now },
      create: { key: "LAST_DB_PING", value: now },
    });
    return NextResponse.json({
      success: true,
      message: "Database keep-alive write completed successfully",
      timestamp: now,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
