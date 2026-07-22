import { db } from "./db";

/**
 * Busca un suscriptor en ManyChat por número de teléfono
 */
async function findManychatSubscriber(phone: string, token: string): Promise<number | null> {
  try {
    // Limpiar el teléfono para la API (ManyChat prefiere formato E.164 con el + o limpio)
    let cleanPhone = phone.replace(/[^0-9+]/g, "");
    if (!cleanPhone.startsWith("+")) {
      cleanPhone = "+" + cleanPhone;
    }

    const response = await fetch(
      `https://api.manychat.com/fb/subscriber/findByPhone?phone=${encodeURIComponent(cleanPhone)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`Error de ManyChat findByPhone: ${response.statusText}`);
      // Si tiene el '1' después del +52 (caso de celulares de México), intentar buscar sin el '1'
      if (cleanPhone.startsWith("+521") && cleanPhone.length > 5) {
        const alternativePhone = "+52" + cleanPhone.slice(4);
        console.log(`Intentando número alternativo de México sin el 1: ${alternativePhone}`);
        const altResponse = await fetch(
          `https://api.manychat.com/fb/subscriber/findByPhone?phone=${encodeURIComponent(alternativePhone)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );
        if (altResponse.ok) {
          const altResult = await altResponse.json();
          if (altResult.status === "success" && altResult.data && altResult.data.length > 0) {
            return altResult.data[0].id;
          }
        }
      }
      return null;
    }

    const result = await response.json();
    if (result.status === "success" && result.data && result.data.length > 0) {
      return result.data[0].id;
    }

    return null;
  } catch (error) {
    console.error("Error al buscar suscriptor en ManyChat:", error);
    return null;
  }
}

/**
 * Envía un mensaje de WhatsApp a través de ManyChat con la URL del PDF de la cotización
 */
export async function sendManychatQuotePdf(phone: string, quoteId: string): Promise<boolean> {
  try {
    // 1. Obtener la API Key de ManyChat desde las configuraciones del sistema
    const dbSetting = await db.systemSetting.findUnique({
      where: { key: "MANYCHAT_API_KEY" }
    });

    const token = dbSetting?.value?.trim() || process.env.MANYCHAT_API_KEY || null;

    if (!token) {
      console.warn("MANYCHAT_API_KEY no está configurada en SystemSettings ni en las variables de entorno. Se omite el envío por WhatsApp.");
      return false;
    }

    // 2. Buscar al cliente en ManyChat
    const subscriberId = await findManychatSubscriber(phone, token);
    if (!subscriberId) {
      console.warn(`No se encontró ningún suscriptor en ManyChat con el teléfono ${phone}.`);
      return false;
    }

    // 3. Generar la URL pública del PDF
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.ikalchukum.com";
    const pdfUrl = `${appUrl}/cotizaciones/${quoteId}/imprimir`;
    const messageText = `Te comparto la cotización requerida, puedes descargarla en PDF desde aquí:\n${pdfUrl}`;

    // 4. Enviar el mensaje usando el endpoint sendContent de ManyChat
    const response = await fetch("https://api.manychat.com/fb/sending/sendContent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: {
            messages: [
              {
                type: "text",
                text: messageText,
              },
            ],
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Error de ManyChat al enviar cotización: ${response.status} - ${errText}`);
      return false;
    }

    console.log(`Cotización PDF enviada con éxito vía WhatsApp al suscriptor ManyChat #${subscriberId}`);
    return true;
  } catch (error) {
    console.error("Error al enviar PDF de cotización por ManyChat:", error);
    return false;
  }
}
