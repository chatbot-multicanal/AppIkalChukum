"use client";

import { useState } from "react";
import { payCommissionAction } from "./actions";

interface Commission {
  id: string;
  quoteId: string;
  userId: string;
  amount: number;
  status: string;
  scheduledDate: string | null;
  paidDate: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  quote: {
    quoteNumber: string;
    subtotal: number;
    total: number;
    client: {
      name: string;
    };
  };
}

interface CommissionsViewProps {
  initialCommissions: any[];
  currentRole: string;
  currentRate: number;
}

export default function CommissionsView({
  initialCommissions,
  currentRole,
  currentRate,
}: CommissionsViewProps) {
  const [commissions, setCommissions] = useState<Commission[]>(initialCommissions);
  const [rate, setRate] = useState<number>(currentRate);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const isAdmin = currentRole === "ADMIN";
  const isVendor = currentRole === "VENDEDOR";
 
  // Registrar el pago de la comisión
  const handlePayCommission = async (id: string) => {
    if (!confirm("¿Seguro que deseas marcar esta comisión como pagada?")) return;
    setIsUpdating(true);
    const res = await payCommissionAction(id);
    if (res.success) {
      setCommissions(prev =>
        prev.map(c =>
          c.id === id
            ? { ...c, status: "PAID", paidDate: new Date().toISOString() }
            : c
        )
      );
      alert("Comisión marcada como pagada.");
    } else {
      alert("Error: " + res.error);
    }
    setIsUpdating(false);
  };

  // Calcular totales
  const totalPaid = commissions
    .filter((c) => c.status === "PAID")
    .reduce((acc, c) => acc + c.amount, 0);

  const totalPending = commissions
    .filter((c) => c.status === "PENDING")
    .reduce((acc, c) => acc + c.amount, 0);

  const totalCancelled = commissions
    .filter((c) => c.status === "CANCELLED")
    .reduce((acc, c) => acc + c.amount, 0);

  // Filtrar comisiones según estado
  const filteredCommissions = commissions.filter((c) => {
    if (statusFilter === "ALL") return true;
    return c.status === statusFilter;
  });

  // Guardar configuración de comisiones
  const handleSaveRate = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/comisiones/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commission_rate: rate }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar la tasa de comisión");
      }

      alert("Tasa de comisión global actualizada exitosamente.");
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div>
      {/* Page Title */}
      <div className="page-header" style={{ display: "block" }}>
        <div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.5px", marginBottom: "6px" }}>
            Control de Comisiones
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem", fontWeight: 500 }}>
            {isVendor 
              ? "Monitorea tus ganancias por ventas entregadas y el estado de tus pagos." 
              : "Administra y audita las comisiones de los vendedores y configura los parámetros de cálculo."}
          </p>
        </div>
      </div>

      {/* Grid: Stats & Configuration (if Admin) */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: isAdmin ? "3fr 2fr" : "1fr", marginBottom: "40px" }}>
        
        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div className="glass-card" style={{ padding: "24px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Comisiones Pagadas</span>
            <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "8px", color: "var(--primary-sage)" }}>
              ${totalPaid.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
              Total transferido con éxito
            </span>
          </div>

          <div className="glass-card" style={{ padding: "24px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Pendientes de Cobro</span>
            <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "8px", color: "var(--primary-teal)" }}>
              ${totalPending.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
              Pedidos entregados por cobrar
            </span>
          </div>

          {totalCancelled > 0 && (
            <div className="glass-card" style={{ padding: "24px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Anuladas (Cancelado)</span>
              <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "8px", color: "#ef4444" }}>
                ${totalCancelled.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
              </div>
            </div>
          )}
        </div>

        {/* Configuration Panel (Solo ADMIN) */}
        {isAdmin && (
          <div className="glass-card" style={{ padding: "28px", borderLeft: "4px solid var(--primary-teal)" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              ⚙️ Configuración Global de Comisiones
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.4", marginBottom: "20px" }}>
              Define el porcentaje de comisión que reciben los vendedores sobre el <strong>subtotal</strong> de las cotizaciones aprobadas al entregarse.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem", fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Porcentaje de Comisión:</span>
                  <span style={{ color: "var(--primary-teal)", fontSize: "1.05rem" }}>{rate.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="15.0"
                  step="0.5"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  disabled={isUpdating}
                  style={{ width: "100%", accentColor: "var(--primary-teal)", cursor: "pointer" }}
                />
              </div>

              <button
                onClick={handleSaveRate}
                disabled={isUpdating || rate === currentRate}
                className="btn-premium btn-primary-teal"
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  fontSize: "0.85rem", 
                  borderRadius: "10px",
                  cursor: (isUpdating || rate === currentRate) ? "not-allowed" : "pointer",
                  opacity: (rate === currentRate) ? 0.6 : 1
                }}
              >
                {isUpdating ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs / Filter Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          {["ALL", "PENDING", "PAID", "CANCELLED"].map((filter) => {
            const label = 
              filter === "ALL" ? "Todas" : 
              filter === "PENDING" ? "Pendientes" : 
              filter === "PAID" ? "Pagadas" : "Anuladas";
            
            const isActive = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                style={{
                  background: isActive ? "linear-gradient(135deg, rgba(29, 128, 136, 0.15), rgba(29, 128, 136, 0.05))" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isActive ? "rgba(29, 128, 136, 0.25)" : "rgba(255,255,255,0.05)"}`,
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Mostrando {filteredCommissions.length} registro(s)
        </span>
      </div>
      {/* Commissions Table */}
      <div className="glass-card" style={{ padding: "32px", overflowX: "auto" }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Folio Cotización</th>
              {!isVendor && <th>Vendedor</th>}
              <th>Cliente</th>
              <th>Subtotal Cotización</th>
              <th>Monto Comisión</th>
              <th>Estado</th>
              <th>Fecha de Pago / Entrega</th>
              {isAdmin && <th style={{ textAlign: "right" }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filteredCommissions.length === 0 ? (
              <tr>
                <td colSpan={isVendor ? 6 : (isAdmin ? 8 : 7)} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                  No hay comisiones en este estado.
                </td>
              </tr>
            ) : (
              filteredCommissions.map((comm) => {
                const dateToDisplay = 
                  comm.status === "PAID" 
                    ? comm.paidDate 
                    : comm.scheduledDate;
 
                return (
                  <tr key={comm.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: "#ffffff" }}>{comm.quote.quoteNumber}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Registrado: {new Date(comm.createdAt).toLocaleDateString("es-MX")}
                      </div>
                    </td>
                    {!isVendor && (
                      <td>
                        <div style={{ fontWeight: 500 }}>{comm.user.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{comm.user.email}</div>
                      </td>
                    )}
                    <td>{comm.quote.client.name}</td>
                    <td>${comm.quote.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN</td>
                    <td style={{ fontWeight: 700, color: comm.status === "CANCELLED" ? "var(--text-muted)" : "var(--primary-sage)" }}>
                      ${comm.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                    </td>
                    <td>
                      <span className={`badge ${
                        comm.status === "PAID" ? "badge-approved" :
                        comm.status === "PENDING" ? "badge-pending" :
                        "badge-cancelled"
                      }`}>
                        {comm.status === "PAID" ? "Pagada" :
                         comm.status === "PENDING" ? "Pendiente" :
                         "Anulada"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {dateToDisplay ? (
                        <div>
                          <div>{new Date(dateToDisplay).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {comm.status === "PAID" ? "Pagado" : "Estimado"}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: "right" }}>
                        {comm.status === "PENDING" ? (
                          <button
                            onClick={() => handlePayCommission(comm.id)}
                            disabled={isUpdating}
                            style={{
                              background: "linear-gradient(135deg, var(--primary-teal) 0%, #156066 100%)",
                              border: "none",
                              color: "#ffffff",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            Liberar Pago
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
                        )}
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
  );
}
