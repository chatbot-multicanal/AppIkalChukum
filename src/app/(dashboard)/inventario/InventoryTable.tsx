"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustStockAction, getInventoryHistoryAction } from "./actions";

interface Product {
  id: string;
  sku: string;
  name: string;
  color: string | null;
  basePrice: number;
  costPrice: number | null;
}

interface InventoryItem {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  product: Product;
}

interface InventoryTableProps {
  initialItems: InventoryItem[];
  warehouseId: string;
  warehouseName: string;
  showCost: boolean;
  isAdmin: boolean;
}

export default function InventoryTable({
  initialItems,
  warehouseId,
  warehouseName,
  showCost,
  isAdmin,
}: InventoryTableProps) {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>(initialItems);

  // Modal states
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  // Form states (Ajuste)
  const [adjType, setAdjType] = useState<"ADD" | "SUB">("ADD");
  const [adjQty, setAdjQty] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History states
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const LOW_STOCK_THRESHOLD = 15.0;

  // Open adjustment modal
  const handleOpenAdjust = (item: InventoryItem) => {
    setAdjustingItem(item);
    setAdjType("ADD");
    setAdjQty("");
    setAdjReason("");
    setError(null);
  };

  // Open history modal
  const handleOpenHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setIsLoadingHistory(true);
    setHistoryError(null);
    setHistoryLogs([]);

    const res = await getInventoryHistoryAction(warehouseId, item.productId);
    if (res.success) {
      setHistoryLogs(res.history || []);
    } else {
      setHistoryError(res.error || "No se pudo cargar el historial.");
    }
    setIsLoadingHistory(false);
  };

  // Submit adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    setError(null);
    setIsSubmitting(true);

    const qty = parseFloat(adjQty);
    if (isNaN(qty) || qty <= 0) {
      setError("La cantidad debe ser un número mayor a cero.");
      setIsSubmitting(false);
      return;
    }

    const finalAdjustment = adjType === "ADD" ? qty : -qty;

    const res = await adjustStockAction(
      warehouseId,
      adjustingItem.productId,
      finalAdjustment,
      adjReason
    );

    if (res.success && res.inventory) {
      setAdjustingItem(null);
      // Actualizar estado local del item ajustado
      setItems((prev) =>
        prev.map((i) =>
          i.id === adjustingItem.id
            ? { ...i, quantity: res.inventory.quantity }
            : i
        )
      );
      router.refresh();
      alert("¡Stock ajustado exitosamente!");
    } else {
      setError(res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="glass-card" style={{ padding: "32px" }}>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "24px" }}>
        Stock de Kits en {warehouseName}
      </h2>

      <div style={{ overflowX: "auto" }}>
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
              {isAdmin && <th style={{ textAlign: "right" }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6 + (showCost ? 1 : 0) + (isAdmin ? 1 : 0)} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                  No hay inventario registrado en esta bodega.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isLowStock = item.quantity < LOW_STOCK_THRESHOLD;
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: "#ffffff" }}>
                        {item.product.name}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Color: {item.product.color || "N/A"}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        {item.product.sku}
                      </span>
                    </td>
                    <td>{warehouseName}</td>
                    {showCost && (
                      <td style={{ color: "var(--text-secondary)" }}>
                        ${item.product.costPrice?.toLocaleString("es-MX", { minimumFractionDigits: 2 }) || "-"} {warehouseName.includes("Miami") ? "USD" : "MXN"}
                      </td>
                    )}
                    <td>
                      ${item.product.basePrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {warehouseName.includes("Miami") ? "USD" : "MXN"}
                    </td>
                    <td style={{ fontWeight: 700, fontSize: "1.05rem", color: isLowStock && item.quantity > 0 ? "#ff9f43" : item.quantity === 0 ? "#ef4444" : "#ffffff" }}>
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
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => handleOpenAdjust(item)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary-teal)",
                            cursor: "pointer",
                            fontWeight: 600,
                            marginRight: "12px",
                            fontSize: "0.9rem",
                          }}
                        >
                          Ajustar
                        </button>
                        <button
                          onClick={() => handleOpenHistory(item)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                          }}
                        >
                          Historial
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: AJUSTAR STOCK */}
      {adjustingItem && (
        <div style={modalBackdropStyle} onClick={() => setAdjustingItem(null)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>⚙️ Ajustar Stock Inventario</h2>
              <button onClick={() => setAdjustingItem(null)} style={closeButtonStyle}>×</button>
            </div>

            <div style={{ marginBottom: "16px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.85rem" }}>
              <div><strong>Bodega:</strong> {warehouseName}</div>
              <div><strong>Producto:</strong> {adjustingItem.product.name} ({adjustingItem.product.sku})</div>
              <div><strong>Stock Actual:</strong> <span style={{ fontWeight: "bold" }}>{adjustingItem.quantity.toFixed(1)} sacos</span></div>
            </div>

            {error && <div style={errorStyle}>⚠️ {error}</div>}

            <form onSubmit={handleAdjustSubmit} style={formStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Tipo de Ajuste *</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setAdjType("ADD")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid " + (adjType === "ADD" ? "var(--primary-teal)" : "rgba(255,255,255,0.1)"),
                      background: adjType === "ADD" ? "rgba(29,128,136,0.15)" : "none",
                      color: adjType === "ADD" ? "var(--primary-teal)" : "var(--text-secondary)",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Agregar (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType("SUB")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid " + (adjType === "SUB" ? "#ef4444" : "rgba(255,255,255,0.1)"),
                      background: adjType === "SUB" ? "rgba(239,68,68,0.15)" : "none",
                      color: adjType === "SUB" ? "#ef4444" : "var(--text-secondary)",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Retirar (-)
                  </button>
                </div>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Cantidad (Sacos) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="ej. 50.0"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  required
                  disabled={isSubmitting}
                  style={inputStyle}
                />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Motivo / Observación *</label>
                <input
                  type="text"
                  placeholder="ej. Abastecimiento local, merma, conteo físico"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  required
                  disabled={isSubmitting}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  disabled={isSubmitting}
                  style={btnCancelStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={btnSubmitStyle}
                >
                  {isSubmitting ? "Guardando..." : "Confirmar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DE MOVIMIENTOS */}
      {historyItem && (
        <div style={modalBackdropStyle} onClick={() => setHistoryItem(null)}>
          <div style={{ ...modalContentStyle, maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>📜 Historial de Movimientos</h2>
              <button onClick={() => setHistoryItem(null)} style={closeButtonStyle}>×</button>
            </div>

            <div style={{ marginBottom: "16px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.85rem" }}>
              <div><strong>Bodega:</strong> {warehouseName}</div>
              <div><strong>Producto:</strong> {historyItem.product.name} ({historyItem.product.sku})</div>
            </div>

            {isLoadingHistory ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
                Cargando bitácora de auditoría...
              </div>
            ) : historyError ? (
              <div style={errorStyle}>⚠️ {historyError}</div>
            ) : historyLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)", fontSize: "0.9rem", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "10px" }}>
                No hay movimientos registrados para este ítem en la bitácora.
              </div>
            ) : (
              <div style={{ maxHeight: "350px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingRight: "6px" }}>
                {historyLogs.map((log) => {
                  const dateStr = new Date(log.createdAt).toLocaleDateString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  const isAdj = log.action === "ADJUST_STOCK";
                  const isTransfer = log.action === "UPDATE";
                  
                  let badgeBg = "rgba(255, 255, 255, 0.05)";
                  let badgeText = "Movimiento";
                  if (isAdj) {
                    badgeBg = log.details.adjustment >= 0 ? "rgba(29, 128, 136, 0.15)" : "rgba(239, 68, 68, 0.15)";
                    badgeText = log.details.adjustment >= 0 ? "Entrada" : "Salida";
                  } else if (isTransfer) {
                    badgeBg = "rgba(155, 89, 182, 0.15)";
                    badgeText = "Transferencia";
                  }

                  return (
                    <div key={log.id} style={{ padding: "14px", border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", padding: "4px 8px", borderRadius: "6px", background: badgeBg, fontWeight: 700, color: isAdj && log.details.adjustment >= 0 ? "var(--primary-teal)" : isAdj ? "#ef4444" : "#9b59b6" }}>
                          {badgeText}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{dateStr}</span>
                      </div>
                      
                      <div style={{ fontSize: "0.85rem", color: "#ffffff", fontWeight: 500 }}>
                        {log.details.message || "Actualización de inventario"}
                      </div>

                      {log.details.reason && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                          Motivo: "{log.details.reason}"
                        </div>
                      )}

                      {isAdj && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "6px", marginTop: "4px" }}>
                          <span>Previo: {log.details.previousQuantity.toFixed(1)} sacos</span>
                          <span>Nuevo: {log.details.newQuantity.toFixed(1)} sacos</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setHistoryItem(null)} style={{ ...btnCancelStyle, flex: "none", width: "120px" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos de los modales (reutilizados del diseño premium de IkalChukum)
const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(8, 11, 17, 0.75)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1100,
};

const modalContentStyle: React.CSSProperties = {
  background: "rgba(18, 24, 38, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "20px",
  width: "100%",
  maxWidth: "480px",
  padding: "30px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  color: "#ffffff",
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  paddingBottom: "12px",
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: "1.8rem",
  cursor: "pointer",
  lineHeight: "1",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "0.8rem",
  fontWeight: 600,
  letterSpacing: "0.2px",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "rgba(8, 11, 17, 0.6)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "10px",
  color: "#ffffff",
  padding: "10px 14px",
  fontSize: "0.9rem",
  outline: "none",
  width: "100%",
};

const errorStyle: React.CSSProperties = {
  backgroundColor: "rgba(239, 68, 68, 0.1)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  borderRadius: "10px",
  color: "#ef4444",
  padding: "10px 14px",
  fontSize: "0.85rem",
  marginBottom: "16px",
  fontWeight: 500,
};

const btnCancelStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "var(--text-secondary)",
  padding: "12px",
  borderRadius: "10px",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
  textAlign: "center",
};

const btnSubmitStyle: React.CSSProperties = {
  flex: 1,
  background: "linear-gradient(135deg, var(--primary-teal) 0%, #156066 100%)",
  color: "#ffffff",
  border: "none",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(29,128,136,0.25)",
};
