export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import CommissionsView from "./CommissionsView";

export default async function ComisionesPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_session")?.value;
  const userRole = cookieStore.get("user_role")?.value || "VENDEDOR";

  if (!userId) {
    return (
      <main className="main-content">
        <p style={{ color: "red", fontWeight: "bold" }}>No autenticado. Por favor inicia sesión.</p>
      </main>
    );
  }

  // 1. Obtener la tasa de comisión global actual
  const setting = await db.systemSetting.findUnique({
    where: { key: "commission_rate" },
  });
  const currentRate = setting ? parseFloat(setting.value) : 3.0;

  // 2. Cargar comisiones según el rol del usuario logueado
  const isVendor = userRole === "VENDEDOR";
  
  const commissions = await db.commission.findMany({
    where: isVendor ? { userId } : undefined, // Vendedor solo ve las suyas
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      quote: {
        select: {
          quoteNumber: true,
          total: true,
          subtotal: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="main-content animate-fade-in">
      <CommissionsView 
        initialCommissions={commissions} 
        currentRole={userRole} 
        currentRate={currentRate}
      />
    </main>
  );
}
