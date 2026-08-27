"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import "../globals.css";
import { getPendingFreightCountAction } from "@/app/(dashboard)/cotizaciones/actions";

const SEGMENTS: Record<string, { color: string; bg: string }> = {
  "/": { color: "#1D8088", bg: "#10191B" },          // Dashboard (Turquesa #1D8088 -> #10191B)
  "/clientes": { color: "#A4BD91", bg: "#151A14" },    // Clientes (Verde salvia #A4BD91 -> #151A14)
  "/cotizaciones": { color: "#D5C3A5", bg: "#1B1813" },// Cotizaciones (Arena #D5C3A5 -> #1B1813)
  "/pedidos": { color: "#287A94", bg: "#10171B" },     // Pedidos (Azul petróleo #287A94 -> #10171B)
  "/inventario": { color: "#5F8C74", bg: "#111915" },  // Inventario (Verde profundo #5F8C74 -> #111915)
  "/comisiones": { color: "#C3A15E", bg: "#1B1811" },  // Comisiones (Dorado apagado #C3A15E -> #1B1811)
  "/finanzas": { color: "#4FAF8A", bg: "#101916" },    // Finanzas (Esmeralda #4FAF8A -> #101916)
  "/respaldos": { color: "#74828C", bg: "#141719" }    // Respaldos (Gris azulado #74828C -> #141719)
};

const getSegmentConfig = (path: string) => {
  if (path.startsWith("/clientes")) return SEGMENTS["/clientes"];
  if (path.startsWith("/cotizaciones")) return SEGMENTS["/cotizaciones"];
  if (path.startsWith("/pedidos")) return SEGMENTS["/pedidos"];
  if (path.startsWith("/inventario")) return SEGMENTS["/inventario"];
  if (path.startsWith("/comisiones")) return SEGMENTS["/comisiones"];
  if (path.startsWith("/finanzas")) return SEGMENTS["/finanzas"];
  if (path.startsWith("/respaldos")) return SEGMENTS["/respaldos"];
  return SEGMENTS["/"];
};

const TAB_IMAGES: Record<string, string> = {
  "Dashboard": "/tab-dashboard.png",
  "Clientes": "/tab-clientes.png",
  "Cotizaciones": "/tab-cotizaciones.png",
  "Pedidos": "/tab-pedidos.png",
  "Inventario": "/tab-inventario.png",
  "Comisiones": "/tab-comisiones.png",
  "Finanzas": "/tab-finanzas.png",
  "Respaldos": "/tab-respaldos.png"
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("Cargando...");
  const [userRole, setUserRole] = useState("VENDEDOR");
  const [pendingFreightCount, setPendingFreightCount] = useState(0);

  // Helper client-side para leer cookies
  useEffect(() => {
    const getCookie = (name: string) => {
      if (typeof document === "undefined") return "";
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(";").shift() || "");
      return "";
    };

    const role = getCookie("user_role") || "VENDEDOR";
    setUserName(getCookie("user_name") || "Usuario");
    setUserRole(role);

    // Fetch count if Admin, Bodega or Vendedor
    if (role === "BODEGA" || role === "ADMIN" || role === "VENDEDOR") {
      getPendingFreightCountAction().then((res) => {
        setPendingFreightCount(res.count);
      });
      
      const interval = setInterval(() => {
        getPendingFreightCountAction().then((res) => {
          setPendingFreightCount(res.count);
        });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleLogout = async () => {
    if (!confirm("¿Seguro que deseas cerrar la sesión?")) return;
    
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        router.push("/login");
        router.refresh();
      } else {
        alert("Error al cerrar sesión");
      }
    } catch (error) {
      console.error(error);
      alert("Error al intentar conectar con el servidor");
    }
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
      )
    },
    {
      name: "Clientes",
      path: "/clientes",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      )
    },
    {
      name: "Cotizaciones",
      path: "/cotizaciones",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      )
    },
    {
      name: "Pedidos",
      path: "/pedidos",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
      )
    },
    {
      name: "Inventario",
      path: "/inventario",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
      )
    },
    {
      name: "Comisiones",
      path: "/comisiones",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
      )
    },
    {
      name: "Finanzas",
      path: "/finanzas",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
      )
    },
    {
      name: "Respaldos",
      path: "/respaldos",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
      )
    }
  ].filter(item => {
    if (userRole === "BODEGA") {
      return ["Dashboard", "Pedidos", "Inventario", "Cotizaciones"].includes(item.name);
    }
    if (item.name === "Respaldos" || item.name === "Finanzas") {
      return userRole === "ADMIN";
    }
    return true;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentSegment = getSegmentConfig(pathname);

  // Configure CSS custom properties dynamically on the container wrapper
  const customStyles = {
    position: "relative",
    "--primary-teal": currentSegment.color,
    "--border-color-hover": `${currentSegment.color}5a`,
    "--shadow-glow": `0 0 20px ${currentSegment.color}44`,
    "--bg-app": currentSegment.bg
  } as React.CSSProperties;

  return (
    <div className="layout-container" style={customStyles}>
      {/* Background Texture plane with Chukum texture */}
      <div style={{
        position: "fixed",
        top: "-50px",
        left: "-50px",
        right: "-50px",
        bottom: "-50px",
        backgroundImage: "url('/bg-chukum.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "blur(15px) contrast(1.05)",
        opacity: 0.12, // Subtle texture showing behind the content
        zIndex: -2,
        pointerEvents: "none"
      }} />

      {/* Solid Dynamic Background Color (which transitions smoothly) */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: currentSegment.bg,
        zIndex: -3,
        pointerEvents: "none",
        transition: "all 0.8s ease" // Smooth fade transition between section backgrounds!
      }} />
      
      {/* Dynamic Radial Glow plane */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundImage: `radial-gradient(at 0% 0%, ${currentSegment.color}15 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(255, 255, 255, 0.02) 0px, transparent 50%)`,
        zIndex: -2,
        pointerEvents: "none",
        transition: "all 0.8s ease"
      }} />
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <button 
          onClick={() => setIsSidebarOpen(true)} 
          className="menu-toggle-btn"
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 800, background: 'linear-gradient(135deg, #ffffff 0%, #a4bd91 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IkalChukum</span>
        </div>
        <div style={{ width: '40px' }}></div> {/* Spacer to center the brand logo */}
      </header>

      {/* Sidebar Drawer Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? "open" : ""}`} 
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="brand-section">
            <img src="/logo.png" alt="Logo IkalChukum" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} />
            <span className="brand-name">IkalChukum</span>
          </div>
          {/* Close button on mobile */}
          <button 
            className="sidebar-close-btn" 
            onClick={() => setIsSidebarOpen(false)}
          >
            ×
          </button>
        </div>
        
        <nav className="nav-group">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const itemSegment = getSegmentConfig(item.path);
            const iconColor = itemSegment.color;
            
            // Define active styles based on business segment
            let activeStyle = {};
            if (isActive) {
              if (item.name === "Inventario") {
                // Sage Green Segment (Stock / Materials)
                activeStyle = {
                  color: "#ffffff",
                  background: "linear-gradient(135deg, rgba(164, 189, 145, 0.18) 0%, rgba(164, 189, 145, 0.05) 100%)",
                  borderColor: "rgba(164, 189, 145, 0.35)",
                  boxShadow: "0 0 15px rgba(164, 189, 145, 0.2)"
                };
              } else if (["Finanzas", "Comisiones"].includes(item.name)) {
                // Gold / Terracotta Segment (Finanzas / Miami)
                activeStyle = {
                  color: "#ffffff",
                  background: "linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.05) 100%)",
                  borderColor: "rgba(245, 158, 11, 0.35)",
                  boxShadow: "0 0 15px rgba(245, 158, 11, 0.2)"
                };
              } else if (item.name === "Respaldos") {
                // Purple Segment (System / Admin)
                activeStyle = {
                  color: "#ffffff",
                  background: "linear-gradient(135deg, rgba(167, 120, 250, 0.18) 0%, rgba(167, 120, 250, 0.05) 100%)",
                  borderColor: "rgba(167, 120, 250, 0.35)",
                  boxShadow: "0 0 15px rgba(167, 120, 250, 0.2)"
                };
              } else {
                // Default Teal Segment (Sales / CRM / Help2Win)
                activeStyle = {
                  color: "#ffffff",
                  background: "linear-gradient(135deg, rgba(29, 128, 136, 0.18) 0%, rgba(29, 128, 136, 0.05) 100%)",
                  borderColor: "rgba(29, 128, 136, 0.35)",
                  boxShadow: "0 0 15px rgba(29, 128, 136, 0.2)"
                };
              }
            }

            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className={`nav-link ${isActive ? "active" : ""}`}
                style={activeStyle}
                onClick={() => setIsSidebarOpen(false)} // Close sidebar when clicked
              >
                <span style={{ 
                  color: iconColor, 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  opacity: isActive ? 1 : 0.6,
                  transition: 'all 0.25s ease' 
                }} className="nav-icon-wrapper">
                  {item.icon}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>{item.name}</span>
                  {item.name === "Cotizaciones" && pendingFreightCount > 0 && (
                    <span style={{ 
                      background: '#ff9f43', 
                      color: '#ffffff', 
                      fontSize: '0.7rem', 
                      fontWeight: 800, 
                      padding: '2px 6px', 
                      borderRadius: '10px', 
                      lineHeight: '1',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(255, 159, 67, 0.4)'
                    }}>
                      {pendingFreightCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Branding Kit Graphic */}
        <div style={{ 
          marginTop: 'auto', 
          padding: '12px 0 0 0', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          width: '100%',
          overflow: 'hidden'
        }}>
          <img 
            src="/kit-chukum-neon.png" 
            alt="Ikal Chukum Premium Neon Kit" 
            style={{ 
              width: '110%', 
              maxHeight: '230px', 
              objectFit: 'contain',
              filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.55))'
            }} 
          />
        </div>

        <div className="sidebar-footer" style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="avatar">👤</div>
            <div className="user-info" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="user-name" style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", fontWeight: 600 }}>{userName}</span>
              <span className="user-role" style={{ fontSize: "0.75rem", color: "var(--primary-sage)", fontWeight: 700 }}>{userRole}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            style={{ 
              background: "rgba(239, 68, 68, 0.08)", 
              border: "1px solid rgba(239, 68, 68, 0.15)", 
              color: "#ef4444", 
              padding: "8px 12px", 
              borderRadius: "10px", 
              fontSize: "0.75rem", 
              fontWeight: 700, 
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: "100%",
              transition: "all 0.2s ease"
            }}
            className="logout-btn"
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Segment Tabs Row (Horizontal Grid) */}
        <div style={{ 
          padding: '40px 48px 0px 48px', 
          maxWidth: '1600px', 
          width: '100%', 
          margin: '0 auto' 
        }} className="top-nav-tabs-container">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', 
            gap: '12px',
            width: '100%' 
          }}>
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              const itemSegment = getSegmentConfig(item.path);
              const imageSrc = TAB_IMAGES[item.name] || "/tab-dashboard.png";
                return (
                <Link 
                  key={item.path} 
                  href={item.path}
                  style={{
                    display: 'flex',
                    flexDirection: 'column' as const,
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                  className="top-nav-3d-button"
                >
                  {/* The visual Card Image Wrapper */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9.5',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: 'transparent',
                    border: `1px solid ${isActive ? itemSegment.color : 'transparent'}`,
                    boxShadow: isActive ? `0 0 20px ${itemSegment.color}44` : 'none',
                  }} className="top-nav-3d-card-wrapper">
                    {/* Background 3D glass button image */}
                    <img 
                      src={imageSrc} 
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: isActive ? 'none' : 'grayscale(45%) opacity(55%) brightness(0.85)',
                        transition: 'all 0.3s ease',
                      }}
                      className="top-nav-3d-img"
                    />
                    
                    {/* Cotizaciones notification badge overlay */}
                    {item.name === "Cotizaciones" && pendingFreightCount > 0 && (
                      <span style={{ 
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: '#ff9f43', 
                        color: '#ffffff', 
                        fontSize: '0.7rem', 
                        fontWeight: 800, 
                        padding: '2px 6px', 
                        borderRadius: '10px', 
                        lineHeight: '1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(255, 159, 67, 0.4)'
                      }}>
                        {pendingFreightCount}
                      </span>
                    )}
                  </div>
                  
                  {/* Text label rendered EXTERNALLY below the card */}
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                    textAlign: 'center',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    marginTop: '2px'
                  }}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
