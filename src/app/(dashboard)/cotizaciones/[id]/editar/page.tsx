"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Warehouse {
  id: string;
  name: string;
  city: string;
  country: string;
  currency: string;
}

interface ProductInventory {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  basePrice: number;
  inventory: ProductInventory[];
}

interface Client {
  id: string;
  name: string;
  city: string;
  country: string;
  company?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  state?: string | null;
  zip?: string | null;
  receptionSchedule?: string | null;
}

interface QuoteItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  stockAvailable: number;
}

export default function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // DB Lists
  const [clients, setClients] = useState<Client[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form State
  const [quoteNumber, setQuoteNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [currency, setCurrency] = useState("MXN");
  const [exchangeRate, setExchangeRate] = useState(1.0);
  const [deliveryMethod, setDeliveryMethod] = useState("ENVIO"); // ENVIO or RECOLECTA
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountInput, setDiscountInput] = useState(0);
  const [notes, setNotes] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState<string | null>(null);
  const [shippingDuration, setShippingDuration] = useState<string | null>(null);
  const [items, setItems] = useState<QuoteItemInput[]>([
    { productId: "", quantity: 1, unitPrice: 0, stockAvailable: 0 }
  ]);

  // Modal State for New Client
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientState, setNewClientState] = useState("");
  const [newClientZip, setNewClientZip] = useState("");
  const [newClientCity, setNewClientCity] = useState("");
  const [newClientCountry, setNewClientCountry] = useState("México");
  const [newClientContact, setNewClientContact] = useState("");
  const [newClientReceptionSchedule, setNewClientReceptionSchedule] = useState("");

  // Shippo State
  const [shippingRates, setShippingRates] = useState<any[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [shippoError, setShippoError] = useState<string | null>(null);

  const [fetchedItemsHash, setFetchedItemsHash] = useState<string | null>(null);

  // New fields
  const [shippingQuoteStatus, setShippingQuoteStatus] = useState("NONE");
  const [shippingOptions, setShippingOptions] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = document.cookie
        .split("; ")
        .find(row => row.startsWith("user_role="))
        ?.split("=")[1];
      if (role) {
        setUserRole(role);
      }
    }
  }, []);

  // Hash to track changes in product selection or quantities
  const itemsHash = JSON.stringify(items.map(it => ({ id: it.productId, q: it.quantity })));

  // Reset rates on client or warehouse changes (only after loading has finished)
  useEffect(() => {
    if (!loading) {
      setShippingRates([]);
      setShippingCost(0);
      setSelectedRateId("");
      setShippoError(null);
      setFetchedItemsHash(null);
    }
  }, [clientId, warehouseId, loading]);

  // Clear rates if products or quantities change after they were fetched
  useEffect(() => {
    if (!loading && (shippingRates.length > 0 || shippingCost > 0)) {
      setShippingRates([]);
      setShippingCost(0);
      setSelectedRateId("");
    }
  }, [itemsHash, loading]);

  const totalKits = items.reduce((acc, item) => acc + (item.quantity || 0), 0);

  const handleFetchShippingRates = async () => {
    if (!clientId || !warehouseId) {
      alert("Por favor selecciona un cliente y una bodega de despacho.");
      return;
    }
    setLoadingRates(true);
    setShippoError(null);
    setShippingRates([]);
    try {
      const response = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originWarehouseId: warehouseId,
          destinationClientId: clientId,
          kitsCount: totalKits
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al obtener tarifas de Shippo");
      }
      setShippingRates(data.rates || []);
      if (data.rates && data.rates.length > 0) {
        setSelectedRateId(data.rates[0].object_id);
        setShippingCost(parseFloat(data.rates[0].amount) || 0);
      } else {
        setShippingCost(0);
      }
      setFetchedItemsHash(itemsHash);
    } catch (err: any) {
      console.error(err);
      setShippoError(err.message);
    } finally {
      setLoadingRates(false);
    }
  };

  const handleRateSelect = (rateId: string) => {
    setSelectedRateId(rateId);
    const rate = shippingRates.find(r => r.object_id === rateId);
    if (rate) {
      setShippingCost(parseFloat(rate.amount) || 0);
    }
  };

  // Load configuration and existing quote details on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [clientsRes, configRes, quoteRes] = await Promise.all([
          fetch("/api/clientes"),
          fetch("/api/inventario/config"),
          fetch(`/api/cotizaciones/${id}`)
        ]);

        const clientsData = await clientsRes.json();
        const { warehouses: whsData, products: prodsData } = await configRes.json();
        const quoteData = await quoteRes.json();

        setClients(clientsData);
        setWarehouses(whsData);
        setProducts(prodsData);

        // Pre-populate Form Data from the Quote
        setQuoteNumber(quoteData.quoteNumber);
        setClientId(quoteData.clientId);
        setWarehouseId(quoteData.warehouseId);
        setCurrency(quoteData.currency);
        setExchangeRate(quoteData.exchangeRate);
        setDeliveryMethod(quoteData.deliveryMethod);
        setNotes(quoteData.notes || "");
        setShippingCost(quoteData.shippingCost || 0);
        setDiscountType("amount");
        setShippingCarrier(quoteData.shippingCarrier || null);
        setShippingDuration(quoteData.shippingDuration || null);
        setShippingQuoteStatus(quoteData.shippingQuoteStatus || "NONE");
        setShippingOptions(quoteData.shippingOptions || "");

        // Map items and find current stock values
        const mappedItems = quoteData.items.map((item: any) => {
          const product = prodsData.find((p: any) => p.id === item.productId);
          const inv = product?.inventory.find((i: any) => i.warehouseId === quoteData.warehouseId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            stockAvailable: inv ? inv.quantity : 0
          };
        });
        setItems(mappedItems);

      } catch (err) {
        console.error("Error al cargar configuración y cotización:", err);
        alert("Error al cargar los datos de la cotización");
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      loadData();
    }
  }, [id]);

  // Helper to get default prices for 2026 based on warehouse location
  const getDefaultPrice = (sku: string, isMiami: boolean, originalBasePrice: number): number => {
    if (isMiami) {
      switch (sku) {
        case "KIT-NAT-001":
        case "KIT-GRS-002":
          return 300.0;
        case "KIT-PDR-003":
        case "KIT-AZM-004":
        case "KIT-VJD-005":
        case "KIT-AMH-006":
          return 312.0;
        case "KIT-PXR-007":
          return 330.0;
        case "KIT-NGR-008":
        case "KIT-TRA-009":
          return 350.0;
        default:
          return originalBasePrice;
      }
    } else {
      switch (sku) {
        case "KIT-NAT-001":
        case "KIT-GRS-002":
          return 1300.0;
        case "KIT-PDR-003":
        case "KIT-AZM-004":
        case "KIT-VJD-005":
        case "KIT-AMH-006":
          return 1350.0;
        case "KIT-PXR-007":
          return 1400.0;
        case "KIT-NGR-008":
        case "KIT-TRA-009":
          return 1500.0;
        default:
          return originalBasePrice;
      }
    }
  };

  // Update product details when selected in a row
  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const inv = product.inventory.find(i => i.warehouseId === warehouseId);
    const stockAvailable = inv ? inv.quantity : 0;

    const wh = warehouses.find(w => w.id === warehouseId);
    const isMiami = wh ? (wh.country === "Estados Unidos" || wh.name.toLowerCase().includes("miami")) : false;
    const unitPrice = getDefaultPrice(product.sku, isMiami, product.basePrice);

    setItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return {
          ...item,
          productId,
          unitPrice,
          stockAvailable
        };
      }
      return item;
    }));
  };

  const handleItemFieldChange = (index: number, field: keyof QuoteItemInput, value: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { productId: "", quantity: 1, unitPrice: 0, stockAvailable: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Trigger recalculations of stock and prices when warehouse changes (only after loading finished)
  useEffect(() => {
    if (loading || !warehouseId) return;

    const wh = warehouses.find(w => w.id === warehouseId);
    const isMiami = wh ? (wh.country === "Estados Unidos" || wh.name.toLowerCase().includes("miami")) : false;

    setItems(prev => prev.map(item => {
      if (!item.productId) return item;
      const product = products.find(p => p.id === item.productId);
      const inv = product?.inventory.find(i => i.warehouseId === warehouseId);
      const unitPrice = product ? getDefaultPrice(product.sku, isMiami, product.basePrice) : 0;
      return {
        ...item,
        stockAvailable: inv ? inv.quantity : 0,
        unitPrice
      };
    }));

    // Auto update currency based on warehouse country default
    if (wh) {
      if (wh.country === "Estados Unidos") {
        setCurrency("USD");
      } else {
        setCurrency("MXN");
      }
    }
  }, [warehouseId, loading, warehouses, products]);

  // Create Client from Modal
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientCity || !newClientCountry) {
      alert("Por favor completa los campos obligatorios del cliente");
      return;
    }

    try {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientName,
          company: newClientCompany,
          contact: newClientContact,
          email: newClientEmail,
          phone: newClientPhone,
          address: newClientAddress,
          state: newClientState,
          zip: newClientZip,
          city: newClientCity,
          country: newClientCountry,
          receptionSchedule: newClientReceptionSchedule
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setClients(prev => [...prev, result.client]);
      setClientId(result.client.id);
      
      setNewClientName("");
      setNewClientCompany("");
      setNewClientEmail("");
      setNewClientPhone("");
      setNewClientAddress("");
      setNewClientState("");
      setNewClientZip("");
      setNewClientCity("");
      setNewClientContact("");
      setNewClientReceptionSchedule("");
      setIsClientModalOpen(false);

      alert("Cliente creado y seleccionado automáticamente.");
    } catch (err: any) {
      alert(`Error al crear cliente: ${err.message}`);
    }
  };

  // Calculations
  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
  const isMiami = selectedWarehouse ? (selectedWarehouse.country === "Estados Unidos" || selectedWarehouse.name.toLowerCase().includes("miami")) : false;

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const finalShippingCost = deliveryMethod === "RECOLECTA" ? 0 : shippingCost;

  let calculatedDiscount = 0;
  let tax = 0;
  let total = 0;

  if (isMiami) {
    // Miami/USD logic: Shipping is part of subtotal, no tax (IVA = 0)
    const amountBeforeDiscount = subtotal + finalShippingCost;
    if (discountType === "percent") {
      calculatedDiscount = amountBeforeDiscount * (discountInput / 100);
    } else {
      calculatedDiscount = discountInput;
    }
    tax = 0;
    total = Math.max(0, amountBeforeDiscount - calculatedDiscount);
  } else {
    // Mexico/MXN logic: Discount on products, then add shipping, then 16% IVA
    if (discountType === "percent") {
      calculatedDiscount = subtotal * (discountInput / 100);
    } else {
      calculatedDiscount = discountInput;
    }
    const discountedSubtotal = Math.max(0, subtotal - calculatedDiscount);
    const baseSubtotal = discountedSubtotal + finalShippingCost;
    tax = baseSubtotal * 0.16;
    total = baseSubtotal + tax;
  }

  // Submit Quote Updates
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) return alert("Selecciona un cliente");
    if (!warehouseId) return alert("Selecciona una bodega");
    
    const invalidItems = items.filter(it => !it.productId || it.quantity <= 0 || it.unitPrice <= 0);
    if (invalidItems.length > 0) {
      return alert("Por favor completa todos los productos con cantidades y precios válidos.");
    }

    setSubmitting(true);

    const selectedRate = deliveryMethod === "ENVIO" ? shippingRates.find(r => r.object_id === selectedRateId) : null;
    const carrier = selectedRate ? selectedRate.provider : (deliveryMethod === "ENVIO" ? shippingCarrier : null);
    let duration = null;
    if (selectedRate && selectedRate.estimated_days) {
      const days = parseInt(selectedRate.estimated_days, 10);
      duration = isNaN(days) ? `${selectedRate.estimated_days} days` : `${days + 1} ${days + 1 === 1 ? 'day' : 'days'}`;
    } else if (deliveryMethod === "ENVIO") {
      duration = shippingDuration;
    }

    try {
      const response = await fetch(`/api/cotizaciones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          warehouseId,
          currency,
          exchangeRate,
          shippingCost: finalShippingCost,
          deliveryMethod,
          discount: calculatedDiscount,
          notes,
          shippingCarrier: carrier,
          shippingDuration: duration,
          shippingQuoteStatus,
          shippingOptions,
          items: items.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice
          }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al actualizar la cotización");
      }

      alert("Cotización actualizada exitosamente.");
      router.push("/cotizaciones");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="main-content" style={{ color: "white" }}>Cargando datos de la cotización...</div>;
  }

  return (
    <main className="main-content animate-fade-in" style={{ position: "relative" }}>
      
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Editar Cotización
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Modificando documento: <strong style={{ color: "var(--primary-teal)" }}>{quoteNumber}</strong>
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/cotizaciones">
            <button className="btn-premium btn-secondary-sage" style={{ fontSize: "0.9rem" }}>
              Volver a Cotizaciones
            </button>
          </Link>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="quote-form-layout">
        
        {/* Left Side: General & Products */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          
          {/* General Config Card */}
          <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "24px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "white", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              1. Datos de Operación
            </h2>
            
            <div className="grid-2-col">
              
              {/* Client Selection */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>
                  Cliente *
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select 
                    value={clientId} 
                    onChange={(e) => setClientId(e.target.value)}
                    required
                    style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                  >
                    <option value="" style={{ background: "#0c0f17" }}>-- Selecciona un cliente --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id} style={{ background: "#0c0f17" }}>{c.name} ({c.city}, {c.country})</option>
                    ))}
                  </select>
                  <button 
                    type="button"
                    onClick={() => setIsClientModalOpen(true)}
                    className="btn-premium btn-secondary-sage"
                    style={{ padding: "12px", borderRadius: "10px", width: "45px", height: "45px", minWidth: "auto" }}
                    title="Nuevo cliente"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Warehouse Selection */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>
                  Bodega de Despacho *
                </label>
                <select 
                  value={warehouseId} 
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id} style={{ background: "#0c0f17" }}>{w.name} ({w.city})</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="grid-2-col">
              
              {/* Currency Selection */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>
                  Moneda de la Cotización *
                </label>
                <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                >
                  <option value="MXN" style={{ background: "#0c0f17" }}>MXN (Pesos Mexicanos)</option>
                  <option value="USD" style={{ background: "#0c0f17" }}>USD (Dólares Americanos)</option>
                </select>
              </div>

              {/* Exchange Rate */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>
                  Tipo de Cambio (MXN por USD)
                </label>
                <input 
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1.0)}
                  disabled={currency === "MXN" && warehouses.find(w => w.id === warehouseId)?.country === "México"}
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                />
              </div>

            </div>

            {/* Client address details card */}
            {clientId && (
              (() => {
                const selectedClient = clients.find(c => c.id === clientId);
                if (!selectedClient) return null;
                return (
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px", marginTop: "10px" }}>
                    <div style={{ background: "rgba(255,255,255,0.01)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                      <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-sage)", marginBottom: "8px" }}>📦 Dirección de Envío y Datos del Cliente:</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        <div><strong>Nombre/Contacto:</strong> {selectedClient.name} {selectedClient.contact ? `(${selectedClient.contact})` : ""}</div>
                        <div><strong>Empresa:</strong> {selectedClient.company || "N/A"}</div>
                        <div><strong>Teléfono:</strong> {selectedClient.phone || "N/A"}</div>
                        <div><strong>Correo:</strong> {selectedClient.email || "N/A"}</div>
                        <div style={{ gridColumn: "1 / -1" }}><strong>Dirección:</strong> {selectedClient.address || "N/A"}, {selectedClient.city}, {selectedClient.state || ""}, {selectedClient.country} {selectedClient.zip ? `(CP: ${selectedClient.zip})` : ""}</div>
                        <div style={{ gridColumn: "1 / -1" }}><strong>Horario de Recepción:</strong> {selectedClient.receptionSchedule || "N/A"}</div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

          </div>

          {/* Products List Card */}
          <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "white" }}>
                2. Productos a Cotizar
              </h2>
              <button 
                type="button" 
                onClick={addItemRow} 
                className="btn-premium btn-secondary-sage"
                style={{ padding: "8px 16px", fontSize: "0.8rem", borderRadius: "8px" }}
              >
                + Agregar Fila
              </button>
            </div>

            {/* Products Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {items.map((item, idx) => {
                const isOverStock = item.productId && item.quantity > item.stockAvailable;

                return (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "8px", borderBottom: idx < items.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none", paddingBottom: idx < items.length - 1 ? "16px" : "0" }}>
                    <div className="product-item-row">
                      
                      {/* Select Product */}
                      <div style={{ flex: 2 }}>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                          Producto (Kit de Chukum)
                        </label>
                        <select 
                          value={item.productId}
                          onChange={(e) => handleProductChange(idx, e.target.value)}
                          required
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                        >
                          <option value="" style={{ background: "#0c0f17" }}>-- Selecciona un kit --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id} style={{ background: "#0c0f17" }}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                          Cantidad (Sacos)
                        </label>
                        <input 
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={item.quantity}
                          onChange={(e) => handleItemFieldChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                          required
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                        />
                      </div>

                      {/* Price */}
                      <div style={{ flex: 1.2 }}>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                          Precio Unit. ({currency})
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemFieldChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                          required
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                        />
                      </div>

                      {/* Row Total */}
                      <div style={{ width: "120px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total</span>
                        <div style={{ padding: "12px 0", color: "#ffffff", fontWeight: 700, fontSize: "0.95rem" }}>
                          ${(item.quantity * item.unitPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Remove Row Button */}
                      <button 
                        type="button" 
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: items.length === 1 ? "not-allowed" : "pointer", paddingBottom: "12px", opacity: items.length === 1 ? 0.3 : 1 }}
                      >
                        🗑
                      </button>

                    </div>

                    {/* Stock Indicator */}
                    {item.productId && (
                      <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", paddingLeft: "4px", marginTop: "2px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>
                          Stock disponible en esta bodega: <strong>{item.stockAvailable.toFixed(1)} sacos</strong>
                        </span>
                        {isOverStock && (
                          <span style={{ color: "#ff9f43", fontWeight: 600 }}>
                            ⚠ Warning: Cantidad mayor al stock actual.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

          {/* Delivery Method, Discount & Comments */}
          <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "24px", marginTop: "24px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "white", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", margin: 0 }}>
              Detalles de Entrega y Comercial
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
              {/* Delivery Method */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Método de Entrega *</label>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => { setDeliveryMethod("ENVIO"); setShippingQuoteStatus("NONE"); }}
                    style={{
                      flex: 1,
                      minWidth: "150px",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid " + (deliveryMethod === "ENVIO" && shippingQuoteStatus === "NONE" ? "var(--primary-teal)" : "rgba(255,255,255,0.08)"),
                      background: deliveryMethod === "ENVIO" && shippingQuoteStatus === "NONE" ? "rgba(29,128,136,0.1)" : "none",
                      color: deliveryMethod === "ENVIO" && shippingQuoteStatus === "NONE" ? "var(--primary-teal)" : "var(--text-secondary)",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    🚚 Envío Domicilio (Auto)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeliveryMethod("ENVIO"); setShippingQuoteStatus("PENDING_MIAMI"); }}
                    style={{
                      flex: 1,
                      minWidth: "150px",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid " + (deliveryMethod === "ENVIO" && (shippingQuoteStatus === "PENDING_MIAMI" || shippingQuoteStatus === "QUOTED") ? "var(--primary-teal)" : "rgba(255,255,255,0.08)"),
                      background: deliveryMethod === "ENVIO" && (shippingQuoteStatus === "PENDING_MIAMI" || shippingQuoteStatus === "QUOTED") ? "rgba(29,128,136,0.1)" : "none",
                      color: deliveryMethod === "ENVIO" && (shippingQuoteStatus === "PENDING_MIAMI" || shippingQuoteStatus === "QUOTED") ? "var(--primary-teal)" : "var(--text-secondary)",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    📦 Cotizar con Bodega
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeliveryMethod("RECOLECTA"); setShippingCost(0); setShippingQuoteStatus("NONE"); }}
                    style={{
                      flex: 1,
                      minWidth: "150px",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid " + (deliveryMethod === "RECOLECTA" ? "var(--primary-sage)" : "rgba(255,255,255,0.08)"),
                      background: deliveryMethod === "RECOLECTA" ? "rgba(164,189,145,0.15)" : "none",
                      color: deliveryMethod === "RECOLECTA" ? "var(--primary-sage)" : "var(--text-secondary)",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    🏢 Recolecta Local
                  </button>
                </div>
              </div>

              {/* Discount Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Descuento Directo
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountInput || ""}
                    onChange={(e) => setDiscountInput(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder={discountType === "percent" ? "ej. 10%" : "ej. 1500.00"}
                    style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")}
                    style={{ padding: "12px", borderRadius: "8px", background: "#0c0f17", border: "1px solid var(--border-color)", color: "white", outline: "none", width: "110px", cursor: "pointer" }}
                  >
                    <option value="amount">Monto ($)</option>
                    <option value="percent">Porcentaje (%)</option>
                  </select>
                </div>
              </div>
            </div>

            {deliveryMethod === "ENVIO" && (() => {
              if (!clientId) {
                return (
                  <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(255, 159, 67, 0.08)", border: "1px solid rgba(255, 159, 67, 0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                    <span style={{ fontSize: "0.85rem", color: "#ff9f43", fontWeight: 600 }}>
                      Por favor, selecciona un Cliente en la Sección 1 para poder cotizar las tarifas de envío.
                    </span>
                  </div>
                );
              }

              const wh = warehouses.find(w => w.id === warehouseId);
              const isMiami = wh ? (wh.country === "Estados Unidos" || wh.name.toLowerCase().includes("miami")) : false;

              return (
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  
                  {/* If Cotizar con Bodega is selected */}
                  {(shippingQuoteStatus === "PENDING_MIAMI" || shippingQuoteStatus === "QUOTED") ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      
                      {userRole !== "VENDEDOR" ? (
                        <>
                          {/* Checkbox to mark as Quoted */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <input
                              type="checkbox"
                              id="fleteCotizado"
                              checked={shippingQuoteStatus === "QUOTED"}
                              onChange={(e) => setShippingQuoteStatus(e.target.checked ? "QUOTED" : "PENDING_MIAMI")}
                              style={{ width: "18px", height: "18px", cursor: "pointer" }}
                            />
                            <label htmlFor="fleteCotizado" style={{ fontSize: "0.9rem", color: "white", fontWeight: 600, cursor: "pointer" }}>
                              ✓ Flete ya cotizado por Oficina Miami
                            </label>
                          </div>

                          {/* Textarea to input options */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                              Opciones de Envío / Tarifas de Bodega
                            </label>
                            <textarea
                              value={shippingOptions}
                              onChange={(e) => setShippingOptions(e.target.value)}
                              placeholder="Aquí la oficina de Miami escribirá las opciones de envío (ej. UPS: $85 | LTL: $240) para elegir la mejor."
                              rows={3}
                              style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", outline: "none", fontFamily: "inherit", fontSize: "0.9rem", resize: "vertical" }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Seller Role Read-only info */}
                          <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(29, 128, 136, 0.08)", border: "1px solid rgba(29, 128, 136, 0.2)", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <span style={{ fontSize: "0.85rem", color: "var(--primary-teal)", fontWeight: 700 }}>
                              {shippingQuoteStatus === "QUOTED" ? "✓ Flete ya cotizado por Oficina Miami" : "⌛ Flete Pendiente de Cotizar por Oficina Miami"}
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                              {shippingQuoteStatus === "QUOTED" 
                                ? "La oficina de Miami ha propuesto las tarifas detalladas abajo. Elige la mejor opción e ingresa el costo en el campo final."
                                : "Se enviará la solicitud de flete a la bodega de Miami cuando guardes esta cotización."}
                            </span>
                          </div>

                          {shippingOptions && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                                Tarifas propuestas por Bodega
                              </label>
                              <div style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                                {shippingOptions}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    /* If standard Auto shipping is selected */
                    <>
                      {isMiami ? (
                        <div>
                          {shippingCarrier && (
                            <div style={{ fontSize: "0.85rem", color: "var(--primary-sage)", background: "rgba(164,189,145,0.08)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(164,189,145,0.2)", marginBottom: "12px", width: "fit-content" }}>
                              🚚 <strong>Envío registrado:</strong> {shippingCarrier} {shippingDuration ? `(Tránsito estimado: ${shippingDuration})` : ""}
                            </div>
                          )}
                          <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-teal)", marginBottom: "8px", marginTop: "10px" }}>🚚 Cotizar Envío Automatizado (Shippo)</h4>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                            <button
                              type="button"
                              onClick={handleFetchShippingRates}
                              disabled={loadingRates}
                              className="btn-premium btn-secondary-sage"
                              style={{ padding: "10px 16px", fontSize: "0.85rem", borderRadius: "8px", height: "auto" }}
                            >
                              {loadingRates ? "Cotizando..." : "Consultar Tarifas"}
                            </button>
                            {shippingRates.length > 0 && (
                              <span style={{ fontSize: "0.8rem", color: "var(--primary-sage)", fontWeight: 600 }}>
                                ✓ {shippingRates.length} tarifa(s) cargada(s)
                              </span>
                            )}
                            {shippingRates.length === 0 && fetchedItemsHash !== null && itemsHash !== fetchedItemsHash && (
                              <span style={{ fontSize: "0.8rem", color: "#ff9f43", fontWeight: 600 }}>
                                ⚠ Productos modificados. Favor de consultar tarifas.
                              </span>
                            )}
                          </div>

                          {shippoError && (
                            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "12px" }}>
                              ⚠️ Error al cotizar: {shippoError}
                            </div>
                          )}

                          {shippingRates.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                                Selecciona la paquetería de envío:
                              </label>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                                {shippingRates.map((r: any) => {
                                  const isSelected = selectedRateId === r.object_id;
                                  return (
                                    <div
                                      key={r.object_id}
                                      onClick={() => handleRateSelect(r.object_id)}
                                      style={{
                                        padding: "12px",
                                        borderRadius: "8px",
                                        border: `1px solid ${isSelected ? "var(--primary-teal)" : "var(--border-color)"}`,
                                        background: isSelected ? "rgba(29, 128, 136, 0.08)" : "rgba(255,255,255,0.01)",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease"
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "0.8rem", color: isSelected ? "var(--primary-teal)" : "#ffffff" }}>
                                        <span>{r.provider}</span>
                                        <span>${parseFloat(r.amount).toLocaleString("es-MX", { minimumFractionDigits: 2 })} {r.currency}</span>
                                      </div>
                                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                        Servicio: {r.servicelevel}<br />
                                        Entrega estimada: ~{r.estimated_days} días
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-teal)", marginBottom: "8px", marginTop: "10px" }}>🚚 Cotizar Envío Automatizado (envio.com)</h4>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
                            <button
                              type="button"
                              disabled
                              className="btn-premium btn-secondary-sage"
                              style={{ padding: "10px 16px", fontSize: "0.85rem", borderRadius: "8px", height: "auto", opacity: 0.5, cursor: "not-allowed" }}
                            >
                              Cotizar en envio.com (Próximamente)
                            </button>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                              La cotización automatizada estará disponible pronto.
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div style={{ maxWidth: "300px" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>
                      Costo de Envío Final ({currency}) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={shippingCost || ""}
                      onChange={(e) => setShippingCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      required
                      style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
                    />
                  </div>

                </div>
              );
            })()}

            {/* Notes */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Observaciones / Comentarios de la Cotización</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escribe aquí observaciones comerciales, vigencia de precios o condiciones de pago..."
                style={{ width: "100%", padding: "12px", minHeight: "80px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", outline: "none", resize: "vertical" }}
              />
            </div>
          </div>

        </div>

        {/* Right Side: Totals Summary & Submit */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "24px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "white", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              Resumen
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Subtotal Productos:</span>
                <span style={{ fontWeight: 600 }}>${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
              {calculatedDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
                  <span style={{ color: "#ff6b6b" }}>Descuento Directo:</span>
                  <span style={{ fontWeight: 600, color: "#ff6b6b" }}>-${calculatedDiscount.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {currency}</span>
                </div>
              )}
              {finalShippingCost > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Costo de Envío:</span>
                  <span style={{ fontWeight: 600 }}>${finalShippingCost.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {currency}</span>
                </div>
              )}
              {!isMiami && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>IVA (16%):</span>
                  <span style={{ fontWeight: 600 }}>${tax.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {currency}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", borderTop: "1px solid var(--border-color)", paddingTop: "16px", color: "white", fontWeight: 800 }}>
                <span>Total:</span>
                <span style={{ color: "var(--primary-sage)" }}>${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            </div>

            {/* Submit Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              <button 
                type="submit" 
                disabled={submitting}
                className="btn-premium btn-primary-teal" 
                style={{ width: "100%", padding: "14px" }}
              >
                {submitting ? "Guardando..." : "Guardar Cambios"}
              </button>
              
              <Link href="/cotizaciones" style={{ textDecoration: "none" }}>
                <button type="button" className="btn-premium btn-secondary-sage" style={{ width: "100%", padding: "12px" }}>
                  Cancelar
                </button>
              </Link>
            </div>

          </div>

        </div>

      </form>

      {/* MODAL: Nuevo Cliente Inline */}
      {isClientModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass-card animate-fade-in" style={{ width: "500px", padding: "30px", background: "var(--bg-sidebar)", borderColor: "var(--border-color-hover)" }}>
            <h3 style={{ fontSize: "1.25rem", color: "white", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", display: "flex", justifyContent: "space-between" }}>
              <span>Agregar Nuevo Cliente</span>
              <button onClick={() => setIsClientModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
            </h3>

            <form onSubmit={handleCreateClient} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Nombre de Empresa / Cliente *</label>
                <input 
                  type="text" 
                  value={newClientName} 
                  onChange={(e) => setNewClientName(e.target.value)} 
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                />
              </div>

              <div className="modal-row">
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Contacto</label>
                  <input 
                    type="text" 
                    value={newClientContact} 
                    onChange={(e) => setNewClientContact(e.target.value)} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Nombre Empresa</label>
                  <input 
                    type="text" 
                    value={newClientCompany} 
                    onChange={(e) => setNewClientCompany(e.target.value)} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                  />
                </div>
              </div>

              <div className="modal-row">
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Teléfono</label>
                  <input 
                    type="text" 
                    value={newClientPhone} 
                    onChange={(e) => setNewClientPhone(e.target.value)} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={newClientEmail} 
                    onChange={(e) => setNewClientEmail(e.target.value)} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                  />
                </div>
              </div>

              <div className="modal-row">
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Ciudad *</label>
                  <input 
                    type="text" 
                    value={newClientCity} 
                    onChange={(e) => setNewClientCity(e.target.value)} 
                    required
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>País *</label>
                  <select 
                    value={newClientCountry} 
                    onChange={(e) => setNewClientCountry(e.target.value)} 
                    required
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                  >
                    <option value="México" style={{ background: "#0c0f17" }}>México</option>
                    <option value="Estados Unidos" style={{ background: "#0c0f17" }}>Estados Unidos</option>
                  </select>
                </div>
              </div>

              <div className="modal-row">
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Estado</label>
                  <input 
                    type="text" 
                    placeholder="ej. Yucatán"
                    value={newClientState} 
                    onChange={(e) => setNewClientState(e.target.value)} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Código Postal</label>
                  <input 
                    type="text" 
                    placeholder="ej. 97000"
                    value={newClientZip} 
                    onChange={(e) => setNewClientZip(e.target.value)} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Dirección (Calle, Número)</label>
                <input 
                  type="text" 
                  value={newClientAddress} 
                  onChange={(e) => setNewClientAddress(e.target.value)} 
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>Horario de Recepción</label>
                <input 
                  type="text" 
                  placeholder="ej. Lunes a Viernes 9:00 AM - 5:00 PM"
                  value={newClientReceptionSchedule} 
                  onChange={(e) => setNewClientReceptionSchedule(e.target.value)} 
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white" }} 
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button type="submit" className="btn-premium btn-primary-teal" style={{ flex: 1, padding: "10px" }}>Guardar Cliente</button>
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="btn-premium btn-secondary-sage" style={{ flex: 1, padding: "10px" }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
