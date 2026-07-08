"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  createClientAction, 
  updateClientAction, 
  toggleClientStatusAction 
} from "./actions";

interface Client {
  id: string;
  name: string;
  company: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  zip: string | null;
  city: string;
  country: string;
  receptionSchedule: string | null;
  active: boolean;
  createdAt: Date | string;
  user?: {
    name: string;
  } | null;
}

interface ClientesClientProps {
  initialClients: Client[];
}

export default function ClientesClient({ initialClients }: ClientesClientProps) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClients);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("activos");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("México");
  const [receptionSchedule, setReceptionSchedule] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unique countries for filter dropdown
  const countries = Array.from(new Set(clients.map(c => c.country))).filter(Boolean);

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditingClient(null);
    setName("");
    setCompany("");
    setContact("");
    setEmail("");
    setPhone("");
    setAddress("");
    setState("");
    setZip("");
    setCity("");
    setCountry("México");
    setReceptionSchedule("");
    setError(null);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setCompany(client.company || "");
    setContact(client.contact || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setAddress(client.address || "");
    setState(client.state || "");
    setZip(client.zip || "");
    setCity(client.city);
    setCountry(client.country);
    setReceptionSchedule(client.receptionSchedule || "");
    setError(null);
    setIsModalOpen(true);
  };

  // Submit client form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!name.trim() || !city.trim() || !country.trim()) {
      setError("El nombre, la ciudad y el país son requeridos.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      name,
      company,
      contact,
      email,
      phone,
      address,
      state,
      zip,
      city,
      country,
      receptionSchedule
    };

    let res;
    if (editingClient) {
      res = await updateClientAction(editingClient.id, payload);
    } else {
      res = await createClientAction(payload);
    }

    if (res.success && res.client) {
      // Refresh local clients list
      if (editingClient) {
        setClients(prev => prev.map(c => c.id === editingClient.id ? (res.client as any) : c));
      } else {
        setClients(prev => [res.client as any, ...prev]);
      }
      setIsModalOpen(false);
      router.refresh();
      alert(editingClient ? "¡Cliente actualizado correctamente!" : "¡Cliente guardado correctamente!");
    } else {
      setError(res.error || "Ocurrió un error al guardar el cliente.");
    }
    setIsSubmitting(false);
  };

  // Toggle client status (activate/deactivate)
  const handleToggleStatus = async (client: Client) => {
    const actionWord = client.active ? "desactivar" : "activar";
    if (!confirm(`¿Seguro que deseas ${actionWord} al cliente "${client.name}"?`)) return;

    const res = await toggleClientStatusAction(client.id, client.active);
    if (res.success && res.client) {
      setClients(prev => prev.map(c => c.id === client.id ? (res.client as any) : c));
      router.refresh();
    } else {
      alert("Error al cambiar estado: " + res.error);
    }
  };

  // Filter clients
  const filteredClients = clients.filter(c => {
    // 1. Search Query
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      c.name.toLowerCase().includes(query) ||
      (c.company && c.company.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      c.city.toLowerCase().includes(query) ||
      c.country.toLowerCase().includes(query);

    // 2. Country Filter
    const matchesCountry = countryFilter === "todos" || c.country === countryFilter;

    // 3. Status Filter
    const matchesStatus = 
      statusFilter === "todos" || 
      (statusFilter === "activos" && c.active) || 
      (statusFilter === "inactivos" && !c.active);

    return matchesSearch && matchesCountry && matchesStatus;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Directorio de Clientes
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Administra los clientes, su información de contacto y segmentación por país.
          </p>
        </div>
        <div className="page-header-actions">
          <button onClick={handleOpenAdd} className="btn-premium btn-primary-teal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Agregar Cliente
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-card filter-row" style={{ padding: '20px', marginBottom: '30px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input 
            type="text" 
            placeholder="Buscar por nombre, empresa, correo o país..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: '#ffffff', fontSize: '0.95rem', outline: 'none' }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        <select 
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(18, 24, 38, 0.95)', border: '1px solid var(--border-color)', color: '#ffffff', outline: 'none', cursor: 'pointer' }}
        >
          <option value="todos">Todos los Países</option>
          {countries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(18, 24, 38, 0.95)', border: '1px solid var(--border-color)', color: '#ffffff', outline: 'none', cursor: 'pointer' }}
        >
          <option value="todos">Todos los Estados</option>
          <option value="activos">Sólo Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </div>

      {/* Clients Table */}
      <div className="glass-card" style={{ padding: '32px', overflowX: 'auto' }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Empresa</th>
              <th>Contacto</th>
              <th>Ubicación</th>
              <th>Recepción</th>
              <th>Vendedor</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No se encontraron clientes registrados.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#ffffff' }}>{client.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {client.id}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{client.company || "-"}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.9rem' }}>{client.email || "Sin correo"}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{client.phone || "Sin teléfono"}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.9rem' }}>{client.city}{client.state ? `, ${client.state}` : ""}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{client.country} {client.zip ? `(CP: ${client.zip})` : ""}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{client.receptionSchedule || "No indicado"}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{client.user?.name || "Administración"}</div>
                  </td>
                  <td>
                    <span className={`badge ${client.active ? "badge-approved" : "badge-cancelled"}`}>
                      {client.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleOpenEdit(client)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-teal)', cursor: 'pointer', fontWeight: 600, marginRight: '12px' }}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleToggleStatus(client)}
                      style={{ background: 'none', border: 'none', color: client.active ? '#ef4444' : 'var(--primary-sage)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {client.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: AGREGAR / EDITAR CLIENTE */}
      {isModalOpen && (
        <div style={modalBackdropStyle} onClick={() => setIsModalOpen(false)}>
          <div className="modal-content-card" style={{ maxWidth: "550px", width: "95%", background: "rgba(18, 24, 38, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "20px", padding: "30px", color: "#ffffff", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                {editingClient ? "✏️ Editar Cliente" : "👤 Agregar Nuevo Cliente"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={closeButtonStyle}>×</button>
            </div>

            {error && <div style={errorStyle}>⚠️ {error}</div>}

            <form onSubmit={handleSubmit} style={formStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Nombre Completo *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej. Juan Pérez"
                    required
                    disabled={isSubmitting}
                    style={inputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Nombre de la Empresa</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="ej. Constructora Alfa"
                    disabled={isSubmitting}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Contacto Adicional</label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="ej. Ing. Civil / Compras"
                    disabled={isSubmitting}
                    style={inputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Teléfono de Contacto</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="ej. 9991234567"
                    disabled={isSubmitting}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. compras@empresa.com"
                  disabled={isSubmitting}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Ciudad *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="ej. Mérida"
                    required
                    disabled={isSubmitting}
                    style={inputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>País *</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    disabled={isSubmitting}
                    style={{ ...inputStyle, background: "rgba(8, 11, 17, 0.95)" }}
                  >
                    <option value="México">México</option>
                    <option value="Estados Unidos">Estados Unidos</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Estado</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="ej. Yucatán"
                    disabled={isSubmitting}
                    style={inputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Código Postal (CP)</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="ej. 97000"
                    disabled={isSubmitting}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Dirección (Calle, Número, Colonia)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="ej. Calle 60 #204 x 25 y 27 Centro"
                  disabled={isSubmitting}
                  style={inputStyle}
                />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Horario de Recepción</label>
                <input
                  type="text"
                  value={receptionSchedule}
                  onChange={(e) => setReceptionSchedule(e.target.value)}
                  placeholder="ej. Lun-Vie 9:00 AM - 5:00 PM, Sáb 9:00 AM - 1:00 PM"
                  disabled={isSubmitting}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  {isSubmitting ? "Guardando..." : editingClient ? "Actualizar" : "Guardar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Estilos de modales
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
  gap: "14px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
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
