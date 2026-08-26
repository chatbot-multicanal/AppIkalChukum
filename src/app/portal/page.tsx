"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "@/app/globals.css";

export default function PortalPage() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#05070f",
      backgroundImage: "radial-gradient(circle at 50% 25%, rgba(17, 24, 48, 0.8) 0%, #05070f 75%)",
      color: "#ffffff",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "40px",
      boxSizing: "border-box",
      overflowX: "hidden",
      position: "relative"
    }}>
      {/* Background Glows */}
      <div style={{
        position: "absolute",
        top: "20%",
        left: "10%",
        width: "350px",
        height: "350px",
        background: "rgba(245, 158, 11, 0.06)",
        filter: "blur(120px)",
        borderRadius: "50%",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute",
        bottom: "20%",
        right: "10%",
        width: "400px",
        height: "400px",
        background: "rgba(16, 185, 129, 0.06)",
        filter: "blur(140px)",
        borderRadius: "50%",
        pointerEvents: "none"
      }} />

      {/* HEADER */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "1.3rem",
            boxShadow: "0 0 15px rgba(99, 102, 241, 0.4)"
          }}>
            M
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "0.5px" }}>Multiapp</span>
              <span style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                backgroundColor: "rgba(255,255,255,0.08)",
                padding: "2px 6px",
                borderRadius: "4px",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.1)"
              }}>
                V2.0 PRO
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Plataforma Multinegocio y Multiambiente</p>
          </div>
        </div>

        <button style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.25) 100%)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          color: "#ffffff",
          padding: "10px 20px",
          borderRadius: "10px",
          fontWeight: 700,
          fontSize: "0.85rem",
          cursor: "pointer",
          transition: "all 0.3s ease",
          boxShadow: "0 4px 12px rgba(99, 102, 241, 0.1)"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 0 15px rgba(99, 102, 241, 0.3)";
          e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.8)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.1)";
          e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
        }}
        >
          ➕ Crear empresa
        </button>
      </header>

      {/* HERO SECTION */}
      <main style={{
        textAlign: "center",
        margin: "60px auto",
        maxWidth: "1200px",
        width: "100%",
        zIndex: 10
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "6px 14px",
          borderRadius: "20px",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          marginBottom: "24px"
        }}>
          ✨ Tu ecosistema empresarial
        </div>

        <h1 style={{
          fontSize: "2.8rem",
          fontWeight: 800,
          margin: "0 0 16px 0",
          letterSpacing: "-0.5px"
        }}>
          ¿En qué ambiente vas a trabajar <span style={{
            background: "linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>hoy</span>?
        </h1>
        
        <p style={{
          fontSize: "1.05rem",
          color: "rgba(255,255,255,0.5)",
          margin: "0 0 48px 0"
        }}>
          Selecciona un negocio o explora tus giros comerciales.
        </p>

        {/* CARDS GRID */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          width: "100%"
        }}>
          
          {/* CARD 1: Servicios, Comercio & Acabados */}
          <div 
            onMouseEnter={() => setHoveredCard(1)}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(16px)",
              border: hoveredCard === 1 ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "400px",
              transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: hoveredCard === 1 
                ? "0 20px 40px rgba(0,0,0,0.4), 0 0 25px rgba(245, 158, 11, 0.15)" 
                : "0 10px 30px rgba(0,0,0,0.2)",
              transform: hoveredCard === 1 ? "translateY(-6px)" : "translateY(0)"
            }}
          >
            <div>
              {/* Icon Container */}
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
              </div>

              <h2 style={{ fontSize: "1.45rem", fontWeight: 700, margin: "0 0 12px 0", color: "#ffffff" }}>
                Servicios, Comercio & Acabados
              </h2>
              
              <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: "0 0 24px 0" }}>
                Proyectos, Cotizaciones, Insumos de Producción y servicios profesionales.
              </p>

              {/* Tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "32px" }}>
                {["Cotizaciones Exprés", "Gestión por Proyectos", "Agenda de Entregas"].map(t => (
                  <span key={t} style={{
                    fontSize: "0.72rem",
                    color: "rgba(245, 158, 11, 0.8)",
                    border: "1px solid rgba(245, 158, 11, 0.2)",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    backgroundColor: "rgba(245, 158, 11, 0.03)"
                  }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Action Link */}
            <Link href="/" style={{ textDecoration: "none" }}>
              <div style={{
                background: hoveredCard === 1 
                  ? "rgba(245, 158, 11, 0.15)" 
                  : "rgba(255,255,255,0.04)",
                border: hoveredCard === 1 
                  ? "1px solid rgba(245, 158, 11, 0.4)" 
                  : "1px solid rgba(255,255,255,0.06)",
                padding: "14px 20px",
                borderRadius: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 700,
                color: "#ffffff",
                transition: "all 0.3s ease",
                cursor: "pointer"
              }}>
                <span>Ikal Chukum – Acabados Orgánicos</span>
                <span style={{ fontSize: "1.1rem" }}>→</span>
              </div>
            </Link>
          </div>

          {/* CARD 2: Gastronomía & Vida Nocturna */}
          <div 
            onMouseEnter={() => setHoveredCard(2)}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(16px)",
              border: hoveredCard === 2 ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "400px",
              transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: hoveredCard === 2 
                ? "0 20px 40px rgba(0,0,0,0.4), 0 0 25px rgba(139, 92, 246, 0.15)" 
                : "0 10px 30px rgba(0,0,0,0.2)",
              transform: hoveredCard === 2 ? "translateY(-6px)" : "translateY(0)"
            }}
          >
            <div>
              {/* Icon Container */}
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(139, 92, 246, 0.1)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </div>

              <h2 style={{ fontSize: "1.45rem", fontWeight: 700, margin: "0 0 12px 0", color: "#ffffff" }}>
                Gastronomía & Vida Nocturna
              </h2>
              
              <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: "0 0 24px 0" }}>
                Restaurantes, Bares, Antros & Cafeterías. Punto de venta rápido con mapa de mesas e inventario de recetas.
              </p>

              {/* Tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "32px" }}>
                {["Comandas & Mesas", "Control de Recetas", "Arqueo de Caja"].map(t => (
                  <span key={t} style={{
                    fontSize: "0.72rem",
                    color: "rgba(139, 92, 246, 0.8)",
                    border: "1px solid rgba(139, 92, 246, 0.2)",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    backgroundColor: "rgba(139, 92, 246, 0.03)"
                  }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Action Link (Disabled Demo) */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              padding: "14px 20px",
              borderRadius: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 700,
              color: "rgba(255,255,255,0.3)",
              cursor: "not-allowed"
            }}>
              <span>La Mezcalería & Cantina (Próximamente)</span>
              <span style={{ fontSize: "1.1rem" }}>🔒</span>
            </div>
          </div>

          {/* CARD 3: Reservaciones & Eventos */}
          <div 
            onMouseEnter={() => setHoveredCard(3)}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(16px)",
              border: hoveredCard === 3 ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "400px",
              transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: hoveredCard === 3 
                ? "0 20px 40px rgba(0,0,0,0.4), 0 0 25px rgba(16, 185, 129, 0.15)" 
                : "0 10px 30px rgba(0,0,0,0.2)",
              transform: hoveredCard === 3 ? "translateY(-6px)" : "translateY(0)"
            }}
          >
            <div>
              {/* Icon Container */}
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>

              <h2 style={{ fontSize: "1.45rem", fontWeight: 700, margin: "0 0 12px 0", color: "#ffffff" }}>
                Reservaciones & Eventos
              </h2>
              
              <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: "0 0 24px 0" }}>
                Hoteles, Hostales, Departamentos, Canchas y Jardines. Calendario visual y gestión integral de Check-in.
              </p>

              {/* Tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "32px" }}>
                {["Calendario Ocupación", "Check-in / Check-out", "Tarifas Dinámicas"].map(t => (
                  <span key={t} style={{
                    fontSize: "0.72rem",
                    color: "rgba(16, 185, 129, 0.8)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    backgroundColor: "rgba(16, 185, 129, 0.03)"
                  }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Action Link (Disabled Demo) */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              padding: "14px 20px",
              borderRadius: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 700,
              color: "rgba(255,255,255,0.3)",
              cursor: "not-allowed"
            }}>
              <span>Villas, Canchas & Eventos Akumal (Próximamente)</span>
              <span style={{ fontSize: "1.1rem" }}>🔒</span>
            </div>
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        paddingTop: "24px",
        fontSize: "0.75rem",
        color: "rgba(255,255,255,0.35)",
        zIndex: 10
      }}>
        <div>
          Multiapp © 2026 — Plataforma Integral para Múltiples Negocios & Ambientes Comerciales.
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Soporte</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Términos</a>
        </div>
      </footer>
    </div>
  );
}
