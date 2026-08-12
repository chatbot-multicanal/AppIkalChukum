import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Realizar una consulta ligera a la base de datos para mantenerla activa (keep-alive)
    await db.systemSetting.findFirst();
    return NextResponse.json({ success: true, message: "Database pinged successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
