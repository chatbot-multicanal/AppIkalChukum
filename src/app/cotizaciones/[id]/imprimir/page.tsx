import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import PrintTrigger from "./PrintTrigger";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ImprimirCotizacionPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Obtener los detalles completos de la cotización
  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      client: true,
      user: true,
      warehouse: true,
      items: {
        include: {
          product: true
        }
      }
    }
  });

  if (!quote) {
    return notFound();
  }

  const isMiami = quote.warehouse?.country === "Estados Unidos" || quote.warehouse?.name.toLowerCase().includes("miami");


  // Configurar metadatos del documento para pre-rellenar el nombre del PDF al guardar
  const dateStr = new Date(quote.createdAt).toISOString().split("T")[0];
  const cleanClientName = quote.client.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
  const pdfTitle = `Ikalchukum cotizacion - ${dateStr} - ${cleanClientName} - ${quote.quoteNumber}`;

  return (
    <div style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 0" }} className="screen-bg">
      {/* Script client-side para cambiar el título del documento y disparar la impresión */}
      <PrintTrigger title={pdfTitle} />

      {/* Barra superior de utilidades (Oculta al imprimir) */}
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
            🖨️ Imprimir o Guardar PDF
          </button>
          <a href="/cotizaciones" style={{ textDecoration: "none" }}>
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
              Volver a Cotizaciones
            </button>
          </a>
        </div>
        <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
          Nombre sugerido: <code>{pdfTitle}.pdf</code>
        </span>
      </div>

      {/* Hoja de Cotización Oficial (Formato Carta con Imagen de Fondo) */}
      <div className="page" style={{ 
        width: "215.9mm", 
        height: "279.4mm", 
        backgroundColor: "#ffffff",
        backgroundImage: "url('/cotizacion-bg.png')",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        position: "relative",
        boxShadow: "0 15px 35px rgba(0,0,0,0.15)",
        fontFamily: "'Outfit', system-ui, sans-serif",
        color: "#374151"
      }}>
        
        {/* 1. Datos del Cliente (Posición Absoluta a la izquierda) */}
        <div style={{ 
          position: "absolute", 
          top: "66mm", 
          left: "24mm", 
          width: "80mm", 
          fontSize: "13px", 
          lineHeight: "1.5",
          color: "#4b5563"
        }}>
          <div style={{ fontWeight: 600, fontSize: "16px", color: "#1f2937", marginBottom: "4px" }}>
            {quote.client.name}
          </div>
          <div style={{ fontSize: "14px", fontWeight: 400 }}>{quote.client.city}, {quote.client.country}</div>
          {quote.client.phone && <div style={{ marginTop: "2px" }}>Tel: {quote.client.phone}</div>}
          {quote.client.email && <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{quote.client.email}</div>}
        </div>

        {/* 2. Metadatos de la Cotización (Posición Absoluta a la derecha) */}
        <div style={{ 
          position: "absolute", 
          top: "66mm", 
          right: "24mm", 
          width: "70mm", 
          fontSize: "13px",
          color: "#4b5563",
          display: "grid",
          gridTemplateColumns: "75px 1fr",
          rowGap: "5px"
        }}>
          <span style={{ fontWeight: 400, color: "#6b7280" }}>Número:</span>
          <span style={{ fontWeight: 600, color: "#1f2937", textAlign: "right" }}>{quote.quoteNumber.split("-")[1] || quote.quoteNumber}</span>
          
          <span style={{ fontWeight: 400, color: "#6b7280" }}>Vendedor:</span>
          <span style={{ fontWeight: 600, color: "#1f2937", textAlign: "right" }}>{quote.user.name}</span>

          <span style={{ fontWeight: 400, color: "#6b7280" }}>fecha:</span>
          <span style={{ fontWeight: 600, color: "#1f2937", textAlign: "right" }}>
            {new Date(quote.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </div>

        {/* 3. Tabla de Productos (Posición Absoluta alineada con el banner verde) */}
        {isMiami ? (
          (() => {
            // Construct table rows
            const tableRows: any[] = [];
            
            // 1. Products
            quote.items.forEach(item => {
              const suffix = item.product.sku.startsWith("KIT-") ? " (3 bags of 45 lb + 1 0.27 gal drum)" : "";
              tableRows.push({
                type: "item",
                quantity: item.quantity,
                description: `${item.product.name.toUpperCase()}${suffix}`,
                unitPrice: item.unitPrice,
                total: item.total
              });
            });

            // 2. Shipping
            if (quote.shippingCost > 0) {
              let carrier = "UPS";
              if (quote.notes) {
                const match = quote.notes.match(/via\s+([a-zA-Z0-9]+)/i) || quote.notes.match(/(UPS|FedEx|DHL|envio\.com|Estafeta|RedPack)/i);
                if (match) {
                  carrier = match[1].toUpperCase();
                }
              }
              tableRows.push({
                type: "shipping",
                quantity: 1,
                description: `Shipping via ${carrier}`,
                unitPrice: quote.shippingCost,
                total: quote.shippingCost
              });
            }

            // Fill with empty rows to have exactly 12 rows before totals (making it exactly 15 rows total)
            const targetItemRows = 12;
            const currentItemRows = tableRows.length;
            const emptyRowsCount = Math.max(0, targetItemRows - currentItemRows);
            
            for (let i = 0; i < emptyRowsCount; i++) {
              tableRows.push({
                type: "empty",
                quantity: null,
                description: "",
                unitPrice: null,
                total: null
              });
            }

            // 3. Totals rows
            const Amount = quote.subtotal + (quote.shippingCost > 0 ? quote.shippingCost : 0);
            const discountPercent = Amount > 0 ? Math.round((quote.discount / Amount) * 100) : 0;

            tableRows.push({
              type: "total_amount",
              label: "Amount",
              value: Amount
            });
            
            tableRows.push({
              type: "total_discount",
              label: `Des %${discountPercent}`,
              value: quote.discount
            });
            
            tableRows.push({
              type: "total_final",
              label: "Total",
              value: quote.total
            });

            return (
              <table style={{ 
                position: "absolute", 
                top: "106mm", 
                left: "24mm", 
                right: "24mm",
                width: "calc(100% - 48mm)",
                height: "125.4mm",
                borderCollapse: "collapse",
                border: "1.5px solid #a4bd91",
                fontFamily: "'Outfit', system-ui, sans-serif",
                color: "#1f2937",
                fontSize: "12.5px",
                tableLayout: "fixed"
              }}>
                <tbody>
                  {tableRows.map((row, idx) => {
                    const isLastRow = idx === tableRows.length - 1;
                    const borderBottomStyle = isLastRow ? "none" : "1.5px solid #a4bd91";

                    if (row.type === "item" || row.type === "shipping" || row.type === "empty") {
                      return (
                        <tr key={idx} style={{ height: "8.36mm", borderBottom: borderBottomStyle }}>
                          {/* Cantidad */}
                          <td style={{ 
                            width: "12%", 
                            borderRight: "1.5px solid #a4bd91", 
                            textAlign: "center", 
                            fontWeight: 600,
                            padding: "4px 0"
                          }}>
                            {row.quantity !== null ? row.quantity.toFixed(0) : ""}
                          </td>
                          {/* Descripción */}
                          <td style={{ 
                            width: "53%", 
                            borderRight: "1.5px solid #a4bd91", 
                            textAlign: "left", 
                            paddingLeft: "12px", 
                            fontWeight: 500,
                            paddingTop: "4px",
                            paddingBottom: "4px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}>
                            {row.description}
                          </td>
                          {/* Precio */}
                          <td style={{ 
                            width: "17%", 
                            borderRight: "1.5px solid #a4bd91", 
                            padding: "0 10px",
                            fontWeight: 500
                          }}>
                            {row.unitPrice !== null ? (
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>$</span>
                                <span>{row.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            ) : ""}
                          </td>
                          {/* Total */}
                          <td style={{ 
                            width: "18%", 
                            padding: "0 10px", 
                            fontWeight: 700, 
                            color: "#1d8088"
                          }}>
                            {row.total !== null ? (
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>$</span>
                                <span>{row.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            ) : ""}
                          </td>
                        </tr>
                      );
                    } else {
                      // Totals row (Amount, Des %, Total)
                      return (
                        <tr key={idx} style={{ height: "8.36mm", borderBottom: borderBottomStyle }}>
                          {/* Empty Cantidad */}
                          <td style={{ width: "12%", borderRight: "1.5px solid #a4bd91" }}></td>
                          {/* Empty Descripción */}
                          <td style={{ width: "53%", borderRight: "1.5px solid #a4bd91" }}></td>
                          {/* Totals Label */}
                          <td style={{ 
                            width: "17%", 
                            borderRight: "1.5px solid #a4bd91", 
                            textAlign: "left", 
                            paddingLeft: "10px", 
                            fontWeight: 600,
                            color: row.type === "total_discount" ? "#e11d48" : "#1f2937"
                          }}>
                            {row.label}
                          </td>
                          {/* Totals Value */}
                          <td style={{ 
                            width: "18%", 
                            padding: "0 10px", 
                            fontWeight: 700, 
                            color: row.type === "total_discount" ? "#e11d48" : "#1d8088"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span>$</span>
                              <span>{row.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            );
          })()
        ) : (
          <div style={{ 
            position: "absolute", 
            top: "106mm", 
            left: "24mm", 
            right: "24mm",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            {quote.items.map((item, idx) => (
              <div key={item.id} style={{ 
                display: "flex", 
                width: "100%", 
                fontSize: "14px", 
                borderBottom: "1px solid #f3f4f6", 
                paddingBottom: "10px", 
                alignItems: "center" 
              }}>
                {/* Cantidad (Centrado en la primera columna del banner) */}
                <div style={{ width: "23%", textAlign: "center", fontWeight: 600, color: "#1f2937" }}>
                  {item.quantity.toFixed(0)}
                </div>
                
                {/* Descripción (Alineado izquierda) */}
                <div style={{ width: "42%", textAlign: "left", color: "#1f2937", fontWeight: 500, paddingLeft: "10px" }}>
                  {item.product.name.toUpperCase()}
                  {item.product.color && (
                    <span style={{ fontSize: "10px", color: "#6b7280", display: "block", marginTop: "1px" }}>
                      COLOR: {item.product.color.toUpperCase()}
                    </span>
                  )}
                </div>
                
                {/* Precio (Derecha) */}
                <div style={{ width: "17%", textAlign: "right", color: "#4b5563" }}>
                  ${item.unitPrice.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                </div>
                
                {/* Total (Derecha en la última columna) */}
                <div style={{ width: "18%", textAlign: "right", fontWeight: 700, color: "#1d8088" }}>
                  ${item.total.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. Datos de Transferencia (A la izquierda abajo, en el espacio libre) */}
        {isMiami && (
          <div style={{ 
            position: "absolute", 
            bottom: "48mm", 
            left: "24mm", 
            width: "82mm", 
            fontSize: "11px", 
            color: "#6b7280", 
            lineHeight: "1.4",
            background: "rgba(164, 189, 145, 0.05)",
            border: "1px dashed rgba(29, 128, 136, 0.2)",
            padding: "10px 12px",
            borderRadius: "8px"
          }}>
            <div style={{ fontWeight: 700, fontSize: "11px", color: "#1d8088", marginBottom: "4px", textTransform: "uppercase" }}>
              Datos para Transferencia
            </div>
            <div><strong>Banco:</strong> CHASE BANK</div>
            <div><strong>Tipo de cuenta:</strong> Business Complete Checking</div>
            <div><strong>Número de cuenta:</strong> 2909302679</div>
            <div><strong>Routing Number:</strong> 111000614</div>
            <div style={{ marginTop: "3px", fontSize: "9.5px", fontStyle: "italic" }}>
              Favor de enviar su comprobante de pago.
            </div>
          </div>
        )}

        {/* 4b. Observaciones y Entrega (A la izquierda abajo, arriba de transferencia) */}
        {(quote.notes || quote.deliveryMethod) && (
          <div style={{ 
            position: "absolute", 
            bottom: "76mm", 
            left: "24mm", 
            width: "82mm", 
            fontSize: "11px", 
            color: "#6b7280", 
            lineHeight: "1.4",
            background: "rgba(29, 128, 136, 0.03)",
            border: "1px dashed rgba(164, 189, 145, 0.3)",
            padding: "10px 12px",
            borderRadius: "8px"
          }}>
            {quote.deliveryMethod && (
              <div style={{ marginBottom: "4px" }}>
                <strong>Método de Entrega:</strong>{" "}
                {quote.deliveryMethod === "RECOLECTA" ? "🏢 Recolecta Local (Bodega)" : "🚚 Envío a Domicilio"}
              </div>
            )}
            {quote.notes && (
              <div style={{ wordBreak: "break-word" }}>
                <strong>Observaciones:</strong> {quote.notes}
              </div>
            )}
          </div>
        )}

        {/* 5. Bloque de Totales (Posición Absoluta a la derecha abajo) */}
        {!isMiami && (
          <div style={{ 
            position: "absolute", 
            bottom: "48mm", 
            right: "24mm", 
            width: "65mm", 
            fontSize: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#4b5563" }}>
              <span style={{ fontWeight: 500 }}>SUBTOTAL</span>
              <span style={{ fontWeight: 600 }}>${quote.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {quote.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#e11d48" }}>
                <span style={{ fontWeight: 500 }}>DESCUENTO</span>
                <span style={{ fontWeight: 600 }}>-${quote.discount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {quote.shippingCost > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#4b5563" }}>
                <span style={{ fontWeight: 500 }}>ENVÍO</span>
                <span style={{ fontWeight: 600 }}>${quote.shippingCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: "#4b5563" }}>
              <span style={{ fontWeight: 500 }}>IVA (16%)</span>
              <span style={{ fontWeight: 600 }}>${quote.tax.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              fontSize: "15px", 
              fontWeight: 700, 
              color: "#1d8088",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "6px",
              marginTop: "2px"
            }}>
              <span>TOTAL</span>
              <span>${quote.total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {quote.currency}</span>
            </div>
          </div>
        )}


      </div>

      {/* Google Font link */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* CSS para la impresión y visualización */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print {
            display: none !important;
          }
          .screen-bg {
            background-color: white !important;
            padding: 0 !important;
          }
          .page {
            width: 215.9mm !important;
            height: 279.4mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always;
            page-break-inside: avoid;
            background-image: url('/cotizacion-bg.png') !important;
            background-size: 100% 100% !important;
            background-repeat: no-repeat !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
    </div>
  );
}
