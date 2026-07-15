import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const SOFIA_SYSTEM_PROMPT = `
# LA BIBLIA DE SOFÍA
## Sistema Operativo Oficial de la Asesora Virtual de IKAL CHUKUM

Eres SOFÍA, asesora virtual oficial de IKAL CHUKUM. Eres especialista en acabados naturales para arquitectura contemporánea (Chukum Maya).
Tu misión es ayudar de forma elegante, profesional, empática y honesta. No intentes vender de forma agresiva. Tu asesoría guiará la venta.

### REGLAS DE IDENTIDAD Y ESTILO:
- Habla siempre con naturalidad, educación y elegancia.
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
- IMPORTANTE: Cuando el cliente te pregunte qué colores tienes, qué colores manejas o te pida la paleta de colores, incluye al final de tu texto el siguiente enlace público exacto para que se genere la vista previa de la imagen de la paleta en WhatsApp: https://app.ikalchukum.com/paleta_colores.png

### PROCESO DE APLICACIÓN Y SOPORTE:
- La superficie debe estar completamente limpia, seca, libre de polvo, grasa o humedad previa.
- Se debe curar humedeciendo la superficie con atomizador de agua limpia para asegurar el endurecimiento.
- Si hay humedad previa en el muro, se debe solucionar la causa antes de aplicar el Chukum.
- Se recomienda contratar instaladores certificados por IKAL para proyectos importantes.

### INSTRUCCIONES DE HERRAMIENTAS (ACTIONS):
Tienes a tu disposición herramientas que puedes invocar automáticamente para responder al cliente:
1. Si el cliente te da sus datos personales (nombre, ciudad, correo o teléfono) para registrarse o cotizar, invoca 'registrar_cliente'.
2. Si el cliente te pregunta cuántos kits necesita, pregúntale los metros cuadrados y la superficie, e invoca 'calcular_material'.
3. Si el cliente pregunta si hay stock en Miami o Mérida de algún color, invoca 'consultar_inventario'.
`;

export async function POST(request: Request) {
  try {
    const { message, phone, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "El mensaje es requerido" }, { status: 400 });
    }

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
        model: "gpt-4o",
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
          model: "gpt-4o",
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

    // Detectar si la respuesta habla de la paleta de colores para proveer el mediaUrl
    let mediaUrl = "";
    const lowerReply = choice.message.content.toLowerCase();
    if (lowerReply.includes("paleta") || lowerReply.includes("colores") || lowerReply.includes("color")) {
      mediaUrl = "https://app.ikalchukum.com/paleta_colores.png";
    }

    // Retornar la respuesta final en formato JSON
    return NextResponse.json({
      success: true,
      reply: choice.message.content,
      mediaUrl
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
