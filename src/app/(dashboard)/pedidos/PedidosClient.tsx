"use client";

import { useState, useEffect } from "react";
import { 
  getOrdersAction, 
  getActiveWarehousesAction, 
  updateOrderStatusAction,
  acknowledgeOrderAction,
  buyShippoLabelAction,
  scheduleShippoPickupAction
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
    id: string;
    sku: string;
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
  acknowledgedAt?: string | null;
  createdAt: string;
  warehouse: Warehouse | null;
  shippingLabelUrl?: string | null;
  trackingNumber?: string | null;
  shippoTransactionId?: string | null;
  shippoPickupId?: string | null;
  quote: {
    quoteNumber: string;
    subtotal: number;
    total: number;
    clientId: string;
    deliveryMethod: string;
    client: {
      name: string;
    };
    items: QuoteItem[];
    warehouseId?: string | null;
  };
}

interface PedidosClientProps {
  initialOrders: any[];
  initialWarehouses: any[];
  userRole: string;
  userWarehouseId: string | null;
}

export default function PedidosClient({ initialOrders, initialWarehouses, userRole, userWarehouseId }: PedidosClientProps) {
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>(initialOrders as any);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses as any);
  
  // State to track which card is selecting a warehouse
  const [selectingWarehouseForId, setSelectingWarehouseForId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  // States for Shippo Label Generation Modal
  const [shippoRatesOrderId, setShippoRatesOrderId] = useState<string | null>(null);
  const [shippingRates, setShippingRates] = useState<any[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [shippoError, setShippoError] = useState<string | null>(null);
  const [selectedRateId, setSelectedRateId] = useState("");

  // States for Shippo Pickup Modal
  const [pickupOrderId, setPickupOrderId] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupStartTime, setPickupStartTime] = useState("09:00");
  const [pickupEndTime, setPickupEndTime] = useState("17:00");
  const [pickupLocation, setPickupLocation] = useState("Warehouse");
  const [schedulingPickup, setSchedulingPickup] = useState(false);

  const canModify = userRole === "ADMIN" || userRole === "GERENTE";

  const handleOpenShippoModal = async (orderId: string) => {
    setShippoRatesOrderId(orderId);
    setShippingRates([]);
    setLoadingRates(true);
    setShippoError(null);
    setSelectedRateId("");

    const order = orders.find(o => o.id === orderId);
    if (!order) {
      setShippoError("Pedido no encontrado");
      setLoadingRates(false);
      return;
    }

    const originWarehouseId = order.warehouseId || order.quote.warehouseId;
    const destinationClientId = order.quote.clientId;

    // Calcular cantidad de kits
    const kitsCount = order.quote.items
      .filter(it => it.product.sku?.startsWith("KIT-") || it.product.name.toLowerCase().includes("kit"))
      .reduce((sum, it) => sum + it.quantity, 0) || 1;

    try {
      const response = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originWarehouseId,
          destinationClientId,
          kitsCount
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al obtener tarifas de Shippo");
      }

      if (data.rates && data.rates.length > 0) {
        setShippingRates(data.rates);
        setSelectedRateId(data.rates[0].object_id);
      } else {
        setShippingRates([]);
        throw new Error("No se encontraron tarifas de Shippo disponibles.");
      }
    } catch (err: any) {
      console.error(err);
      setShippoError(err.message || "Error al cotizar.");
    } finally {
      setLoadingRates(false);
    }
  };

  const handleBuyLabel = async () => {
    if (!shippoRatesOrderId || !selectedRateId) return;

    setUpdatingId(shippoRatesOrderId);
    setShippoRatesOrderId(null);

    const res = await buyShippoLabelAction(shippoRatesOrderId, selectedRateId);
    
    setUpdatingId(null);
    if (res.success) {
      alert(`Guía comprada exitosamente. Código de rastreo: ${res.trackingNumber}`);
      loadData();
    } else {
      alert("Error al comprar guía: " + res.error);
    }
  };

  const handleOpenPickupModal = (orderId: string) => {
    setPickupOrderId(orderId);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (tomorrow.getDay() === 6) { // Sábado
      tomorrow.setDate(tomorrow.getDate() + 2);
    } else if (tomorrow.getDay() === 0) { // Domingo
      tomorrow.setDate(tomorrow.getDate() + 1);
    }

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    
    setPickupDate(`${year}-${month}-${day}`);
    setPickupStartTime("09:00");
    setPickupEndTime("17:00");
    setPickupLocation("Warehouse");
  };

  const handleSchedulePickup = async () => {
    if (!pickupOrderId || !pickupDate || !pickupStartTime || !pickupEndTime) {
      alert("Por favor completa todos los campos requeridos.");
      return;
    }

    setSchedulingPickup(true);
    const res = await scheduleShippoPickupAction(
      pickupOrderId,
      pickupDate,
      pickupStartTime,
      pickupEndTime,
      pickupLocation
    );
    setSchedulingPickup(false);
    
    if (res.success) {
      alert("Recolección programada exitosamente con Shippo.");
      setPickupOrderId(null);
      loadData();
    } else {
      alert("Error al programar recolección: " + res.error);
    }
  };

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
    const isBodegaAllowed = userRole === "BODEGA" && (newStatus === "PREPARING" || newStatus === "SHIPPED");
    if (!canModify && !isBodegaAllowed) {
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

  const handleAcknowledge = async (orderId: string) => {
    setUpdatingId(orderId);
    const res = await acknowledgeOrderAction(orderId);
    if (res.success) {
      await loadData();
    } else {
      alert("Error al confirmar recepción: " + res.error);
    }
    setUpdatingId(null);
  };

  // Filter orders by warehouse for BODEGA role
  const filteredOrders = userRole === "BODEGA" && userWarehouseId
    ? orders.filter(o => o.warehouseId === userWarehouseId)
    : orders;

  // Group orders by columns
  const pendingOrders = filteredOrders.filter(o => o.status === "PENDING");
  const preparingOrders = filteredOrders.filter(o => o.status === "PREPARING");
  const shippedOrders = filteredOrders.filter(o => o.status === "SHIPPED");
  const deliveredOrders = filteredOrders.filter(o => o.status === "DELIVERED");
  const cancelledOrders = filteredOrders.filter(o => o.status === "CANCELLED");

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
            <>
              {canModify && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const whId = order.warehouseId || order.quote.warehouseId;
                      if (whId) {
                        handleUpdateStatus(order.id, "PREPARING", whId);
                      } else {
                        setSelectingWarehouseForId(order.id);
                        if (warehouses.length > 0) setSelectedWarehouseId(warehouses[0].id);
                      }
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
              )}
              {!canModify && userRole === "BODEGA" && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleUpdateStatus(order.id, "PREPARING", order.warehouseId || order.quote.warehouseId || undefined)}
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
                </div>
              )}
            </>
          )}
        </div>
      )
    },
    {
      id: "PREPARING" as const,
      title: "En Preparación / Picking",
      color: "var(--primary-teal)",
      orders: preparingOrders,
      actionButton: (order: Order) => {
        const isBodega = userRole === "BODEGA";
        
        if (isBodega) {
          if (!order.acknowledgedAt) {
            return (
              <div style={{ display: 'flex', marginTop: '12px' }}>
                <button
                  onClick={() => handleAcknowledge(order.id)}
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
                  Confirmar Recepción (Enterado)
                </button>
              </div>
            );
          } else {
            const isMiamiEnvio = (order.warehouse?.country === "Estados Unidos" || order.warehouse?.name.toLowerCase().includes("miami")) && order.quote.deliveryMethod === "ENVIO";

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-sage)', fontWeight: 600, textAlign: 'center' }}>
                  ✓ Enterado
                </span>
                
                {isMiamiEnvio && !order.shippingLabelUrl ? (
                  <button
                    onClick={() => handleOpenShippoModal(order.id)}
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
                    📦 Generar Guía Shippo
                  </button>
                ) : (
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
                    Dar Salida (Despachar)
                  </button>
                )}
              </div>
            );
          }
        }
        
        const isMiamiEnvio = (order.warehouse?.country === "Estados Unidos" || order.warehouse?.name.toLowerCase().includes("miami")) && order.quote.deliveryMethod === "ENVIO";

        return (
          canModify && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
              {order.acknowledgedAt ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-sage)', fontWeight: 600, textAlign: 'center', marginBottom: '4px' }}>
                  ✓ Recibido en Bodega
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '4px' }}>
                  ⌛ Esperando recepción en bodega
                </span>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                {isMiamiEnvio && !order.shippingLabelUrl ? (
                  <button
                    onClick={() => handleOpenShippoModal(order.id)}
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
                    📦 Generar Guía Shippo
                  </button>
                ) : (
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
                )}
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
            </div>
          )
        );
      }
    },
    {
      id: "SHIPPED" as const,
      title: "En Camino / Enviado",
      color: "#9b59b6",
      orders: shippedOrders,
      actionButton: (order: Order) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          {order.shippingLabelUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255, 255, 255, 0.03)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                📦 Tracking: <strong style={{ color: 'var(--primary-teal)' }}>{order.trackingNumber}</strong>
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <a
                  href={order.shippingLabelUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🖨️ Imprimir Guía
                </a>
                
                {order.shippoPickupId ? (
                  <span style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(164, 189, 145, 0.1)',
                    border: '1px solid rgba(164, 189, 145, 0.2)',
                    borderRadius: '6px',
                    color: 'var(--primary-sage)',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    ✓ Recogida OK
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenPickupModal(order.id)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, var(--primary-teal) 0%, #156066 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📅 Recolección
                  </button>
                )}
              </div>
            </div>
          )}

          {canModify && (
            <div style={{ display: 'flex', gap: '8px' }}>
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
          )}
        </div>
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

      {/* Modal 1: Generar Guía de Envío (Shippo) */}
      {shippoRatesOrderId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '500px',
            backgroundColor: '#0c0f17',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
              📦 Generar Guía de Envío (Shippo)
            </h3>

            {loadingRates && (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--primary-teal)', fontWeight: 600 }}>
                  ⌛ Consultando tarifas en tiempo real con Shippo...
                </span>
              </div>
            )}

            {shippoError && (
              <div style={{
                color: '#ef4444',
                fontSize: '0.85rem',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                marginBottom: '16px'
              }}>
                ⚠️ Error al cotizar: {shippoError}
              </div>
            )}

            {!loadingRates && !shippoError && shippingRates.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Selecciona la tarifa para comprar la guía:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {shippingRates.map((r) => {
                    const isSelected = selectedRateId === r.object_id;
                    return (
                      <div
                        key={r.object_id}
                        onClick={() => setSelectedRateId(r.object_id)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: `1px solid ${isSelected ? 'var(--primary-teal)' : 'var(--border-color)'}`,
                          background: isSelected ? 'rgba(19, 224, 185, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{r.provider}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            {r.servicelevel} ({r.estimated_days} + 1 día margen)
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--primary-teal)' }}>
                            ${parseFloat(r.amount).toFixed(2)} {r.currency}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShippoRatesOrderId(null)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  color: 'var(--text-secondary)',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              {!loadingRates && shippingRates.length > 0 && (
                <button
                  type="button"
                  onClick={handleBuyLabel}
                  disabled={!selectedRateId}
                  style={{
                    background: 'linear-gradient(135deg, var(--primary-teal) 0%, #156066 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    padding: '10px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Comprar Guía
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Programar Recolección (Shippo Pickups) */}
      {pickupOrderId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '450px',
            backgroundColor: '#0c0f17',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
              📅 Programar Recolección
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Fecha de recolección:
                </label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    color: '#ffffff'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Hora inicio:
                  </label>
                  <input
                    type="time"
                    value={pickupStartTime}
                    onChange={(e) => setPickupStartTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      color: '#ffffff'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Hora fin:
                  </label>
                  <input
                    type="time"
                    value={pickupEndTime}
                    onChange={(e) => setPickupEndTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      color: '#ffffff'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Ubicación física del paquete:
                </label>
                <select
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    color: '#ffffff'
                  }}
                >
                  <option value="Warehouse">Bodega / Almacén</option>
                  <option value="Front Door">Puerta Principal</option>
                  <option value="Reception">Recepción</option>
                  <option value="Back Door">Puerta Trasera</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPickupOrderId(null)}
                disabled={schedulingPickup}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  color: 'var(--text-secondary)',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSchedulePickup}
                disabled={schedulingPickup}
                style={{
                  background: 'linear-gradient(135deg, var(--primary-teal) 0%, #156066 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {schedulingPickup ? "Programando..." : "Confirmar Recolección"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
