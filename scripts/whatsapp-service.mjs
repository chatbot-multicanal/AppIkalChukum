import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import http from "http";
import pino from "pino";
import pg from "pg";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const AUTH_DIR = path.join(ROOT_DIR, ".whatsapp_auth");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const PALETTE_IMG_PATH = path.join(PUBLIC_DIR, "paleta_colores.png");
const QR_PNG_PATH = path.join(PUBLIC_DIR, "whatsapp-qr.png");
const ARTIFACT_QR_PATH = "C:/Users/capys/.gemini/antigravity/brain/eac5fb3a-2d95-4aa7-b6bc-0c41e6d9bce2/whatsapp_qr.png";

// Load .env and .env.local if present
for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(ROOT_DIR, envFile);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const SOFIA_API_URL = process.env.SOFIA_API_URL || "https://app.ikalchukum.com/api/chat/sofia";
const dbPool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "") })
  : null;

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Auto-restore session from environment variable (persists session across Render cloud restarts)
const credsPath = path.join(AUTH_DIR, "creds.json");
if (process.env.WA_SESSION_DATA && !fs.existsSync(credsPath)) {
  try {
    const rawData = Buffer.from(process.env.WA_SESSION_DATA, "base64").toString("utf8");
    fs.writeFileSync(credsPath, rawData, "utf8");
    console.log("🔑 Sesión de WhatsApp restaurada automáticamente desde WA_SESSION_DATA.");
  } catch (err) {
    console.error("Error restaurando WA_SESSION_DATA:", err);
  }
}

// In-memory log buffer for remote debugging via /logs
const logBuffer = [];
function addLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBuffer.push(line);
  if (logBuffer.length > 150) logBuffer.shift();
  console.log(msg);
}

// Conversation memory per JID (stores { role: "user" | "assistant", content: string })
const sessionHistories = new Map();
const processedMsgIds = new Set();
let isWhatsAppConnected = false;
let lastConnectedAt = null;
let currentSock = null;
let activeSocketId = 0;
let reconnectTimer = null;
let isShuttingDown = false;
let latestQrDataUrl = "";

/**
 * Syncs WhatsApp bot status, QR code, and live logs to Supabase SystemSetting ("WA_BOT_STATUS")
 * so the ERP dashboard (/sofia) can display them in real time from anywhere.
 */
async function syncStatusToDatabase() {
  if (!dbPool || isShuttingDown) return;
  try {
    const existingRes = await dbPool.query(
      'SELECT "value" FROM "SystemSetting" WHERE "key" = $1',
      ["WA_BOT_STATUS"]
    );
    let current = {};
    if (existingRes.rows.length > 0 && existingRes.rows[0].value) {
      try {
        current = JSON.parse(existingRes.rows[0].value);
      } catch {}
    }

    if (current.pendingReset) {
      addLog("🔄 Reinicio de QR solicitado desde el panel ERP (/sofia)...");
      cleanupCurrentSocket();
      if (fs.existsSync(AUTH_DIR)) {
        for (const file of fs.readdirSync(AUTH_DIR)) {
          try {
            fs.rmSync(path.join(AUTH_DIR, file), { recursive: true, force: true });
          } catch {}
        }
      }
      isWhatsAppConnected = false;
      latestQrDataUrl = "";
      scheduleReconnect(800);
    }

    const payload = JSON.stringify({
      connected: isWhatsAppConnected,
      qr: latestQrDataUrl || null,
      lastConnected: lastConnectedAt || current.lastConnected || null,
      serviceLogs: logBuffer.slice(-80),
      updatedAt: new Date().toISOString(),
      pendingReset: false,
    });

    await dbPool.query(
      'INSERT INTO "SystemSetting" ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"',
      ["WA_BOT_STATUS", payload]
    );
  } catch (err) {
    // Non-blocking DB sync
  }
}

setInterval(syncStatusToDatabase, 3000);

/**
 * Formats Markdown output from OpenAI into clean WhatsApp formatting
 */
function formatForWhatsApp(text) {
  if (!text) return "";
  return text
    // Convert **bold** to WhatsApp *bold*
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    // Convert markdown links [Label](https://...) -> *Label*: https://...
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, "*$1*: $2")
    .trim();
}

/**
 * Calls the Ikal Chukum Sofía ERP endpoint (with full DB, inventory, quotes & email tools)
 */
async function getSofiaReply(cleanText, phone, history = []) {
  try {
    const response = await fetch(SOFIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: cleanText,
        phone: phone,
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
    } else {
      const errText = await response.text().catch(() => "");
      addLog(`⚠️ Respuesta no-OK de API Sofía (${response.status}): ${errText.slice(0, 120)}`);
    }
  } catch (err) {
    addLog(`⚠️ Error conectando con API Sofía (${err.message}). Usando respuesta de respaldo...`);
  }

  // Fallback response if the cloud API is momentarily unreachable
  const isEn = /\b(hello|hi|how much|price|quote|colors|chukum|need|help)\b/i.test(cleanText);
  if (isEn) {
    return {
      reply:
        "✨ Hello! Nice to meet you. I am Sofía, advisor for *IKAL CHUKUM*. 🏛️ How can I help you today? If you like, I can show you our Chukum colors, help you calculate the materials needed for your project, or prepare a quote.",
      mediaUrl: "",
      alertaAdmin: "",
    };
  }
  return {
    reply:
      "✨ ¡Hola! Qué gusto saludarte. Soy Sofía, asesora de *IKAL CHUKUM*. 🏛️ ¿En qué te puedo ayudar hoy? Si gustas puedo mostrarte nuestros tonos de Chukum, ayudarte a calcular el material que necesitas para tu obra, o preparar una cotización.",
    mediaUrl: "",
    alertaAdmin: "",
  };
}

function cleanupCurrentSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (currentSock) {
    try {
      currentSock.ev.removeAllListeners("connection.update");
      currentSock.ev.removeAllListeners("creds.update");
      currentSock.ev.removeAllListeners("messages.upsert");
      currentSock.end(undefined);
    } catch {}
    currentSock = null;
  }
}

function scheduleReconnect(delayMs = 2500) {
  if (isShuttingDown) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startWhatsAppBot();
  }, delayMs);
}

async function startWhatsAppBot() {
  if (isShuttingDown) return;
  cleanupCurrentSocket();
  const mySocketId = ++activeSocketId;

  console.log("==========================================================");
  console.log(`🏛️ INICIANDO BOT DE WHATSAPP IKAL CHUKUM - SOFÍA (SOCKET #${mySocketId})`);
  console.log("==========================================================");

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  if (mySocketId !== activeSocketId || isShuttingDown) return;

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["Ikal Chukum ERP - Sofia IA", "Chrome", "1.0.0"],
    syncFullHistory: false,
  });

  currentSock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    if (mySocketId !== activeSocketId || isShuttingDown) return;
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      addLog("📲 Nuevo código QR recibido de WhatsApp. Actualizando vista...");
      qrcodeTerminal.generate(qr, { small: true });

      try {
        await QRCode.toFile(QR_PNG_PATH, qr, { width: 450, margin: 2 });
        try {
          fs.copyFileSync(QR_PNG_PATH, ARTIFACT_QR_PATH);
        } catch {}
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
        latestQrDataUrl = qrDataUrl;
        syncStatusToDatabase();
      } catch (err) {
        addLog(`❌ Error generando imagen QR: ${err.message}`);
      }
    }

    if (connection === "close") {
      isWhatsAppConnected = false;
      syncStatusToDatabase();
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      addLog(`❌ Conexión cerrada (Código ${statusCode}). Reintentando: ${shouldReconnect}`);

      if (shouldReconnect) {
        const delay = statusCode === 440 ? 8000 : 2500;
        scheduleReconnect(delay);
      } else {
        addLog("⚠️ Sesión cerrada/desvinculada. Limpiando credenciales para nuevo QR...");
        try {
          if (fs.existsSync(AUTH_DIR)) {
            const files = fs.readdirSync(AUTH_DIR);
            for (const file of files) {
              try {
                fs.rmSync(path.join(AUTH_DIR, file), { recursive: true, force: true });
              } catch {}
            }
          }
        } catch {}
        scheduleReconnect(2000);
      }
    } else if (connection === "open") {
      isWhatsAppConnected = true;
      latestQrDataUrl = "";
      lastConnectedAt = new Date().toISOString();
      addLog("🎉 ¡WHATSAPP CONECTADO CON ÉXITO! Asesora Sofía de IKAL CHUKUM activa 24/7.");
      syncStatusToDatabase();
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (mySocketId !== activeSocketId || isShuttingDown) return;
    try {
      for (const msg of messages) {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid) continue;

        // Ignore status broadcasts or group chats
        if (remoteJid === "status@broadcast") continue;
        if (remoteJid.endsWith("@g.us")) continue;

        // Deduplicate messages
        const msgId = msg.key.id;
        if (msgId && processedMsgIds.has(msgId)) continue;

        // Extract message text from all WhatsApp packet variants
        const textMessage =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.ephemeralMessage?.message?.conversation ||
          msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
          msg.message?.viewOnceMessage?.message?.conversation ||
          msg.message?.viewOnceMessage?.message?.extendedTextMessage?.text ||
          msg.message?.viewOnceMessageV2?.message?.conversation ||
          msg.message?.viewOnceMessageV2?.message?.extendedTextMessage?.text ||
          msg.message?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
          "";

        const cleanText = (textMessage || "").trim();
        if (!cleanText) continue;

        // Never reply to messages generated by Sofía herself
        if (
          cleanText.startsWith("✨ ¡Hola! Qué gusto saludarte. Soy Sofía") ||
          cleanText.startsWith("✨ Hello! Nice to meet you. I am Sofia") ||
          cleanText.startsWith("✨ Olá! Que bom falar com você. Sou a Sofia") ||
          cleanText.startsWith("🎨 *Nuestra Paleta de Colores IKAL CHUKUM*") ||
          cleanText.startsWith("🏛️ *SOFÍA • IKAL CHUKUM*")
        ) {
          continue;
        }

        const myJid = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : "";
        const isSelfChat =
          remoteJid === myJid || (myJid && remoteJid.includes(myJid.replace("@s.whatsapp.net", "")));

        // Ignore messages sent by the human operator to OTHER clients, but allow self-chat for testing
        if (msg.key.fromMe && !isSelfChat) {
          addLog(`ℹ️ Mensaje enviado manualmente a [${remoteJid}]: "${cleanText}"`);
          continue;
        }

        if (msgId) {
          processedMsgIds.add(msgId);
          if (processedMsgIds.size > 300) {
            const firstId = processedMsgIds.values().next().value;
            processedMsgIds.delete(firstId);
          }
        }

        const phoneClean = remoteJid.replace(/@.*$/, "").split(":")[0];
        addLog(`📩 Mensaje recibido de [${phoneClean}]: "${cleanText}"`);

        // Get user session history
        if (!sessionHistories.has(remoteJid)) {
          sessionHistories.set(remoteJid, []);
        }
        const history = sessionHistories.get(remoteJid);

        // Send 'composing' presence indicator safely
        try {
          if (currentSock) await currentSock.sendPresenceUpdate("composing", remoteJid);
        } catch {}

        // Small realistic human typing delay (700ms)
        await new Promise((res) => setTimeout(res, 700));

        // Query Sofía AI + ERP tools
        const { reply, mediaUrl, alertaAdmin } = await getSofiaReply(cleanText, phoneClean, history);

        if (alertaAdmin) {
          addLog(`🔔 ALERTA ERP: ${alertaAdmin}`);
        }

        // Send text reply to WhatsApp with retry
        let sentOk = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const activeSock = currentSock || sock;
            await activeSock.sendMessage(remoteJid, { text: reply });
            sentOk = true;
            break;
          } catch (sendErr) {
            addLog(`⚠️ Intento ${attempt} de envío falló (${sendErr.message}). Reintentando...`);
            await new Promise((res) => setTimeout(res, 2000));
          }
        }

        if (sentOk) {
          addLog(`📤 Respuesta de Sofía enviada a [${phoneClean}]: ${reply.substring(0, 70).replace(/\n/g, " ")}...`);

          // Update conversation history (keep last 10 messages)
          history.push({ role: "user", content: cleanText });
          history.push({ role: "assistant", content: reply });
          if (history.length > 10) {
            sessionHistories.set(remoteJid, history.slice(-10));
          }

          // If Sofía presented the color palette, send the official palette image right below!
          if (mediaUrl) {
            try {
              const activeSock = currentSock || sock;
              if (fs.existsSync(PALETTE_IMG_PATH)) {
                await activeSock.sendMessage(remoteJid, {
                  image: fs.readFileSync(PALETTE_IMG_PATH),
                  caption: "🎨 Paleta Oficial de Colores • IKAL CHUKUM",
                });
              } else {
                await activeSock.sendMessage(remoteJid, {
                  image: { url: mediaUrl },
                  caption: "🎨 Paleta Oficial de Colores • IKAL CHUKUM",
                });
              }
              addLog(`🖼️ Imagen de paleta de colores enviada a [${phoneClean}]`);
            } catch (imgErr) {
              addLog(`⚠️ Error enviando imagen de paleta: ${imgErr.message}`);
            }
          }
        }

        // Restore presence
        try {
          if (currentSock) await currentSock.sendPresenceUpdate("available", remoteJid);
        } catch {}
      }
    } catch (msgError) {
      addLog(`❌ Error procesando mensaje entrante: ${msgError.message}`);
    }
  });
}

// HTTP server for visual QR, live logs, and health checks (Render/Railway/Local)
const PORT = process.env.WA_PORT || process.env.PORT || 3005;
const server = http.createServer((req, res) => {
  if (req.url === "/logs") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="4">
  <title>Monitor en Vivo - Sofía WhatsApp Bot • IKAL CHUKUM</title>
  <style>
    body { background: #0C0A09; color: #D6D3D1; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", monospace; padding: 25px; margin: 0; }
    .card { background: #1C1917; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 16px; padding: 20px; max-width: 920px; margin: 0 auto; box-shadow: 0 0 30px rgba(0,0,0,0.6); }
    h2 { color: #F5F5F4; margin-top: 0; font-size: 18px; display: flex; align-items: center; justify-content: space-between; }
    .status-badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; margin-bottom: 15px; }
    .connected { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid #10B981; }
    .waiting { background: rgba(245, 158, 11, 0.15); color: #FBBF24; border: 1px solid #F59E0B; }
    .terminal { background: #090807; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 15px; font-family: monospace; font-size: 13px; line-height: 1.6; max-height: 520px; overflow-y: auto; color: #E7E5E4; }
    .log-line { margin: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 2px; }
    a.btn { color: #D4AF37; text-decoration: none; font-size: 13px; border: 1px solid rgba(212,175,55,0.4); padding: 5px 12px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>
      <span>🏛️ IKAL CHUKUM • Monitor de Sofía WhatsApp IA</span>
      <a href="/qr" class="btn">📱 Ver Panel QR</a>
    </h2>
    <div class="status-badge ${isWhatsAppConnected ? "connected" : "waiting"}">
      ${isWhatsAppConnected ? "🟢 CONECTADO A WHATSAPP (SOFÍA ACTIVA 24/7)" : "🟡 ESPERANDO ESCANEO DE CÓDIGO QR"}
    </div>
    <div class="terminal">
      ${logBuffer.map((l) => `<div class="log-line">${l}</div>`).join("") || "<div>Iniciando monitor de Sofía...</div>"}
    </div>
  </div>
</body>
</html>`);
    return;
  }

  if (req.url === "/reset" || req.url === "/logout") {
    try {
      cleanupCurrentSocket();
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
          try {
            fs.rmSync(path.join(AUTH_DIR, file), { recursive: true, force: true });
          } catch {}
        }
      }
      isWhatsAppConnected = false;
      latestQrDataUrl = "";
      addLog("🔄 Sesión reseteada a solicitud del usuario. Generando nuevo código QR...");
      scheduleReconnect(800);
      res.writeHead(302, { Location: "/qr" });
      res.end();
      return;
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Error reseteando sesión: " + e.message);
      return;
    }
  }

  if (req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        connected: isWhatsAppConnected,
        qr: latestQrDataUrl || null,
        lastConnected: lastConnectedAt,
      })
    );
    return;
  }

  if (req.url === "/qr") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vincular WhatsApp - Sofía • IKAL CHUKUM</title>
  <style>
    body { background: #0C0A09; color: #F5F5F4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
    .card { background: #1C1917; border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 24px; padding: 32px 24px; max-width: 440px; width: 100%; box-shadow: 0 0 50px rgba(212, 175, 55, 0.15); transition: all 0.3s ease; }
    h1 { font-size: 21px; color: #EAB308; margin: 0 0 8px; }
    p { color: #A8A29E; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
    .qr-container { background: #fff; padding: 12px; border-radius: 16px; display: inline-block; box-shadow: 0 8px 25px rgba(0,0,0,0.5); min-width: 260px; min-height: 260px; }
    .qr-container img { display: block; width: 260px; height: 260px; object-fit: contain; }
    .steps { text-align: left; background: rgba(255,255,255,0.03); border-radius: 12px; padding: 12px 18px; margin: 18px 0; font-size: 13px; color: #D6D3D1; }
    .steps ol { margin: 0; padding-left: 18px; }
    .steps li { margin-bottom: 6px; }
    .btn { display: inline-block; padding: 11px 20px; border-radius: 12px; font-weight: 600; font-size: 13px; text-decoration: none; transition: all 0.2s ease; }
    .btn-reset { color: #FBBF24; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); }
    .btn-reset:hover { background: rgba(245, 158, 11, 0.25); color: #fff; }
    .btn-danger { background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.3); color: #fff; }
    .btn-secondary { background: rgba(234, 179, 8, 0.12); color: #EAB308; border: 1px solid rgba(234, 179, 8, 0.35); }
    .spinner { width: 44px; height: 44px; border: 4px solid rgba(234, 179, 8, 0.2); border-top-color: #EAB308; border-radius: 50%; animation: spin 1s linear infinite; margin: 80px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-text { font-size: 12px; color: #34D399; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card" id="mainCard">
    <div id="loadingView">
      <div class="spinner"></div>
      <h1>Generando código QR...</h1>
      <p>Iniciando conexión directa de WhatsApp para Sofía (IKAL CHUKUM).</p>
    </div>

    <div id="qrView" style="display: none;">
      <h1>🏛️ Vincular WhatsApp • IKAL CHUKUM</h1>
      <p>Escanea este código desde el WhatsApp de Ikal Chukum (sin necesitar ManyChat):</p>
      <div class="qr-container">
        <img id="qrImage" src="" alt="Código QR WhatsApp" />
      </div>
      <div class="steps">
        <ol>
          <li>Abre <b>WhatsApp</b> o <b>WhatsApp Business</b> en tu teléfono.</li>
          <li>Toca <b>Menú (⋮) / Configuración</b> ➔ <b>Dispositivos vinculados</b>.</li>
          <li>Toca <b>Vincular un dispositivo</b> y apunta la cámara a este QR.</li>
        </ol>
      </div>
      <div>
        <a href="/reset" class="btn btn-reset">🔄 Generar nuevo código QR</a>
      </div>
      <div class="status-text">🟢 Código activo listo para escanear en tiempo real</div>
    </div>

    <div id="connectedView" style="display: none;">
      <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
      <h1 style="color: #34D399;">WhatsApp Conectado</h1>
      <p>La asesora <b>Sofía (IKAL CHUKUM)</b> está conectada directamente a tu WhatsApp y conectada al ERP (inventario, cotizaciones EE.UU./México y paleta de colores) 24/7.</p>
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
        <a href="/logs" class="btn btn-secondary">📊 Ver monitor de mensajes en vivo</a>
        <a href="/reset" class="btn btn-danger" onclick="return confirm('¿Seguro que deseas desvincular este número?');">🔄 Desvincular / Cambiar número</a>
      </div>
    </div>
  </div>

  <script>
    let currentQr = "";
    async function checkStatus() {
      try {
        const res = await fetch("/api/status");
        if (!res.ok) return;
        const data = await res.json();

        const loadingView = document.getElementById("loadingView");
        const qrView = document.getElementById("qrView");
        const connectedView = document.getElementById("connectedView");
        const qrImage = document.getElementById("qrImage");
        const card = document.getElementById("mainCard");

        if (data.connected) {
          loadingView.style.display = "none";
          qrView.style.display = "none";
          connectedView.style.display = "block";
          card.style.borderColor = "rgba(16, 185, 129, 0.45)";
          card.style.boxShadow = "0 0 50px rgba(16, 185, 129, 0.2)";
        } else if (data.qr) {
          if (currentQr !== data.qr) {
            currentQr = data.qr;
            qrImage.src = data.qr;
          }
          loadingView.style.display = "none";
          connectedView.style.display = "none";
          qrView.style.display = "block";
          card.style.borderColor = "rgba(234, 179, 8, 0.45)";
          card.style.boxShadow = "0 0 50px rgba(234, 179, 8, 0.18)";
        } else {
          loadingView.style.display = "block";
          qrView.style.display = "none";
          connectedView.style.display = "none";
        }
      } catch (err) {
        console.log("Polling status...", err);
      }
    }

    checkStatus();
    setInterval(checkStatus, 2000);
  </script>
</body>
</html>`);
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "online",
      bot: "Ikal Chukum - Asesora Sofía IA",
      whatsapp_connected: isWhatsAppConnected,
      last_connected_at: lastConnectedAt,
      timestamp: new Date().toISOString(),
    })
  );
});

process.on("uncaughtException", (err) => {
  addLog(`⚠️ Uncaught Exception: ${err.message}`);
});
process.on("unhandledRejection", (reason) => {
  addLog(`⚠️ Unhandled Rejection: ${reason}`);
});

function gracefulShutdown(signal) {
  console.log(`🛑 Recibido ${signal}. Cerrando socket de WhatsApp limpiamente...`);
  isShuttingDown = true;
  cleanupCurrentSocket();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor de WhatsApp Ikal Chukum activo en http://localhost:${PORT}/qr`);
});

startWhatsAppBot();
