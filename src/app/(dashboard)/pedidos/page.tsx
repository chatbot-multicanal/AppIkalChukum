export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import PedidosClient from "./PedidosClient";
import { cookies } from "next/headers";

export default async function PedidosPage() {
  const cookieStore = await cookies();
  const userRole = cookieStore.get("user_role")?.value || "VENDEDOR";
  const userId = cookieStore.get("user_session")?.value;

  // Obtener warehouseId del usuario actual
  const user = userId ? await db.user.findUnique({
    where: { id: userId },
    select: { warehouseId: true }
  }) : null;
  const userWarehouseId = user?.warehouseId || null;

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
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Flujo de Pedidos
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Monitorea el flujo de preparación, asignación de inventario y entrega de materiales de construcción.
          </p>
        </div>
      </div>

      {/* Renderizar el tablero Kanban interactivo del cliente */}
      <PedidosClient 
        initialOrders={orders} 
        initialWarehouses={warehouses} 
        userRole={userRole} 
        userWarehouseId={userWarehouseId} 
      />
    </main>
  );
}
