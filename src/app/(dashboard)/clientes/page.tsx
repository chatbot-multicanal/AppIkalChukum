export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import ClientesClient from "./ClientesClient";
import { cookies } from "next/headers";

export default async function ClientesPage() {
  const cookieStore = await cookies();
  const userRole = cookieStore.get("user_role")?.value;
  const userId = cookieStore.get("user_session")?.value;

  let whereClause: any = {};

  if (userRole === "VENDEDOR" && userId) {
    whereClause.userId = userId;
  }

  // 1. Cargar clientes reales
  const clients = await db.client.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          name: true
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return (
    <main className="main-content animate-fade-in">
      <ClientesClient initialClients={clients as any} />
    </main>
  );
}
