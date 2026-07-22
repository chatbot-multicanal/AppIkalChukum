import nodemailer from "nodemailer";

// Configuración de SMTP desde variables de entorno
const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = parseInt(process.env.SMTP_PORT || "465");
const secure = process.env.SMTP_SECURE === "true" || port === 465;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

if (user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false // Evitar errores con certificados autofirmados
    }
  });
}

/**
 * Función genérica para enviar correos electrónicos con fallback a consola en caso de error
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  console.log(`[Notificación por Correo] Intentando enviar a ${to}...`);
  console.log(`Asunto: ${subject}`);
  console.log(`Contenido: ${text}`);

  if (!transporter) {
    console.warn("⚠️ SMTP no está configurado (SMTP_USER y SMTP_PASS requeridos). El correo solo se imprimió en consola.");
    return { success: true, logged: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Ikal Chukum Ventas" <${user}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });

    console.log("✅ Correo enviado con éxito. ID:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error al enviar correo por SMTP:", error);
    // Retornamos éxito simulado para que no rompa el flujo de base de datos
    return { success: false, error };
  }
}

/**
 * Notificación cuando un pedido cambia de estado
 */
export async function sendOrderStatusNotification(order: any, oldStatus: string, newStatus: string) {
  const statusLabels: Record<string, string> = {
    PENDING: "Por Procesar",
    PREPARING: "En Preparación / Surtido",
    SHIPPED: "En Camino / Enviado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
  };

  const clientName = order.quote?.client?.name || "Cliente";
  const clientEmail = order.quote?.client?.email;
  const quoteNumber = order.quote?.quoteNumber || "N/A";
  const warehouseName = order.warehouse?.name || "No asignada";

  const subject = `[Pedido ${quoteNumber}] Estado actualizado a: ${statusLabels[newStatus] || newStatus}`;
  
  let text = `El estado del pedido para la cotización ${quoteNumber} ha cambiado.\n\n`;
  text += `Cliente: ${clientName}\n`;
  text += `Bodega: ${warehouseName}\n`;
  text += `Estado Anterior: ${statusLabels[oldStatus] || oldStatus}\n`;
  text += `Nuevo Estado: ${statusLabels[newStatus] || newStatus}\n\n`;

  if (newStatus === "PREPARING") {
    text += `👉 Atención Bodega: Se ha iniciado el surtido de este pedido. Por favor ingresa al sistema para confirmar la recepción ("Dar por enterado").\n`;
  } else if (newStatus === "SHIPPED") {
    text += `👉 El pedido ha salido de la bodega y va en camino a su destino.\n`;
  }

  text += `\nEste es un correo automático generado por el CRM de Ikal Chukum.`;

  // 1. Notificar a ventas centralizada y admins
  await sendEmail({
    to: "ventas@ikalchukum.com, asf2485@gmail.com, admin@ikalchukum.com",
    subject,
    text,
  });

  // 2. Notificar al cliente si tiene correo
  if (clientEmail) {
    await sendEmail({
      to: clientEmail,
      subject: `Notificación de Envío Ikal Chukum - Pedido ${quoteNumber}`,
      text: `Estimado(a) ${clientName},\n\nLe informamos que su pedido (${quoteNumber}) ha cambiado de estado.\n\nNuevo Estado: ${statusLabels[newStatus] || newStatus}.\n\nCualquier duda o comentario, estamos a su servicio.\n\nAtentamente,\nIkal Chukum`,
    });
  }
}

/**
 * Notificación cuando se añade un comentario en bodega
 */
export async function sendCommentNotification(comment: any, productSku?: string, productName?: string, warehouseName?: string) {
  const authorName = comment.user?.name || "Usuario de Bodega";
  const subject = `[Comentario Bodega] Nuevo comentario en ${warehouseName || "Inventario"}`;
  
  let text = `Se ha registrado un nuevo comentario en el inventario por ${authorName}.\n\n`;
  if (warehouseName) {
    text += `Bodega: ${warehouseName}\n`;
  }
  if (productSku) {
    text += `Producto: ${productName} (SKU: ${productSku})\n`;
  }
  text += `Comentario: "${comment.content}"\n\n`;
  text += `Fecha: ${new Date(comment.createdAt).toLocaleString("es-MX")}\n\n`;
  text += `Revisa los detalles en tu CRM Ikal Chukum.`;

  // Notificar a ventas centralizada y admins
  await sendEmail({
    to: "ventas@ikalchukum.com, asf2485@gmail.com, admin@ikalchukum.com",
    subject,
    text,
  });
}
