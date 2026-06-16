export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import ClientesClient from "./ClientesClient";

export default async function ClientesPage() {
  // 1. Cargar clientes reales
  const clients = await db.client.findMany({
    orderBy: { name: "asc" }
  });

  return (
    <main className="main-content animate-fade-in">
      <ClientesClient initialClients={clients as any} />
    </main>
  );
}
