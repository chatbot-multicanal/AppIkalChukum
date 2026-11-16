import makeWASocket, {
  initAuthCreds,
  BufferJSON,
  proto,
  DisconnectReason,
  fetchLatestBaileysVersion,
  AuthenticationCreds,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys";
// @ts-ignore - qrcode does not ship built-in types
import QRCode from "qrcode";
import pino from "pino";
import { db } from "@/lib/db";

interface CloudWaState {
  sock: ReturnType<typeof makeWASocket> | null;
  activeSocketId: number;
  isConnected: boolean;
  isStarting: boolean;
  latestQr: string | null;
  latestPairingCode: string | null;
  lastConnectedAt: string | null;
  logBuffer: string[];
  processedMsgIds: Set<string>;
  sessionHistories: Map<string, Array<{ role: "user" | "assistant"; content: string }>>;
  qrWaiters: Array<(qr: string | null) => void>;
}

const globalForWa = globalThis as unknown as {
  __sofiaWaCloudState?: CloudWaState;
};

function getCloudState(): CloudWaState {
  if (!globalForWa.__sofiaWaCloudState) {
    globalForWa.__sofiaWaCloudState = {
      sock: null,
      activeSocketId: 0,
      isConnected: false,
      isStarting: false,
      latestQr: null,
      latestPairingCode: null,
      lastConnectedAt: null,
      logBuffer: [],
      processedMsgIds: new Set<string>(),
      sessionHistories: new Map(),
      qrWaiters: [],
    };
  }
  return globalForWa.__sofiaWaCloudState;
}

function addCloudLog(msg: string) {
  const st = getCloudState();
  const line = `[${new Date().toLocaleTimeString()}] ☁️ ${msg}`;
  st.logBuffer.push(line);
  if (st.logBuffer.length > 120) st.logBuffer.shift();
  console.log(`[WA-Cloud] ${msg}`);
}

function notifyQrWaiters(qr: string | null) {
  const st = getCloudState();
  while (st.qrWaiters.length > 0) {
    const waiter = st.qrWaiters.shift();
    if (waiter) {
      try {
        waiter(qr);
      } catch {}
    }
  }
}

async function persistStatusToDb() {
  const st = getCloudState();
  try {
    const existing = await db.systemSetting.findUnique({
      where: { key: "WA_BOT_STATUS" },
    });
    let current: any = {};
    if (existing?.value) {
      try {
        current = JSON.parse(existing.value);
      } catch {}
    }

    const payload = {
      connected: st.isConnected,
      qr: st.isConnected ? null : st.latestQr || current.qr || null,
      pairingCode: st.isConnected ? null : st.latestPairingCode || current.pairingCode || null,
      lastConnected: st.lastConnectedAt || current.lastConnected || null,
      serviceLogs: st.logBuffer.length > 0 ? st.logBuffer.slice(-80) : current.serviceLogs || [],
      updatedAt: new Date().toISOString(),
      pendingReset: false,
      pendingPairPhone: null,
      mode: "cloud",
    };

    await db.systemSetting.upsert({
      where: { key: "WA_BOT_STATUS" },
      update: { value: JSON.stringify(payload) },
      create: { key: "WA_BOT_STATUS", value: JSON.stringify(payload) },
    });

    return payload;
  } catch (err: any) {
    console.error("[WA-Cloud] Error guardando estado en DB:", err?.message);
    return {
      connected: st.isConnected,
      qr: st.latestQr,
      pairingCode: st.latestPairingCode,
      lastConnected: st.lastConnectedAt,
      serviceLogs: st.logBuffer.slice(-80),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Stores Baileys credentials & signal keys directly in PostgreSQL (`SystemSetting`)
 * so serverless / cloud deployments persist sessions across restarts without needing local disk.
 */
async function useDatabaseAuthState() {
  let creds: AuthenticationCreds;
  let keysStore: Record<string, any> = {};

  try {
    const [credsRow, keysRow] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: "WA_CLOUD_CREDS" } }),
      db.systemSetting.findUnique({ where: { key: "WA_CLOUD_KEYS" } }),
    ]);

    if (credsRow?.value) {
      creds = JSON.parse(credsRow.value, BufferJSON.reviver);
    } else {
      creds = initAuthCreds();
    }

    if (keysRow?.value) {
      keysStore = JSON.parse(keysRow.value, BufferJSON.reviver);
    }
  } catch {
    creds = initAuthCreds();
    keysStore = {};
  }

  let saveKeysTimeout: NodeJS.Timeout | null = null;
  const flushKeysToDb = async () => {
    try {
      const serialized = JSON.stringify(keysStore, BufferJSON.replacer);
      await db.systemSetting.upsert({
        where: { key: "WA_CLOUD_KEYS" },
        update: { value: serialized },
        create: { key: "WA_CLOUD_KEYS", value: serialized },
      });
    } catch {}
  };

  const saveCreds = async () => {
    try {
      const serialized = JSON.stringify(creds, BufferJSON.replacer);
      await db.systemSetting.upsert({
        where: { key: "WA_CLOUD_CREDS" },
        update: { value: serialized },
        create: { key: "WA_CLOUD_CREDS", value: serialized },
      });
    } catch {}
  };

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            const fileKey = fixKeyFileName(`${type}-${id}.json`);
            let value = keysStore[fileKey] ?? keysStore[`${type}-${id}`];
            if (typeof value === "string") {
              try {
                value = JSON.parse(value, BufferJSON.reviver);
              } catch {}
            }
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            if (value) {
              data[id] = value;
            }
          }
          return data;
        },
        set: async (data: any) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const fileKey = fixKeyFileName(`${category}-${id}.json`);
              if (value) {
                keysStore[fileKey] = value;
              } else {
                delete keysStore[fileKey];
                delete keysStore[`${category}-${id}`];
              }
            }
          }
          if (saveKeysTimeout) clearTimeout(saveKeysTimeout);
          saveKeysTimeout = setTimeout(() => {
            flushKeysToDb();
          }, 400);
        },
      },
    },
    saveCreds,
  };
}

const fixKeyFileName = (file: string) => file?.replace(/\//g, "__")?.replace(/:/g, "-");

export async function clearDatabaseAuthState() {
  try {
    await db.systemSetting.deleteMany({
      where: {
        key: { in: ["WA_CLOUD_CREDS", "WA_CLOUD_KEYS"] },
      },
    });
  } catch {}
}

function formatForWhatsApp(text: string) {
  if (!text) return "";
  return text
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, "*$1*: $2")
    .trim();
}

async function querySofiaCloudEndpoint(
  cleanText: string,
  phone: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.ikalchukum.com";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/chat/sofia`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: cleanText,
        phone,
        contact_id: phone,
        conversationHistory: history.slice(-10),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.reply) {
        return {
          reply: formatForWhatsApp(data.reply),
          mediaUrl: data.mediaUrl || "",
          alertaAdmin: data.sofia_alerta_admin || "",
        };
      }
    }
  } catch (err: any) {
    addCloudLog(`⚠️ Error consultando endpoint Sofía: ${err?.message}`);
  }

  return {
    reply:
      "✨ ¡Hola! Qué gusto saludarte. Soy Sofía, asesora de *IKAL CHUKUM*. 🏛️ ¿En qué te puedo ayudar hoy?",
    mediaUrl: "",
    alertaAdmin: "",
  };
}

function cleanupCloudSocket() {
  const st = getCloudState();
  if (st.sock) {
    try {
      st.sock.ev.removeAllListeners("connection.update");
      st.sock.ev.removeAllListeners("creds.update");
      st.sock.ev.removeAllListeners("messages.upsert");
      st.sock.end(undefined);
    } catch {}
    st.sock = null;
  }
}

async function startCloudSocket(): Promise<void> {
  const st = getCloudState();
  if (st.isStarting) return;
  st.isStarting = true;

  try {
    cleanupCloudSocket();
    const mySocketId = ++st.activeSocketId;
    addCloudLog(`Iniciando motor WhatsApp en la nube (Socket #${mySocketId})...`);

    const { state, saveCreds } = await useDatabaseAuthState();
    const { version } = await fetchLatestBaileysVersion();

    if (mySocketId !== st.activeSocketId) {
      st.isStarting = false;
      return;
    }

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }) as any,
      printQRInTerminal: false,
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
    });

    st.sock = sock;
    st.isStarting = false;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      if (mySocketId !== st.activeSocketId) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
          st.latestQr = qrDataUrl;
          st.isConnected = false;
          addCloudLog("📲 Nuevo código QR generado desde el servidor en la nube.");
          await persistStatusToDb();
          notifyQrWaiters(qrDataUrl);
        } catch (err: any) {
          addCloudLog(`❌ Error convirtiendo QR: ${err?.message}`);
          notifyQrWaiters(null);
        }
      }

      if (connection === "open") {
        st.isConnected = true;
        st.latestQr = null;
        st.latestPairingCode = null;
        st.lastConnectedAt = new Date().toISOString();
        addCloudLog("🎉 ¡WHATSAPP CONECTADO EN LA NUBE! Sofía IA activa 24/7.");
        await persistStatusToDb();
        notifyQrWaiters(null);
        processCloudOutboundQueue().catch(() => {});
      } else if (connection === "close") {
        st.isConnected = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        addCloudLog(`⚠️ Conexión cerrada (Código ${statusCode || "desconocido"}).`);

        if (loggedOut) {
          addCloudLog("Sesión desvinculada desde el teléfono. Limpiando credenciales para generar nuevo QR...");
          await clearDatabaseAuthState();
          st.latestQr = null;
          st.latestPairingCode = null;
        }
        await persistStatusToDb();
        notifyQrWaiters(null);

        // Reconnect automatically after brief pause
        setTimeout(() => {
          if (mySocketId === st.activeSocketId) {
            startCloudSocket().catch(() => {});
          }
        }, loggedOut ? 1200 : 2500);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      if (mySocketId !== st.activeSocketId) return;
      try {
        for (const msg of messages) {
          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) {
            continue;
          }

          const msgId = msg.key.id;
          if (msgId && st.processedMsgIds.has(msgId)) continue;

          const textMessage =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.ephemeralMessage?.message?.conversation ||
            msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
            "";

          const cleanText = (textMessage || "").trim();
          if (!cleanText) continue;

          if (
            cleanText.startsWith("✨ ¡Hola! Qué gusto saludarte. Soy Sofía") ||
            cleanText.startsWith("✨ Hello! Nice to meet you. I am Sofia") ||
            cleanText.startsWith("🎨 *Nuestra Paleta de Colores IKAL CHUKUM*") ||
            cleanText.startsWith("🏛️ *SOFÍA • IKAL CHUKUM*")
          ) {
            continue;
          }

          const myJid = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : "";
          const isSelfChat =
            remoteJid === myJid || (myJid && remoteJid.includes(myJid.replace("@s.whatsapp.net", "")));

          if (msg.key.fromMe && !isSelfChat) {
            continue;
          }

          if (msgId) {
            st.processedMsgIds.add(msgId);
            if (st.processedMsgIds.size > 300) {
              const first = st.processedMsgIds.values().next().value;
              if (first) st.processedMsgIds.delete(first);
            }
          }

          const phoneClean = remoteJid.replace(/@.*$/, "").split(":")[0];
          addCloudLog(`📩 Mensaje de [${phoneClean}]: "${cleanText}"`);

          if (!st.sessionHistories.has(remoteJid)) {
            st.sessionHistories.set(remoteJid, []);
          }
          const history = st.sessionHistories.get(remoteJid)!;

          try {
            await sock.sendPresenceUpdate("composing", remoteJid);
          } catch {}

          const { reply, mediaUrl, alertaAdmin } = await querySofiaCloudEndpoint(
            cleanText,
            phoneClean,
            history
          );

          if (alertaAdmin) {
            addCloudLog(`🔔 ALERTA ERP: ${alertaAdmin}`);
          }

          await sock.sendMessage(remoteJid, { text: reply });
          addCloudLog(`📤 Respuesta enviada a [${phoneClean}]`);

          history.push({ role: "user", content: cleanText });
          history.push({ role: "assistant", content: reply });
          if (history.length > 10) {
            st.sessionHistories.set(remoteJid, history.slice(-10));
          }

          if (mediaUrl) {
            try {
              const isUsa = mediaUrl.includes("paleta_colores_usa");
              const captionText = isUsa
                ? "🎨 Official Color Palette (USA) • IKAL CHUKUM"
                : "🎨 Paleta Oficial de Colores • IKAL CHUKUM";
              await sock.sendMessage(remoteJid, {
                image: { url: mediaUrl },
                caption: captionText,
              });
              addCloudLog(`🖼️ Paleta (${isUsa ? "USA" : "México/Export"}) enviada a [${phoneClean}]`);
            } catch (imgErr: any) {
              addCloudLog(`⚠️ Error enviando imagen: ${imgErr?.message}`);
            }
          }

          await persistStatusToDb();
        }
      } catch (err: any) {
        addCloudLog(`❌ Error procesando mensaje: ${err?.message}`);
      }
    });
  } catch (err: any) {
    st.isStarting = false;
    addCloudLog(`❌ Error iniciando socket en la nube: ${err?.message}`);
    notifyQrWaiters(null);
  }
}

/**
 * Ensures the cloud WhatsApp engine is active and returns the latest status (waiting up to `waitMs` for a QR if none exists yet).
 */
export async function ensureCloudWhatsAppEngine(waitMs = 5500) {
  const st = getCloudState();

  // Check if an external dedicated worker updated WA_BOT_STATUS within the last 10 seconds and already has a valid QR or connection
  try {
    const existing = await db.systemSetting.findUnique({ where: { key: "WA_BOT_STATUS" } });
    if (existing?.value) {
      const parsed = JSON.parse(existing.value);
      const ageMs = parsed.updatedAt ? Date.now() - new Date(parsed.updatedAt).getTime() : 999999;
      if (
        ageMs < 10000 &&
        parsed.mode !== "cloud" &&
        (parsed.connected || parsed.qr) &&
        !parsed.pendingReset
      ) {
        return parsed;
      }
    }
  } catch {}

  if (!st.sock && !st.isStarting) {
    startCloudSocket().catch(() => {});
  }

  // If neither connected nor QR available yet, wait briefly for Baileys to emit the QR code
  if (!st.isConnected && !st.latestQr && waitMs > 0) {
    await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), waitMs);
      st.qrWaiters.push((qr) => {
        clearTimeout(timer);
        resolve(qr);
      });
    });
  }

  if (st.isConnected) {
    await processCloudOutboundQueue();
  }

  return await persistStatusToDb();
}

function resolveCloudTargetToJid(targetStr: string): string | null {
  const raw = String(targetStr || "").trim();
  if (!raw) return null;
  if (raw.endsWith("@g.us") || raw.endsWith("@s.whatsapp.net") || raw.endsWith("@lid")) {
    return raw;
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

/**
 * Drains WA_OUTBOUND_QUEUE from the cloud engine when no dedicated worker has drained it.
 */
export async function processCloudOutboundQueue() {
  const st = getCloudState();
  if (!st.sock || !st.isConnected) return;

  try {
    const row = await db.systemSetting.findUnique({
      where: { key: "WA_OUTBOUND_QUEUE" },
    });
    if (!row?.value) return;

    let queue: Array<{ id: string; target: string; text: string }> = [];
    try {
      queue = JSON.parse(row.value);
    } catch {}
    if (!Array.isArray(queue) || queue.length === 0) return;

    await db.systemSetting.update({
      where: { key: "WA_OUTBOUND_QUEUE" },
      data: { value: "[]" },
    });

    for (const item of queue) {
      try {
        const jid = resolveCloudTargetToJid(item.target);
        if (!jid) continue;
        const sent = await st.sock.sendMessage(jid, { text: item.text });
        if (sent?.key?.id) st.processedMsgIds.add(sent.key.id);
        addCloudLog(`📤 Aviso enviado en la nube a [${item.target}]`);
      } catch (err: any) {
        addCloudLog(`⚠️ Error enviando aviso en la nube a [${item.target}]: ${err?.message}`);
      }
    }
    await persistStatusToDb();
  } catch {}
}

/**
 * Resets the cloud WhatsApp session and waits for a fresh QR code directly from the server.
 */
export async function resetCloudWhatsAppSession() {
  const st = getCloudState();
  addCloudLog("🔄 Reiniciando sesión de WhatsApp en la nube y generando nuevo QR...");
  cleanupCloudSocket();
  st.isConnected = false;
  st.latestQr = null;
  st.latestPairingCode = null;

  await clearDatabaseAuthState();
  await persistStatusToDb();

  startCloudSocket().catch(() => {});

  // Wait up to 6 seconds for the new QR to be ready before returning
  await new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 6000);
    st.qrWaiters.push((qr) => {
      clearTimeout(timer);
      resolve(qr);
    });
  });

  return await persistStatusToDb();
}

/**
 * Generates an 8-digit WhatsApp pairing code directly from the cloud server for mobile-only linking.
 */
export async function requestCloudPairingCode(rawPhoneInput: string) {
  const st = getCloudState();
  let cleanDigits = String(rawPhoneInput || "").replace(/\D/g, "");
  if (cleanDigits.length === 10) {
    cleanDigits = "52" + cleanDigits;
  }

  if (!st.sock && !st.isStarting) {
    startCloudSocket().catch(() => {});
  }

  // Wait until socket is initialized and has emitted initial QR handshake (ready for pairing code)
  if (!st.latestQr && !st.isConnected) {
    await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 5500);
      st.qrWaiters.push((qr) => {
        clearTimeout(timer);
        resolve(qr);
      });
    });
  }

  if (!st.sock) {
    throw new Error("El motor de WhatsApp en la nube se está iniciando, intenta de nuevo en 3 segundos.");
  }

  addCloudLog(`📲 Solicitando código de 8 dígitos para +${cleanDigits} desde el servidor...`);
  const rawCode = await st.sock.requestPairingCode(cleanDigits);
  const formattedCode =
    rawCode && rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` : rawCode;

  st.latestPairingCode = formattedCode;
  addCloudLog(`🔑 Código móvil de 8 dígitos generado en la nube: ${formattedCode}`);
  const status = await persistStatusToDb();

  return {
    pairingCode: formattedCode,
    waStatus: status,
  };
}
