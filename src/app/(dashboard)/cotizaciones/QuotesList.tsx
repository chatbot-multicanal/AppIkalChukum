"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateOrderStatusAction } from "@/app/(dashboard)/pedidos/actions";

interface QuoteItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Quote {
  id: string;
  quoteNumber: string;
  clientId: string;
  status: string;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  tax: number;
  total: number;
  shippingCost?: number;
  deliveryMethod?: string;
  shippingQuoteStatus?: string;
  shippingOptions?: string | null;
  createdAt: string;
  client: {
    name: string;
  };
  user: {
    name: string;
  };
  order?: {
    id: string;
    status: string;
  } | null;
}

interface QuotesListProps {
  initialQuotes: any[];
}

export default function QuotesList({ initialQuotes }: QuotesListProps) {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPendingFreight, setFilterPendingFreight] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("VENDEDOR");
  const router = useRouter();

  // Read cookies in client-side useEffect
  useEffect(() => {
    const getCookie = (name: string) => {
      if (typeof document === "undefined") return "";
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(";").shift() || "");
      return "";
    };
    setUserRole(getCookie("user_role") || "VENDEDOR");
  }, []);

  const handleUpdateOrderStatus = async (orderId: string, quoteId: string, newStatus: "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED") => {
    const statusMsg = newStatus === "SHIPPED" ? "Listo para su Entrega" : "Entregado";
    if (!confirm(`¿Seguro que deseas marcar este pedido como ${statusMsg}?`)) {
      return;
    }
    
    setIsProcessing(quoteId);
    try {
      const res = await updateOrderStatusAction(orderId, newStatus);
      if (res.success) {
        // Update status in local quotes state
        setQuotes(prev => prev.map(q => {
          if (q.order?.id === orderId) {
            return {
              ...q,
              order: {
                ...q.order,
                status: newStatus
              }
            };
          }
          return q;
        }));
        alert(`Pedido actualizado a ${statusMsg} con éxito.`);
      } else {
        alert("Error al actualizar estado: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  // Approve a Quote (DRAFT -> APPROVED)
  const handleApprove = async (quoteId: string) => {
    setIsProcessing(quoteId);
    try {
      const response = await fetch(`/api/cotizaciones/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al aprobar la cotización");
      }

      // Update state locally
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: "APPROVED" } : q));

      if (result.warning) {
        alert(`Cotización Aprobada con Advertencia:\n\n${result.warning}`);
      } else {
        alert("Cotización aprobada exitosamente.");
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  // Reject a Quote (DRAFT/SENT -> REJECTED)
  const handleReject = async (quoteId: string) => {
    if (!confirm("¿Estás seguro de que deseas rechazar esta cotización?")) return;
    setIsProcessing(quoteId);
    try {
      const response = await fetch(`/api/cotizaciones/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al rechazar la cotización");
      }

      // Update state locally
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: "REJECTED" } : q));
      alert("Cotización rechazada exitosamente.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  // Convert Approved Quote to Order (1-Click)
  const handleCreateOrder = async (quoteId: string) => {
    setIsProcessing(quoteId);
    try {
      const response = await fetch(`/api/cotizaciones/${quoteId}/pedido`, {
        method: "POST"
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear el pedido");
      }

      alert("¡Pedido creado con éxito! El inventario ha sido descontado.");
      
      // Refresh the page or redirect to Kanban board
      router.push("/pedidos");
    } catch (err: any) {
      // Hard block notification (e.g. stock validation failed)
      alert(err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  // Calculate stats dynamically
  const draftCount = quotes.filter(q => q.status === "DRAFT").length;
  const sentCount = quotes.filter(q => q.status === "SENT").length;
  const approvedCount = quotes.filter(q => q.status === "APPROVED" || (q.order && q.order.status !== "CANCELLED")).length;
  const totalCount = quotes.length;
  const conversionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  return (
    <div className="animate-fade-in">
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pendientes Aprobación</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px' }}>{draftCount}</div>
        </div>
        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enviadas</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px' }}>{sentCount}</div>
        </div>
        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Aprobadas / Con Pedido</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--primary-sage)' }}>{approvedCount}</div>
        </div>
        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Conversión</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--primary-teal)' }}>{conversionRate}%</div>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Buscar por folio o cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-color)",
            color: "white",
            outline: "none",
            fontSize: "0.85rem",
            width: "100%",
            maxWidth: "320px"
          }}
        />

        <button
          type="button"
          onClick={() => setFilterPendingFreight(!filterPendingFreight)}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: filterPendingFreight ? "1px solid #ff9f43" : "1px solid var(--border-color)",
            background: filterPendingFreight ? "rgba(255, 159, 67, 0.12)" : "rgba(255,255,255,0.01)",
            color: filterPendingFreight ? "#ff9f43" : "var(--text-secondary)",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          {filterPendingFreight ? "🧡 Mostrando: Fletes Pendientes" : "⌛ Filtrar: Fletes Pendientes Miami"}
        </button>
      </div>

      {/* List */}
      <div className="glass-card" style={{ padding: '32px', overflowX: 'auto' }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Cliente</th>
              <th>Fecha de Creación</th>
              <th>Tipo de Cambio</th>
              <th>Total</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const filteredQuotes = quotes.filter(quote => {
                const matchesSearch = 
                  quote.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  quote.client.name.toLowerCase().includes(searchQuery.toLowerCase());
                
                const matchesFreight = !filterPendingFreight || quote.shippingQuoteStatus === "PENDING_MIAMI";
                
                return matchesSearch && matchesFreight;
              });

              if (filteredQuotes.length === 0) {
                return (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No se encontraron cotizaciones con los filtros aplicados.
                    </td>
                  </tr>
                );
              }

              return filteredQuotes.map((quote) => {
                const hasOrder = !!quote.order && quote.order.status !== "CANCELLED";
                const isBtnLoading = isProcessing === quote.id;

                return (
                  <tr key={quote.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>{quote.quoteNumber}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Creado por: {quote.user.name}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{quote.client.name}</div>
                      <div style={{ marginTop: '4px' }}>
                        {quote.deliveryMethod === "RECOLECTA" ? (
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary-sage)', background: 'rgba(164,189,145,0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(164,189,145,0.2)' }}>
                            Recolecta Local
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary-teal)', background: 'rgba(29,128,136,0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(29,128,136,0.2)' }}>
                            Envío a Domicilio
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(quote.createdAt).toLocaleDateString("es-MX", { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>
                      {quote.currency} ({quote.exchangeRate.toFixed(2)})
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      ${quote.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {quote.currency}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {hasOrder ? (
                          <span className="badge badge-approved" style={{ border: "1px solid var(--primary-teal)", alignSelf: "flex-start" }}>Con Pedido</span>
                        ) : (
                          <span className={`badge ${
                            quote.status === "APPROVED" ? "badge-approved" : 
                            quote.status === "SENT" ? "badge-pending" : 
                            quote.status === "REJECTED" ? "badge-cancelled" : 
                            "badge-pending"
                          }`} style={{ alignSelf: "flex-start" }}>
                             {quote.status === "APPROVED" ? "Aprobada" : 
                              quote.status === "SENT" ? "Enviada" : 
                              quote.status === "REJECTED" ? "Rechazada" : 
                              "Pendiente Aprobación"}
                          </span>
                        )}

                        {quote.shippingQuoteStatus === "PENDING_MIAMI" && (quote.shippingCost || 0) === 0 && (
                          <span className="badge" style={{
                            backgroundColor: "rgba(255, 159, 67, 0.08)",
                            color: "#ff9f43",
                            border: "1px solid rgba(255, 159, 67, 0.3)",
                            alignSelf: "flex-start",
                            fontSize: "0.75rem",
                            padding: "3px 6px"
                          }}>
                            ⌛ Flete Miami Pendiente
                          </span>
                        )}

                        {(quote.shippingQuoteStatus === "QUOTED" || (quote.shippingQuoteStatus === "PENDING_MIAMI" && (quote.shippingCost || 0) > 0)) && (
                          <span className="badge" style={{
                            backgroundColor: "rgba(164, 189, 145, 0.08)",
                            color: "var(--primary-sage)",
                            border: "1px solid rgba(164, 189, 145, 0.3)",
                            alignSelf: "flex-start",
                            fontSize: "0.75rem",
                            padding: "3px 6px"
                          }}>
                            ✓ Flete Miami Cotizado
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {hasOrder ? (() => {
                        const orderStatus = quote.order?.status;
                        const orderId = quote.order?.id;
                        
                        if (orderStatus === "PENDING") {
                          return (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, marginRight: '12px' }}>
                              ⌛ Pendiente Asignar Bodega
                            </span>
                          );
                        }
                        
                        if (orderStatus === "PREPARING") {
                          return (
                            <button
                              onClick={() => orderId && handleUpdateOrderStatus(orderId, quote.id, "SHIPPED")}
                              disabled={isProcessing === quote.id}
                              className="btn-premium"
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.8rem', 
                                borderRadius: '8px', 
                                cursor: 'pointer', 
                                marginRight: '12px',
                                background: 'linear-gradient(135deg, #9b59b6 0%, #7d3c98 100%)',
                                color: '#ffffff',
                                border: 'none'
                              }}
                            >
                              {isProcessing === quote.id ? "Procesando..." : "Pedido listo para su entrega"}
                            </button>
                          );
                        }
                        
                        if (orderStatus === "SHIPPED") {
                          return (
                            <button
                              onClick={() => orderId && handleUpdateOrderStatus(orderId, quote.id, "DELIVERED")}
                              disabled={isProcessing === quote.id}
                              className="btn-premium"
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.8rem', 
                                borderRadius: '8px', 
                                cursor: 'pointer', 
                                marginRight: '12px',
                                background: 'linear-gradient(135deg, var(--primary-sage) 0%, #7d966a 100%)',
                                color: '#ffffff',
                                border: 'none'
                              }}
                            >
                              {isProcessing === quote.id ? "Procesando..." : "Producto entregado"}
                            </button>
                          );
                        }
                        
                        if (orderStatus === "DELIVERED") {
                          return (
                            <span style={{ color: 'var(--primary-sage)', fontSize: '0.85rem', fontWeight: 700, marginRight: '12px' }}>
                              ✅ Entregado
                            </span>
                          );
                        }
                        
                        return (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, marginRight: '12px' }}>
                            Pedido Creado ✓
                          </span>
                        );
                      })() : (
                        <>
                          {/* Crear Pedido si la cotización está aprobada */}
                          {quote.status === "APPROVED" && (
                            <button 
                              onClick={() => handleCreateOrder(quote.id)}
                              disabled={isBtnLoading}
                              className="btn-premium btn-primary-teal"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer', marginRight: '12px' }}
                            >
                              {isBtnLoading ? "Procesando..." : "Crear Pedido"}
                            </button>
                          )}

                          {/* Opciones de administrador: Aprobar y Rechazar */}
                          {userRole === "ADMIN" && (
                            <>
                              {quote.status !== "APPROVED" && quote.status !== "REJECTED" && (
                                <button 
                                  onClick={() => handleApprove(quote.id)}
                                  disabled={isBtnLoading}
                                  className="btn-premium btn-secondary-sage"
                                  style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer', marginRight: '12px' }}
                                >
                                  {isBtnLoading ? "Aprobando..." : "Aprobar"}
                                </button>
                              )}

                              {quote.status !== "REJECTED" && (
                                <button 
                                  onClick={() => handleReject(quote.id)}
                                  disabled={isBtnLoading}
                                  className="btn-premium"
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: '0.8rem', 
                                    borderRadius: '8px', 
                                    cursor: 'pointer', 
                                    marginRight: '12px', 
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                    color: '#ef4444', 
                                    border: '1px solid rgba(239, 68, 68, 0.3)' 
                                  }}
                                >
                                  {isBtnLoading ? "Procesando..." : "Rechazar"}
                                </button>
                              )}
                            </>
                          )}

                          {/* Botón de Editar / Agregar Costo Envío */}
                          {(!hasOrder && quote.status !== "APPROVED" && quote.status !== "REJECTED" && (userRole !== "BODEGA" || quote.deliveryMethod === "ENVIO")) && (
                            <Link href={`/cotizaciones/${quote.id}/editar`} style={{ textDecoration: 'none' }}>
                              <button 
                                className="btn-premium"
                                style={{ 
                                  padding: '6px 12px', 
                                  fontSize: '0.8rem', 
                                  borderRadius: '8px', 
                                  cursor: 'pointer',
                                  marginRight: '12px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: '#ffffff',
                                  border: '1px solid rgba(255, 255, 255, 0.15)'
                                }}
                              >
                                {quote.shippingQuoteStatus === "PENDING_MIAMI" && (quote.shippingCost || 0) === 0 ? "Agregar Costo Envío" : "Editar"}
                              </button>
                            </Link>
                          )}
                        </>
                      )}
                      
                      <button 
                        onClick={() => window.open(`/cotizaciones/${quote.id}/imprimir`, '_blank')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Descargar PDF
                      </button>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
