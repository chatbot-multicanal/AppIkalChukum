"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function getClientsAction() {
  try {
    const clients = await db.client.findMany({
      orderBy: { name: "asc" }
    });
    return { success: true, clients };
  } catch (error: any) {
    console.error("Error in getClientsAction:", error);
    return { success: false, error: error.message || "Error al obtener clientes" };
  }
}

export async function createClientAction(data: {
  name: string;
  company?: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  zip?: string;
  city: string;
  country: string;
  receptionSchedule?: string;
}) {
  try {
    if (!data.name || !data.city || !data.country) {
      throw new Error("Nombre, Ciudad y País son requeridos.");
    }

    const nameTrim = data.name.trim();
    const emailTrim = data.email?.trim().toLowerCase() || null;
    const phoneTrim = data.phone?.trim() || null;

    // 1. Control de duplicados por nombre
    const existingByName = await db.client.findFirst({
      where: {
        active: true,
        name: { equals: nameTrim, mode: 'insensitive' }
      }
    });
    if (existingByName) {
      throw new Error(`Ya existe un cliente activo registrado con el nombre "${nameTrim}".`);
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
        throw new Error(`Ya existe un cliente activo registrado con el correo "${emailTrim}".`);
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
        throw new Error(`Ya existe un cliente activo registrado con el teléfono "${phoneTrim}".`);
      }
    }

    const cookieStore = await cookies();
    const creatorId = cookieStore.get("user_session")?.value || null;

    const client = await db.client.create({
      data: {
        name: nameTrim,
        company: data.company?.trim() || null,
        contact: data.contact?.trim() || null,
        email: emailTrim,
        phone: phoneTrim,
        address: data.address?.trim() || null,
        state: data.state?.trim() || null,
        zip: data.zip?.trim() || null,
        city: data.city.trim(),
        country: data.country.trim(),
        receptionSchedule: data.receptionSchedule?.trim() || null,
        active: true,
        userId: creatorId
      }
    });

    revalidatePath("/clientes");
    revalidatePath("/cotizaciones/nueva");
    return { success: true, client };
  } catch (error: any) {
    console.error("Error in createClientAction:", error);
    return { success: false, error: error.message || "Error al crear cliente" };
  }
}

export async function updateClientAction(
  id: string,
  data: {
    name: string;
    company?: string;
    contact?: string;
    email?: string;
    phone?: string;
    address?: string;
    state?: string;
    zip?: string;
    city: string;
    country: string;
    receptionSchedule?: string;
  }
) {
  try {
    if (!data.name || !data.city || !data.country) {
      throw new Error("Nombre, Ciudad y País son requeridos.");
    }

    const nameTrim = data.name.trim();
    const emailTrim = data.email?.trim().toLowerCase() || null;
    const phoneTrim = data.phone?.trim() || null;

    // 1. Control de duplicados por nombre
    const existingByName = await db.client.findFirst({
      where: {
        id: { not: id },
        active: true,
        name: { equals: nameTrim, mode: 'insensitive' }
      }
    });
    if (existingByName) {
      throw new Error(`Ya existe otro cliente activo registrado con el nombre "${nameTrim}".`);
    }

    // 2. Control de duplicados por correo
    if (emailTrim) {
      const existingByEmail = await db.client.findFirst({
        where: {
          id: { not: id },
          active: true,
          email: { equals: emailTrim, mode: 'insensitive' }
        }
      });
      if (existingByEmail) {
        throw new Error(`Ya existe otro cliente activo registrado con el correo "${emailTrim}".`);
      }
    }

    // 3. Control de duplicados por teléfono
    if (phoneTrim) {
      const existingByPhone = await db.client.findFirst({
        where: {
          id: { not: id },
          active: true,
          phone: phoneTrim
        }
      });
      if (existingByPhone) {
        throw new Error(`Ya existe otro cliente activo registrado con el teléfono "${phoneTrim}".`);
      }
    }

    const client = await db.client.update({
      where: { id },
      data: {
        name: nameTrim,
        company: data.company?.trim() || null,
        contact: data.contact?.trim() || null,
        email: emailTrim,
        phone: phoneTrim,
        address: data.address?.trim() || null,
        state: data.state?.trim() || null,
        zip: data.zip?.trim() || null,
        city: data.city.trim(),
        country: data.country.trim(),
        receptionSchedule: data.receptionSchedule?.trim() || null
      }
    });

    revalidatePath("/clientes");
    revalidatePath("/cotizaciones/nueva");
    return { success: true, client };
  } catch (error: any) {
    console.error("Error in updateClientAction:", error);
    return { success: false, error: error.message || "Error al actualizar cliente" };
  }
}

export async function toggleClientStatusAction(id: string, currentStatus: boolean) {
  try {
    const client = await db.client.update({
      where: { id },
      data: {
        active: !currentStatus
      }
    });

    revalidatePath("/clientes");
    return { success: true, client };
  } catch (error: any) {
    console.error("Error in toggleClientStatusAction:", error);
    return { success: false, error: error.message || "Error al cambiar estado del cliente" };
  }
}
