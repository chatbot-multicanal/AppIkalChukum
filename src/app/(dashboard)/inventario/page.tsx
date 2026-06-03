import { db } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import InventoryModals from "./InventoryModals";

interface SearchParams {
  bodega?: string;
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const selectedBodegaName = params.bodega || "Mérida";

  // Determinar rol del usuario
  const cookieStore = await cookies();
  const userRole = cookieStore.get("user_role")?.value || "VENDEDOR";
  const showCost = userRole === "ADMIN" || userRole === "GERENTE";
  const isAdmin = userRole === "ADMIN";

  // 1. Obtener todas las bodegas activas de la base de datos
  const warehouses = await db.warehouse.findMany({
    where: { active: true },
    orderBy: { name: "asc" }
  });

  // 2. Determinar la bodega seleccionada
  const selectedWh = warehouses.find(
    w => w.name.toLowerCase().includes(selectedBodegaName.toLowerCase())
  ) || warehouses[0];

  // 3. Obtener el stock real de la bodega seleccionada
  const inventoryItems = await db.inventory.findMany({
    where: { warehouseId: selectedWh.id },
    include: {
      product: true
    },
    orderBy: {
      product: {
        name: "asc"
      }
    }
  });

  // 4. Obtener todos los productos y el inventario global para los modales de administración
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" }
  });

  const allInventory = await db.inventory.findMany();

  // Umbral de stock bajo
  const LOW_STOCK_THRESHOLD = 15.0;

  return (
    <main className="main-content animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Control de Inventario
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Monitorea el stock físico de tus productos en tiempo real por bodega.
          </p>
        </div>
        {isAdmin && (
          <InventoryModals 
            warehouses={warehouses} 
            products={products} 
            inventoryItems={allInventory} 
          />
        )}
      </div>

      {/* Warehouse Selector (Real dynamic cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {warehouses.map((wh) => {
          const isSelected = wh.id === selectedWh.id;
          return (
            <Link
              key={wh.id}
              href={`/inventario?bodega=${wh.name.replace("Bodega ", "")}`}
              style={{ textDecoration: "none" }}
            >
              <div 
                className="glass-card" 
                style={{ 
                  padding: '20px', 
                  cursor: 'pointer',
                  borderLeft: isSelected ? '4px solid var(--primary-teal)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(29, 128, 136, 0.08)' : 'var(--bg-card)',
                  borderColor: isSelected ? 'var(--border-color-hover)' : 'var(--border-color)',
                  transition: 'all 0.25s ease'
                }}
              >
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  {wh.name}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {wh.city}, {wh.country} | Moneda: {wh.country === "Estados Unidos" ? "USD" : "MXN"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Stock List (Real SQLite Data) */}
      <div className="glass-card" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '24px' }}>
          Stock de Kits en {selectedWh.name}
        </h2>

        <div style={{ overflowX: 'auto' }}>
          <table className="premium-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código SKU</th>
                <th>Bodega</th>
                {showCost && <th>Costo Compra</th>}
                <th>Precio Base</th>
                <th>Cantidad (Kits)</th>
                <th>Estado</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {inventoryItems.length === 0 ? (
                <tr>
                  <td colSpan={6 + (showCost ? 1 : 0) + (isAdmin ? 1 : 0)} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No hay inventario registrado en esta bodega.
                  </td>
                </tr>
              ) : (
                inventoryItems.map((item) => {
                  const isLowStock = item.quantity < LOW_STOCK_THRESHOLD;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>
                          {item.product.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Color: {item.product.color}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {item.product.sku}
                        </span>
                      </td>
                      <td>{selectedWh.name}</td>
                      {showCost && (
                        <td style={{ color: "var(--text-secondary)" }}>
                          ${item.product.costPrice?.toLocaleString("es-MX", { minimumFractionDigits: 2 }) || "-"} {selectedWh.country === "Estados Unidos" ? "USD" : "MXN"}
                        </td>
                      )}
                      <td>
                        ${item.product.basePrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {selectedWh.country === "Estados Unidos" ? "USD" : "MXN"}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '1.05rem', color: isLowStock && item.quantity > 0 ? '#ff9f43' : item.quantity === 0 ? '#ef4444' : '#ffffff' }}>
                        {item.quantity.toFixed(1)}
                      </td>
                      <td>
                        {item.quantity === 0 ? (
                          <span className="badge badge-cancelled">Agotado</span>
                        ) : isLowStock ? (
                          <span className="badge badge-pending">Stock Bajo</span>
                        ) : (
                          <span className="badge badge-approved">Suficiente</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button style={{ background: 'none', border: 'none', color: 'var(--primary-teal)', cursor: 'pointer', fontWeight: 600, marginRight: '12px' }}>Ajustar</button>
                          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Historial</button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
