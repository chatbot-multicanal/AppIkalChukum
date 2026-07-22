import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mail";

const SOFIA_SYSTEM_PROMPT = `
# LA BIBLIA DE SOFÍA
## Sistema Operativo Oficial de la Asesora de IKAL CHUKUM

Eres SOFÍA, asesora oficial de IKAL CHUKUM. Eres especialista en acabados naturales para arquitectura contemporánea (Chukum Maya).
Tu misión es ayudar de forma elegante, profesional, empática y honesta. No intentes vender de forma agresiva. Tu asesoría guiará la venta.

### REGLAS DE IDENTIDAD Y ESTILO:
- Habla siempre con naturalidad, educación y elegancia.
- **Saludo de Bienvenida**: Cuando el cliente te salude por primera vez o inicie la conversación (ej. con "hola", "hola sofia", "buenos días", etc.), utiliza siempre una bienvenida elegante, cálida y premium como esta:
  "✨ ¡Hola! Qué gusto saludarte. Soy Sofía, asesora de **IKAL CHUKUM**. 🏛️
  
  Me especializo en acabados naturales de Chukum Maya para diseñar espacios únicos, con texturas orgánicas y elegancia atemporal.
  
  ¿En qué te puedo ayudar hoy? Si gustas puedo mostrarte nuestros tonos de Chukum, ayudarte a calcular el material que necesitas para tu obra, o preparar una cotización."
- NUNCA digas "Como inteligencia artificial...", "No sé", o "Busca en Google". Si no sabes algo, di: "Permíteme verificar esa información con nuestro equipo para ofrecerte una respuesta precisa".
- Nunca des respuestas robóticas o prefabricadas idénticas.
- Adapta tu lenguaje al tipo de cliente:
  - Arquitectos/Diseñadores: Habla de textura, composición, luz, estética, materialidad.
  - Constructores: Rendimiento, tiempos de secado, compatibilidad, practicidad.
  - Instaladores: Herramientas, preparación de mezclas, curado, buenas prácticas.
  - Clientes finales: Belleza, durabilidad, tranquilidad, bajo mantenimiento.

### CONOCIMIENTO DE IKAL CHUKUM:
- Especializados en acabados naturales inspirados en el Chukum Maya ancestral.
- El nombre: IKAL (Espíritu en maya) + CHUKUM (árbol de origen). Significa "El Espíritu del Chukum".
- Mérida, México: Planta de producción y oficinas centrales.
- Miami, Estados Unidos: Centro de distribución en "10850 NW 21st Street, Suite 210, Miami, FL 33172" (Operado por RCB Logistic Corp). Distribuimos a todo EE.UU. desde aquí.

### PRODUCTO Y RENDIMIENTOS:
- El Chukum es natural. El acabado final es continuo, de textura mineral, con vetas y variaciones naturales de tono e iluminación que forman parte de su belleza única y artesanal. No es pintura ni acabado plástico uniforme.
- El sistema consiste en polvo (sacos de polvo de cemento y piedra caliza formulada) y agua (resina líquida de la corteza del árbol de Chukum).
- Rendimiento por kit (sistema completo):
  - Revoco (cemento-arena): 4 a 6 m² por kit (usar promedio de 5 m² para calcular).
  - Masilla / Skim Coat / Stucco: 8 a 10 m² por kit (usar promedio de 9 m² para calcular).
  - Tablaroca / Drywall: 13 a 15 m² por kit (usar promedio de 14 m² para calcular).
- Paleta de Colores: Natural (atemporal/orgánico), Azul Maya, Verde Jade, Gris, Negro, Amarillo Hacienda, Palo de Rosa, Rojo, Tierra Café, Tierra Rojizo.
- IMPORTANTE: Cuando el cliente te pregunte qué colores tienes, qué colores manejas o te pida la paleta de colores, utiliza EXACTAMENTE la siguiente redacción, emojis y formato para responder:
  
  "🎨 *Nuestra Paleta de Colores IKAL CHUKUM*

  Cada color transmite una personalidad única para crear espacios auténticos.

  🤍 *Natural* 🌿
  ✨ Atemporal y orgánico
  #IK-NAT

  💙 *Azul Maya* 🏛️
  Inspirado en el legado maya.
  #IK-MAYA

  💚 *Verde Jade* 💎
  Elegancia natural y frescura.
  #IK-JADE

  🩶 *Gris* 🪨
  Sobriedad y sofisticación.
  #IK-GRIS

  🖤 *Negro* ⛰️
  Profundidad y carácter.
  #IK-NEGRO

  💛 *Amarillo Hacienda* ☀️
  Calidez y tradición.
  #IK-HACIENDA

  🩷 *Palo de Rosa* 🌹
  Delicadeza y armonía.
  #IK-ROSA

  ❤️ *Rojo* 🔥
  Energía y personalidad.
  #IK-ROJO

  🤎 *Tierra Café* 🍂
  Conexión con la naturaleza.
  #IK-CAFE

  🧡 *Tierra Rojizo* 🏺
  Calidez artesanal.
  #IK-ROJIZO

  📖 Conoce todos los tonos y aplicaciones aquí: https://www.instagram.com/ikalchukum/

  Te comparto nuestra paleta oficial de colores justo aquí abajo en imagen: 👇"
  
  (Nota: NO incluyas ningún otro enlace de imagen o archivo en tu texto, ya que la imagen física de la paleta se enviará de forma automática abajo mediante el sistema).

### PROCESO DE APLICACIÓN Y SOPORTE:
- La superficie debe estar completamente limpia, seca, libre de polvo, grasa o humedad previa.
- Se debe curar humedeciendo la superficie con atomizador de agua limpia para asegurar el endurecimiento.
- Si hay humedad previa en el muro, se debe solucionar la causa antes de aplicar el Chukum.
- Se recomienda contratar instaladores certificados por IKAL para proyectos importantes.

### VIDEOS Y FICHAS TÉCNICAS:
- **Cómo instalar Chukum** (Video tutorial de instalación): https://youtu.be/4sgnxCSVgHI?si=B0q3qqvxMn5msJf2
- **Qué es el Chukum / Presentación de IKAL Chukum**:
  - Video en Español: https://youtu.be/xI2_mGrTB6w?si=GmeYcx3PDqKpQD_l
  - Video en Inglés: https://youtu.be/xI2_mGrTB6w?si=HOyMRTqxE7zaoKC9
- **Fichas Técnicas de los Productos**: https://www.ikalchukum.com/fichas-tecnicas
- Comparte estos enlaces de forma natural y amigable siempre que los clientes pregunten por instalación, explicaciones del producto o fichas técnicas.

### INSTRUCCIONES DE HERRAMIENTAS (ACTIONS):
Tienes a tu disposición herramientas que puedes invocar automáticamente para responder al cliente:
1. Si el cliente tiene un proyecto en México y solicita una cotización, pídele su nombre completo, ciudad, metros cuadrados, tipo de superficie (revoco, masilla o tablaroca) y color de Chukum de su elección, e invoca 'solicitar_cotizacion_mexico'.
2. Si el cliente tiene un proyecto en Estados Unidos y solicita una cotización, pídele su nombre completo, ciudad, código postal de EE.UU. (ZIP), metros cuadrados, tipo de superficie (revoco, masilla o tablaroca) y color de Chukum de su elección, e invoca 'solicitar_cotizacion_usa'.
3. Si el cliente te pregunta cuántos kits necesita (sin registrarse o cotizar aún), pregúntale los metros cuadrados y la superficie, e invoca 'calcular_material'.
4. Si el cliente pregunta si hay stock en Miami o Mérida de algún color, invoca 'consultar_inventario'.
5. Si el cliente te da sus datos personales únicamente para registrarse como contacto (sin solicitar cotización todavía), invoca 'registrar_cliente'.
`;

export async function POST(request: Request) {
  try {
    const { message, phone, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "El mensaje es requerido" }, { status: 400 });
    }

    let sofiaAlertaAdmin = "";

    let apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      const dbSetting = await db.systemSetting.findUnique({
        where: { key: "OPENAI_API_KEY" }
      });
      if (dbSetting && dbSetting.value.trim() !== "") {
        apiKey = dbSetting.value.trim();
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "La API Key de OpenAI no está configurada en las variables de entorno ni en la base de datos." },
        { status: 500 }
      );
    }

    // Preparar el listado de mensajes para la API
    const messages = [
      { role: "system", content: SOFIA_SYSTEM_PROMPT },
      ...conversationHistory.slice(-10), // Tomar los últimos 10 mensajes del historial
      { role: "user", content: message }
    ];

    // Definición de las herramientas (Tools) para OpenAI
    const tools = [
      {
        type: "function",
        function: {
          name: "registrar_cliente",
          description: "Registra un nuevo lead o cliente en la base de datos de IKAL CHUKUM.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre completo del cliente." },
              city: { type: "string", description: "Ciudad de ubicación del proyecto." },
              country: { type: "string", enum: ["México", "Estados Unidos"], description: "País del proyecto." },
              email: { type: "string", description: "Correo electrónico del cliente (opcional)." },
              phone: { type: "string", description: "Número de teléfono de contacto (opcional)." },
              company: { type: "string", description: "Empresa o estudio de arquitectura/construcción (opcional)." }
            },
            required: ["name", "city", "country"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "solicitar_cotizacion_mexico",
          description: "Registra un prospecto en México que requiere cotización manual personalizada e informa a ventas.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre completo del cliente." },
              city: { type: "string", description: "Ciudad del proyecto." },
              m2: { type: "number", description: "Metros cuadrados totales de la obra." },
              tipoSuperficie: { type: "string", enum: ["revoco", "masilla", "tablaroca"], description: "Superficie de aplicación." },
              color: { type: "string", description: "Color de acabado Chukum deseado." },
              email: { type: "string", description: "Correo de contacto (opcional)." },
              phone: { type: "string", description: "Teléfono de contacto (opcional)." },
              company: { type: "string", description: "Empresa o constructora (opcional)." }
            },
            required: ["name", "city", "m2", "tipoSuperficie", "color"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "solicitar_cotizacion_usa",
          description: "Crea una cotización en borrador para Estados Unidos (bodega Miami) pendiente de flete y aprobación administrativa.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre completo del cliente." },
              city: { type: "string", description: "Ciudad del proyecto." },
              zip: { type: "string", description: "Código Postal de EE.UU. (necesario para cotizar flete)." },
              m2: { type: "number", description: "Metros cuadrados totales de la obra." },
              tipoSuperficie: { type: "string", enum: ["revoco", "masilla", "tablaroca"], description: "Superficie de aplicación." },
              color: { type: "string", description: "Color de acabado Chukum deseado." },
              email: { type: "string", description: "Correo de contacto (opcional)." },
              phone: { type: "string", description: "Teléfono de contacto (opcional)." },
              company: { type: "string", description: "Empresa o constructora (opcional)." },
              address: { type: "string", description: "Dirección de envío (opcional)." }
            },
            required: ["name", "city", "zip", "m2", "tipoSuperficie", "color"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_inventario",
          description: "Consulta las existencias en inventario de un producto o color en una bodega.",
          parameters: {
            type: "object",
            properties: {
              warehouseName: { type: "string", enum: ["Mérida", "Miami"], description: "Nombre de la bodega." },
              skuOrColor: { type: "string", description: "SKU o nombre del color (ej. Azul Maya, Gris, Natural, etc.)." }
            },
            required: ["warehouseName", "skuOrColor"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "calcular_material",
          description: "Calcula los kits estimados necesarios a partir de metros cuadrados y tipo de superficie.",
          parameters: {
            type: "object",
            properties: {
              m2: { type: "number", description: "Metros cuadrados totales de la obra." },
              tipoSuperficie: { type: "string", enum: ["revoco", "masilla", "tablaroca"], description: "Tipo de superficie (revoco, masilla o tablaroca)." }
            },
            required: ["m2", "tipoSuperficie"]
          }
        }
      }
    ];

    // Llamada inicial a OpenAI Chat Completions
    let openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto"
      })
    });

    if (!openAiResponse.ok) {
      const errorData = await openAiResponse.json();
      console.error("OpenAI Error:", errorData);
      
      try {
        await db.auditLog.create({
          data: {
            entity: "SofiaChat",
            entityId: "OpenAIError",
            action: "ERROR",
            details: JSON.stringify({ errorData, body: { message, phone } })
          }
        });
      } catch (dbErr) {
        console.error("Failed to log OpenAI error:", dbErr);
      }

      return NextResponse.json({ error: "Error al comunicarse con la IA de OpenAI" }, { status: 500 });
    }

    let responseData = await openAiResponse.json();
    let choice = responseData.choices[0];

    // Si la IA decide llamar a alguna función
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      const toolCalls = choice.message.tool_calls;
      const systemMessages = [...messages, choice.message];

      for (const call of toolCalls) {
        const functionName = call.function.name;
        const args = JSON.parse(call.function.arguments);
        let result: any = {};

        console.log(`[Sofía IA] Ejecutando función '${functionName}' con argumentos:`, args);

        if (functionName === "registrar_cliente") {
          try {
            const clientPhone = args.phone || phone || null;
            // Validar duṕlicados por nombre, correo o teléfono
            const existing = await db.client.findFirst({
              where: {
                active: true,
                OR: [
                  { name: { equals: args.name.trim(), mode: "insensitive" } },
                  args.email ? { email: { equals: args.email.trim().toLowerCase(), mode: "insensitive" } } : undefined,
                  clientPhone ? { phone: clientPhone } : undefined
                ].filter(Boolean) as any
              }
            });

            if (existing) {
              result = { success: false, message: `El cliente ya se encuentra registrado (ID: ${existing.id}).` };
            } else {
              const newClient = await db.client.create({
                data: {
                  name: args.name.trim(),
                  city: args.city.trim(),
                  country: args.country.trim(),
                  email: args.email?.trim().toLowerCase() || null,
                  phone: clientPhone,
                  company: args.company?.trim() || null,
                  active: true
                }
              });
              result = { success: true, clientId: newClient.id, message: "Cliente registrado con éxito en el ERP." };
            }
          } catch (e: any) {
            result = { success: false, error: e.message };
          }
        } 
        
        else if (functionName === "solicitar_cotizacion_mexico") {
          try {
            const clientPhone = args.phone || phone || null;
            let client = await db.client.findFirst({
              where: {
                active: true,
                OR: [
                  { name: { equals: args.name.trim(), mode: "insensitive" } },
                  args.email ? { email: { equals: args.email.trim().toLowerCase(), mode: "insensitive" } } : undefined,
                  clientPhone ? { phone: clientPhone } : undefined
                ].filter(Boolean) as any
              }
            });

            if (!client) {
              client = await db.client.create({
                data: {
                  name: args.name.trim(),
                  city: args.city.trim(),
                  country: "México",
                  email: args.email?.trim().toLowerCase() || null,
                  phone: clientPhone,
                  company: args.company?.trim() || null,
                  active: true
                }
              });
            }

            await db.auditLog.create({
              data: {
                entity: "Client",
                entityId: client.id,
                action: "CREATE_PROSPECT_MEXICO",
                details: JSON.stringify({
                  m2: args.m2,
                  tipoSuperficie: args.tipoSuperficie,
                  color: args.color
                })
              }
            });

            await sendEmail({
              to: "ventas@ikalchukum.com, asf2485@gmail.com, admin@ikalchukum.com",
              subject: `[Prospecto México] Nueva solicitud de cotización manual`,
              text: `Se ha registrado un prospecto en México que requiere una cotización personalizada:\n\n` +
                `- Cliente: ${args.name.trim()}\n` +
                `- Ciudad: ${args.city.trim()}\n` +
                `- Teléfono: ${clientPhone || "No proporcionado"}\n` +
                `- Correo: ${args.email?.trim().toLowerCase() || "No proporcionado"}\n` +
                `- Empresa/Estudio: ${args.company?.trim() || "No especificado"}\n` +
                `- Metraje: ${args.m2} m²\n` +
                `- Superficie: ${args.tipoSuperficie}\n` +
                `- Color deseado: ${args.color}\n\n` +
                `Por favor ponte en contacto para procesar la cotización manual.`
            });

            sofiaAlertaAdmin = `🚨 Nuevo Prospecto registrado para México: ${args.name.trim()} (${args.city.trim()}). Requiere cotización manual de ${args.m2} m² (${args.tipoSuperficie}) en color ${args.color}.`;

            result = {
              success: true,
              message: "Tu solicitud ha sido registrada en nuestro sistema de México. Un asesor comercial especializado se pondrá en contacto contigo a la brevedad para enviarte la propuesta personalizada."
            };
          } catch (e: any) {
            result = { success: false, error: e.message };
          }
        }

        else if (functionName === "solicitar_cotizacion_usa") {
          try {
            const clientPhone = args.phone || phone || null;
            let client = await db.client.findFirst({
              where: {
                active: true,
                OR: [
                  { name: { equals: args.name.trim(), mode: "insensitive" } },
                  args.email ? { email: { equals: args.email.trim().toLowerCase(), mode: "insensitive" } } : undefined,
                  clientPhone ? { phone: clientPhone } : undefined
                ].filter(Boolean) as any
              }
            });

            if (!client) {
              client = await db.client.create({
                data: {
                  name: args.name.trim(),
                  city: args.city.trim(),
                  country: "Estados Unidos",
                  zip: args.zip.trim(),
                  address: args.address?.trim() || null,
                  email: args.email?.trim().toLowerCase() || null,
                  phone: clientPhone,
                  company: args.company?.trim() || null,
                  active: true
                }
              });
            }

            const warehouse = await db.warehouse.findFirst({
              where: {
                active: true,
                OR: [
                  { name: { contains: "Miami", mode: "insensitive" } },
                  { city: { contains: "Miami", mode: "insensitive" } }
                ]
              }
            });

            if (!warehouse) {
              throw new Error("Bodega de Miami no encontrada para cotizaciones de EE.UU.");
            }

            const adminUser = await db.user.findFirst({
              where: { role: "ADMIN", active: true }
            });

            if (!adminUser) {
              throw new Error("Usuario administrador no encontrado en el ERP.");
            }

            let divisor = 5; 
            if (args.tipoSuperficie === "masilla") divisor = 9;
            if (args.tipoSuperficie === "tablaroca") divisor = 14;
            const kits = Math.ceil(args.m2 / divisor);

            let sku = "KIT-NAT-001"; 
            const lowerColor = args.color.toLowerCase();
            if (lowerColor.includes("gris")) sku = "KIT-GRS-002";
            else if (lowerColor.includes("rosa") || lowerColor.includes("palo")) sku = "KIT-PDR-003";
            else if (lowerColor.includes("azul") || lowerColor.includes("maya")) sku = "KIT-AZM-004";
            else if (lowerColor.includes("verde") || lowerColor.includes("jade")) sku = "KIT-VJD-005";
            else if (lowerColor.includes("amarillo") || lowerColor.includes("hacienda")) sku = "KIT-AMH-006";
            else if (lowerColor.includes("rojo") || lowerColor.includes("pixoy")) sku = "KIT-PXR-007";
            else if (lowerColor.includes("negro")) sku = "KIT-NGR-008";
            else if (lowerColor.includes("tierra") || lowerColor.includes("caf") || lowerColor.includes("rojiz")) sku = "KIT-TRA-009";

            const product = await db.product.findUnique({
              where: { sku }
            });

            if (!product) {
              throw new Error(`Producto con SKU ${sku} no encontrado en el catálogo.`);
            }

            const itemPrice = product.basePrice;
            const subtotal = kits * itemPrice;
            const tax = 0; 
            const total = subtotal;

            const count = await db.quote.count();
            const cleanClientName = args.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15);
            const dateStr = new Date().toISOString().split("T")[0];
            const quoteNumber = `COT-${String(count + 101).padStart(4, "0")}-${cleanClientName}-${dateStr}`;

            const quote = await db.$transaction(async (tx) => {
              return await tx.quote.create({
                data: {
                  quoteNumber,
                  clientId: client.id,
                  userId: adminUser.id,
                  warehouseId: warehouse.id,
                  status: "DRAFT", 
                  currency: "USD",
                  exchangeRate: 1.0,
                  subtotal,
                  shippingCost: 0,
                  discount: 0,
                  tax,
                  total,
                  deliveryMethod: "ENVIO",
                  notes: `Creada por Asesora Sofía vía WhatsApp. CP: ${args.zip}. Requiere cotización de flete y aprobación administrativa.`,
                  shippingQuoteStatus: "PENDING_MIAMI",
                  items: {
                    create: [
                      {
                        productId: product.id,
                        quantity: kits,
                        unitPrice: itemPrice,
                        total: subtotal
                      }
                    ]
                  }
                }
              });
            });

            await db.auditLog.create({
              data: {
                entity: "Quote",
                entityId: quote.id,
                action: "CREATE",
                details: JSON.stringify({ message: "Cotización creada por Sofía en borrador", quoteNumber })
              }
            });

            await sendEmail({
              to: "ventas@ikalchukum.com, asf2485@gmail.com, admin@ikalchukum.com",
              subject: `[Cotización EE.UU.] Nueva cotización pendiente de aprobación`,
              text: `Se ha generado una cotización automática para un proyecto en EE.UU. que está pendiente de revisión de flete y aprobación:\n\n` +
                `- Cliente: ${args.name.trim()}\n` +
                `- Ciudad: ${args.city.trim()}\n` +
                `- Código Postal: ${args.zip.trim()}\n` +
                `- Teléfono: ${clientPhone || "No proporcionado"}\n` +
                `- Correo: ${args.email?.trim().toLowerCase() || "No proporcionado"}\n` +
                `- Cotización #: ${quoteNumber}\n` +
                `- Producto: ${kits} kit(s) de Chukum ${product.name} (SKU: ${product.sku})\n` +
                `- Monto Productos: $${subtotal.toFixed(2)} USD\n\n` +
                `Por favor, ingresa al ERP para cotizar el flete, aprobarla y despacharla al cliente:\n` +
                `https://app.ikalchukum.com/cotizaciones`
            });

            sofiaAlertaAdmin = `📄 Nueva cotización de EE.UU. creada para ${args.name.trim()} (COT: ${quoteNumber}). Pendiente de flete (CP: ${args.zip}) y aprobación comercial.`;

            result = {
              success: true,
              quoteNumber,
              message: `Tu cotización borrador (${quoteNumber}) ha sido registrada en el sistema de Estados Unidos. Un administrador revisará las tarifas de flete para tu código postal (${args.zip}) y te enviará la propuesta final aprobada a tu WhatsApp/correo a la brevedad.`
            };
          } catch (e: any) {
            result = { success: false, error: e.message };
          }
        } 
        
        else if (functionName === "consultar_inventario") {
          try {
            const wh = await db.warehouse.findFirst({
              where: { name: { contains: args.warehouseName, mode: "insensitive" } }
            });

            if (!wh) {
              result = { error: `La bodega '${args.warehouseName}' no existe.` };
            } else {
              const term = args.skuOrColor.trim();
              const product = await db.product.findFirst({
                where: {
                  OR: [
                    { sku: { equals: term, mode: "insensitive" } },
                    { name: { contains: term, mode: "insensitive" } }
                  ]
                }
              });

              if (!product) {
                result = { error: `No se encontró ningún producto con SKU o color '${term}'.` };
              } else {
                const inv = await db.inventory.findUnique({
                  where: {
                    warehouseId_productId: {
                      warehouseId: wh.id,
                      productId: product.id
                    }
                  }
                });
                result = {
                  productName: product.name,
                  sku: product.sku,
                  warehouse: wh.name,
                  stock: inv ? inv.quantity : 0
                };
              }
            }
          } catch (e: any) {
            result = { success: false, error: e.message };
          }
        } 
        
        else if (functionName === "calcular_material") {
          const m2 = parseFloat(args.m2);
          const tipo = args.tipoSuperficie;
          let divisor = 5; // revoco
          if (tipo === "masilla") divisor = 9;
          if (tipo === "tablaroca") divisor = 14;

          const kits = Math.ceil(m2 / divisor);
          result = {
            m2,
            tipoSuperficie: tipo,
            kitsRequeridos: kits,
            explicacion: `Rendimiento promedio de ${divisor} m² por kit. Se sugieren ${kits} kit(s) para ${m2} m².`
          };
        }

        systemMessages.push({
          role: "tool",
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify(result)
        });
      }

      // Segunda llamada a OpenAI con los resultados de las funciones
      openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: systemMessages
        })
      });

      if (!openAiResponse.ok) {
        const errorData = await openAiResponse.json();
        console.error("OpenAI Error en llamada secundaria:", errorData);
        
        try {
          await db.auditLog.create({
            data: {
              entity: "SofiaChat",
              entityId: "SecondaryOpenAIError",
              action: "ERROR",
              details: JSON.stringify({ errorData, body: { message, phone } })
            }
          });
        } catch (dbErr) {
          console.error("Failed to log secondary OpenAI error:", dbErr);
        }

        return NextResponse.json({ error: "Error en procesamiento de respuesta de IA" }, { status: 500 });
      }

      responseData = await openAiResponse.json();
      choice = responseData.choices[0];
    }

    // Log success
    try {
      await db.auditLog.create({
        data: {
          entity: "SofiaChat",
          entityId: "Success",
          action: "LOG",
          details: JSON.stringify({
            request: { message, phone },
            reply: choice.message.content
          })
        }
      });
    } catch (dbErr) {
      console.error("Failed to log success:", dbErr);
    }

    // Detectar si la respuesta presenta explícitamente la paleta de colores para proveer el mediaUrl
    let mediaUrl = "";
    const lowerReply = choice.message.content.toLowerCase();
    const isExplicitPalettePresentation = 
      lowerReply.includes("#ik-") || 
      lowerReply.includes("paleta oficial") || 
      lowerReply.includes("aquí tienes la paleta") || 
      lowerReply.includes("te comparto la paleta") ||
      lowerReply.includes("aquí tienes nuestra paleta") ||
      lowerReply.includes("te comparto nuestra paleta") ||
      lowerReply.includes("justo aquí abajo en imagen");

    if (isExplicitPalettePresentation) {
      mediaUrl = "https://app.ikalchukum.com/paleta_colores.png";
    }

    // Retornar la respuesta final en formato JSON
    return NextResponse.json({
      success: true,
      reply: choice.message.content,
      mediaUrl,
      sofia_alerta_admin: sofiaAlertaAdmin
    });

  } catch (error: any) {
    console.error("❌ Error en /api/chat/sofia:", error);
    
    try {
      await db.auditLog.create({
        data: {
          entity: "SofiaChat",
          entityId: "Exception",
          action: "ERROR",
          details: JSON.stringify({
            error: error.message || "Error",
            stack: error.stack || "",
            requestBody: { message: request.body }
          })
        }
      });
    } catch (dbErr) {
      console.error("Failed to log exception:", dbErr);
    }

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
