import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import PrintTrigger from "@/app/cotizaciones/[id]/imprimir/PrintTrigger";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ImprimirNotaPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Obtener el pedido completo poblado
  const order = await db.order.findUnique({
    where: { id },
    include: {
      warehouse: true,
      quote: {
        include: {
          client: true,
          user: true,
          items: {
            include: {
              product: true
            }
          }
        }
      }
    }
  });

  if (!order) {
    return notFound();
  }

  const dateStr = new Date(order.createdAt).toISOString().split("T")[0];
  const cleanClientName = order.quote.client.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
  const pdfTitle = `Nota_de_Empaque_Ikal - ${dateStr} - ${cleanClientName} - ${order.quote.quoteNumber}`;

  return (
    <div style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 0" }} className="screen-bg">
      <PrintTrigger title={pdfTitle} />

      {/* Barra de utilidades (Oculta al imprimir) */}
      <div className="no-print" style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        width: "215.9mm", 
        marginBottom: "20px", 
        padding: "16px 24px", 
        background: "rgba(12, 15, 23, 0.8)", 
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "16px",
        color: "white",
        fontFamily: "'Outfit', system-ui, sans-serif"
      }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <button 
            style={{ 
              backgroundColor: "#1d8088", 
              color: "white", 
              border: "none", 
              padding: "10px 20px", 
              borderRadius: "10px", 
              fontSize: "0.85rem", 
              fontWeight: 700, 
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(29,128,136,0.3)"
            }}
            id="print-btn-trigger"
          >
            🖨️ Imprimir Nota de Empaque
          </button>
          <a href="/pedidos" style={{ textDecoration: "none" }}>
            <button style={{ 
              backgroundColor: "rgba(255,255,255,0.06)", 
              color: "#a4bd91", 
              border: "1px solid rgba(255,255,255,0.1)", 
              padding: "9px 18px", 
              borderRadius: "10px", 
              fontSize: "0.85rem", 
              fontWeight: 700, 
              cursor: "pointer"
            }}>
              Volver a Pedidos
            </button>
          </a>
        </div>
        <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
          PDF: <code>{pdfTitle}.pdf</code>
        </span>
      </div>

      {/* Hoja de Impresión tamaño Carta */}
      <div className="page" style={{ 
        width: "215.9mm", 
        height: "279.4mm", 
        backgroundColor: "#ffffff",
        padding: "20mm 20mm",
        boxShadow: "0 15px 35px rgba(0,0,0,0.15)",
        fontFamily: "'Outfit', system-ui, sans-serif",
        color: "#374151",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative"
      }}>
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body { background-color: #ffffff !important; }
            .screen-bg { background-color: #ffffff !important; padding: 0 !important; }
            .no-print { display: none !important; }
            .page { box-shadow: none !important; margin: 0 !important; border: none !important; padding: 15mm 15mm !important; }
          }
        `}} />

        <div>
          {/* Encabezado */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #a4bd91", paddingBottom: "15px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src="/logo.png" alt="Ikal" style={{ width: "50px", height: "50px", objectFit: "contain" }} />
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.5px" }}>IKAL CHUKUM</h1>
                <span style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Materiales de Construcción de Alta Gama</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1d8088", margin: "0 0 4px 0" }}>NOTA DE EMPAQUE</h2>
              <span style={{ fontSize: "12px", color: "#4b5563" }}>Pedido: <strong>{order.quote.quoteNumber}</strong></span>
            </div>
          </div>

          {/* Bloques de Direcciones */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginBottom: "30px", fontSize: "13px", lineHeight: "1.4" }}>
            <div>
              <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#1f2937", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px", marginBottom: "8px", textTransform: "uppercase" }}>Dirección de Salida (Remitente):</h3>
              <strong>Bodega de Surtido:</strong> {order.warehouse?.name || "Ikal Warehouse"}<br />
              {order.warehouse?.address && <>{order.warehouse.address}<br /></>}
              {order.warehouse?.city && <>{order.warehouse.city}, {order.warehouse.state} {order.warehouse.zip}<br /></>}
              {order.warehouse?.country && <>{order.warehouse.country}<br /></>}
            </div>
            <div>
              <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#1f2937", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px", marginBottom: "8px", textTransform: "uppercase" }}>Dirección de Entrega (Destinatario):</h3>
              <strong>Cliente:</strong> {order.quote.client.name}<br />
              {order.quote.client.company && <>{order.quote.client.company}<br /></>}
              {order.quote.client.address && <>{order.quote.client.address}<br /></>}
              {order.quote.client.city && <>{order.quote.client.city}, {order.quote.client.state} {order.quote.client.zip}<br /></>}
              {order.quote.client.country && <>{order.quote.client.country}<br /></>}
              {order.quote.client.phone && <>Tel: {order.quote.client.phone}<br /></>}
            </div>
          </div>

          {/* Detalles de Envío */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 16px", marginBottom: "30px", fontSize: "12px" }}>
            <div>
              <span style={{ color: "#6b7280", display: "block", marginBottom: "2px" }}>Fecha del Pedido:</span>
              <strong>{new Date(order.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</strong>
            </div>
            <div>
              <span style={{ color: "#6b7280", display: "block", marginBottom: "2px" }}>Empresa de Envío:</span>
              <strong>{order.quote.shippingCarrier || (order.quote.deliveryMethod === "RECOLECTA" ? "Cliente Recolecta" : "Envío Estándar")}</strong>
            </div>
            <div>
              <span style={{ color: "#6b7280", display: "block", marginBottom: "2px" }}>Número de Guía (Tracking):</span>
              <strong style={{ fontFamily: "monospace", fontSize: "11px" }}>{order.trackingNumber || "N/A"}</strong>
            </div>
            <div>
              <span style={{ color: "#6b7280", display: "block", marginBottom: "2px" }}>Tiempo Estimado:</span>
              <strong>{order.quote.shippingDuration || "N/A"}</strong>
            </div>
          </div>

          {/* Tabla de Productos */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#1d8088", color: "white" }}>
                <th style={{ padding: "10px 14px", borderTopLeftRadius: "6px", borderBottomLeftRadius: "6px" }}>SKU</th>
                <th style={{ padding: "10px 14px" }}>Descripción del Producto</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Cant. Pedida</th>
                <th style={{ padding: "10px 14px", textAlign: "center", borderTopRightRadius: "6px", borderBottomRightRadius: "6px" }}>Verificado</th>
              </tr>
            </thead>
            <tbody>
              {order.quote.items.map((item, index) => {
                const bg = index % 2 === 0 ? "#ffffff" : "#f9fafb";
                return (
                  <tr key={item.id} style={{ backgroundColor: bg, borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>{item.product.sku}</td>
                    <td style={{ padding: "12px 14px" }}>{item.product.name}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700 }}>{item.quantity.toFixed(1)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ width: "18px", height: "18px", border: "2px solid #a4bd91", borderRadius: "4px", margin: "0 auto" }}></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer y firmas */}
        <div style={{ borderTop: "2px solid #e5e7eb", paddingTop: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "flex-end" }}>
            <div style={{ fontSize: "11px", color: "#6b7280", lineHeight: "1.4" }}>
              <strong>Notas para Almacén / Surtidor:</strong><br />
              1. Validar que las cantidades coincidan antes del sellado.<br />
              2. Incluir el instructivo de aplicación de Chukum correspondiente.<br />
              3. Marcar con una check-mark una vez colocado el material en el empaque.<br />
              {order.quote.notes && <><br /><strong>Indicaciones Especiales:</strong> {order.quote.notes}</>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "60mm", borderBottom: "1px solid #9ca3af", height: "15mm", marginBottom: "6px" }}></div>
              <span style={{ fontSize: "11px", color: "#4b5563", fontWeight: 700, textTransform: "uppercase" }}>Firma del Surtidor</span>
              <span style={{ fontSize: "9px", color: "#9ca3af" }}>Responsable de Bodega</span>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: "30px", fontSize: "10px", color: "#9ca3af" }}>
            IKAL CHUKUM LLC • Miami, Florida • info@ikalchukum.com • www.ikalchukum.com
          </div>
        </div>
      </div>
    </div>
  );
}
