import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// GET /api/clientes - Obtener lista de clientes
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;
    const userId = cookieStore.get("user_session")?.value;

    let whereClause: any = { active: true };

    if (userRole === "VENDEDOR" && userId) {
      whereClause.userId = userId;
    }

    const clients = await db.client.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
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
    const { name, company, contact, email, phone, address, state, zip, city, country, receptionSchedule } = data;

    if (!name || !city || !country) {
      return NextResponse.json({ error: "Nombre, Ciudad y País son requeridos" }, { status: 400 });
    }

    const nameTrim = name.trim();
    const emailTrim = email?.trim().toLowerCase() || null;
    const phoneTrim = phone?.trim() || null;

    // 1. Control de duplicados por nombre
    const existingByName = await db.client.findFirst({
      where: {
        active: true,
        name: { equals: nameTrim, mode: 'insensitive' }
      }
    });
    if (existingByName) {
      return NextResponse.json({ error: `Ya existe un cliente activo registrado con el nombre "${nameTrim}".` }, { status: 400 });
    }

    // 2. Control de duplicados por correo
    if (emailTrim) {
      const existingByEmail = await db.client.findFirst({
        where: {
          active: true,
          email: { equals: emailTrim, mode: 'insensitive' }
        }
      });
      if (existingByEmail) {
        return NextResponse.json({ error: `Ya existe un cliente activo registrado con el correo "${emailTrim}".` }, { status: 400 });
      }
    }

    // 3. Control de duplicados por teléfono
    if (phoneTrim) {
      const existingByPhone = await db.client.findFirst({
        where: {
          active: true,
          phone: phoneTrim
        }
      });
      if (existingByPhone) {
        return NextResponse.json({ error: `Ya existe un cliente activo registrado con el teléfono "${phoneTrim}".` }, { status: 400 });
      }
    }

    // Validar autorización (o sesión de usuario activa o API key válida de ManyChat/Sofía)
    const cookieStore = await cookies();
    const creatorId = cookieStore.get("user_session")?.value || null;
    const apiKeyHeader = request.headers.get("x-api-key");
    const validApiKey = process.env.ERP_API_KEY || "ikal-chukum-secret-key-2026";

    if (!creatorId && (!apiKeyHeader || apiKeyHeader !== validApiKey)) {
      return NextResponse.json({ error: "No autorizado. Requiere sesión activa o clave API válida." }, { status: 401 });
    }

    const client = await db.client.create({
      data: {
        name: nameTrim,
        company: company?.trim() || null,
        contact: contact?.trim() || null,
        email: emailTrim,
        phone: phoneTrim,
        address: address?.trim() || null,
        state: state?.trim() || null,
        zip: zip?.trim() || null,
        city: city.trim(),
        country: country.trim(),
        receptionSchedule: receptionSchedule?.trim() || null,
        active: true,
        userId: creatorId
      }
    });

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
