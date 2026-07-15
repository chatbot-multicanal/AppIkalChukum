import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  const parts = dbUrl.split("://")[1] || "";
  const credentials = parts.split("@")[0] || "";
  const username = credentials.split(":")[0] || "not found";
  const host = parts.split("@")[1]?.split(":")[0] || "not found";
  
  let dbStatus = "unknown";
  let dbError = null;
  
  try {
    // Intentar una consulta simple para verificar la conexión
    const settings = await db.systemSetting.findMany({ take: 1 });
    dbStatus = "connected";
  } catch (err: any) {
    dbStatus = "failed";
    dbError = {
      message: err.message,
      code: err.code,
      stack: err.stack
    };
  }

  return NextResponse.json({ 
    username, 
    host,
    dbStatus,
    dbError
  });
}
