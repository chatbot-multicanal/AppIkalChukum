"use client";

import { useEffect, useState, useRef } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  contactKey: string;
  phone: string;
  clientName: string | null;
  city: string | null;
  country: string | null;
  lastMessage: string;
  lastAt: string;
  messages: ChatMessage[];
}

interface LogEntry {
  id: string;
  createdAt: string;
  type: "INFO" | "SUCCESS" | "ERROR" | "WA";
  phone: string;
  summary: string;
  userMessage?: string;
  botReply?: string;
}

interface WaStatus {
  connected: boolean;
  qr: string | null;
  lastConnected: string | null;
  serviceLogs: string[];
  updatedAt: string | null;
}

export default function SofiaMonitorPage() {
  const [activeSubTab, setActiveSubTab] = useState<"chat" | "logs" | "qr">("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [waStatus, setWaStatus] = useState<WaStatus>({
    connected: false,
    qr: null,
    lastConnected: null,
    serviceLogs: [],
    updatedAt: null,
  });

  const [selectedContactKey, setSelectedContactKey] = useState<string>("SIMULADOR");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Estado para probador / chat en vivo con Sofía
  const [testInput, setTestInput] = useState("");
  const [testPhone, setTestPhone] = useState("529990001122");
  const [isSending, setIsSending] = useState(false);
  const [isResettingQr, setIsResettingQr] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchMonitorData = async () => {
    try {
      const res = await fetch("/api/chat/sofia/logs", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        setLogs(data.logs || []);
        if (data.waStatus) {
          setWaStatus(data.waStatus);
        }

        // Si estaba en SIMULADOR y aún no había conversaciones seleccionadas, seleccionar la más reciente si existe
        if (
          selectedContactKey === "SIMULADOR" &&
          data.conversations &&
          data.conversations.length > 0 &&
          loading
        ) {
          setSelectedContactKey(data.conversations[0].contactKey);
        }
      }
    } catch (err) {
      console.error("Error cargando monitor de Sofía:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMonitorData();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedContactKey, loading]);

  const activeConversation = conversations.find((c) => c.contactKey === selectedContactKey) || null;

  useEffect(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [selectedContactKey]);

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.phone.toLowerCase().includes(q) ||
      (c.clientName && c.clientName.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  });

  const handleSendMessageToSofia = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = testInput.trim();
    if (!text || isSending) return;

    const targetPhone =
      selectedContactKey === "SIMULADOR"
        ? testPhone.trim() || "529990001122"
        : activeConversation?.phone || testPhone;

    setIsSending(true);
    setTestInput("");

    try {
      const res = await fetch("/api/chat/sofia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          phone: targetPhone,
          contact_id: targetPhone,
        }),
      });

      if (res.ok) {
        await fetchMonitorData();
        const digits = targetPhone.replace(/\D/g, "") || targetPhone;
        setSelectedContactKey(digits);
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 150);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error al enviar mensaje a Sofía");
      }
    } catch (error: any) {
      alert(`Error de red: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetWhatsAppQr = async () => {
    if (!confirm("¿Deseas reiniciar la sesión de WhatsApp y generar un nuevo código QR?")) return;
    setIsResettingQr(true);
    try {
      await fetch("/api/chat/sofia/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REQUEST_RESET" }),
      });
      setTimeout(() => {
        fetchMonitorData();
        setIsResettingQr(false);
      }, 2000);
    } catch {
      setIsResettingQr(false);
    }
  };

  const getPaletteImageForMessage = (text: string): string | null => {
    const lower = text.toLowerCase();
    if (
      lower.includes("#ik-nat-usa") ||
      lower.includes("#ik-rosa-usa") ||
      lower.includes("#ik-maya-usa") ||
      lower.includes("colores de ee. uu.") ||
      lower.includes("(estados unidos / usa)")
    ) {
      return "/paleta_colores_usa.jpg";
    }
    if (
      lower.includes("#ik-hacienda") ||
      lower.includes("#ik-cafe") ||
      lower.includes("#ik-rojizo") ||
      lower.includes("(méxico y exportación)") ||
      lower.includes("#ik-") ||
      lower.includes("justo aquí abajo en imagen")
    ) {
      return "/paleta_colores_mx.jpg";
    }
    return null;
  };

  return (
    <main className="main-content animate-fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                color: "var(--text-main)",
                letterSpacing: "-0.5px",
                margin: 0,
              }}
            >
              Sofía IA • Chat en Vivo & Logs
            </h1>
            <span
              onClick={() => setActiveSubTab("qr")}
              style={{
                cursor: "pointer",
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "0.78rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: waStatus.connected
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(245, 158, 11, 0.15)",
                color: waStatus.connected ? "#34d399" : "#fbbf24",
                border: waStatus.connected
                  ? "1px solid rgba(16, 185, 129, 0.4)"
                  : "1px solid rgba(245, 158, 11, 0.4)",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: waStatus.connected ? "#10b981" : "#f59e0b",
                  boxShadow: waStatus.connected ? "0 0 8px #10b981" : "0 0 8px #f59e0b",
                }}
              />
              {waStatus.connected
                ? "WhatsApp Conectado 24/7 (Sin ManyChat)"
                : "WhatsApp Esperando Escaneo QR"}
            </span>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "1rem",
              fontWeight: 500,
              marginTop: "6px",
            }}
          >
            Monitorea las conversaciones de WhatsApp en tiempo real, revisa los logs técnicos y vincula el número oficial de IKAL CHUKUM.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="btn-premium"
            style={{
              background: autoRefresh ? "rgba(16, 185, 129, 0.12)" : "rgba(255,255,255,0.05)",
              border: autoRefresh
                ? "1px solid rgba(16, 185, 129, 0.35)"
                : "1px solid var(--border-color)",
              color: autoRefresh ? "#34d399" : "var(--text-secondary)",
              padding: "9px 14px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {autoRefresh ? "🟢 Tiempo Real: ACTIVO (3s)" : "⏸️ Tiempo Real: PAUSADO"}
          </button>

          <button
            onClick={fetchMonitorData}
            className="btn-premium btn-primary-teal"
            style={{ padding: "9px 16px", fontSize: "0.85rem" }}
          >
            🔄 Actualizar Ahora
          </button>
        </div>
      </div>

      {/* Sub-Navigation Pills (Chat en Vivo | Consola de Logs | Vincular QR WhatsApp) */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "22px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "14px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setActiveSubTab("chat")}
          style={{
            padding: "10px 20px",
            borderRadius: "12px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            border:
              activeSubTab === "chat"
                ? "1px solid rgba(29, 128, 136, 0.6)"
                : "1px solid rgba(255,255,255,0.08)",
            background:
              activeSubTab === "chat"
                ? "linear-gradient(135deg, rgba(29, 128, 136, 0.28) 0%, rgba(29, 128, 136, 0.08) 100%)"
                : "rgba(255,255,255,0.03)",
            color: activeSubTab === "chat" ? "#ffffff" : "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          💬 Chat en Vivo ({conversations.length})
        </button>

        <button
          onClick={() => setActiveSubTab("logs")}
          style={{
            padding: "10px 20px",
            borderRadius: "12px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            border:
              activeSubTab === "logs"
                ? "1px solid rgba(213, 195, 165, 0.6)"
                : "1px solid rgba(255,255,255,0.08)",
            background:
              activeSubTab === "logs"
                ? "linear-gradient(135deg, rgba(213, 195, 165, 0.25) 0%, rgba(213, 195, 165, 0.06) 100%)"
                : "rgba(255,255,255,0.03)",
            color: activeSubTab === "logs" ? "#ffffff" : "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          🖥️ Monitor de Logs ({logs.length})
        </button>

        <button
          onClick={() => setActiveSubTab("qr")}
          style={{
            padding: "10px 20px",
            borderRadius: "12px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            border:
              activeSubTab === "qr"
                ? "1px solid rgba(16, 185, 129, 0.6)"
                : "1px solid rgba(255,255,255,0.08)",
            background:
              activeSubTab === "qr"
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.06) 100%)"
                : "rgba(255,255,255,0.03)",
            color: activeSubTab === "qr" ? "#ffffff" : "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          📱 Conexión WhatsApp / QR
        </button>
      </div>

      {/* TAB 1: CHAT EN VIVO */}
      {activeSubTab === "chat" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "350px 1fr",
            gap: "24px",
            minHeight: "640px",
            alignItems: "stretch",
          }}
          className="grid-responsive"
        >
          {/* Left Column: Conversations List */}
          <div
            className="glass-card"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              maxHeight: "720px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                Conversaciones Activas
              </h2>
              <button
                onClick={() => setSelectedContactKey("SIMULADOR")}
                style={{
                  background: "rgba(29, 128, 136, 0.18)",
                  border: "1px solid rgba(29, 128, 136, 0.4)",
                  color: "#5eead4",
                  borderRadius: "8px",
                  padding: "5px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✨ + Simular Chat
              </button>
            </div>

            <input
              type="text"
              placeholder="🔍 Buscar por cliente, teléfono o mensaje..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(0,0,0,0.25)",
                border: "1px solid var(--border-color)",
                color: "#fff",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                paddingRight: "4px",
              }}
            >
              {loading ? (
                <div style={{ color: "var(--text-secondary)", padding: "20px", textAlign: "center" }}>
                  Cargando conversaciones...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div
                  style={{
                    color: "var(--text-muted)",
                    padding: "28px 16px",
                    textAlign: "center",
                    fontSize: "0.85rem",
                  }}
                >
                  No hay conversaciones registradas todavía. Usa el botón{" "}
                  <strong>&quot;✨ + Simular Chat&quot;</strong> o envía un WhatsApp al número vinculado.
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = selectedContactKey === conv.contactKey;
                  return (
                    <div
                      key={conv.contactKey}
                      onClick={() => setSelectedContactKey(conv.contactKey)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        cursor: "pointer",
                        background: isSelected
                          ? "linear-gradient(135deg, rgba(29, 128, 136, 0.25) 0%, rgba(29, 128, 136, 0.08) 100%)"
                          : "rgba(255,255,255,0.02)",
                        border: isSelected
                          ? "1px solid rgba(29, 128, 136, 0.5)"
                          : "1px solid rgba(255,255,255,0.05)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "4px",
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>
                          {conv.clientName || `📱 ${conv.phone}`}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {new Date(conv.lastAt).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {conv.clientName && (
                        <div
                          style={{
                            fontSize: "0.73rem",
                            color: "var(--primary-sage)",
                            marginBottom: "4px",
                            fontWeight: 600,
                          }}
                        >
                          📞 {conv.phone} {conv.city ? `• 📍 ${conv.city}, ${conv.country}` : ""}
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {conv.lastMessage}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active WhatsApp Conversation View */}
          <div
            className="glass-card"
            style={{
              padding: "0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              maxHeight: "720px",
            }}
          >
            {/* Chat Window Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border-color)",
                background: "rgba(0,0,0,0.25)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1D8088, #5F8C74)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {activeConversation ? "💬" : "✨"}
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: "#fff", fontSize: "1.05rem" }}>
                    {activeConversation
                      ? activeConversation.clientName || `Cliente WhatsApp (${activeConversation.phone})`
                      : "Simulador en Vivo • Asesora Sofía IA"}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {activeConversation
                      ? `Teléfono: ${activeConversation.phone} ${
                          activeConversation.city
                            ? `• ${activeConversation.city}, ${activeConversation.country}`
                            : ""
                        } • ${activeConversation.messages.length} mensaje(s)`
                      : "Prueba respuestas de Sofía en tiempo real conectada al inventario y cotizador del ERP"}
                  </div>
                </div>
              </div>

              {selectedContactKey === "SIMULADOR" && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Tel. Simulado:
                  </span>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      fontSize: "0.8rem",
                      width: "140px",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Chat Messages Scroll Area */}
            <div
              style={{
                flex: 1,
                padding: "24px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                background: "rgba(8, 12, 13, 0.45)",
              }}
            >
              {!activeConversation || activeConversation.messages.length === 0 ? (
                <div
                  style={{
                    margin: "auto",
                    textAlign: "center",
                    maxWidth: "460px",
                    padding: "32px",
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ fontSize: "2.4rem", marginBottom: "10px" }}>🏛️</div>
                  <h3 style={{ color: "#fff", margin: "0 0 8px 0", fontSize: "1.1rem" }}>
                    Asesora Sofía • IKAL CHUKUM Lista
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    Escribe un mensaje aquí abajo para probar a Sofía en vivo (ej.{" "}
                    <em>&quot;Hola, ¿qué colores de Chukum manejan?&quot;</em> o{" "}
                    <em>&quot;¿Cuántos kits necesito para 45 m2 sobre revoco?&quot;</em>) o selecciona un
                    chat de WhatsApp de la columna izquierda.
                  </p>
                </div>
              ) : (
                activeConversation.messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const paletteImgSrc = !isUser ? getPaletteImageForMessage(msg.content) : null;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isUser ? "flex-start" : "flex-end",
                        maxWidth: "78%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isUser ? "flex-start" : "flex-end",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          marginBottom: "4px",
                          padding: "0 4px",
                        }}
                      >
                        {isUser
                          ? `👤 Cliente (${activeConversation.clientName || activeConversation.phone})`
                          : "🏛️ Sofía IA • IKAL CHUKUM"}{" "}
                        •{" "}
                        {new Date(msg.createdAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>

                      <div
                        style={{
                          padding: "14px 18px",
                          borderRadius: isUser ? "16px 16px 16px 4px" : "16px 16px 4px 16px",
                          background: isUser
                            ? "rgba(255, 255, 255, 0.07)"
                            : "linear-gradient(135deg, rgba(29, 128, 136, 0.35) 0%, rgba(20, 88, 94, 0.45) 100%)",
                          border: isUser
                            ? "1px solid rgba(255, 255, 255, 0.1)"
                            : "1px solid rgba(29, 128, 136, 0.55)",
                          color: "#f5f5f4",
                          fontSize: "0.9rem",
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                          boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                        }}
                      >
                        {msg.content.replace(/\*\*([^*]+)\*\*/g, "*$1*")}

                        {paletteImgSrc && (
                          <div style={{ marginTop: "12px" }}>
                            <img
                              src={paletteImgSrc}
                              alt="Paleta Oficial IKAL CHUKUM"
                              style={{
                                maxWidth: "260px",
                                width: "100%",
                                borderRadius: "10px",
                                border: "1px solid rgba(255,255,255,0.15)",
                                display: "block",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom Input Bar to test / interact with Sofía */}
            <form
              onSubmit={handleSendMessageToSofia}
              style={{
                padding: "16px 20px",
                borderTop: "1px solid var(--border-color)",
                background: "rgba(0,0,0,0.3)",
                display: "flex",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="Escribe un mensaje para probar a Sofía en este hilo..."
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                disabled={isSending}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-color)",
                  color: "#fff",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={isSending || !testInput.trim()}
                className="btn-premium btn-primary-teal"
                style={{
                  padding: "12px 22px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  cursor: isSending ? "wait" : "pointer",
                  opacity: isSending || !testInput.trim() ? 0.6 : 1,
                }}
              >
                {isSending ? "Sofía escribiendo..." : "Enviar a Sofía ➔"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: CONSOLA DE LOGS EN VIVO */}
      {activeSubTab === "logs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Live Service Terminal */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "12px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                  🖥️ Terminal en Vivo • Servicio Directo de WhatsApp
                </h2>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Eventos en tiempo real del socket de WhatsApp y del motor de IA de Sofía
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: waStatus.connected ? "#34d399" : "#fbbf24",
                  fontWeight: 700,
                }}
              >
                {waStatus.connected ? "🟢 SOCKET CONECTADO" : "🟡 ESPERANDO VINCULACIÓN"}
              </span>
            </div>

            <div
              style={{
                background: "#07090A",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "16px",
                fontFamily: "monospace",
                fontSize: "0.82rem",
                lineHeight: 1.65,
                maxHeight: "300px",
                overflowY: "auto",
                color: "#d6d3d1",
              }}
            >
              {waStatus.serviceLogs && waStatus.serviceLogs.length > 0 ? (
                waStatus.serviceLogs.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "2px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      color: line.includes("❌")
                        ? "#f87171"
                        : line.includes("📤")
                        ? "#34d399"
                        : line.includes("📩")
                        ? "#38bdf8"
                        : "#e7e5e4",
                    }}
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--text-muted)" }}>
                  Mostrando eventos de auditoría de la base de datos abajo...
                </div>
              )}
            </div>
          </div>

          {/* Detailed Database Audit Logs Table */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <h2
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#fff",
                margin: "0 0 16px 0",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "12px",
              }}
            >
              📋 Historial Detallado de Interacciones (AuditLog)
            </h2>

            {logs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", padding: "24px", textAlign: "center" }}>
                No hay registros de logs todavía.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Hora / Fecha</th>
                      <th>Estado</th>
                      <th>Cliente / Teléfono</th>
                      <th>Mensaje del Cliente</th>
                      <th>Respuesta de Sofía</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: "nowrap", fontSize: "0.8rem", fontWeight: 600 }}>
                          {new Date(log.createdAt).toLocaleString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              background:
                                log.type === "ERROR"
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : "rgba(16, 185, 129, 0.15)",
                              color: log.type === "ERROR" ? "#f87171" : "#34d399",
                            }}
                          >
                            {log.type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: "var(--primary-sage)", fontSize: "0.85rem" }}>
                          {log.phone}
                        </td>
                        <td style={{ maxWidth: "280px", fontSize: "0.83rem", color: "#fff" }}>
                          {log.userMessage || "—"}
                        </td>
                        <td
                          style={{
                            maxWidth: "420px",
                            fontSize: "0.82rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {log.botReply ? (
                            <div
                              style={{
                                maxHeight: "75px",
                                overflowY: "auto",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {log.botReply}
                            </div>
                          ) : (
                            log.summary
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VINCULAR WHATSAPP / QR DIRECTO */}
      {activeSubTab === "qr" && (
        <div
          className="glass-card"
          style={{
            padding: "40px 28px",
            maxWidth: "560px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          {waStatus.connected ? (
            <div>
              <div style={{ fontSize: "3.5rem", marginBottom: "12px" }}>✅</div>
              <h2 style={{ color: "#34d399", fontSize: "1.6rem", fontWeight: 800, margin: "0 0 8px 0" }}>
                WhatsApp Conectado Activo 24/7
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                La asesora <strong>Sofía (IKAL CHUKUM)</strong> está vinculada directamente a WhatsApp sin
                necesidad de ManyChat, respondiendo mensajes, enviando la paleta de colores y creando
                cotizaciones en el ERP automáticamente.
              </p>
              {waStatus.lastConnected && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px" }}>
                  Última conexión establecida:{" "}
                  {new Date(waStatus.lastConnected).toLocaleString("es-MX")}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                  marginTop: "24px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setActiveSubTab("chat")}
                  className="btn-premium btn-primary-teal"
                >
                  💬 Ir al Chat en Vivo
                </button>
                <button
                  onClick={handleResetWhatsAppQr}
                  disabled={isResettingQr}
                  className="btn-premium"
                  style={{
                    background: "rgba(239, 68, 68, 0.14)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#f87171",
                    cursor: "pointer",
                  }}
                >
                  {isResettingQr ? "Reiniciando..." : "🔄 Desvincular / Cambiar Número"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, margin: "0 0 8px 0" }}>
                📱 Vincular WhatsApp de IKAL CHUKUM
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>
                Escanea este código QR desde el WhatsApp o WhatsApp Business de Ikal Chukum:
              </p>

              <div
                style={{
                  background: "#ffffff",
                  padding: "16px",
                  borderRadius: "20px",
                  display: "inline-block",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  minWidth: "260px",
                  minHeight: "260px",
                }}
              >
                {waStatus.qr ? (
                  <img
                    src={waStatus.qr}
                    alt="Código QR de WhatsApp"
                    style={{ width: "260px", height: "260px", display: "block", objectFit: "contain" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "260px",
                      height: "260px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#1c1917",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      padding: "20px",
                    }}
                  >
                    Generando código QR en vivo...
                  </div>
                )}
              </div>

              <div
                style={{
                  textAlign: "left",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "14px",
                  padding: "16px 22px",
                  margin: "22px 0",
                  fontSize: "0.88rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                <ol style={{ margin: 0, paddingLeft: "18px" }}>
                  <li>
                    Abre <strong>WhatsApp</strong> o <strong>WhatsApp Business</strong> en tu teléfono.
                  </li>
                  <li>
                    Ve a <strong>Menú (⋮) / Configuración</strong> ➔{" "}
                    <strong>Dispositivos vinculados</strong>.
                  </li>
                  <li>
                    Toca <strong>Vincular un dispositivo</strong> y escanea este código QR.
                  </li>
                </ol>
              </div>

              <button
                onClick={handleResetWhatsAppQr}
                disabled={isResettingQr}
                className="btn-premium"
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  color: "#fbbf24",
                  cursor: "pointer",
                }}
              >
                {isResettingQr ? "Generando nuevo QR..." : "🔄 Generar Nuevo Código QR"}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
