"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Warehouse {
  id: string;
  name: string;
  city: string;
  country: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  color: string | null;
}

interface InventoryItem {
  warehouseId: string;
  productId: string;
  quantity: number;
}

interface InventoryModalsProps {
  warehouses: Warehouse[];
  products: Product[];
  inventoryItems: InventoryItem[];
}

export default function InventoryModals({
  warehouses,
  products,
  inventoryItems,
}: InventoryModalsProps) {
  const router = useRouter();
  
  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form Product State
  const [prodName, setProdName] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodColor, setProdColor] = useState("");
  const [prodBasePrice, setProdBasePrice] = useState("");
  const [prodCostPrice, setProdCostPrice] = useState("");
  const [prodDescription, setProdDescription] = useState("");

  // Form Transfer State
  const [transProductId, setTransProductId] = useState("");
  const [transOriginId, setTransOriginId] = useState("");
  const [transDestId, setTransDestId] = useState("");
  const [transQty, setTransQty] = useState("");
  const [availableStock, setAvailableStock] = useState(0);

  // Calcular stock disponible dinámicamente cuando cambian producto u origen
  useEffect(() => {
    if (transProductId && transOriginId) {
      const match = inventoryItems.find(
        (item) => item.productId === transProductId && item.warehouseId === transOriginId
      );
      setAvailableStock(match ? match.quantity : 0);
    } else {
      setAvailableStock(0);
    }
  }, [transProductId, transOriginId, inventoryItems]);

  // Pre-cargar valores por defecto al abrir modal de transferencia
  useEffect(() => {
    if (showTransferModal) {
      if (products.length > 0) setTransProductId(products[0].id);
      if (warehouses.length > 0) {
        setTransOriginId(warehouses[0].id);
        if (warehouses.length > 1) {
          setTransDestId(warehouses[1].id);
        } else {
          setTransDestId(warehouses[0].id);
        }
      }
      setTransQty("");
      setError(null);
    }
  }, [showTransferModal, products, warehouses]);

  // Pre-cargar valores al abrir modal de producto
  useEffect(() => {
    if (showProductModal) {
      setProdName("");
      setProdSku("");
      setProdColor("");
      setProdBasePrice("");
      setProdCostPrice("");
      setProdDescription("");
      setError(null);
    }
  }, [showProductModal]);

  // Manejar creación de producto
  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/inventario/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prodName,
          sku: prodSku,
          color: prodColor || null,
          basePrice: prodBasePrice,
          costPrice: prodCostPrice || null,
          description: prodDescription || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear el producto");
      }

      setShowProductModal(false);
      router.refresh();
      alert("¡Producto registrado con éxito en el catálogo e inventario!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar transferencia de stock
  const handleTransferStock = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/inventario/transferir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: transProductId,
          originWarehouseId: transOriginId,
          destinationWarehouseId: transDestId,
          quantity: transQty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al transferir inventario");
      }

      setShowTransferModal(false);
      router.refresh();
      alert("¡Transferencia de stock realizada exitosamente!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botones disparadores (Tema premium) */}
      <div className="page-header-actions" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button 
          onClick={() => setShowTransferModal(true)}
          className="btn-premium btn-secondary-sage"
        >
          Transferencia de Bodega
        </button>
        <button 
          onClick={() => setShowProductModal(true)}
          className="btn-premium btn-primary-teal"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px" }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nuevo Producto
        </button>
      </div>

      {/* MODAL 1: NUEVO PRODUCTO */}
      {showProductModal && (
        <div style={modalBackdropStyle} onClick={() => setShowProductModal(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700 }}>📦 Nuevo Producto en Catálogo</h2>
              <button onClick={() => setShowProductModal(false)} style={closeButtonStyle}>×</button>
            </div>
            
            {error && <div style={errorStyle}>⚠️ {error}</div>}

            <form onSubmit={handleCreateProduct} style={formStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Nombre del Producto *</label>
                <input
                  type="text"
                  placeholder="ej. Kit Azul Maya"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                  disabled={isLoading}
                  style={inputStyle}
                />
              </div>

              <div className="modal-row">
                <div style={{ ...inputGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Código SKU *</label>
                  <input
                    type="text"
                    placeholder="ej. KIT-AZM-004"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    required
                    disabled={isLoading}
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...inputGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Color</label>
                  <input
                    type="text"
                    placeholder="ej. Azul Maya"
                    value={prodColor}
                    onChange={(e) => setProdColor(e.target.value)}
                    disabled={isLoading}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="modal-row">
                <div style={{ ...inputGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Precio de Venta ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1300.00"
                    value={prodBasePrice}
                    onChange={(e) => setProdBasePrice(e.target.value)}
                    required
                    disabled={isLoading}
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...inputGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Costo de Compra ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="850.00"
                    value={prodCostPrice}
                    onChange={(e) => setProdCostPrice(e.target.value)}
                    disabled={isLoading}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Descripción</label>
                <textarea
                  placeholder="Descripción breve del kit..."
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  disabled={isLoading}
                  style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  disabled={isLoading}
                  style={btnCancelStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={btnSubmitStyle}
                >
                  {isLoading ? "Registrando..." : "Registrar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TRANSFERENCIA DE BODEGA */}
      {showTransferModal && (
        <div style={modalBackdropStyle} onClick={() => setShowTransferModal(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700 }}>🚚 Transferencia física de stock</h2>
              <button onClick={() => setShowTransferModal(false)} style={closeButtonStyle}>×</button>
            </div>

            {error && <div style={errorStyle}>⚠️ {error}</div>}

            <form onSubmit={handleTransferStock} style={formStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Producto a Transferir *</label>
                <select
                  value={transProductId}
                  onChange={(e) => setTransProductId(e.target.value)}
                  required
                  disabled={isLoading}
                  style={selectStyle}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-row">
                <div style={{ ...inputGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Bodega Origen *</label>
                  <select
                    value={transOriginId}
                    onChange={(e) => setTransOriginId(e.target.value)}
                    required
                    disabled={isLoading}
                    style={selectStyle}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ ...inputGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Bodega Destino *</label>
                  <select
                    value={transDestId}
                    onChange={(e) => setTransDestId(e.target.value)}
                    required
                    disabled={isLoading}
                    style={selectStyle}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mostrar stock disponible interactivo */}
              <div style={stockIndicatorStyle}>
                <span>Stock Disponible en Origen:</span>
                <strong style={{ color: availableStock === 0 ? "#ef4444" : "var(--primary-sage)" }}>
                  {availableStock.toFixed(1)} Kits
                </strong>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Cantidad a Transferir (Sacos) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="ej. 15.0"
                  value={transQty}
                  onChange={(e) => setTransQty(e.target.value)}
                  required
                  disabled={isLoading || availableStock === 0}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  disabled={isLoading}
                  style={btnCancelStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || availableStock === 0 || !transQty}
                  style={availableStock === 0 ? btnSubmitDisabledStyle : btnSubmitStyle}
                >
                  {isLoading ? "Transfiriendo..." : "Realizar Transferencia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Estilos de los modales y layouts
const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(8, 11, 17, 0.65)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  animation: "fadeIn 0.2s ease-out",
};

const modalContentStyle: React.CSSProperties = {
  background: "rgba(18, 24, 38, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "20px",
  width: "100%",
  maxWidth: "500px",
  padding: "32px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  color: "#ffffff",
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  paddingBottom: "14px",
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

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const stockIndicatorStyle: React.CSSProperties = {
  backgroundColor: "rgba(29, 128, 136, 0.08)",
  border: "1px dashed rgba(29, 128, 136, 0.2)",
  borderRadius: "10px",
  padding: "10px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "0.85rem",
  fontWeight: 500,
  color: "var(--text-secondary)",
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

const btnSubmitDisabledStyle: React.CSSProperties = {
  ...btnSubmitStyle,
  background: "rgba(29, 128, 136, 0.3)",
  color: "rgba(255, 255, 255, 0.4)",
  cursor: "not-allowed",
  boxShadow: "none",
};
