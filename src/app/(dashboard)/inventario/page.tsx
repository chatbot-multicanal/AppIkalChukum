import { db } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import InventoryModals from "./InventoryModals";
import InventoryTable from "./InventoryTable";

import WarehouseExpenseButton from "./WarehouseExpenseButton";

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

  // 3. Obtener el stock real de la bodega seleccionada (solo componentes físicos)
  const inventoryItems = await db.inventory.findMany({
    where: { 
      warehouseId: selectedWh.id,
      product: {
        active: true,
        OR: [
          { sku: { startsWith: "SACO-" } },
          { sku: "BIDON-RES-001" }
        ]
      }
    },
    include: {
      product: true
    },
    orderBy: {
      product: {
        name: "asc"
      }
    }
  });

  // 4. Obtener todos los productos y el inventario global para los modales de administración (solo componentes físicos)
  const products = await db.product.findMany({
    where: { 
      active: true,
      OR: [
        { sku: { startsWith: "SACO-" } },
        { sku: "BIDON-RES-001" }
      ]
    },
    orderBy: { name: "asc" }
  });

  const allInventory = await db.inventory.findMany({
    where: {
      product: {
        active: true,
        OR: [
          { sku: { startsWith: "SACO-" } },
          { sku: "BIDON-RES-001" }
        ]
      }
    }
  });

  return (
    <main className="main-content animate-fade-in">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Control de Inventario
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Monitorea el stock físico de tus productos en tiempo real por bodega.
          </p>
        </div>
        <div className="page-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {isAdmin && (
            <InventoryModals 
              warehouses={warehouses} 
              products={products} 
              inventoryItems={allInventory} 
            />
          )}
          {(userRole === "BODEGA" || isAdmin) && (
            <WarehouseExpenseButton 
              warehouseId={selectedWh.id} 
              warehouseName={selectedWh.name} 
              currency={selectedWh.country === "Estados Unidos" ? "USD" : "MXN"} 
            />
          )}
        </div>
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
      <InventoryTable 
        initialItems={inventoryItems} 
        warehouseId={selectedWh.id} 
        warehouseName={selectedWh.name} 
        showCost={showCost} 
        isAdmin={isAdmin} 
        userRole={userRole}
      />
    </main>
  );
}
