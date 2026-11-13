import { db } from "@/lib/db";
import { ensureCloudWhatsAppEngine, processCloudOutboundQueue } from "@/lib/whatsappCloudEngine";

export interface WaNotificationConfig {
  winerPhone: string;
  miamiGroupJid: string;
  miamiGroupName: string;
  ownerPhone1: string; // Arturo
  ownerPhone2: string; // Socio (Alberteto Saenz)
  notifyOnNewOrder: boolean;
  notifyOnAcknowledge: boolean;
  notifyOnShippedOrPickup: boolean;
  notifyOnDelivered: boolean;
}

export interface WaOutboundMessage {
  id: string;
  target: string; // Phone digits or group JID (@g.us) or group name prefix "GROUP_NAME:..."
  text: string;
  createdAt: string;
}

const DEFAULT_CONFIG: WaNotificationConfig = {
  winerPhone: "593998293607",
  miamiGroupJid: "120363426383204504@g.us",
  miamiGroupName: "ikal Chukum oficina Miami",
  ownerPhone1: "5219992587847",
  ownerPhone2: "5219991597289",
  notifyOnNewOrder: true,
  notifyOnAcknowledge: true,
  notifyOnShippedOrPickup: true,
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

    if (queue.length > 50) {
      queue = queue.slice(-50);
    }

    await db.systemSetting.upsert({
      where: { key: "WA_OUTBOUND_QUEUE" },
      update: { value: JSON.stringify(queue) },
      create: { key: "WA_OUTBOUND_QUEUE", value: JSON.stringify(queue) },
    });

    // Si el servicio dedicado no ha reportado latido en los últimos 10 segundos, procesar la cola desde el motor en la nube
    try {
      const statusRow = await db.systemSetting.findUnique({ where: { key: "WA_BOT_STATUS" } });
      const parsed = statusRow?.value ? JSON.parse(statusRow.value) : null;
      const ageMs = parsed?.updatedAt ? Date.now() - new Date(parsed.updatedAt).getTime() : 999999;
      if (ageMs > 10000 || parsed?.mode === "cloud") {
        await ensureCloudWhatsAppEngine(3000);
        await processCloudOutboundQueue();
      }
    } catch {}
  } catch (err) {
    console.error("Error encolando mensaje de WhatsApp:", err);
  }
}

export async function notifyOrderWhatsAppEvent(
  eventType: "NEW_ORDER" | "ACKNOWLEDGED" | "PREPARING" | "SHIPPED" | "DELIVERED",
  orderData: {
    quoteNumber: string;
    clientName: string;
    clientPhone?: string | null;
    warehouseName: string;
    warehouseAddress?: string | null;
    deliveryMethod?: string;
    scheduledDeliveryAt?: Date | string | null;
    trackingNumber?: string | null;
    shippingCarrier?: string | null;
    shippingLabelUrl?: string | null;
    total?: number;
    currency?: string;
    itemsSummary?: string;
  }
) {
  try {
    const config = await getWaNotificationConfig();
    const isMiami = orderData.warehouseName.toLowerCase().includes("miami");
    const targets: Array<{ target: string; text: string }> = [];

    const deliveryLabel =
      orderData.deliveryMethod === "RECOLECTA" ? "Recolecta en Bodega" : "Envío a Domicilio";

    const formattedSchedule = orderData.scheduledDeliveryAt
      ? new Date(orderData.scheduledDeliveryAt).toLocaleString("es-MX", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: isMiami ? "America/New_York" : "America/Mexico_City",
        })
      : null;

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
        `• *Estado:* Confirmado de recibido / En preparación por bodega.`;

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
    } else if (eventType === "SHIPPED" && config.notifyOnShippedOrPickup) {
      const isRecolecta = orderData.deliveryMethod === "RECOLECTA";
      const rawClientDigits = String(orderData.clientPhone || "").replace(/\D/g, "");
      const cleanClientPhone =
        rawClientDigits.length === 10
          ? isMiami
            ? `1${rawClientDigits}`
            : `521${rawClientDigits}`
          : rawClientDigits;

      // 1. Mensaje directo al Cliente (si tiene teléfono registrado)
      if (cleanClientPhone.length >= 10) {
        let clientMsg = "";
        if (isRecolecta) {
          const whLocation =
            orderData.warehouseAddress ||
            (isMiami
              ? "8357 NW 68th St, Miami, FL 33166 (Bodega Miami)"
              : orderData.warehouseName);
          clientMsg = isMiami
            ? `🏛️ *IKAL CHUKUM • Pedido Listo para Recolecta / Ready for Pickup*\n\n` +
              `¡Hola *${orderData.clientName}*! ✨ Te informamos que tu pedido (*${orderData.quoteNumber}*) ya está listo para recolecta en nuestra *${orderData.warehouseName}*.\n` +
              `Hi *${orderData.clientName}*! ✨ Your order (*${orderData.quoteNumber}*) is ready for pickup at our *Miami Warehouse*.\n\n` +
              (formattedSchedule
                ? `🕒 *Fecha y hora programada / Scheduled pickup:* ${formattedSchedule}\n`
                : "") +
              `📍 *Dirección / Address:* ${whLocation}\n` +
              (orderData.itemsSummary ? `📦 *Material / Items:* ${orderData.itemsSummary}\n` : "") +
              `\n¡Te esperamos! Cualquier duda estamos para servirte. / We look forward to seeing you!`
            : `🏛️ *IKAL CHUKUM • Pedido Listo para Recolecta*\n\n` +
              `¡Hola *${orderData.clientName}*! ✨ Te informamos que tu pedido (*${orderData.quoteNumber}*) ya está listo para recolecta en nuestra *${orderData.warehouseName}*.\n\n` +
              (formattedSchedule
                ? `🕒 *Fecha y hora programada para pasar a recogerlo:* ${formattedSchedule}\n`
                : "") +
              `📍 *Dirección:* ${whLocation}\n` +
              (orderData.itemsSummary ? `📦 *Material:* ${orderData.itemsSummary}\n` : "") +
              `\n¡Te esperamos! Cualquier duda estamos para servirte.`;
        } else {
          clientMsg =
            `🚚 *IKAL CHUKUM • Estatus de tu Envío*\n\n` +
            `¡Hola *${orderData.clientName}*! ✨ Te informamos que tu pedido (*${orderData.quoteNumber}*) ha salido de nuestra *${orderData.warehouseName}* y ya se encuentra en camino.\n\n` +
            (orderData.itemsSummary ? `📦 *Material:* ${orderData.itemsSummary}\n` : "") +
            (orderData.shippingCarrier ? `🚛 *Paquetería:* ${orderData.shippingCarrier}\n` : "") +
            (orderData.trackingNumber
              ? `🔢 *Número de rastreo (Tracking):* ${orderData.trackingNumber}\n`
              : "") +
            (formattedSchedule ? `📅 *Fecha programada:* ${formattedSchedule}\n` : "") +
            (orderData.shippingLabelUrl ? `📄 *Guía:* ${orderData.shippingLabelUrl}\n` : "") +
            `\n¡Gracias por tu preferencia en *IKAL CHUKUM*!`;
        }
        targets.push({ target: cleanClientPhone, text: clientMsg });
      }

      // 2. Aviso interno al equipo (Grupo Miami, Winer y Socios)
      const teamMsg = isRecolecta
        ? `🕒 *HORA DE RECOLECTA PROGRAMADA • IKAL CHUKUM*\n\n` +
          `• *Folio:* ${orderData.quoteNumber}\n` +
          `• *Cliente:* ${orderData.clientName}\n` +
          `• *Bodega:* ${orderData.warehouseName}\n` +
          (formattedSchedule ? `• *Hora programada:* ${formattedSchedule}\n` : "") +
          (orderData.itemsSummary ? `• *Material:* ${orderData.itemsSummary}\n` : "") +
          `• *Aviso al cliente:* ${cleanClientPhone.length >= 10 ? "Enviado por WhatsApp ✅" : "Cliente sin teléfono registrado"}`
        : `🚚 *PEDIDO EN CAMINO / ENVIADO • IKAL CHUKUM*\n\n` +
          `• *Folio:* ${orderData.quoteNumber}\n` +
          `• *Cliente:* ${orderData.clientName}\n` +
          `• *Bodega:* ${orderData.warehouseName}\n` +
          (orderData.trackingNumber ? `• *Rastreo:* ${orderData.trackingNumber}\n` : "") +
          (formattedSchedule ? `• *Fecha programada:* ${formattedSchedule}\n` : "") +
          (orderData.itemsSummary ? `• *Material:* ${orderData.itemsSummary}\n` : "") +
          `• *Aviso al cliente:* ${cleanClientPhone.length >= 10 ? "Enviado por WhatsApp ✅" : "Cliente sin teléfono registrado"}`;

      if (isMiami) {
        if (config.winerPhone) targets.push({ target: config.winerPhone, text: teamMsg });
        if (config.miamiGroupJid) {
          targets.push({ target: config.miamiGroupJid, text: teamMsg });
        } else if (config.miamiGroupName) {
          targets.push({ target: `GROUP_NAME:${config.miamiGroupName}`, text: teamMsg });
        }
      }
      if (config.ownerPhone1) targets.push({ target: config.ownerPhone1, text: teamMsg });
      if (config.ownerPhone2) targets.push({ target: config.ownerPhone2, text: teamMsg });
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
