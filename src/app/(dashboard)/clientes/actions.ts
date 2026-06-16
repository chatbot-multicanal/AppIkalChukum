"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

    const client = await db.client.create({
      data: {
        name: data.name.trim(),
        company: data.company?.trim() || null,
        contact: data.contact?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        state: data.state?.trim() || null,
        zip: data.zip?.trim() || null,
        city: data.city.trim(),
        country: data.country.trim(),
        receptionSchedule: data.receptionSchedule?.trim() || null,
        active: true
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

    const client = await db.client.update({
      where: { id },
      data: {
        name: data.name.trim(),
        company: data.company?.trim() || null,
        contact: data.contact?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
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
