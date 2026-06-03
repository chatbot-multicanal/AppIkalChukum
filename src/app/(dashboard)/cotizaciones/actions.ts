"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export interface CreateQuoteItemInput {
  productId: string;
  quantity: number;
}

export interface CreateQuoteInput {
  clientId: string;
  currency: string; // "MXN" | "USD"
  exchangeRate: number;
  items: CreateQuoteItemInput[];
}

/**
 * Fetches all quotes with their related client and user information.
 */
export async function getQuotesAction() {
  try {
    const quotes = await db.quote.findMany({
      include: {
        client: true,
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      quotes,
    };
  } catch (error: any) {
    console.error("Error in getQuotesAction:", error);
    return {
      success: false,
      error: error.message || "Error al obtener cotizaciones",
      quotes: [],
    };
  }
}

/**
 * Fetches active clients and products for the quote creation form.
 */
export async function getNewQuoteFormDataAction() {
  try {
    const clients = await db.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    const products = await db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      clients,
      products,
    };
  } catch (error: any) {
    console.error("Error in getNewQuoteFormDataAction:", error);
    return {
      success: false,
      error: error.message || "Error al obtener datos para el formulario",
      clients: [],
      products: [],
    };
  }
}

/**
 * Creates a new quote and calculates subtotals, tax (16%), and totals.
 */
export async function createQuoteAction(data: CreateQuoteInput) {
  try {
    // 1. Validation
    if (!data.clientId || !data.items || data.items.length === 0) {
      throw new Error("El cliente y al menos un producto son requeridos.");
    }

    // Get default user (we use the first available user as current logged in user)
    const user = await db.user.findFirst();
    if (!user) {
      throw new Error("No hay usuarios registrados en el sistema. Ejecuta el seed.");
    }

    // 2. Fetch products to get prices and calculate totals
    const productIds = data.items.map((i) => i.productId);
    const dbProducts = await db.product.findMany({
      where: { id: { in: productIds } },
    });

    let subtotal = 0;
    const itemsData = data.items.map((item) => {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product) {
        throw new Error(`El producto con ID ${item.productId} no existe.`);
      }
      
      const unitPrice = product.basePrice;
      const totalItem = unitPrice * item.quantity;
      subtotal += totalItem;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: unitPrice,
        total: totalItem,
      };
    });

    const tax = subtotal * 0.16; // 16% IVA
    const total = subtotal + tax;

    // 3. Generate sequential quote number
    const currentYear = new Date().getFullYear();
    const count = await db.quote.count();
    const sequenceNumber = String(count + 1).padStart(4, "0");
    const quoteNumber = `COT-${currentYear}-${sequenceNumber}`;

    // 4. Create quote in transaction
    const quote = await db.$transaction(async (tx) => {
      const q = await tx.quote.create({
        data: {
          quoteNumber,
          clientId: data.clientId,
          userId: user.id,
          status: "DRAFT",
          currency: data.currency,
          exchangeRate: data.exchangeRate,
          subtotal,
          tax,
          total,
          items: {
            create: itemsData,
          },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          entity: "Quote",
          entityId: q.id,
          action: "CREATE",
          details: JSON.stringify({
            quoteNumber: q.quoteNumber,
            total: q.total,
            itemsCount: itemsData.length,
          }),
        },
      });

      return q;
    });

    // 5. Revalidate cache
    revalidatePath("/cotizaciones");
    revalidatePath("/");

    return {
      success: true,
      quote,
    };
  } catch (error: any) {
    console.error("Error in createQuoteAction:", error);
    return {
      success: false,
      error: error.message || "Error interno al guardar la cotización.",
    };
  }
}

/**
 * Approves a quote and automatically generates a pending Order.
 */
export async function approveQuoteAction(quoteId: string) {
  try {
    // Validar autorización a nivel backend (Solo ADMIN puede aprobar cotizaciones)
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;

    if (userRole !== "ADMIN") {
      throw new Error("No autorizado. Solo el Administrador puede aprobar cotizaciones.");
    }

    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      include: { order: true },
    });

    if (!quote) {
      throw new Error("La cotización seleccionada no existe.");
    }

    if (quote.status === "APPROVED") {
      throw new Error("Esta cotización ya se encuentra aprobada.");
    }

    // 1. Transaction to update status and create order
    await db.$transaction(async (tx) => {
      // Update Quote Status
      await tx.quote.update({
        where: { id: quoteId },
        data: { status: "APPROVED" },
      });

      // Create Order
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 3); // Default scheduled delivery in 3 days

      await tx.order.create({
        data: {
          quoteId: quoteId,
          status: "PENDING",
          scheduledDeliveryAt: deliveryDate,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          entity: "Quote",
          entityId: quoteId,
          action: "UPDATE_STATUS_APPROVED",
          details: JSON.stringify({
            quoteNumber: quote.quoteNumber,
            statusChange: "APPROVED",
            orderCreated: true,
          }),
        },
      });
    });

    // 2. Revalidate caches
    revalidatePath("/cotizaciones");
    revalidatePath("/pedidos");
    revalidatePath("/");

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error in approveQuoteAction:", error);
    return {
      success: false,
      error: error.message || "Error al aprobar la cotización.",
    };
  }
}
