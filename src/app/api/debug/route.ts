import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  const parts = dbUrl.split("://")[1] || "";
  const credentials = parts.split("@")[0] || "";
  const username = credentials.split(":")[0] || "not found";
  const host = parts.split("@")[1]?.split(":")[0] || "not found";
  return NextResponse.json({ username, host });
}
