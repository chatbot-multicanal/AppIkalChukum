"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface CreateClientInput {
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  city: string;
  country: string;
}

/**
 * Fetches all clients, optionally filtered by a search query.
 */
export async function getClientsAction(searchQuery?: string) {
  try {
    const whereClause = searchQuery
      ? {
          active: true,
          OR: [
            { name: { contains: searchQuery } },
            { contact: { contains: searchQuery } },
            { city: { contains: searchQuery } },
          ],
        }
      : { active: true };

    const clients = await db.client.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      clients,
    };
  } catch (error: any) {
    console.error("Error in getClientsAction:", error);
    return {
      success: false,
      error: error.message || "Error al obtener clientes",
      clients: [],
    };
  }
}

/**
 * Creates a new client and adds an audit log entry.
 */
export async function createClientAction(data: CreateClientInput) {
  try {
    // 1. Validation
    if (!data.name || !data.city || !data.country) {
      throw new Error("El nombre del cliente, la ciudad y el país son obligatorios.");
    }

    // 2. Insert into SQLite via Prisma transaction
    const client = await db.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: {
          name: data.name,
          contact: data.contact || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city,
          country: data.country,
          active: true,
        },
      });

      // Log the creation
      await tx.auditLog.create({
        data: {
          entity: "Client",
          entityId: c.id,
          action: "CREATE",
          details: JSON.stringify({
            name: c.name,
            city: c.city,
            country: c.country,
          }),
        },
      });

      return c;
    });

    // 3. Revalidate Next.js cache for the pages
    revalidatePath("/clientes");
    revalidatePath("/cotizaciones");

    return {
      success: true,
      client,
    };
  } catch (error: any) {
    console.error("Error in createClientAction:", error);
    return {
      success: false,
      error: error.message || "Error interno al registrar el cliente.",
    };
  }
}
