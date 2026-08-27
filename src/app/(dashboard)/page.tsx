export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";

interface LogDetails {
  sku?: string;
  name?: string;
  quoteNumber?: string;
  total?: number;
  newStatus?: string;
  city?: string;
  country?: string;
}

function parseLog(log: { entity: string; action: string; details: string | null }): string {
  try {
    const details: LogDetails = log.details ? JSON.parse(log.details) : {};
    
    if (log.entity === "Client") {
      if (log.action === "CREATE") {
        return `Cliente registrado: "${details.name || 'Desconocido'}" en ${details.city || ''}, ${details.country || ''}`;
      }
    }
    
    if (log.entity === "Product") {
      if (log.action === "CREATE") {
        return `Nuevo producto registrado: SKU ${details.sku || ''} - "${details.name || ''}"`;
      }
    }
    
    if (log.entity === "Quote") {
      if (log.action === "CREATE") {
        return `Cotización ${details.quoteNumber || ''} generada por $${details.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}`;
      }
      if (log.action === "UPDATE_STATUS_APPROVED") {
        return `Cotización ${details.quoteNumber || ''} aprobada (pedido enviado a Kanban)`;
      }
    }
    
    if (log.entity === "Order") {
      if (log.action === "UPDATE_STATUS_PREPARING") {
        return `Pedido ${details.quoteNumber || ''} en preparación (sacos reservados)`;
      }
      if (log.action === "UPDATE_STATUS_SHIPPED") {
        return `Pedido ${details.quoteNumber || ''} listo para envío`;
      }
      if (log.action === "UPDATE_STATUS_DELIVERED") {
        return `Pedido ${details.quoteNumber || ''} entregado (comisión del 3% registrada)`;
      }
      if (log.action === "UPDATE_STATUS_CANCELLED") {
        return `Pedido ${details.quoteNumber || ''} cancelado (sacos devueltos a inventario)`;
      }
    }

    return `${log.action} en ${log.entity}`;
  } catch (e) {
    return `${log.action} en ${log.entity}`;
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Hace unos segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

export default async function Home() {
  const LOW_STOCK_THRESHOLD = 15.0;

  const cookieStore = await cookies();
  const userRole = cookieStore.get("user_role")?.value || "VENDEDOR";
  const userId = cookieStore.get("user_session")?.value;

  // Si el usuario es BODEGA, cargamos la información de su bodega
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        include: { warehouse: true },
      })
    : null;

  const userWarehouseId = user?.warehouseId;
  const userWarehouseName = user?.warehouse?.name || "Todas las Bodegas";

  if (userRole === "BODEGA") {
    // ----------------------------------------------------
    // PANEL EXCLUSIVO PARA ROL DE BODEGA
    // ----------------------------------------------------

    // 1. Pedidos por preparar o listos en esta bodega
    const pendingOrdersCount = await db.order.count({
      where: {
        warehouseId: userWarehouseId || undefined,
        status: { in: ["PENDING", "PREPARING"] },
      },
    });

    // 2. Pedidos ya enviados / despachados por esta bodega
    const shippedOrdersCount = await db.order.count({
      where: {
        warehouseId: userWarehouseId || undefined,
        status: "SHIPPED",
      },
    });

    // 3. Alertas de bajo inventario en esta bodega
    const lowStockCount = await db.inventory.count({
      where: {
        warehouseId: userWarehouseId || undefined,
        quantity: { lt: LOW_STOCK_THRESHOLD },
      },
    });

    // 4. Obtener pedidos pendientes específicos para esta bodega
    const recentOrders = await db.order.findMany({
      where: {
        warehouseId: userWarehouseId || undefined,
        status: { in: ["PENDING", "PREPARING", "SHIPPED"] },
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: {
        quote: {
          include: {
            client: true,
          },
        },
      },
    });

    // 5. Encontrar el artículo con el stock más bajo en esta bodega
    const criticalStockItem = await db.inventory.findFirst({
      where: {
        warehouseId: userWarehouseId || undefined,
        quantity: { lt: LOW_STOCK_THRESHOLD },
      },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { quantity: "asc" },
    });

    // 6. Obtener comentarios recientes de esta bodega o generales
    const recentComments = await db.comment.findMany({
      where: {
        warehouseId: userWarehouseId || undefined,
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, role: true },
        },
        product: {
          select: { name: true, sku: true },
        },
      },
    });

    return (
      <main className="main-content animate-fade-in">
        {/* Top Header */}
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
              Control de Bodega
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
              Encargado de: <strong style={{ color: 'var(--primary-sage)' }}>{userWarehouseName}</strong>. Gestión de almacén y despachos.
            </p>
          </div>
          <div className="page-header-actions">
            <Link href="/inventario" style={{ textDecoration: 'none' }}>
              <button className="btn-premium btn-secondary-sage">
                Revisar Inventario
              </button>
            </Link>
            <Link href="/pedidos" style={{ textDecoration: 'none' }}>
              <button className="btn-premium btn-primary-teal">
                Despachar Pedidos
              </button>
            </Link>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="kpi-grid">
          
          {/* Metric 1 */}
          <div className="glass-card" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Por Preparar / Surtir</span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(29, 128, 136, 0.1)', color: 'var(--primary-teal)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px', letterSpacing: '-1px' }}>
              {pendingOrdersCount}
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary-sage)', fontWeight: 600 }}>
              Requieren atención en Kanban
            </span>
          </div>

          {/* Metric 2 */}
          <div className="glass-card" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Enviados / En Camino</span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(164, 189, 145, 0.15)', color: 'var(--primary-sage)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px', letterSpacing: '-1px' }}>
              {shippedOrdersCount}
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Salidas físicas registradas
            </span>
          </div>

          {/* Metric 3 */}
          <div className="glass-card" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Stock Bajo Mínimo</span>
              <div style={{ padding: '8px', borderRadius: '10px', background: lowStockCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(164, 189, 145, 0.15)', color: lowStockCount > 0 ? '#ef4444' : 'var(--primary-sage)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: lowStockCount > 0 ? '#ef4444' : '#ffffff', marginBottom: '8px', letterSpacing: '-1px' }}>
              {lowStockCount}
            </div>
            <span style={{ fontSize: '0.85rem', color: lowStockCount > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: 600 }}>
              {lowStockCount > 0 ? "Requiere reabastecimiento" : "Niveles saludables"}
            </span>
          </div>

        </div>

        {/* Main Grid: Orders & Comments */}
        <div className="dashboard-grid">
          
          {/* Recent Orders in Warehouse */}
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
                Pedidos en Almacén
              </h2>
              <Link href="/pedidos" style={{ color: 'var(--primary-teal)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
                Ver Kanban →
              </Link>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>No. Pedido</th>
                    <th>Cliente</th>
                    <th>Destino</th>
                    <th>Estado</th>
                    <th>Visto en Bodega</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No hay pedidos activos asignados a esta bodega.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => {
                      const quoteNumber = order.quote?.quoteNumber || "N/A";
                      const clientName = order.quote?.client?.name || "Desconocido";
                      const city = order.quote?.client?.city || "N/A";
                      
                      return (
                        <tr key={order.id}>
                          <td style={{ fontWeight: 600, color: '#ffffff' }}>{quoteNumber}</td>
                          <td>{clientName}</td>
                          <td>{city}</td>
                          <td>
                            <span className={`badge ${
                              order.status === "PENDING" ? "badge-draft" :
                              order.status === "PREPARING" ? "badge-pending" :
                              order.status === "SHIPPED" ? "badge-approved" :
                              "badge-approved"
                            }`}>
                              {order.status === "PENDING" ? "Por Procesar" :
                               order.status === "PREPARING" ? "Surtido / Prep." :
                               order.status === "SHIPPED" ? "En Camino" :
                               order.status}
                            </span>
                          </td>
                          <td>
                            {order.acknowledgedAt ? (
                              <span style={{ color: "var(--primary-sage)", fontSize: "0.85rem", fontWeight: 600 }}>
                                ✓ Enterado ({new Date(order.acknowledgedAt).toLocaleDateString("es-MX", { day: '2-digit', month: 'short' })})
                              </span>
                            ) : (
                              <span style={{ color: "#ef4444", fontSize: "0.85rem", fontWeight: 600 }}>
                                ⌛ Pendiente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts and Comments panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {criticalStockItem ? (
              <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #ef4444' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Alerta Crítica de Almacén
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '12px' }}>
                  El producto <strong>{criticalStockItem.product.name}</strong> tiene stock crítico de <strong>{criticalStockItem.quantity.toFixed(1)} Kits</strong> en tu bodega.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Link 
                    href="/inventario" 
                    style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Ver Detalles →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--primary-sage)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-sage)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Surtido Completo
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  No hay productos por debajo del umbral mínimo de seguridad en tu almacén.
                </p>
              </div>
            )}

            {/* Warehouse Comments list */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
                Comentarios en mi Bodega
              </h3>
              
              {recentComments.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px 0' }}>
                  No hay comentarios en esta bodega todavía. Ve a la sección de Inventario para dejar notas.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {recentComments.map((comment) => (
                    <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary-sage)' }}>{comment.user.name} ({comment.user.role})</span>
                        <span>{formatTimeAgo(comment.createdAt)}</span>
                      </div>
                      {comment.product && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary-teal)', fontWeight: 500 }}>
                          Producto: {comment.product.name} ({comment.product.sku})
                        </div>
                      )}
                      <p style={{ color: 'var(--text-main)', margin: '2px 0 0 0', fontStyle: 'italic' }}>
                        "{comment.content}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>
    );
  }

  // ----------------------------------------------------
  // PANEL ADMINISTRADOR / GERENTE / VENDEDOR (ORIGINAL)
  // ----------------------------------------------------

  // 1. Cotizaciones pendientes (Pendientes de Aprobación y Enviadas)
  const pendingQuotesCount = await db.quote.count({
    where: { status: { in: ["DRAFT", "SENT"] } }
  });

  // 2. Pedidos activos (Por Procesar, En Preparación, En Camino)
  const activeOrdersCount = await db.order.count({
    where: { status: { in: ["PENDING", "PREPARING", "SHIPPED"] } }
  });

  // 3. Alertas de inventario bajo umbral en bodegas activas
  const lowStockCount = await db.inventory.count({
    where: {
      quantity: { lt: LOW_STOCK_THRESHOLD },
      warehouse: { active: true }
    }
  });

  // 4. Obtener cotizaciones recientes con detalles de cliente
  const recentQuotes = await db.quote.findMany({
    take: 4,
    orderBy: { createdAt: "desc" },
    include: { client: true }
  });

  // 5. Encontrar el artículo con el stock más bajo (alerta crítica)
  const criticalStockItem = await db.inventory.findFirst({
    where: {
      quantity: { lt: LOW_STOCK_THRESHOLD },
      warehouse: { active: true }
    },
    include: {
      product: true,
      warehouse: true
    },
    orderBy: { quantity: "asc" }
  });

  // 6. Obtener las últimas 5 bitácoras de auditoría reales
  const recentLogs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5
  });

  return (
    <main className="main-content animate-fade-in">
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Panel de Operaciones
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Bienvenido de vuelta. Aquí está el estado de IkalChukum al día de hoy.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/inventario" style={{ textDecoration: 'none' }}>
            <button className="btn-premium btn-secondary-sage">
              Ver Inventario
            </button>
          </Link>
          <Link href="/cotizaciones" style={{ textDecoration: 'none' }}>
            <button className="btn-premium btn-primary-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Nueva Cotización
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        
        {/* Metric 1 */}
        <div className="glass-card" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cotizaciones Pendientes</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(29, 128, 136, 0.1)', color: 'var(--primary-teal)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px', letterSpacing: '-1px' }}>
            {pendingQuotesCount}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--primary-sage)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            Activas en el embudo
          </span>
        </div>

        {/* Metric 2 */}
        <div className="glass-card" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pedidos Activos</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(164, 189, 145, 0.15)', color: 'var(--primary-sage)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px', letterSpacing: '-1px' }}>
            {activeOrdersCount}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Listos para envío y picking
          </span>
        </div>

        {/* Metric 3 */}
        <div className="glass-card" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Alertas de Inventario</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: lowStockCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(164, 189, 145, 0.15)', color: lowStockCount > 0 ? '#ef4444' : 'var(--primary-sage)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: lowStockCount > 0 ? '#ef4444' : '#ffffff', marginBottom: '8px', letterSpacing: '-1px' }}>
            {lowStockCount}
          </div>
          <span style={{ fontSize: '0.85rem', color: lowStockCount > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: 600 }}>
            {lowStockCount > 0 ? "Bajo el umbral de seguridad" : "Inventario óptimo"}
          </span>
        </div>

      </div>

      {/* Main Grid: Transactions & Alerts */}
      <div className="dashboard-grid">
        
        {/* Recent Quotes Table */}
        <div className="glass-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
              Cotizaciones Recientes
            </h2>
            <Link href="/cotizaciones" style={{ color: 'var(--primary-teal)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
              Ver todas →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th>No. Cotización</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No hay cotizaciones registradas.
                    </td>
                  </tr>
                ) : (
                  recentQuotes.map((quote) => (
                    <tr key={quote.id}>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>{quote.quoteNumber}</td>
                      <td>{quote.client.name}</td>
                      <td>{new Date(quote.createdAt).toLocaleDateString("es-MX", { day: '2-digit', month: 'short' })}</td>
                      <td style={{ fontWeight: 600 }}>
                        ${quote.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {quote.currency}
                      </td>
                      <td>
                        <span className={`badge ${
                          quote.status === "APPROVED" ? "badge-approved" : 
                          quote.status === "SENT" ? "badge-pending" : 
                          quote.status === "REJECTED" ? "badge-cancelled" : 
                          "badge-pending"
                        }`}>
                          {quote.status === "APPROVED" ? "Aprobada" : 
                           quote.status === "SENT" ? "Enviada" : 
                           quote.status === "REJECTED" ? "Rechazada" : 
                           "Pendiente Aprobación"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Alerts Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {criticalStockItem ? (
            <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #ef4444' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Alerta Crítica de Stock
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '12px' }}>
                El <strong>{criticalStockItem.product.name}</strong> en la <strong>{criticalStockItem.warehouse.name}</strong> se encuentra por debajo del umbral mínimo de seguridad.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Stock actual: {criticalStockItem.quantity.toFixed(1)} Kits
                </span>
                <Link 
                  href={`/inventario?bodega=${criticalStockItem.warehouse.name.replace("Bodega ", "")}`} 
                  style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
                >
                  Ver Stock →
                </Link>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--primary-sage)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-sage)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Stock en Buen Estado
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Todos los productos se encuentran por encima de los niveles de stock mínimo en todas las bodegas.
              </p>
            </div>
          )}

          {/* Dynamic Audit Logs Bitacora */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
              Bitácora de Acciones
            </h3>
            
            {recentLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px 0' }}>
                No hay actividades registradas en la bitácora todavía.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {recentLogs.map((log) => {
                  const isApprove = log.action.includes("APPROVED") || log.action.includes("DELIVERED") || log.action.includes("PAY_COMMISSION");
                  const isCreate = log.action === "CREATE";
                  const isCancel = log.action.includes("CANCELLED");
                  
                  let dotColor = 'var(--text-muted)';
                  if (isApprove) dotColor = 'var(--primary-sage)';
                  else if (isCreate) dotColor = 'var(--primary-teal)';
                  else if (isCancel) dotColor = '#ef4444';

                  return (
                    <div key={log.id} style={{ display: 'flex', gap: '10px', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '10px' }}>
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: dotColor,
                        marginTop: '5px',
                        flexShrink: 0 
                      }}></div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                          {parseLog(log)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {formatTimeAgo(log.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </main>
  );
}
