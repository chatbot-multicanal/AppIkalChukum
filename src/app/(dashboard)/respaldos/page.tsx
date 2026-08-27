"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface BackupRecord {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
}

export default function RespaldosPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [restoreText, setRestoreText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load backups list
  const loadBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/respaldos");
      if (!response.ok) {
        throw new Error("No se pudo cargar la lista de respaldos.");
      }
      const data = await response.json();
      setBackups(data);
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  // Trigger manual backup creation
  const handleCreateBackup = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/respaldos", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Error al generar el respaldo.");
      }
      alert("Copia de seguridad creada y almacenada exitosamente.");
      loadBackups();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete backup record
  const handleDeleteBackup = async (id: string, filename: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el respaldo "${filename}"?`)) {
      return;
    }
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/respaldos/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Error al eliminar el respaldo.");
      }
      alert("Respaldo eliminado con éxito.");
      loadBackups();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download backup file
  const handleDownloadBackup = (id: string, filename: string) => {
    window.open(`/api/respaldos/${id}`, "_blank");
  };

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Handle Restore file submission
  const handleRestoreDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert("Por favor selecciona un archivo JSON de respaldo.");
      return;
    }

    if (restoreText.trim().toUpperCase() !== "RESTAURAR") {
      alert('Por favor escribe la palabra "RESTAURAR" exactamente para confirmar la restauración.');
      return;
    }

    if (!confirm("⚠️ ADVERTENCIA CRÍTICA: Esta acción eliminará COMPLETAMENTE todos los datos actuales de clientes, cotizaciones, inventario y usuarios de la base de datos y los reemplazará con la información del archivo. ¿Deseas continuar?")) {
      return;
    }

    setIsProcessing(true);

    try {
      // Leer el archivo local
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonContent = JSON.parse(event.target?.result as string);
          
          // Enviar payload de restauración
          const response = await fetch("/api/respaldos/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonContent)
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || "Error en el servidor durante la restauración.");
          }

          alert("🎉 ¡Base de datos restaurada correctamente! Se recomienda cerrar sesión y volver a entrar.");
          setRestoreText("");
          if (fileInputRef.current) fileInputRef.current.value = "";
          loadBackups();
        } catch (err: any) {
          alert(`Error al procesar el archivo: ${err.message}`);
        } finally {
          setIsProcessing(false);
        }
      };

      reader.readAsText(file);
    } catch (error: any) {
      alert(`Error al restaurar: ${error.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <main className="main-content animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Respaldos del Sistema
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Administra copias de seguridad de la base de datos en la nube de forma manual o automática.
          </p>
        </div>
        <div className="page-header-actions">
          <button 
            onClick={handleCreateBackup}
            disabled={isProcessing}
            className="btn-premium btn-primary-teal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            Crear Respaldo Ahora
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px", alignItems: "start" }} className="grid-responsive">
        
        {/* Left Side: Backup list history */}
        <div className="glass-card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: "1.25rem", color: "#ffffff", fontWeight: 700, marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
            Historial de Copias de Seguridad (Base de Datos)
          </h2>

          {loading ? (
            <div style={{ color: "var(--text-secondary)", padding: "20px 0" }}>Cargando lista de respaldos...</div>
          ) : backups.length === 0 ? (
            <div style={{ color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>
              No se han encontrado copias de seguridad.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="premium-table">
              <thead>
                <tr>
                  <th>Fecha de Respaldo</th>
                  <th>Nombre del Archivo</th>
                  <th>Tamaño</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>
                      {new Date(b.createdAt).toLocaleDateString("es-MX", { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                      {b.filename}
                      {b.filename.includes("auto") && (
                        <span style={{ fontSize: "0.7rem", color: "var(--primary-sage)", background: "rgba(164,189,145,0.08)", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px", border: "1px solid rgba(164,189,145,0.2)" }}>
                          Semanal Automático
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--primary-sage)" }}>
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button 
                        onClick={() => handleDownloadBackup(b.id, b.filename)}
                        disabled={isProcessing}
                        className="btn-premium"
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '0.8rem', 
                          borderRadius: '8px', 
                          marginRight: '12px',
                          background: 'rgba(29,128,136,0.1)',
                          color: 'var(--primary-teal)',
                          border: '1px solid rgba(29,128,136,0.3)',
                          cursor: "pointer"
                        }}
                      >
                        Descargar
                      </button>
                      <button 
                        onClick={() => handleDeleteBackup(b.id, b.filename)}
                        disabled={isProcessing}
                        className="btn-premium"
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '0.8rem', 
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          cursor: "pointer"
                        }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>

        {/* Right Side: Restore DB Panel */}
        <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <h2 style={{ fontSize: "1.25rem", color: "#ffffff", fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", margin: 0 }}>
            Restauración de Emergencia
          </h2>

          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Sube un archivo de respaldo `.json` descargado previamente para restaurar toda la base de datos a ese estado.
          </p>

          <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", padding: "16px" }}>
            <span style={{ fontSize: "0.75rem", color: "#ff6b6b", fontWeight: 700, display: "block", marginBottom: "4px" }}>
              ⚠️ ATENCIÓN:
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
              Esta operación es destructiva y reescribirá la base de datos. Asegúrate de tener una copia de respaldo antes de continuar.
            </span>
          </div>

          <form onSubmit={handleRestoreDatabase} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>
                Archivo de Respaldo (.json) *
              </label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".json"
                required
                style={{ width: "100%", color: "white", fontSize: "0.8rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>
                Escribe &quot;RESTAURAR&quot; para confirmar *
              </label>
              <input 
                type="text" 
                value={restoreText}
                onChange={(e) => setRestoreText(e.target.value)}
                placeholder="RESTAURAR"
                required
                style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", color: "white", outline: "none" }}
              />
            </div>

            <button 
              type="submit"
              disabled={isProcessing}
              className="btn-premium"
              style={{
                width: "100%",
                padding: "12px",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ff6b6b",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "8px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {isProcessing ? "Restaurando..." : "Iniciar Restauración"}
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}
