"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Releases/marks a commission as paid in a secure transaction, logging to the audit log.
 */
export async function payCommissionAction(commissionId: string) {
  try {
    const commission = await db.commission.findUnique({
      where: { id: commissionId },
      include: {
        quote: true,
        user: true,
      },
    });

    if (!commission) {
      throw new Error("La comisión especificada no existe.");
    }

    if (commission.status === "PAID") {
      throw new Error("Esta comisión ya ha sido pagada.");
    }

    // 1. Database update in transaction
    await db.$transaction(async (tx) => {
      await tx.commission.update({
        where: { id: commissionId },
        data: {
          status: "PAID",
          paidDate: new Date(),
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          entity: "Commission",
          entityId: commissionId,
          action: "PAY_COMMISSION",
          details: JSON.stringify({
            quoteNumber: commission.quote.quoteNumber,
            salesperson: commission.user.name,
            amount: commission.amount,
          }),
        },
      });
    });

    // 2. Revalidate paths
    revalidatePath("/comisiones");
    revalidatePath("/");

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error in payCommissionAction:", error);
    return {
      success: false,
      error: error.message || "Error al registrar el pago de la comisión.",
    };
  }
}
