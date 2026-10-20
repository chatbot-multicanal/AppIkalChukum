import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Obtener los últimos 150 logs de Sofía en la base de datos
    const rawLogs = await db.auditLog.findMany({
      where: {
        entity: { in: ["SofiaChat", "SofiaWhatsApp"] },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    });

    // 2. Obtener clientes para enriquecer nombres por teléfono
    const clients = await db.client.findMany({
      where: { active: true },
      select: { id: true, name: true, phone: true, city: true, country: true, email: true },
    });

    const clientByPhone = new Map<string, typeof clients[0]>();
    for (const c of clients) {
      if (c.phone) {
        const clean = c.phone.replace(/\D/g, "");
        if (clean) {
          clientByPhone.set(clean, c);
          if (clean.length >= 10) {
            clientByPhone.set(clean.slice(-10), c);
          }
        }
      }
    }

    // 3. Reconstruir conversaciones en vivo y lista de logs para terminal
    const conversationsMap = new Map<
      string,
      {
        contactKey: string;
        phone: string;
        clientName: string | null;
        city: string | null;
        country: string | null;
        lastMessage: string;
        lastAt: string;
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          createdAt: string;
        }>;
      }
    >();

    const formattedLogs: Array<{
      id: string;
      createdAt: string;
      type: "INFO" | "SUCCESS" | "ERROR" | "WA";
      phone: string;
      summary: string;
      userMessage?: string;
      botReply?: string;
    }> = [];

    // Procesar de más antiguo a más reciente para armar el hilo de mensajes en orden
    const chronological = [...rawLogs].reverse();

    for (const log of chronological) {
      try {
        const parsed = JSON.parse(log.details || "{}");
        const rawPhone =
          parsed.request?.phone ||
          parsed.body?.phone ||
          parsed.phone ||
          parsed.request?.contactId ||
          "Desconocido";
        const cleanDigits = String(rawPhone).replace(/\D/g, "");
        const matchedClient =
          clientByPhone.get(cleanDigits) ||
          (cleanDigits.length >= 10 ? clientByPhone.get(cleanDigits.slice(-10)) : undefined);

        const userMsg = parsed.request?.message || parsed.body?.message || "";
        const botReply = parsed.reply || "";

        if (log.action === "ERROR") {
          formattedLogs.push({
            id: log.id,
            createdAt: log.createdAt.toISOString(),
            type: "ERROR",
            phone: String(rawPhone),
            summary: `❌ Error (${log.entityId}): ${parsed.error || JSON.stringify(parsed.errorData || {})}`,
            userMessage: userMsg,
          });
          continue;
        }

        if (log.entity === "SofiaWhatsApp") {
          formattedLogs.push({
            id: log.id,
            createdAt: log.createdAt.toISOString(),
            type: "WA",
            phone: String(rawPhone),
            summary: parsed.message || log.entityId,
          });
          continue;
        }

        if (userMsg || botReply) {
          // Omitir pruebas antiguas de ManyChat donde el teléfono era literal "{{phone}}"
          if (String(rawPhone).trim() === "{{phone}}") {
            continue;
          }
          const contactKey = cleanDigits || String(rawPhone);
          if (!conversationsMap.has(contactKey)) {
            conversationsMap.set(contactKey, {
              contactKey,
              phone: String(rawPhone),
              clientName: matchedClient?.name || null,
              city: matchedClient?.city || null,
              country: matchedClient?.country || null,
              lastMessage: botReply || userMsg,
              lastAt: log.createdAt.toISOString(),
              messages: [],
            });
          }

          const conv = conversationsMap.get(contactKey)!;
          if (matchedClient && !conv.clientName) {
            conv.clientName = matchedClient.name;
            conv.city = matchedClient.city;
            conv.country = matchedClient.country;
          }

          if (userMsg) {
            conv.messages.push({
              id: `${log.id}-u`,
              role: "user",
              content: userMsg,
              createdAt: log.createdAt.toISOString(),
            });
          }
          if (botReply) {
            conv.messages.push({
              id: `${log.id}-a`,
              role: "assistant",
              content: botReply,
              createdAt: log.createdAt.toISOString(),
            });
          }
          conv.lastMessage = botReply || userMsg;
          conv.lastAt = log.createdAt.toISOString();

          formattedLogs.push({
            id: log.id,
            createdAt: log.createdAt.toISOString(),
            type: "SUCCESS",
            phone: matchedClient ? `${matchedClient.name} (${rawPhone})` : String(rawPhone),
            summary: `📩 "${userMsg.slice(0, 65)}" ➔ 🤖 "${botReply.replace(/\n/g, " ").slice(0, 75)}..."`,
            userMessage: userMsg,
            botReply: botReply,
          });
        }
      } catch {
        // Ignorar JSON malformado
      }
    }

    // Ordenar conversaciones por actividad más reciente
    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

    // 4. Obtener estado del conector WhatsApp desde SystemSetting
    let waStatus: any = {
      connected: false,
      qr: null,
      lastConnected: null,
      serviceLogs: [],
      updatedAt: null,
    };

    try {
      const waSetting = await db.systemSetting.findUnique({
        where: { key: "WA_BOT_STATUS" },
      });
      if (waSetting?.value) {
        waStatus = JSON.parse(waSetting.value);
      }
    } catch {}

    return NextResponse.json({
      success: true,
      conversations,
      logs: formattedLogs.reverse(),
      waStatus,
    });
  } catch (error: any) {
    console.error("Error en GET /api/chat/sofia/logs:", error);
    return NextResponse.json(
      { error: "Error al obtener conversaciones y logs de Sofía" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Si la interfaz solicita resetear el QR de WhatsApp
    if (body.action === "REQUEST_RESET") {
      const existing = await db.systemSetting.findUnique({
        where: { key: "WA_BOT_STATUS" },
      });
      let current = existing?.value ? JSON.parse(existing.value) : {};
      current.pendingReset = true;
      current.connected = false;
      current.qr = null;

      await db.systemSetting.upsert({
        where: { key: "WA_BOT_STATUS" },
        update: { value: JSON.stringify(current) },
        create: { key: "WA_BOT_STATUS", value: JSON.stringify(current) },
      });

      return NextResponse.json({ success: true, message: "Solicitud de reinicio enviada al bot" });
    }

    // Si el servicio de WhatsApp reporta su estado en vivo (heartbeat)
    if (body.action === "HEARTBEAT") {
      const existing = await db.systemSetting.findUnique({
        where: { key: "WA_BOT_STATUS" },
      });
      let current = existing?.value ? JSON.parse(existing.value) : {};
      const shouldReset = Boolean(current.pendingReset);

      const newStatus = {
        connected: Boolean(body.connected),
        qr: body.qr || null,
        lastConnected: body.lastConnected || current.lastConnected || null,
        serviceLogs: Array.isArray(body.serviceLogs) ? body.serviceLogs.slice(-80) : [],
        updatedAt: new Date().toISOString(),
        pendingReset: false,
      };

      await db.systemSetting.upsert({
        where: { key: "WA_BOT_STATUS" },
        update: { value: JSON.stringify(newStatus) },
        create: { key: "WA_BOT_STATUS", value: JSON.stringify(newStatus) },
      });

      return NextResponse.json({
        success: true,
        shouldReset,
      });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error: any) {
    console.error("Error en POST /api/chat/sofia/logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
