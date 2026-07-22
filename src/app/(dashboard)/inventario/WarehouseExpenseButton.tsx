"use client";

import { useState } from "react";

interface WarehouseExpenseButtonProps {
  warehouseId: string;
  warehouseName: string;
  currency: string;
}

export default function WarehouseExpenseButton({
  warehouseId,
  warehouseName,
  currency
}: WarehouseExpenseButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState(currency === "USD" ? "20.0" : "1.0");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/finanzas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "EXPENSE",
          category: "BODEGA_OPERACION",
          amount: parseFloat(amount),
          currency,
          exchangeRate: parseFloat(exchangeRate) || 1.0,
          description: description || `Gastos de operación de la bodega ${warehouseName}`,
          date,
          warehouseId
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Error al registrar el gasto de la bodega.");
      }

      alert("🎉 ¡Gastos de operación de bodega registrados exitosamente!");
      setIsOpen(false);
      setAmount("");
      setDescription("");
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-premium btn-primary-teal"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "0.95rem",
          fontWeight: 700,
          padding: "10px 18px"
        }}
      >
        <span>📝</span> Registrar Gastos de Operación
      </button>

      {isOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(5px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }}>
          <div className="glass-card animate-scale-in" style={{ width: "90%", maxWidth: "480px", padding: "30px", position: "relative", color: "white" }}>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "white", marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              Registrar Gasto de Operación - {warehouseName}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>
                    MONTO ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Monto en ${currency}`}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>
                    TIPO DE CAMBIO
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    disabled={currency === "MXN"}
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    style={{ width: "100%", background: currency === "MXN" ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: currency === "MXN" ? "#6b7280" : "white" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>
                  MES CORRESPONDIENTE
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>
                  DETALLES / COMENTARIOS
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`Ejemplo: Renta del mes + gastos de maniobras por descarga.`}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{ background: "none", border: "1px solid var(--border-color)", color: "white", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: 700 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-premium btn-primary-teal"
                  style={{ padding: "10px 24px", borderRadius: "10px", fontWeight: 700 }}
                >
                  {isSubmitting ? "Registrando..." : "Guardar Gasto"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
