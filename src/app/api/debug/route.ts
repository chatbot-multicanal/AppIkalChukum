import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  const host = dbUrl.split("@")[1]?.split(":")[0] || "not found";
  return NextResponse.json({ host });
}
