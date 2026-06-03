"use client";

import { useState, useEffect } from "react";
import { 
  getOrdersAction, 
  getActiveWarehousesAction, 
  updateOrderStatusAction 
} from "./actions";

interface Warehouse {
  id: string;
  name: string;
  city: string;
  country: string;
}

interface QuoteItem {
  id: string;
  quantity: number;
  product: {
    name: string;
  };
}

interface Order {
  id: string;
  quoteId: string;
  warehouseId: string | null;
  status: "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  scheduledDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  warehouse: Warehouse | null;
  quote: {
    quoteNumber: string;
    subtotal: number;
    total: number;
    client: {
      name: string;
    };
    items: QuoteItem[];
  };
}

interface PedidosClientProps {
  initialOrders: any[];
  initialWarehouses: any[];
  userRole: string;
}

export default function PedidosClient({ initialOrders, initialWarehouses, userRole }: PedidosClientProps) {
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>(initialOrders as any);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses as any);
  
  // State to track which card is selecting a warehouse
  const [selectingWarehouseForId, setSelectingWarehouseForId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  const canModify = userRole === "ADMIN" || userRole === "GERENTE";

  const loadData = async () => {
    setLoading(true);
    const ordersRes = await getOrdersAction();
    if (ordersRes.success) {
      setOrders(ordersRes.orders as any);
    } else {
      alert("Error al cargar pedidos: " + ordersRes.error);
    }

    const whsRes = await getActiveWarehousesAction();
    if (whsRes.success) {
      setWarehouses(whsRes.warehouses);
      if (whsRes.warehouses.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(whsRes.warehouses[0].id);
      }
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
    warehouseId?: string
  ) => {
    if (!canModify) {
      alert("No tienes permisos para modificar pedidos.");
      return;
    }

    setUpdatingId(orderId);
    const res = await updateOrderStatusAction(orderId, newStatus, warehouseId);
    if (res.success) {
      setSelectingWarehouseForId(null);
      await loadData();
    } else {
      alert("Error al actualizar estado: " + res.error);
    }
    setUpdatingId(null);
  };

  // Group orders by columns
  const pendingOrders = orders.filter(o => o.status === "PENDING");
  const preparingOrders = orders.filter(o => o.status === "PREPARING");
  const shippedOrders = orders.filter(o => o.status === "SHIPPED");
  const deliveredOrders = orders.filter(o => o.status === "DELIVERED");
  const cancelledOrders = orders.filter(o => o.status === "CANCELLED");

  const columns = [
    {
      id: "PENDING" as const,
      title: "Por Procesar",
      color: "#ff9f43",
      orders: pendingOrders,
      actionButton: (order: Order) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          {selectingWarehouseForId === order.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Seleccionar Bodega:</label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px',
                  color: '#ffffff',
                  fontSize: '0.8rem'
                }}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => handleUpdateStatus(order.id, "PREPARING", selectedWarehouseId)}
                  disabled={updatingId === order.id}
                  style={{
                    flex: 1,
                    background: 'var(--primary-teal)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setSelectingWarehouseForId(null)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  X
                </button>
              </div>
            </div>
          ) : (
            canModify && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setSelectingWarehouseForId(order.id);
                    if (warehouses.length > 0) setSelectedWarehouseId(warehouses[0].id);
                  }}
                  disabled={updatingId === order.id}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, var(--primary-teal) 0%, #156066 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Iniciar Surtido
                </button>
                <button
                  onClick={() => handleUpdateStatus(order.id, "CANCELLED")}
                  disabled={updatingId === order.id}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            )
          )}
        </div>
      )
    },
    {
      id: "PREPARING" as const,
      title: "En Preparación / Picking",
      color: "var(--primary-teal)",
      orders: preparingOrders,
      actionButton: (order: Order) => (
        canModify && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => handleUpdateStatus(order.id, "SHIPPED")}
              disabled={updatingId === order.id}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #9b59b6 0%, #7d3c98 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Listo para Envío
            </button>
            <button
              onClick={() => handleUpdateStatus(order.id, "CANCELLED")}
              disabled={updatingId === order.id}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: '#ef4444',
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        )
      )
    },
    {
      id: "SHIPPED" as const,
      title: "En Camino / Enviado",
      color: "#9b59b6",
      orders: shippedOrders,
      actionButton: (order: Order) => (
        canModify && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => handleUpdateStatus(order.id, "DELIVERED")}
              disabled={updatingId === order.id}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, var(--primary-sage) 0%, #7d966a 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#080b11',
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Marcar Entregado ✓
            </button>
            <button
              onClick={() => handleUpdateStatus(order.id, "CANCELLED")}
              disabled={updatingId === order.id}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: '#ef4444',
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        )
      )
    },
    {
      id: "DELIVERED" as const,
      title: "Entregados (Comisión)",
      color: "var(--primary-sage)",
      orders: deliveredOrders,
      actionButton: (order: Order) => (
        <div style={{
          marginTop: '12px',
          background: 'rgba(164, 189, 145, 0.1)',
          border: '1px solid rgba(164, 189, 145, 0.2)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: 'var(--primary-sage)',
          fontSize: '0.75rem',
          fontWeight: 700,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <span>ENTREGADO CORRECTAMENTE</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Comisión de Venta: ${(order.quote.subtotal * 0.03).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (3%)
          </span>
        </div>
      )
    },
    {
      id: "CANCELLED" as const,
      title: "Cancelados",
      color: "#ef4444",
      orders: cancelledOrders,
      actionButton: (order: Order) => (
        canModify && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => handleUpdateStatus(order.id, "PENDING")}
              disabled={updatingId === order.id}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔄 Reabrir Pedido
            </button>
          </div>
        )
      )
    }
  ];

  return (
    <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px', minHeight: '65vh', alignItems: 'flex-start' }}>
      {columns.map((col, idx) => (
        <div key={idx} className="glass-card" style={{ 
          minWidth: '300px', 
          maxWidth: '300px', 
          padding: '20px', 
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: 'rgba(12, 15, 23, 0.45)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          flexShrink: 0
        }}>
          {/* Column Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }}></div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>{col.title}</h3>
            </div>
            <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', borderRadius: '8px' }}>
              {col.orders.length}
            </span>
          </div>

          {/* Column Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '100px' }}>
            {col.orders.length === 0 ? (
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '30px 10px',
                border: '1px dashed var(--border-color)',
                borderRadius: '12px'
              }}>
                Sin pedidos en este estado
              </div>
            ) : (
              col.orders.map((order) => {
                // Extract items string list
                const itemsList = order.quote.items.map(item => 
                  `${item.quantity.toFixed(1)} ${item.quantity === 1 ? 'saco' : 'sacos'} - ${item.product.name}`
                ).join(", ");

                const dateStr = new Date(order.createdAt).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "short"
                });

                const isPendingSave = updatingId === order.id;

                return (
                  <div key={order.id} className="glass-card" style={{ 
                    padding: '16px', 
                    borderLeft: `3px solid ${col.color}`,
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderColor: 'rgba(255, 255, 255, 0.04)',
                    boxShadow: 'var(--shadow-sm)',
                    opacity: isPendingSave ? 0.6 : 1
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-teal)' }}>
                        {order.quote.quoteNumber}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {dateStr}
                      </span>
                    </div>
                    
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>{order.quote.client.name}</h4>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '6px', 
                      fontSize: '0.8rem', 
                      color: 'var(--text-secondary)',
                      marginBottom: '8px'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                      <span style={{ lineHeight: 1.3 }}>{itemsList}</span>
                    </div>

                    {/* Fulfilling Warehouse indicator if assigned */}
                    {order.warehouse && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        fontSize: '0.75rem', 
                        color: 'var(--primary-sage)',
                        background: 'rgba(164, 189, 145, 0.05)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(164, 189, 145, 0.15)',
                        width: 'fit-content',
                        marginBottom: '4px'
                      }}>
                        <span>🏠 Bodega: {order.warehouse.name}</span>
                      </div>
                    )}

                    {isPendingSave && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary-teal)', fontWeight: 'bold', margin: '8px 0' }}>
                        Actualizando base de datos...
                      </div>
                    )}

                    {col.actionButton(order)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
