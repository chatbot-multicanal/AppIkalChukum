export const dynamic = "force-dynamic";
import { db } from "@/lib/db";

export default async function ClientesPage() {
  // 1. Cargar clientes reales de SQLite
  const clients = await db.client.findMany({
    orderBy: { name: "asc" }
  });

  return (
    <main className="main-content animate-fade-in">
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
          <button className="btn-premium btn-primary-teal">
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
            placeholder="Buscar por nombre, correo o país..." 
            style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: '#ffffff', fontSize: '0.95rem', outline: 'none' }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        <select style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: '#ffffff', outline: 'none', cursor: 'pointer' }}>
          <option value="todos">Todos los Países</option>
          <option value="MX">México (MX)</option>
          <option value="US">Estados Unidos (US)</option>
        </select>
        <select style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: '#ffffff', outline: 'none', cursor: 'pointer' }}>
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
              <th>Contacto</th>
              <th>Ubicación</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>
                  <div style={{ fontWeight: 700, color: '#ffffff' }}>{client.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {client.id}</div>
                </td>
                <td>
                  <div style={{ fontSize: '0.9rem' }}>{client.email || "Sin correo electrónico"}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{client.phone || "Sin teléfono"}</div>
                </td>
                <td>
                  <div style={{ fontSize: '0.9rem' }}>{client.city}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{client.country}</div>
                </td>
                <td>
                  <span className={`badge ${client.active ? "badge-approved" : "badge-cancelled"}`}>
                    {client.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary-teal)', cursor: 'pointer', fontWeight: 600, marginRight: '12px' }}>Editar</button>
                  <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                    {client.active ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
