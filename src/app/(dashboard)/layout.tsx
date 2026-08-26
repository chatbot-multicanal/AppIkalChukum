"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import "../globals.css";
import { getPendingFreightCountAction } from "@/app/(dashboard)/cotizaciones/actions";

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

  // Determine background image and filter based on pathname
  let bgGradient = "radial-gradient(at 0% 0%, rgba(20, 184, 166, 0.08) 0px, transparent 50%)"; // default teal
  let bgImage = "url('/bg-chukum.jpg')"; // Default Chukum for Ikal Chukum
  let blurFilter = "blur(15px) brightness(0.25) contrast(1.05)";

  if (pathname === "/inventario") {
    // Sage Green blurred theme background (Stock / Materials)
    bgGradient = "radial-gradient(at 0% 0%, rgba(164, 189, 145, 0.12) 0px, transparent 50%)";
    blurFilter = "blur(25px) brightness(0.2) contrast(1.1)";
  } else if (pathname === "/finanzas" || pathname === "/comisiones") {
    // Terracotta Chukum theme (less blur so we see the texture)
    bgGradient = "radial-gradient(at 0% 0%, rgba(245, 158, 11, 0.1) 0px, transparent 50%)";
    blurFilter = "blur(12px) brightness(0.24) contrast(1.08)";
  } else if (pathname === "/respaldos") {
    // Purple theme background (System / Admin)
    bgGradient = "radial-gradient(at 0% 0%, rgba(167, 120, 250, 0.1) 0px, transparent 50%)";
    blurFilter = "blur(25px) brightness(0.22) contrast(1.1)";
  }

  return (
    <div className="layout-container" style={{ position: "relative" }}>
      {/* Dynamic Segment Background */}
      <div style={{
        position: "fixed",
        top: "-50px",
        left: "-50px",
        right: "-50px",
        bottom: "-50px",
        backgroundImage: bgImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: blurFilter,
        zIndex: -2,
        pointerEvents: "none",
        transition: "all 0.8s ease" // Smooth fade transition between sections!
      }} />
      
      {/* Secondary Dynamic Radial Glow */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundImage: `${bgGradient}, radial-gradient(at 100% 100%, rgba(164, 189, 145, 0.05) 0px, transparent 50%)`,
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
                {item.icon}
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

        <div className="sidebar-footer" style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "auto", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
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
        {children}
      </div>
    </div>
  );
}
