export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import PedidosClient from "./PedidosClient";
import { cookies } from "next/headers";

export default async function PedidosPage() {
  const cookieStore = await cookies();
  const userRole = cookieStore.get("user_role")?.value || "VENDEDOR";

  // 1. Obtener todos los pedidos con sus cotizaciones, clientes, e ítems
  const orders = await db.order.findMany({
    include: {
      warehouse: true,
      quote: {
        include: {
          client: true,
          user: true,
          items: {
            include: {
              product: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // 2. Obtener las bodegas activas para el picker de picking
  const warehouses = await db.warehouse.findMany({
    where: { active: true },
    orderBy: { name: "asc" }
  });

  return (
    <main className="main-content animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Pedidos (Tablero Kanban)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Monitorea el flujo de preparación, asignación de inventario y entrega de materiales de construcción.
          </p>
        </div>
      </div>

      {/* Renderizar el tablero Kanban interactivo del cliente */}
      <PedidosClient initialOrders={orders} initialWarehouses={warehouses} userRole={userRole} />
    </main>
  );
}
