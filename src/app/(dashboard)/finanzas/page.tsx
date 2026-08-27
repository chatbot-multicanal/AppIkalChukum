"use client";

import { useEffect, useState } from "react";

interface FinanceRecord {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  description: string | null;
  date: string;
  status: string; // "PENDIENTE" o "PAGADO"
  createdAt: string;
  warehouseId?: string | null;
  warehouse?: { name: string } | null;
  user?: { name: string } | null;
}

interface Summary {
  totalIncome: number;
  salesIncome: number;
  manualIncome: number;
  totalExpenses: number;
  netProfit: number;
}

interface ChartMonth {
  monthKey: string;
  monthLabel: string;
  income: number;
  expense: number;
}

interface CategoryBreakdown {
  category: string;
  value: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  RENTA: "🏢 Renta de Espacios",
  SUELDOS: "👥 Sueldos y Nómina",
  MATERIALES: "🪵 Compra de Materiales",
  SERVICIOS: "⚡ Servicios (Luz, Agua, Gas)",
  IMPUESTOS: "📄 Impuestos / Trámites",
  BODEGA_OPERACION: "📦 Gastos Operativos de Bodega",
  OTROS: "⚙️ Otros Gastos/Costos"
};

const CATEGORY_COLORS: Record<string, string> = {
  RENTA: "#3b82f6", // Azul
  SUELDOS: "#8b5cf6", // Violeta
  MATERIALES: "#f59e0b", // Ámbar
  SERVICIOS: "#10b981", // Esmeralda
  IMPUESTOS: "#ec4899", // Rosa
  BODEGA_OPERACION: "#f43f5e", // Rosa fuerte/rojo
  OTROS: "#6b7280"  // Gris
};

export default function FinanzasPage() {
  const [summary, setSummary] = useState<Summary>({
    totalIncome: 0,
    salesIncome: 0,
    manualIncome: 0,
    totalExpenses: 0,
    netProfit: 0
  });
  const [inventoryValue, setInventoryValue] = useState<{ usd: number; mxn: number }>({ usd: 0, mxn: 0 });
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const [salesIncomeByMonth, setSalesIncomeByMonth] = useState<Record<string, number>>({});
  const [chartData, setChartData] = useState<ChartMonth[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bodegas
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("ALL");

  // Filtros de tabla
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterStartDate, setFilterStartDate] = useState<string>("");// YYYY-MM-DD
  const [filterEndDate, setFilterEndDate] = useState<string>("");// YYYY-MM-DD

  // Modal para agregar/editar registro
  const [showModal, setShowModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: "EXPENSE",
    category: "RENTA",
    amount: "",
    currency: "MXN",
    exchangeRate: "1.0",
    description: "",
    date: new Date().toISOString().split("T")[0],
    status: "PAGADO",
    warehouseId: ""
  });

  const openModal = () => {
    setEditingRecordId(null);
    setFormData({
      type: "EXPENSE",
      category: "RENTA",
      amount: "",
      currency: "MXN",
      exchangeRate: "1.0",
      description: "",
      date: new Date().toISOString().split("T")[0],
      status: "PAGADO",
      warehouseId: selectedWarehouse === "ALL" || selectedWarehouse === "GLOBAL" ? "" : selectedWarehouse
    });
    setShowModal(true);
  };

  const handleEditClick = (rec: FinanceRecord) => {
    setEditingRecordId(rec.id);
    setFormData({
      type: rec.type,
      category: rec.category,
      amount: String(rec.amount),
      currency: rec.currency,
      exchangeRate: String(rec.exchangeRate),
      description: rec.description || "",
      date: new Date(rec.date).toISOString().split("T")[0],
      status: rec.status,
      warehouseId: rec.warehouseId || ""
    });
    setShowModal(true);
  };

  const loadData = async (warehouseId = "ALL") => {
    setLoading(true);
    try {
      const response = await fetch(`/api/finanzas?months=6&warehouseId=${warehouseId}`);
      if (!response.ok) {
        throw new Error("Error al obtener la información financiera.");
      }
      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
        setChartData(data.chartData);
        setCategoryBreakdown(data.categoryBreakdown);
        setRecords(data.records);
        setSalesIncomeByMonth(data.salesIncomeByMonth || {});
        setSelectedMonth("ALL");
        if (data.inventoryValue) {
          setInventoryValue(data.inventoryValue);
        }
        if (data.warehouses) {
          setWarehouses(data.warehouses);
        }
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedWarehouse);
  }, [selectedWarehouse]);

  // Obtener meses disponibles de la gráfica
  const availableMonths = chartData.map(m => ({
    key: m.monthKey,
    label: m.monthLabel
  })).reverse(); // Mostrar los más recientes primero

  // Calcular métricas filtradas según el mes seleccionado
  const getFilteredData = () => {
    if (selectedMonth === "ALL") {
      return {
        totalIncome: summary.totalIncome,
        salesIncome: summary.salesIncome,
        manualIncome: summary.manualIncome,
        totalExpenses: summary.totalExpenses,
        netProfit: summary.netProfit,
        records: records,
        categoryBreakdown: categoryBreakdown
      };
    }

    // Filtrar registros manuales del mes
    const filteredRecords = records.filter(r => {
      const rMonth = r.date.slice(0, 7); // "YYYY-MM"
      return rMonth === selectedMonth;
    });

    // Ventas automáticas del mes
    const selSalesIncome = salesIncomeByMonth[selectedMonth] || 0;

    // Ingresos y egresos manuales del mes
    let selManualIncome = 0;
    let selTotalExpenses = 0;

    filteredRecords.forEach(r => {
      const converted = r.amount * r.exchangeRate;
      if (r.type === "INCOME") {
        selManualIncome += converted;
      } else if (r.type === "EXPENSE") {
        selTotalExpenses += converted;
      }
    });

    const selTotalIncome = selSalesIncome + selManualIncome;
    const selNetProfit = selTotalIncome - selTotalExpenses;

    // Desglose de gastos por categoría del mes
    const categoryMap: Record<string, number> = {};
    filteredRecords.forEach(r => {
      if (r.type === "EXPENSE") {
        const converted = r.amount * r.exchangeRate;
        categoryMap[r.category] = (categoryMap[r.category] || 0) + converted;
      }
    });

    const selCategoryBreakdown = Object.entries(categoryMap).map(([category, value]) => ({
      category,
      value
    }));

    return {
      totalIncome: selTotalIncome,
      salesIncome: selSalesIncome,
      manualIncome: selManualIncome,
      totalExpenses: selTotalExpenses,
      netProfit: selNetProfit,
      records: filteredRecords,
      categoryBreakdown: selCategoryBreakdown
    };
  };

  const currentData = getFilteredData();

  const formatMXN = (val: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Ajustar tipo de cambio automático según moneda
      if (name === "currency") {
        updated.exchangeRate = value === "MXN" ? "1.0" : "20.0";
      }
      return updated;
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = editingRecordId !== null;
      const response = await fetch("/api/finanzas", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: editingRecordId, ...formData } : formData)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Error al guardar el movimiento financiero.");
      }
      setShowModal(false);
      setEditingRecordId(null);
      // Reset form
      setFormData({
        type: "EXPENSE",
        category: "RENTA",
        amount: "",
        currency: "MXN",
        exchangeRate: "1.0",
        description: "",
        date: new Date().toISOString().split("T")[0],
        status: "PAGADO",
        warehouseId: ""
      });
      loadData(selectedWarehouse);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (recordId: string, currentStatus: string) => {
    const newStatus = currentStatus === "PAGADO" ? "PENDIENTE" : "PAGADO";
    try {
      const response = await fetch("/api/finanzas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, status: newStatus })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Error al actualizar el estado de pago.");
      }
      await loadData(selectedWarehouse);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar permanentemente este registro financiero?")) {
      return;
    }
    try {
      const response = await fetch(`/api/finanzas/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Error al eliminar el registro.");
      }
      loadData(selectedWarehouse);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // Filtrar registros
  const filteredRecords = currentData.records.filter(rec => {
    const matchesType = filterType === "ALL" || rec.type === filterType;
    const matchesCategory = filterCategory === "ALL" || rec.category === filterCategory;
    
    let matchesDate = true;
    if (filterStartDate) {
      const recDate = new Date(rec.date).toISOString().split("T")[0];
      if (recDate < filterStartDate) matchesDate = false;
    }
    if (filterEndDate) {
      const recDate = new Date(rec.date).toISOString().split("T")[0];
      if (recDate > filterEndDate) matchesDate = false;
    }

    return matchesType && matchesCategory && matchesDate;
  });

  // Calcular máximos de gráfica para escalar SVG
  const maxVal = Math.max(...chartData.map(m => Math.max(m.income, m.expense)), 1000);

  // Formateadores de moneda

  return (
    <main className="main-content animate-fade-in" style={{ padding: "30px", fontFamily: "'Outfit', sans-serif", color: "#f3f4f6" }}>
      
      {/* HEADER */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "20px" }}>
        <div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.5px", marginBottom: "6px" }}>
            Finanzas y Métricas del Negocio
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem", fontWeight: 500 }}>
            Visualiza el balance de la empresa, ingresos automáticos y costos operativos de las bodegas.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 700 }}>BODEGA:</span>
            <select 
              value={selectedWarehouse} 
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              style={{ 
                background: "rgba(255,255,255,0.06)", 
                color: "white", 
                border: "1px solid var(--border-color)", 
                padding: "10px 16px", 
                borderRadius: "10px", 
                fontSize: "0.95rem",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="ALL">🌐 Todas las Bodegas</option>
              <option value="GLOBAL">🏢 Solo Global / Admin</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>📍 {wh.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 700 }}>MES:</span>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ 
                background: "rgba(255,255,255,0.06)", 
                color: "white", 
                border: "1px solid var(--border-color)", 
                padding: "10px 16px", 
                borderRadius: "10px", 
                fontSize: "0.95rem",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="ALL">📅 Todo el histórico</option>
              {availableMonths.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={openModal} 
            className="btn-premium btn-primary-teal"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.95rem", fontWeight: 700 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Registrar Movimiento Manual
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-secondary)", padding: "40px", textAlign: "center", fontSize: "1.2rem" }}>
          Calculando estados financieros...
        </div>
      ) : (
        <>
          {/* METRIC CARDS */}
          <div className="kpi-grid">
            
            {/* Ingresos Totales */}
            <div className="glass-card" style={{ padding: "24px", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Ingresos Totales (MXN)</span>
                <span style={{ fontSize: "1.5rem" }}>💰</span>
              </div>
              <h2 style={{ fontSize: "2.1rem", fontWeight: 800, color: "#10b981", margin: 0 }}>
                {formatMXN(currentData.totalIncome)}
              </h2>
              <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
                <span>Ventas ERP: {formatMXN(currentData.salesIncome)}</span>
                <span>Otros: {formatMXN(currentData.manualIncome)}</span>
              </div>
            </div>

            {/* Gastos Totales */}
            <div className="glass-card" style={{ padding: "24px", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Gastos Registrados (MXN)</span>
                <span style={{ fontSize: "1.5rem" }}>💸</span>
              </div>
              <h2 style={{ fontSize: "2.1rem", fontWeight: 800, color: "#f43f5e", margin: 0 }}>
                {formatMXN(currentData.totalExpenses)}
              </h2>
              <p style={{ margin: "12px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Incluye rentas, servicios y egresos capturados por bodegas.
              </p>
            </div>

            {/* Utilidad Neta */}
            <div className="glass-card" style={{ padding: "24px", position: "relative", overflow: "hidden", borderLeft: `4px solid ${currentData.netProfit >= 0 ? "#10b981" : "#ef4444"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Utilidad Neta (MXN)</span>
                <span style={{ fontSize: "1.5rem" }}>📈</span>
              </div>
              <h2 style={{ fontSize: "2.1rem", fontWeight: 800, color: currentData.netProfit >= 0 ? "#34d399" : "#ef4444", margin: 0 }}>
                {formatMXN(currentData.netProfit)}
              </h2>
              <p style={{ margin: "12px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Rendimiento financiero neto del ejercicio actual.
              </p>
            </div>

            {/* Valor de Inventario */}
            <div className="glass-card" style={{ padding: "24px", position: "relative", overflow: "hidden", borderLeft: "4px solid #3b82f6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Valor del Producto en Bodega</span>
                <span style={{ fontSize: "1.5rem" }}>📦</span>
              </div>
              <h2 style={{ fontSize: "2.1rem", fontWeight: 800, color: "#3b82f6", margin: 0 }}>
                {selectedWarehouse !== "ALL" && (selectedWarehouse === "cmqprgvrr000a8olisiw4wkhq" || warehouses.find(w => w.id === selectedWarehouse)?.name.toLowerCase().includes("miami")) ? (
                  `$${inventoryValue.usd.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD`
                ) : (
                  formatMXN(inventoryValue.mxn)
                )}
              </h2>
              <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
                <span>En USD: ${inventoryValue.usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span>En MXN: {formatMXN(inventoryValue.mxn)}</span>
              </div>
            </div>

          </div>

          {/* CHARTS CONTAINER */}
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "30px", marginBottom: "30px", alignItems: "stretch" }} className="grid-responsive">
            
            {/* SVG Histograma de ingresos vs gastos */}
            <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                Tendencia Mensual: Ingresos vs. Gastos (Últimos 6 meses)
              </h3>
              
              <div style={{ position: "relative", flex: 1, minHeight: "260px", display: "flex", alignItems: "flex-end", gap: "25px", padding: "10px 10px 40px 10px" }}>
                {chartData.map((m) => {
                  const incHeight = (m.income / maxVal) * 100;
                  const expHeight = (m.expense / maxVal) * 100;
                  return (
                    <div key={m.monthKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative" }}>
                      
                      {/* Barras verticales */}
                      <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "100%", width: "100%" }}>
                        {/* Barra Ingresos */}
                        <div 
                          className="bar-income" 
                          style={{ 
                            flex: 1, 
                            height: `${Math.max(incHeight, 2)}%`, 
                            backgroundColor: "rgba(16, 185, 129, 0.8)", 
                            borderTopLeftRadius: "6px", 
                            borderTopRightRadius: "6px",
                            transition: "height 0.8s ease-in-out",
                            position: "relative"
                          }}
                          title={`Ingresos: ${formatMXN(m.income)}`}
                        >
                          {m.income > 0 && (
                            <div className="bar-tooltip" style={{ fontSize: "0.65rem", position: "absolute", top: "-18px", left: "50%", transform: "translateX(-50%)", color: "#10b981", fontWeight: 700 }}>
                              {Math.round(m.income / 1000)}k
                            </div>
                          )}
                        </div>

                        {/* Barra Gastos */}
                        <div 
                          className="bar-expense" 
                          style={{ 
                            flex: 1, 
                            height: `${Math.max(expHeight, 2)}%`, 
                            backgroundColor: "rgba(244, 63, 94, 0.8)", 
                            borderTopLeftRadius: "6px", 
                            borderTopRightRadius: "6px",
                            transition: "height 0.8s ease-in-out",
                            position: "relative"
                          }}
                          title={`Gastos: ${formatMXN(m.expense)}`}
                        >
                          {m.expense > 0 && (
                            <div className="bar-tooltip" style={{ fontSize: "0.65rem", position: "absolute", top: "-18px", left: "50%", transform: "translateX(-50%)", color: "#f43f5e", fontWeight: 700 }}>
                              {Math.round(m.expense / 1000)}k
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Etiqueta del mes */}
                      <span style={{ position: "absolute", bottom: "-30px", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                        {m.monthLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div style={{ display: "flex", gap: "20px", marginTop: "10px", justifyContent: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: "#10b981" }}></span> Ingresos
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: "#f43f5e" }}></span> Gastos
                </span>
              </div>
            </div>

            {/* Desglose de Gastos por Categoría */}
            <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                Desglose de Gastos por Categoría
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "18px", flex: 1, justifyContent: "center" }}>
                {currentData.categoryBreakdown.map((item) => {
                  const percentage = currentData.totalExpenses > 0 ? (item.value / currentData.totalExpenses) * 100 : 0;
                  if (item.value === 0) return null;

                  return (
                    <div key={item.category} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600 }}>
                        <span>{CATEGORY_LABELS[item.category] || item.category}</span>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {formatMXN(item.value)} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      {/* Barra de progreso */}
                      <div style={{ height: "8px", width: "100%", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                        <div 
                          style={{ 
                            height: "100%", 
                            width: `${percentage}%`, 
                            backgroundColor: CATEGORY_COLORS[item.category] || "#ef4444",
                            borderRadius: "4px",
                            transition: "width 1s ease" 
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {currentData.totalExpenses === 0 && (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
                    No hay egresos registrados en el historial para este periodo.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* TABLE OF MOVEMENTS */}
          <div className="glass-card" style={{ padding: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "14px" }}>
              <h3 style={{ fontSize: "1.25rem", color: "#ffffff", fontWeight: 700, margin: 0 }}>
                Historial de Movimientos Manuales
              </h3>

              {/* Filtros */}
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  style={{ background: "var(--card-bg)", color: "white", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.85rem" }}
                >
                  <option value="ALL">Todos los Tipos</option>
                  <option value="INCOME">Ingresos</option>
                  <option value="EXPENSE">Gastos</option>
                </select>

                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  style={{ background: "var(--card-bg)", color: "white", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.85rem" }}
                >
                  <option value="ALL">Todas las Categorías</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label.slice(3)}</option>
                  ))}
                </select>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Desde:</span>
                  <input 
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.04)", color: "white", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.85rem", colorScheme: "dark" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Hasta:</span>
                  <input 
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.04)", color: "white", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.85rem", colorScheme: "dark" }}
                  />
                </div>

                {(filterStartDate || filterEndDate) && (
                  <button
                    onClick={() => {
                      setFilterStartDate("");
                      setFilterEndDate("");
                    }}
                    style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600 }}
                  >
                    Limpiar Fechas
                  </button>
                )}
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div style={{ color: "var(--text-muted)", padding: "40px 0", textAlign: "center" }}>
                No se encontraron movimientos financieros con los filtros seleccionados.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="premium-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Categoría</th>
                    <th>Descripción / Origen</th>
                    <th>Monto Capturado</th>
                    <th>Monto en MXN</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th style={{ textAlign: "right" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((rec) => {
                    const formattedDate = new Date(rec.date).toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    });
                    const isExpense = rec.type === "EXPENSE";

                    return (
                      <tr key={rec.id}>
                        <td>{formattedDate}</td>
                        <td>
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: "6px", 
                            fontSize: "0.75rem", 
                            fontWeight: 700, 
                            backgroundColor: isExpense ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                            color: isExpense ? "#ef4444" : "#10b981" 
                          }}>
                            {isExpense ? "GASTO" : "INGRESO"}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{CATEGORY_LABELS[rec.category]?.slice(3) || rec.category}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{rec.description || "Sin descripción"}</span>
                            {rec.warehouse && (
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                📍 Bodega: {rec.warehouse.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {rec.currency === "USD" ? `$${rec.amount.toFixed(2)} USD` : formatMXN(rec.amount)}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                            {formatMXN(rec.amount * rec.exchangeRate)}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          {rec.user?.name || "Desconocido"}
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleStatus(rec.id, rec.status)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              outline: "none"
                            }}
                            title="Haz clic para cambiar estado"
                          >
                            <span style={{ 
                              padding: "4px 8px", 
                              borderRadius: "6px", 
                              fontSize: "0.75rem", 
                              fontWeight: 700, 
                              backgroundColor: rec.status === "PAGADO" ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 159, 67, 0.12)",
                              color: rec.status === "PAGADO" ? "#10b981" : "#ff9f43",
                              display: "inline-block",
                              border: rec.status === "PAGADO" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 159, 67, 0.3)"
                            }}>
                              {rec.status === "PAGADO" ? "✓ Pagado" : "⏳ Pendiente"}
                            </span>
                          </button>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button 
                            onClick={() => handleEditClick(rec)}
                            style={{ 
                              background: "none", 
                              border: "none", 
                              color: "#ff9f43", 
                              cursor: "pointer", 
                              fontSize: "1.1rem",
                              marginRight: "10px"
                            }}
                            title="Editar registro"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleDeleteRecord(rec.id)}
                            style={{ 
                              background: "none", 
                              border: "none", 
                              color: "#ef4444", 
                              cursor: "pointer", 
                              fontSize: "1.1rem" 
                            }}
                            title="Eliminar registro"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </>
      )}

      {/* MODAL PARA AGREGAR REGISTRO MANUAL */}
      {showModal && (
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
          <div className="glass-card animate-scale-in" style={{ width: "90%", maxWidth: "520px", padding: "30px", position: "relative" }}>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "white", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              {editingRecordId ? "Editar Movimiento Financiero" : "Registrar Movimiento Financiero"}
            </h3>
            
            <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>TIPO</label>
                  <select 
                    name="type" 
                    value={formData.type} 
                    onChange={handleInputChange}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                  >
                    <option value="EXPENSE">GASTO (Egreso)</option>
                    <option value="INCOME">INGRESO (Manual)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>CATEGORÍA</label>
                  <select 
                    name="category" 
                    value={formData.category} 
                    onChange={handleInputChange}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                  >
                    {formData.type === "EXPENSE" ? (
                      Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))
                    ) : (
                      <>
                        <option value="OTROS">⚙️ Ingresos Varios / Otros</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>MONTO</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="amount"
                    required
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="Monto"
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>MONEDA</label>
                  <select 
                    name="currency" 
                    value={formData.currency} 
                    onChange={handleInputChange}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                  >
                    <option value="MXN">MXN ($)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>T. CAMBIO</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    name="exchangeRate"
                    required
                    disabled={formData.currency === "MXN"}
                    value={formData.exchangeRate}
                    onChange={handleInputChange}
                    style={{ width: "100%", background: formData.currency === "MXN" ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: formData.currency === "MXN" ? "#6b7280" : "white" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>BODEGA ASOCIADA</label>
                <select 
                  name="warehouseId" 
                  value={formData.warehouseId} 
                  onChange={handleInputChange}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                >
                  <option value="">🏢 Ninguna (Gasto General / Global)</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>📍 {wh.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>FECHA CONTABLE</label>
                <input 
                  type="date" 
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleInputChange}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>ESTADO DE PAGO</label>
                <select 
                  name="status" 
                  value={formData.status} 
                  onChange={handleInputChange}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white" }}
                >
                  <option value="PAGADO">✓ Pagado</option>
                  <option value="PENDIENTE">⏳ Pendiente</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>DESCRIPCIÓN / COMENTARIO</label>
                <textarea 
                  name="description"
                  rows={2}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Detalles sobre el gasto o ingreso..."
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "10px", color: "white", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
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
                  {isSubmitting ? "Registrando..." : editingRecordId ? "Actualizar Movimiento" : "Guardar Movimiento"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </main>
  );
}
