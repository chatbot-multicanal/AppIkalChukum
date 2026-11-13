import { db } from "@/lib/db";

export interface WaNotificationConfig {
  winerPhone: string;
  miamiGroupJid: string;
  miamiGroupName: string;
  ownerPhone1: string; // Usuario principal
  ownerPhone2: string; // Socio
  notifyOnNewOrder: boolean;
  notifyOnAcknowledge: boolean;
  notifyOnDelivered: boolean;
}

export interface WaOutboundMessage {
  id: string;
  target: string; // Phone digits or group JID (@g.us) or group name prefix "GROUP_NAME:..."
  text: string;
  createdAt: string;
}

const DEFAULT_CONFIG: WaNotificationConfig = {
  winerPhone: "",
  miamiGroupJid: "",
  miamiGroupName: "Miami",
  ownerPhone1: "5219992587847",
  ownerPhone2: "5219992758500",
  notifyOnNewOrder: true,
  notifyOnAcknowledge: true,
  notifyOnDelivered: true,
};

export async function getWaNotificationConfig(): Promise<WaNotificationConfig> {
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: "WA_NOTIFICATION_CONFIG" },
    });
    if (row?.value) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export async function saveWaNotificationConfig(
  partial: Partial<WaNotificationConfig>
): Promise<WaNotificationConfig> {
  const current = await getWaNotificationConfig();
  const updated = { ...current, ...partial };
  await db.systemSetting.upsert({
    where: { key: "WA_NOTIFICATION_CONFIG" },
    update: { value: JSON.stringify(updated) },
    create: { key: "WA_NOTIFICATION_CONFIG", value: JSON.stringify(updated) },
  });
  return updated;
}

export async function getPausedChats(): Promise<string[]> {
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: "WA_PAUSED_CHATS" },
    });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export async function isChatPaused(phoneOrKey: string): Promise<boolean> {
  const clean = String(phoneOrKey || "").replace(/\D/g, "");
  if (!clean) return false;
  const paused = await getPausedChats();
  return paused.some((p) => {
    const pClean = String(p).replace(/\D/g, "");
    if (!pClean) return false;
    return (
      pClean === clean ||
      (pClean.length >= 10 && clean.length >= 10 && pClean.slice(-10) === clean.slice(-10))
    );
  });
}

export async function togglePausedChat(
  phoneOrKey: string,
  pause?: boolean
): Promise<{ pausedChats: string[]; isPaused: boolean }> {
  const clean = String(phoneOrKey || "").replace(/\D/g, "");
  const current = await getPausedChats();
  const exists = current.some(
    (p) =>
      p === clean ||
      (p.length >= 10 && clean.length >= 10 && p.slice(-10) === clean.slice(-10))
  );

  const shouldPause = typeof pause === "boolean" ? pause : !exists;
  let updated: string[];
  if (shouldPause) {
    updated = exists ? current : [...current, clean];
  } else {
    updated = current.filter(
      (p) =>
        !(
          p === clean ||
          (p.length >= 10 && clean.length >= 10 && p.slice(-10) === clean.slice(-10))
        )
    );
  }

  await db.systemSetting.upsert({
    where: { key: "WA_PAUSED_CHATS" },
    update: { value: JSON.stringify(updated) },
    create: { key: "WA_PAUSED_CHATS", value: JSON.stringify(updated) },
  });

  return { pausedChats: updated, isPaused: shouldPause };
}

export async function enqueueWhatsAppMessages(
  messages: Array<{ target: string; text: string }>
) {
  const valid = messages.filter((m) => m.target && m.target.trim() && m.text && m.text.trim());
  if (valid.length === 0) return;

  try {
    const row = await db.systemSetting.findUnique({
      where: { key: "WA_OUTBOUND_QUEUE" },
    });
    let queue: WaOutboundMessage[] = [];
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) queue = parsed;
      } catch {}
    }

    const now = new Date().toISOString();
    for (const msg of valid) {
      queue.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        target: msg.target.trim(),
        text: msg.text.trim(),
        createdAt: now,
      });
    }

    // Keep last 50 queued items max
    if (queue.length > 50) {
      queue = queue.slice(-50);
    }

    await db.systemSetting.upsert({
      where: { key: "WA_OUTBOUND_QUEUE" },
      update: { value: JSON.stringify(queue) },
      create: { key: "WA_OUTBOUND_QUEUE", value: JSON.stringify(queue) },
    });
  } catch (err) {
    console.error("Error encolando mensaje de WhatsApp:", err);
  }
}

export async function notifyOrderWhatsAppEvent(
  eventType: "NEW_ORDER" | "ACKNOWLEDGED" | "PREPARING" | "DELIVERED",
  orderData: {
    quoteNumber: string;
    clientName: string;
    warehouseName: string;
    deliveryMethod?: string;
    total?: number;
    currency?: string;
    itemsSummary?: string;
    acknowledgedBy?: string;
  }
) {
  try {
    const config = await getWaNotificationConfig();
    const isMiami = orderData.warehouseName.toLowerCase().includes("miami");
    const targets: Array<{ target: string; text: string }> = [];

    const deliveryLabel =
      orderData.deliveryMethod === "RECOLECTA" ? "Recolecta en Bodega" : "Envío a Domicilio";

    if (eventType === "NEW_ORDER" && config.notifyOnNewOrder) {
      const msg =
        `📦 *NUEVO PEDIDO POR SURTIR • IKAL CHUKUM*\n\n` +
        `• *Folio:* ${orderData.quoteNumber}\n` +
        `• *Cliente:* ${orderData.clientName}\n` +
        `• *Bodega:* ${orderData.warehouseName}\n` +
        `• *Modalidad:* ${deliveryLabel}\n` +
        (orderData.itemsSummary ? `• *Material:* ${orderData.itemsSummary}\n` : "") +
        `\n👉 Por favor ingresa a https://app.ikalchukum.com/pedidos para confirmar de recibido ("Dar por enterado") e iniciar preparación.`;

      if (isMiami) {
        if (config.winerPhone) targets.push({ target: config.winerPhone, text: msg });
        if (config.miamiGroupJid) {
          targets.push({ target: config.miamiGroupJid, text: msg });
        } else if (config.miamiGroupName) {
          targets.push({ target: `GROUP_NAME:${config.miamiGroupName}`, text: msg });
        }
      }
      if (config.ownerPhone1) targets.push({ target: config.ownerPhone1, text: msg });
      if (config.ownerPhone2) targets.push({ target: config.ownerPhone2, text: msg });
    } else if (
      (eventType === "ACKNOWLEDGED" || eventType === "PREPARING") &&
      config.notifyOnAcknowledge
    ) {
      const msg =
        `✅ *CONFIRMACIÓN DE RECIBIDO EN BODEGA • IKAL CHUKUM*\n\n` +
        `• *Folio:* ${orderData.quoteNumber}\n` +
        `• *Cliente:* ${orderData.clientName}\n` +
        `• *Bodega:* ${orderData.warehouseName}\n` +
        (orderData.itemsSummary ? `• *Material:* ${orderData.itemsSummary}\n` : "") +
        `• *Estado:* Pedido confirmado de recibido / En preparación por bodega.`;

      if (isMiami) {
        if (config.winerPhone) targets.push({ target: config.winerPhone, text: msg });
        if (config.miamiGroupJid) {
          targets.push({ target: config.miamiGroupJid, text: msg });
        } else if (config.miamiGroupName) {
          targets.push({ target: `GROUP_NAME:${config.miamiGroupName}`, text: msg });
        }
      }
      if (config.ownerPhone1) targets.push({ target: config.ownerPhone1, text: msg });
      if (config.ownerPhone2) targets.push({ target: config.ownerPhone2, text: msg });
    } else if (eventType === "DELIVERED" && config.notifyOnDelivered) {
      const totalFormatted =
        typeof orderData.total === "number"
          ? `$${orderData.total.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${
              orderData.currency || "MXN"
            }`
          : "";
      const msg =
        `🏁 *PEDIDO ENTREGADO • IKAL CHUKUM*\n\n` +
        `• *Folio:* ${orderData.quoteNumber}\n` +
        `• *Cliente:* ${orderData.clientName}\n` +
        `• *Bodega:* ${orderData.warehouseName}\n` +
        (orderData.itemsSummary ? `• *Material:* ${orderData.itemsSummary}\n` : "") +
        (totalFormatted ? `• *Total:* ${totalFormatted}\n` : "") +
        `• *Estado:* Entregado / Recibido con éxito ✅`;

      if (config.ownerPhone1) targets.push({ target: config.ownerPhone1, text: msg });
      if (config.ownerPhone2) targets.push({ target: config.ownerPhone2, text: msg });
      if (isMiami && config.miamiGroupJid) {
        targets.push({ target: config.miamiGroupJid, text: msg });
      }
    }

    // Deduplicate targets
    const uniqueTargets = new Map<string, { target: string; text: string }>();
    for (const t of targets) {
      uniqueTargets.set(t.target, t);
    }

    await enqueueWhatsAppMessages(Array.from(uniqueTargets.values()));
  } catch (err) {
    console.error("Error en notifyOrderWhatsAppEvent:", err);
  }
}
