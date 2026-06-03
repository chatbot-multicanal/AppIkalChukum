import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/clientes - Obtener lista de clientes
export async function GET() {
  try {
    const clients = await db.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(clients);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/clientes - Crear nuevo cliente
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, contact, email, phone, address, city, country } = data;

    if (!name || !city || !country) {
      return NextResponse.json({ error: "Nombre, Ciudad y País son requeridos" }, { status: 400 });
    }

    const client = await db.client.create({
      data: {
        name,
        contact,
        email,
        phone,
        address,
        city,
        country
      }
    });

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
