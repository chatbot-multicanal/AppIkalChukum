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
  pairingCode?: string | null;
  lastConnected: string | null;
  serviceLogs: string[];
  updatedAt: string | null;
}

export default function SofiaMonitorPage() {
  const [activeSubTab, setActiveSubTab] = useState<"chat" | "qr" | "logs">("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [waStatus, setWaStatus] = useState<WaStatus>({
    connected: false,
    qr: null,
    pairingCode: null,
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

  // Estado para vinculación móvil (Código de 8 dígitos + QR)
  const [pairPhoneInput, setPairPhoneInput] = useState("");
  const [isRequestingPairCode, setIsRequestingPairCode] = useState(false);
  const [pairCopied, setPairCopied] = useState(false);
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
          if (data.waStatus.pairingCode) {
            setIsRequestingPairCode(false);
          }
        }

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
    }, 2500);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedContactKey, loading]);

  const activeConversation =
    conversations.find((c) => c.contactKey === selectedContactKey) || null;

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

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pairPhoneInput.replace(/\D/g, "");
    if (clean.length < 10) {
      alert(
        "Por favor escribe el número de WhatsApp con clave de país (ej. 529991234567 para México o 13051234567 para EE. UU.)."
      );
      return;
    }

    setIsRequestingPairCode(true);
    try {
      const res = await fetch("/api/chat/sofia/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_PAIRING_CODE",
          phone: clean,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "No se pudo solicitar el código");
        setIsRequestingPairCode(false);
      } else {
        setTimeout(fetchMonitorData, 2000);
      }
    } catch {
      setIsRequestingPairCode(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!waStatus.pairingCode) return;
    navigator.clipboard.writeText(waStatus.pairingCode.replace("-", ""));
    setPairCopied(true);
    setTimeout(() => setPairCopied(false), 2500);
  };

  const handleResetWhatsAppQr = async () => {
    if (!confirm("¿Deseas reiniciar la sesión de WhatsApp y generar un nuevo código QR?"))
      return;
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
      }, 2500);
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
    <main className="main-content animate-fade-in" style={{ paddingBottom: "36px" }}>
      {/* Page Header (Responsive for Mobile & Desktop) */}
      <div className="page-header" style={{ marginBottom: "18px" }}>
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                fontSize: "1.85rem",
                fontWeight: 800,
                color: "var(--text-main)",
                letterSpacing: "-0.5px",
                margin: 0,
              }}
            >
              Sofía IA • Chat & WhatsApp
            </h1>

            <button
              onClick={() => setActiveSubTab("qr")}
              style={{
                cursor: "pointer",
                padding: "7px 14px",
                borderRadius: "20px",
                fontSize: "0.78rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                background: waStatus.connected
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(245, 158, 11, 0.18)",
                color: waStatus.connected ? "#34d399" : "#fbbf24",
                border: waStatus.connected
                  ? "1px solid rgba(16, 185, 129, 0.45)"
                  : "1px solid rgba(245, 158, 11, 0.45)",
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
                ? "WhatsApp Conectado 24/7"
                : "📲 Toca para Vincular WhatsApp"}
            </button>
          </div>

          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
              fontWeight: 500,
              marginTop: "6px",
              marginBottom: 0,
            }}
          >
            Chat en vivo, consola de logs y vinculación directa de WhatsApp Business (por código móvil o QR).
          </p>
        </div>
      </div>

      {/* Prominent Quick Action Banner if WhatsApp is not linked yet */}
      {!waStatus.connected && activeSubTab !== "qr" && (
        <div
          onClick={() => setActiveSubTab("qr")}
          style={{
            cursor: "pointer",
            marginBottom: "18px",
            padding: "14px 18px",
            borderRadius: "14px",
            background:
              "linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(29, 128, 136, 0.15) 100%)",
            border: "1px solid rgba(245, 158, 11, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.4rem" }}>📱</span>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: "0.9rem" }}>
                ¿Estás en tu celular y quieres vincular WhatsApp Business?
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                Vincula con un código de 8 dígitos desde tu mismo teléfono o escanea el código QR.
              </div>
            </div>
          </div>
          <span
            style={{
              background: "#f59e0b",
              color: "#0c0a09",
              fontWeight: 800,
              fontSize: "0.78rem",
              padding: "8px 14px",
              borderRadius: "10px",
              whiteSpace: "nowrap",
            }}
          >
            Vincular Ahora ➔
          </span>
        </div>
      )}

      {/* 3-Tab Segmented Navigation (100% Mobile-Friendly Grid) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          marginBottom: "18px",
          background: "rgba(0,0,0,0.28)",
          padding: "6px",
          borderRadius: "14px",
          border: "1px solid var(--border-color)",
        }}
      >
        <button
          onClick={() => setActiveSubTab("chat")}
          style={{
            padding: "11px 8px",
            borderRadius: "10px",
            fontWeight: 800,
            fontSize: "0.82rem",
            cursor: "pointer",
            border:
              activeSubTab === "chat"
                ? "1px solid rgba(45, 212, 191, 0.5)"
                : "1px solid transparent",
            background:
              activeSubTab === "chat"
                ? "linear-gradient(135deg, rgba(29, 128, 136, 0.4) 0%, rgba(29, 128, 136, 0.15) 100%)"
                : "transparent",
            color: activeSubTab === "chat" ? "#ffffff" : "var(--text-secondary)",
            textAlign: "center",
            transition: "all 0.2s ease",
          }}
        >
          💬 Chat ({conversations.length})
        </button>

        <button
          onClick={() => setActiveSubTab("qr")}
          style={{
            padding: "11px 8px",
            borderRadius: "10px",
            fontWeight: 800,
            fontSize: "0.82rem",
            cursor: "pointer",
            border:
              activeSubTab === "qr"
                ? "1px solid rgba(16, 185, 129, 0.55)"
                : "1px solid transparent",
            background:
              activeSubTab === "qr"
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0.12) 100%)"
                : "transparent",
            color: activeSubTab === "qr" ? "#ffffff" : "var(--text-secondary)",
            textAlign: "center",
            transition: "all 0.2s ease",
          }}
        >
          📱 Vincular WA
        </button>

        <button
          onClick={() => setActiveSubTab("logs")}
          style={{
            padding: "11px 8px",
            borderRadius: "10px",
            fontWeight: 800,
            fontSize: "0.82rem",
            cursor: "pointer",
            border:
              activeSubTab === "logs"
                ? "1px solid rgba(213, 195, 165, 0.55)"
                : "1px solid transparent",
            background:
              activeSubTab === "logs"
                ? "linear-gradient(135deg, rgba(213, 195, 165, 0.3) 0%, rgba(213, 195, 165, 0.08) 100%)"
                : "transparent",
            color: activeSubTab === "logs" ? "#ffffff" : "var(--text-secondary)",
            textAlign: "center",
            transition: "all 0.2s ease",
          }}
        >
          🖥️ Logs ({logs.length})
        </button>
      </div>

      {/* =====================================================================
          TAB 1: CHAT EN VIVO (MOBILE + DESKTOP OPTIMIZED)
         ===================================================================== */}
      {activeSubTab === "chat" && (
        <div>
          {/* Mobile Horizontal Contact Selector Bar (Visible on Mobile <= 768px) */}
          <div
            className="sofia-mobile-contacts"
            style={{
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "12px",
              marginBottom: "10px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <button
              onClick={() => setSelectedContactKey("SIMULADOR")}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: "20px",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                background:
                  selectedContactKey === "SIMULADOR"
                    ? "linear-gradient(135deg, #1D8088, #2DD4BF)"
                    : "rgba(255,255,255,0.06)",
                color: selectedContactKey === "SIMULADOR" ? "#081214" : "#fff",
                border: "none",
              }}
            >
              ✨ Simulador IA
            </button>

            {conversations.map((conv) => {
              const isSelected = selectedContactKey === conv.contactKey;
              return (
                <button
                  key={conv.contactKey}
                  onClick={() => setSelectedContactKey(conv.contactKey)}
                  style={{
                    flexShrink: 0,
                    padding: "8px 14px",
                    borderRadius: "20px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: isSelected
                      ? "rgba(45, 212, 191, 0.22)"
                      : "rgba(255,255,255,0.05)",
                    color: isSelected ? "#5eead4" : "var(--text-secondary)",
                    border: isSelected
                      ? "1px solid rgba(45, 212, 191, 0.55)"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {conv.clientName || `📱 ${conv.phone}`}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "330px 1fr",
              gap: "20px",
              alignItems: "stretch",
            }}
            className="grid-responsive"
          >
            {/* Left Column: Conversations List (Hidden on small mobile in favor of horizontal bar) */}
            <div
              className="glass-card sofia-desktop-contacts"
              style={{
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                maxHeight: "680px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                  Conversaciones
                </h2>
                <button
                  onClick={() => setSelectedContactKey("SIMULADOR")}
                  style={{
                    background: "rgba(29, 128, 136, 0.2)",
                    border: "1px solid rgba(29, 128, 136, 0.45)",
                    color: "#5eead4",
                    borderRadius: "8px",
                    padding: "5px 10px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✨ + Simular Chat
                </button>
              </div>

              <input
                type="text"
                placeholder="🔍 Buscar cliente o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "10px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid var(--border-color)",
                  color: "#fff",
                  fontSize: "0.83rem",
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
                }}
              >
                {loading ? (
                  <div
                    style={{
                      color: "var(--text-secondary)",
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    Cargando conversaciones...
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div
                    style={{
                      color: "var(--text-muted)",
                      padding: "24px 12px",
                      textAlign: "center",
                      fontSize: "0.82rem",
                    }}
                  >
                    Sin conversaciones aún. Usa el simulador o envía un WhatsApp.
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = selectedContactKey === conv.contactKey;
                    return (
                      <div
                        key={conv.contactKey}
                        onClick={() => setSelectedContactKey(conv.contactKey)}
                        style={{
                          padding: "11px 13px",
                          borderRadius: "12px",
                          cursor: "pointer",
                          background: isSelected
                            ? "linear-gradient(135deg, rgba(29, 128, 136, 0.25) 0%, rgba(29, 128, 136, 0.08) 100%)"
                            : "rgba(255,255,255,0.02)",
                          border: isSelected
                            ? "1px solid rgba(29, 128, 136, 0.5)"
                            : "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "3px",
                          }}
                        >
                          <span
                            style={{ fontWeight: 700, color: "#fff", fontSize: "0.88rem" }}
                          >
                            {conv.clientName || `📱 ${conv.phone}`}
                          </span>
                          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                            {new Date(conv.lastAt).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.78rem",
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
                height: "650px",
                maxHeight: "75vh",
              }}
            >
              {/* Chat Header */}
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border-color)",
                  background: "rgba(0,0,0,0.3)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #1D8088, #5F8C74)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      flexShrink: 0,
                    }}
                  >
                    {activeConversation ? "💬" : "✨"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>
                      {activeConversation
                        ? activeConversation.clientName ||
                          `Cliente (${activeConversation.phone})`
                        : "Simulador en Vivo • Sofía IA"}
                    </div>
                    <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>
                      {activeConversation
                        ? `Tel: ${activeConversation.phone} • ${activeConversation.messages.length} msj(s)`
                        : "Prueba respuestas de Sofía en tiempo real"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Container */}
              <div
                style={{
                  flex: 1,
                  padding: "16px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  background: "rgba(8, 12, 13, 0.5)",
                }}
              >
                {!activeConversation || activeConversation.messages.length === 0 ? (
                  <div
                    style={{
                      margin: "auto",
                      textAlign: "center",
                      maxWidth: "400px",
                      padding: "24px 18px",
                      borderRadius: "16px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🏛️</div>
                    <h3 style={{ color: "#fff", margin: "0 0 6px 0", fontSize: "1rem" }}>
                      Asesora Sofía • IKAL CHUKUM
                    </h3>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.82rem",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      Escribe un mensaje abajo para probar a Sofía (ej.{" "}
                      <em>&quot;Quiero saber los colores del Chukum&quot;</em>).
                    </p>
                  </div>
                ) : (
                  activeConversation.messages.map((msg) => {
                    const isUser = msg.role === "user";
                    const paletteImgSrc = !isUser
                      ? getPaletteImageForMessage(msg.content)
                      : null;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isUser ? "flex-start" : "flex-end",
                          maxWidth: "86%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isUser ? "flex-start" : "flex-end",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--text-muted)",
                            marginBottom: "3px",
                            padding: "0 4px",
                          }}
                        >
                          {isUser ? "👤 Cliente" : "🏛️ Sofía IA"} •{" "}
                          {new Date(msg.createdAt).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                        <div
                          style={{
                            padding: "12px 15px",
                            borderRadius: isUser
                              ? "15px 15px 15px 4px"
                              : "15px 15px 4px 15px",
                            background: isUser
                              ? "rgba(255, 255, 255, 0.08)"
                              : "linear-gradient(135deg, rgba(29, 128, 136, 0.38) 0%, rgba(20, 88, 94, 0.5) 100%)",
                            border: isUser
                              ? "1px solid rgba(255, 255, 255, 0.12)"
                              : "1px solid rgba(45, 212, 191, 0.45)",
                            color: "#f5f5f4",
                            fontSize: "0.86rem",
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {msg.content.replace(/\*\*([^*]+)\*\*/g, "*$1*")}

                          {paletteImgSrc && (
                            <div style={{ marginTop: "10px" }}>
                              <img
                                src={paletteImgSrc}
                                alt="Paleta Oficial IKAL CHUKUM"
                                style={{
                                  maxWidth: "230px",
                                  width: "100%",
                                  borderRadius: "10px",
                                  border: "1px solid rgba(255,255,255,0.2)",
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

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSendMessageToSofia}
                style={{
                  padding: "12px 14px",
                  borderTop: "1px solid var(--border-color)",
                  background: "rgba(0,0,0,0.35)",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  placeholder="Escribe un mensaje a Sofía..."
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  disabled={isSending}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "11px 14px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={isSending || !testInput.trim()}
                  className="btn-premium btn-primary-teal"
                  style={{
                    padding: "11px 16px",
                    borderRadius: "10px",
                    fontWeight: 800,
                    fontSize: "0.84rem",
                    whiteSpace: "nowrap",
                    cursor: isSending ? "wait" : "pointer",
                    opacity: isSending || !testInput.trim() ? 0.6 : 1,
                  }}
                >
                  {isSending ? "..." : "Enviar ➔"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: VINCULAR WHATSAPP BUSINESS (OPTIMIZADO PARA CELULAR + QR)
         ===================================================================== */}
      {activeSubTab === "qr" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: waStatus.connected ? "1fr" : "1fr 1fr",
            gap: "20px",
            maxWidth: waStatus.connected ? "540px" : "980px",
            margin: "0 auto",
          }}
          className="grid-responsive"
        >
          {waStatus.connected ? (
            <div
              className="glass-card"
              style={{ padding: "32px 22px", textAlign: "center" }}
            >
              <div style={{ fontSize: "3.2rem", marginBottom: "10px" }}>✅</div>
              <h2
                style={{
                  color: "#34d399",
                  fontSize: "1.45rem",
                  fontWeight: 800,
                  margin: "0 0 8px 0",
                }}
              >
                WhatsApp Business Conectado 24/7
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  lineHeight: 1.55,
                }}
              >
                La asesora <strong>Sofía (IKAL CHUKUM)</strong> está vinculada directamente a tu
                WhatsApp Business sin ManyChat, respondiendo mensajes y enviando las paletas de
                colores de EE. UU. y México automáticamente.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                  marginTop: "20px",
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
                  }}
                >
                  {isResettingQr ? "Desvinculando..." : "🔄 Desvincular / Cambiar Número"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* CARD A: VINCULAR DESDE EL MISMO CELULAR CON CÓDIGO DE 8 DÍGITOS */}
              <div
                className="glass-card"
                style={{
                  padding: "24px 20px",
                  border: "1px solid rgba(45, 212, 191, 0.45)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      background: "rgba(45, 212, 191, 0.15)",
                      color: "#5eead4",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      marginBottom: "10px",
                    }}
                  >
                    ⭐ RECOMENDADO SI ESTÁS EN TU CELULAR
                  </div>
                  <h2
                    style={{
                      color: "#fff",
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      margin: "0 0 8px 0",
                    }}
                  >
                    📲 Vincular con Código de 8 Dígitos
                  </h2>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                      lineHeight: 1.5,
                      marginBottom: "16px",
                    }}
                  >
                    Si abriste esta página desde el mismo celular donde tienes{" "}
                    <strong>WhatsApp Business</strong>, no necesitas otra pantalla para escanear
                    QR. Ingresa el teléfono y copia el código:
                  </p>

                  <form
                    onSubmit={handleRequestPairingCode}
                    style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                  >
                    <input
                      type="tel"
                      placeholder="Ej. 529991234567 (con clave de país)"
                      value={pairPhoneInput}
                      onChange={(e) => setPairPhoneInput(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: "rgba(0,0,0,0.35)",
                        border: "1px solid var(--border-color)",
                        color: "#fff",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isRequestingPairCode}
                      className="btn-premium btn-primary-teal"
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "12px",
                        fontWeight: 800,
                        fontSize: "0.9rem",
                        justifyContent: "center",
                      }}
                    >
                      {isRequestingPairCode
                        ? "Generando código..."
                        : "🔑 Obtener Código de 8 Dígitos"}
                    </button>
                  </form>

                  {waStatus.pairingCode && (
                    <div
                      style={{
                        marginTop: "18px",
                        padding: "16px",
                        borderRadius: "14px",
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.45)",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#34d399",
                          fontWeight: 700,
                          marginBottom: "6px",
                        }}
                      >
                        TU CÓDIGO DE VINCULACIÓN DE WHATSAPP:
                      </div>
                      <div
                        style={{
                          fontSize: "1.9rem",
                          fontWeight: 900,
                          letterSpacing: "4px",
                          color: "#ffffff",
                          fontFamily: "monospace",
                          marginBottom: "10px",
                        }}
                      >
                        {waStatus.pairingCode}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPairingCode}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "10px",
                          background: "#10b981",
                          color: "#062319",
                          fontWeight: 800,
                          fontSize: "0.82rem",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {pairCopied ? "✓ ¡Código Copiado!" : "📋 Copiar Código"}
                      </button>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "18px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ color: "#fff", display: "block", marginBottom: "4px" }}>
                    Pasos en tu celular:
                  </strong>
                  1. Abre <strong>WhatsApp Business</strong> ➔ <strong>Dispositivos vinculados</strong>.
                  <br />
                  2. Toca <strong>Vincular un dispositivo</strong>.
                  <br />
                  3. Abajo toca{" "}
                  <strong>&quot;Vincular con el número de teléfono en su lugar&quot;</strong> y pega el
                  código de 8 dígitos.
                </div>
              </div>

              {/* CARD B: ESCANEAR CÓDIGO QR */}
              <div
                className="glass-card"
                style={{
                  padding: "24px 20px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ width: "100%" }}>
                  <h2
                    style={{
                      color: "#fff",
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      margin: "0 0 6px 0",
                    }}
                  >
                    📷 Escanear Código QR
                  </h2>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.84rem",
                      marginBottom: "16px",
                    }}
                  >
                    Si tienes esta pantalla abierta en tu computadora o tablet, apunta la cámara de
                    WhatsApp Business aquí:
                  </p>

                  <div
                    style={{
                      background: "#ffffff",
                      padding: "14px",
                      borderRadius: "18px",
                      display: "inline-block",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    }}
                  >
                    {waStatus.qr ? (
                      <img
                        src={waStatus.qr}
                        alt="Código QR de WhatsApp"
                        style={{
                          width: "220px",
                          height: "220px",
                          maxWidth: "70vw",
                          maxHeight: "70vw",
                          display: "block",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "220px",
                          height: "220px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#1c1917",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          padding: "16px",
                        }}
                      >
                        Generando código QR en vivo...
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ width: "100%", marginTop: "18px" }}>
                  <button
                    onClick={handleResetWhatsAppQr}
                    disabled={isResettingQr}
                    className="btn-premium"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      padding: "11px",
                      background: "rgba(245, 158, 11, 0.15)",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      color: "#fbbf24",
                      borderRadius: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {isResettingQr ? "Actualizando QR..." : "🔄 Generar Nuevo Código QR"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: MONITOR DE LOGS (MOBILE CARDS + CONSOLE)
         ===================================================================== */}
      {activeSubTab === "logs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Live Service Terminal */}
          <div className="glass-card" style={{ padding: "18px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                🖥️ Consola en Vivo • Socket WhatsApp
              </h2>
              <button
                onClick={fetchMonitorData}
                style={{
                  background: "rgba(29, 128, 136, 0.2)",
                  border: "1px solid rgba(29, 128, 136, 0.4)",
                  color: "#5eead4",
                  borderRadius: "8px",
                  padding: "5px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🔄 Refrescar
              </button>
            </div>

            <div
              style={{
                background: "#07090A",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                padding: "12px",
                fontFamily: "monospace",
                fontSize: "0.78rem",
                lineHeight: 1.6,
                maxHeight: "240px",
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
                      wordBreak: "break-word",
                      color: line.includes("❌")
                        ? "#f87171"
                        : line.includes("📤") || line.includes("🔑")
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
                  Mostrando bitácora de auditoría abajo...
                </div>
              )}
            </div>
          </div>

          {/* Mobile-Friendly Cards for Audit Logs */}
          <div className="glass-card" style={{ padding: "18px" }}>
            <h2
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#fff",
                margin: "0 0 14px 0",
              }}
            >
              📋 Bitácora de Mensajes y Respuestas ({logs.length})
            </h2>

            {logs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>
                No hay registros de logs todavía.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  maxHeight: "520px",
                  overflowY: "auto",
                }}
              >
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--primary-sage)",
                          fontSize: "0.82rem",
                        }}
                      >
                        📱 {log.phone}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            padding: "2px 7px",
                            borderRadius: "6px",
                            fontSize: "0.68rem",
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
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {new Date(log.createdAt).toLocaleString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {log.userMessage && (
                      <div style={{ fontSize: "0.83rem", color: "#fff" }}>
                        <strong style={{ color: "#38bdf8" }}>Cliente:</strong> {log.userMessage}
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      <strong style={{ color: "#34d399" }}>Sofía:</strong>{" "}
                      {log.botReply || log.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
