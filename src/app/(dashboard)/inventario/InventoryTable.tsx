"use client";

import { useState, useEffect } from "react";
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
  userRole?: string;
}

const getDisplayPrice = (
  sku: string, 
  originalPrice: number, 
  isCostPrice: boolean, 
  isMiami: boolean, 
  mode: "kit" | "unit"
): number => {
  if (isMiami) {
    if (mode === "kit") {
      switch (sku) {
        case "BIDON-RES-001":
          return isCostPrice ? 70.0 : 90.0;
        case "SACO-NAT-001":
        case "SACO-GRS-002":
          return isCostPrice ? 220.0 : 300.0;
        case "SACO-PDR-003":
        case "SACO-AZM-004":
        case "SACO-VJD-005":
        case "SACO-AMH-006":
          return isCostPrice ? 232.0 : 312.0;
        case "SACO-PXR-007":
          return isCostPrice ? 250.0 : 330.0;
        case "SACO-NGR-008":
        case "SACO-TRA-009":
          return isCostPrice ? 270.0 : 350.0;
        default:
          return originalPrice;
      }
    } else {
      switch (sku) {
        case "BIDON-RES-001":
          return isCostPrice ? 70.0 : 90.0;
        case "SACO-NAT-001":
          return isCostPrice ? 50.0 : 70.0;
        case "SACO-GRS-002":
        case "SACO-PDR-003":
        case "SACO-AZM-004":
        case "SACO-VJD-005":
        case "SACO-AMH-006":
          return isCostPrice ? 54.0 : 74.0;
        case "SACO-PXR-007":
          return isCostPrice ? 60.0 : 80.0;
        case "SACO-NGR-008":
        case "SACO-TRA-009":
          return isCostPrice ? 66.66 : 86.66;
        default:
          return originalPrice;
      }
    }
  } else {
    if (mode === "kit") {
      switch (sku) {
        case "SACO-NAT-001":
        case "SACO-GRS-002":
          return isCostPrice ? 805.0 : 1300.0;
        case "SACO-PDR-003":
        case "SACO-AZM-004":
        case "SACO-VJD-005":
        case "SACO-AMH-006":
          return isCostPrice ? 850.0 : 1350.0;
        case "SACO-PXR-007":
          return isCostPrice ? 850.0 : 1400.0;
        case "SACO-NGR-008":
        case "SACO-TRA-009":
          return isCostPrice ? 850.0 : 1500.0;
        default:
          return originalPrice;
      }
    } else {
      return originalPrice;
    }
  }
};

const formatName = (name: string, isMiami: boolean, mode: "kit" | "unit"): string => {
  if (mode === "kit") {
    return name.replace("Saco ", "Kit ");
  }
  return name;
};

const formatSku = (sku: string, isMiami: boolean, mode: "kit" | "unit"): string => {
  if (mode === "kit") {
    return sku.replace("SACO-", "KIT-");
  }
  return sku;
};

const formatUnit = (sku: string, isMiami: boolean, plural: boolean, mode: "kit" | "unit"): string => {
  if (sku.startsWith("BIDON-")) {
    return plural ? "bidones" : "bidón";
  }
  if (mode === "kit") {
    return plural ? "kits" : "kit";
  }
  return plural ? "sacos" : "saco";
};

export default function InventoryTable({
  initialItems,
  warehouseId,
  warehouseName,
  showCost,
  isAdmin,
  userRole = "VENDEDOR",
}: InventoryTableProps) {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [viewMode, setViewMode] = useState<"kit" | "unit">("kit");

  // Comments states
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isGeneralCommentsOpen, setIsGeneralCommentsOpen] = useState(false);
  const [commentingItem, setCommentingItem] = useState<InventoryItem | null>(null);

  // Sync initialItems state when they change externally (e.g. changing warehouse filter)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/inventario/comentarios?warehouseId=${warehouseId}`);
      const data = await res.json();
      if (data.success) {
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Error loading comments:", err);
    }
  };

  useEffect(() => {
    loadComments();
  }, [warehouseId]);

  const handleAddComment = async (productId: string | null) => {
    if (!newCommentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch("/api/inventario/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newCommentText,
          warehouseId,
          productId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewCommentText("");
        await loadComments();
      } else {
        alert(data.error || "Error al agregar comentario");
      }
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getProductCommentCount = (productId: string) => {
    return comments.filter((c) => c.productId === productId).length;
  };

  const getGeneralCommentCount = () => {
    return comments.filter((c) => !c.productId).length;
  };

  const handleExportExcel = () => {
    import("xlsx").then((XLSX) => {
      const isMiami = warehouseName.includes("Miami");
      const dataToExport = items.map((item) => {
        const sku = formatSku(item.product.sku, isMiami, viewMode);
        const name = formatName(item.product.name, isMiami, viewMode);
        const costPrice = getDisplayPrice(item.product.sku, item.product.costPrice || 0, true, isMiami, viewMode);
        const basePrice = getDisplayPrice(item.product.sku, item.product.basePrice, false, isMiami, viewMode);

        return {
          "SKU": sku,
          "Producto": name,
          "Color": item.product.color || "N/A",
          "Bodega": warehouseName,
          "Cantidad": item.quantity,
          "Estado": item.quantity === 0 ? "Agotado" : item.quantity < LOW_STOCK_THRESHOLD ? "Stock Bajo" : "Suficiente",
          ...(showCost ? { "Costo Compra": costPrice } : {}),
          "Precio Base": basePrice,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

      // Set nice column widths
      const maxLens = Object.keys(dataToExport[0] || {}).map(key => {
        return Math.max(
          key.length,
          ...dataToExport.map(row => String((row as any)[key] ?? "").length)
        );
      });
      worksheet["!cols"] = maxLens.map(len => ({ wch: len + 3 }));

      const fileName = `Inventario-${warehouseName.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    });
  };

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
          Stock en {warehouseName}
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Selector de modo de vista */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", marginRight: "10px" }}>
            <button
              onClick={() => setViewMode("kit")}
              style={{
                background: viewMode === "kit" ? "var(--primary-teal)" : "none",
                color: viewMode === "kit" ? "#ffffff" : "var(--text-secondary)",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              📦 Vista por Kit
            </button>
            <button
              onClick={() => setViewMode("unit")}
              style={{
                background: viewMode === "unit" ? "var(--primary-teal)" : "none",
                color: viewMode === "unit" ? "#ffffff" : "var(--text-secondary)",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              🛍️ Vista por Unidad (Saco)
            </button>
          </div>

          <button
            onClick={() => setIsGeneralCommentsOpen(true)}
            className="btn-premium btn-secondary-sage"
            style={{ padding: "8px 16px", fontSize: "0.85rem" }}
          >
            💬 Notas de Bodega ({getGeneralCommentCount()})
          </button>
          <button
            onClick={handleExportExcel}
            className="btn-premium btn-primary-teal"
            style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Código SKU</th>
              <th>Bodega</th>
              {showCost && <th>Costo Compra</th>}
              <th>Precio Base</th>
              <th>Cantidad</th>
              <th>Estado</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7 + (showCost ? 1 : 0)} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
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
                        {formatName(item.product.name, warehouseName.includes("Miami"), viewMode)}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Color: {item.product.color || "N/A"}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        {formatSku(item.product.sku, warehouseName.includes("Miami"), viewMode)}
                      </span>
                    </td>
                    <td>{warehouseName}</td>
                    {showCost && (
                      <td style={{ color: "var(--text-secondary)" }}>
                        ${getDisplayPrice(
                          item.product.sku,
                          item.product.costPrice || 0,
                          true,
                          warehouseName.includes("Miami"),
                          viewMode
                        ).toLocaleString("es-MX", { minimumFractionDigits: 2 })} {warehouseName.includes("Miami") ? "USD" : "MXN"}
                      </td>
                    )}
                    <td>
                      ${getDisplayPrice(
                        item.product.sku,
                        item.product.basePrice,
                        false,
                        warehouseName.includes("Miami"),
                        viewMode
                      ).toLocaleString("es-MX", { minimumFractionDigits: 2 })} {warehouseName.includes("Miami") ? "USD" : "MXN"}
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
                    <td style={{ textAlign: "right" }}>
                      {isAdmin && (
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
                      )}
                      <button
                        onClick={() => handleOpenHistory(item)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          fontWeight: 600,
                          marginRight: "12px",
                          fontSize: "0.9rem",
                        }}
                      >
                        Historial
                      </button>
                      <button
                        onClick={() => setCommentingItem(item)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--primary-sage)",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.9rem",
                        }}
                      >
                        💬 Notas ({getProductCommentCount(item.productId)})
                      </button>
                    </td>
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
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>⚙️ Ajustar Stock Inventario</h2>
              <button onClick={() => setAdjustingItem(null)} style={closeButtonStyle}>×</button>
            </div>

            <div style={{ marginBottom: "16px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.85rem" }}>
              <div><strong>Bodega:</strong> {warehouseName}</div>
              <div><strong>Producto:</strong> {formatName(adjustingItem.product.name, warehouseName.includes("Miami"), viewMode)} ({formatSku(adjustingItem.product.sku, warehouseName.includes("Miami"), viewMode)})</div>
              <div><strong>Stock Actual:</strong> <span style={{ fontWeight: "bold" }}>{adjustingItem.quantity.toFixed(1)} {formatUnit(adjustingItem.product.sku, warehouseName.includes("Miami"), true, viewMode)}</span></div>
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
                <label style={labelStyle}>Cantidad ({formatUnit(adjustingItem.product.sku, warehouseName.includes("Miami"), true, viewMode).charAt(0).toUpperCase() + formatUnit(adjustingItem.product.sku, warehouseName.includes("Miami"), true, viewMode).slice(1)}) *</label>
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
          <div className="modal-content-card" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>📜 Historial de Movimientos</h2>
              <button onClick={() => setHistoryItem(null)} style={closeButtonStyle}>×</button>
            </div>

            <div style={{ marginBottom: "16px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.85rem" }}>
              <div><strong>Bodega:</strong> {warehouseName}</div>
              <div><strong>Producto:</strong> {formatName(historyItem.product.name, warehouseName.includes("Miami"), viewMode)} ({formatSku(historyItem.product.sku, warehouseName.includes("Miami"), viewMode)})</div>
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

      {/* MODAL: COMENTARIOS GENERALES DE BODEGA */}
      {isGeneralCommentsOpen && (
        <div style={modalBackdropStyle} onClick={() => { setIsGeneralCommentsOpen(false); setNewCommentText(""); }}>
          <div className="modal-content-card" style={{ maxWidth: "550px", width: "95%", background: "rgba(18, 24, 38, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "20px", padding: "30px", color: "#ffffff", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>💬 Notas Generales: {warehouseName}</h2>
              <button onClick={() => { setIsGeneralCommentsOpen(false); setNewCommentText(""); }} style={closeButtonStyle}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px", maxHeight: "250px", overflowY: "auto", paddingRight: "6px" }}>
              {comments.filter(c => !c.productId).length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "0.85rem" }}>
                  No hay notas generales registradas.
                </div>
              ) : (
                comments.filter(c => !c.productId).map(c => (
                  <div key={c.id} style={{ padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "10px", fontSize: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--primary-sage)", fontWeight: 600, fontSize: "0.75rem", marginBottom: "4px" }}>
                      <span>{c.user.name} ({c.user.role})</span>
                      <span style={{ color: "var(--text-muted)" }}>{new Date(c.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p style={{ margin: 0, color: "#ffffff", whiteSpace: "pre-wrap" }}>{c.content}</p>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={labelStyle}>Escribir nueva nota/comentario general</label>
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Escribe aquí notas sobre recepción, faltantes o avisos de la bodega..."
                style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                disabled={isSubmittingComment}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => { setIsGeneralCommentsOpen(false); setNewCommentText(""); }}
                  style={btnCancelStyle}
                  disabled={isSubmittingComment}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => handleAddComment(null)}
                  style={btnSubmitStyle}
                  disabled={isSubmittingComment || !newCommentText.trim()}
                >
                  {isSubmittingComment ? "Enviando..." : "Guardar Nota"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMENTARIOS DE PRODUCTO INDIVIDUAL */}
      {commentingItem && (
        <div style={modalBackdropStyle} onClick={() => { setCommentingItem(null); setNewCommentText(""); }}>
          <div className="modal-content-card" style={{ maxWidth: "550px", width: "95%", background: "rgba(18, 24, 38, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "20px", padding: "30px", color: "#ffffff", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>💬 Notas: {formatName(commentingItem.product.name, warehouseName.includes("Miami"), viewMode)}</h2>
              <button onClick={() => { setCommentingItem(null); setNewCommentText(""); }} style={closeButtonStyle}>×</button>
            </div>

            <div style={{ marginBottom: "16px", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              SKU: {formatSku(commentingItem.product.sku, warehouseName.includes("Miami"), viewMode)} | Bodega: {warehouseName} | Stock: {commentingItem.quantity.toFixed(1)} {formatUnit(commentingItem.product.sku, warehouseName.includes("Miami"), true, viewMode)}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px", maxHeight: "250px", overflowY: "auto", paddingRight: "6px" }}>
              {comments.filter(c => c.productId === commentingItem.productId).length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "0.85rem" }}>
                  No hay comentarios sobre este producto en esta bodega.
                </div>
              ) : (
                comments.filter(c => c.productId === commentingItem.productId).map(c => (
                  <div key={c.id} style={{ padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "10px", fontSize: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--primary-sage)", fontWeight: 600, fontSize: "0.75rem", marginBottom: "4px" }}>
                      <span>{c.user.name} ({c.user.role})</span>
                      <span style={{ color: "var(--text-muted)" }}>{new Date(c.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p style={{ margin: 0, color: "#ffffff", whiteSpace: "pre-wrap" }}>{c.content}</p>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={labelStyle}>Agregar nota o reporte para este producto</label>
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Escribe observaciones de empaque, daños, mermas o lotes..."
                style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                disabled={isSubmittingComment}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => { setCommentingItem(null); setNewCommentText(""); }}
                  style={btnCancelStyle}
                  disabled={isSubmittingComment}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => handleAddComment(commentingItem.productId)}
                  style={btnSubmitStyle}
                  disabled={isSubmittingComment || !newCommentText.trim()}
                >
                  {isSubmittingComment ? "Enviando..." : "Guardar Nota"}
                </button>
              </div>
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
