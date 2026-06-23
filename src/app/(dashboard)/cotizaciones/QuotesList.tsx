"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  deliveryMethod?: string;
  createdAt: string;
  client: {
    name: string;
  };
  user: {
    name: string;
  };
  order?: {
    id: string;
  } | null;
}

interface QuotesListProps {
  initialQuotes: any[];
}

export default function QuotesList({ initialQuotes }: QuotesListProps) {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
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
  const approvedCount = quotes.filter(q => q.status === "APPROVED" || q.order).length;
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
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No hay cotizaciones registradas.
                </td>
              </tr>
            ) : (
              quotes.map((quote) => {
                const hasOrder = !!quote.order;
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
                      {hasOrder ? (
                        <span className="badge badge-approved" style={{ border: "1px solid var(--primary-teal)" }}>Con Pedido</span>
                      ) : (
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
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {hasOrder ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, marginRight: '12px' }}>
                          Pedido Creado ✓
                        </span>
                      ) : (
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

                          {/* Botón de Editar para cualquier rol si no hay pedido */}
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
                              Editar
                            </button>
                          </Link>
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
