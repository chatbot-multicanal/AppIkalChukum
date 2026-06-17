import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { originWarehouseId, destinationClientId, kitsCount } = await request.json();

    if (!originWarehouseId || !destinationClientId) {
      return NextResponse.json(
        { error: "La bodega de origen y el cliente de destino son requeridos" },
        { status: 400 }
      );
    }

    // 1. Obtener la bodega de origen
    const warehouse = await db.warehouse.findUnique({
      where: { id: originWarehouseId }
    });

    // 2. Obtener el cliente de destino
    const client = await db.client.findUnique({
      where: { id: destinationClientId }
    });

    if (!warehouse || !client) {
      return NextResponse.json(
        { error: "Bodega o Cliente no encontrados" },
        { status: 404 }
      );
    }

    // Formatear dirección origen (bodega)
    const isUsOrigin = warehouse.country === "Estados Unidos";
    const street1_from = warehouse.address || (isUsOrigin ? "100 Biscayne Blvd" : "Calle 60 #102");
    const city_from = warehouse.city || (isUsOrigin ? "Miami" : "Mérida");
    const state_from = warehouse.state || (isUsOrigin ? "FL" : "Yucatán");
    const zip_from = warehouse.zip || (isUsOrigin ? "33132" : "97000");
    const country_from = isUsOrigin ? "US" : "MX";
    const phone_from = warehouse.phone || "9991234567";

    // Formatear dirección destino (cliente)
    const isUsDest = client.country === "Estados Unidos" || 
                     client.state === "Florida" || 
                     client.state === "FL" || 
                     (client.zip && client.zip.length === 5 && !isNaN(Number(client.zip)));
    const street1_to = client.address || "Dirección de Entrega";
    const city_to = client.city || (isUsDest ? "Miami" : "Mérida");
    const state_to = client.state || (isUsDest ? "FL" : "Yucatán");
    const zip_to = client.zip || (isUsDest ? "33015" : "97000");
    const country_to = isUsDest ? "US" : "MX";
    const phone_to = client.phone || "9991234567";
    const name_to = client.name;
    const company_to = client.company || "";
    const email_to = client.email || "ventas@ikalchukum.com";

    // Calcular el peso de los paquetes
    // Supongamos que 1 kit = 3 sacos (20kg c/u) + 1 bidon (20kg) = 80kg = 176 lbs.
    // Shippo requiere peso por paquete. Creamos paquetes por kit cotizado.
    const qty = parseInt(kitsCount || "1") || 1;
    const parcels = [];
    for (let i = 0; i < qty; i++) {
      parcels.push({
        length: "16",
        width: "16",
        height: "16",
        distance_unit: "in",
        weight: "170",
        mass_unit: "lb"
      });
    }

    const shippoApiKey = process.env.SHIPPO_API_KEY;

    if (!shippoApiKey || shippoApiKey.trim() === "") {
      console.warn("⚠️ SHIPPO_API_KEY no configurada en .env. Usando tarifas de envío simuladas.");
      
      const currency = country_to === "US" ? "USD" : "MXN";
      const factor = currency === "USD" ? 1 : 20;

      return NextResponse.json({
        success: true,
        simulated: true,
        rates: [
          {
            object_id: "rate_sim_dhl",
            provider: "DHL Express",
            servicelevel: "Express Worldwide",
            amount: (150 * qty * factor).toFixed(2),
            currency,
            estimated_days: 2,
            duration_terms: "Envío aéreo express - Entrega rápida"
          },
          {
            object_id: "rate_sim_fedex",
            provider: "FedEx",
            servicelevel: "Ground / Priority",
            amount: (85 * qty * factor).toFixed(2),
            currency,
            estimated_days: 4,
            duration_terms: "Tránsito terrestre nacional estándar"
          },
          {
            object_id: "rate_sim_ups",
            provider: "UPS",
            servicelevel: "Standard Ground",
            amount: (65 * qty * factor).toFixed(2),
            currency,
            estimated_days: 5,
            duration_terms: "Envío económico terrestre"
          }
        ]
      });
    }

    // Llamada HTTP real a Shippo API
    console.log(`[Shippo API] Solicitando cotización de ${qty} paquete(s) desde ${city_from} a ${city_to}...`);
    const shippoResponse = await fetch("https://api.goshippo.com/shipments/", {
      method: "POST",
      headers: {
        "Authorization": `ShippoToken ${shippoApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        address_from: {
          name: warehouse.name,
          street1: street1_from,
          city: city_from,
          state: state_from,
          zip: zip_from,
          country: country_from,
          phone: phone_from,
          email: "bodega@ikalchukum.com"
        },
        address_to: {
          name: name_to,
          company: company_to,
          street1: street1_to,
          city: city_to,
          state: state_to,
          zip: zip_to,
          country: country_to,
          phone: phone_to,
          email: email_to
        },
        parcels: parcels,
        async: false
      })
    });

    const shippoData = await shippoResponse.json();

    if (!shippoResponse.ok) {
      console.error("❌ Error de la API de Shippo:", shippoData);
      return NextResponse.json(
        { error: shippoData.message || "Error devuelto por la API de Shippo" },
        { status: shippoResponse.status }
      );
    }

    // Filtrar y estructurar las tarifas devueltas
    const rates = (shippoData.rates || []).map((r: any) => ({
      object_id: r.object_id,
      provider: r.provider,
      servicelevel: r.servicelevel?.name || r.servicelevel || "Estándar",
      amount: r.amount,
      currency: r.currency,
      estimated_days: r.estimated_days || 3,
      duration_terms: r.duration_terms || "Tránsito estándar"
    }));

    // Ordenar por precio ascendente
    rates.sort((a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount));

    // Si no obtuvimos tarifas reales y es un ambiente de prueba/desarrollo (o el token es de prueba),
    // devolvemos tarifas simuladas para que el usuario pueda probar el flujo sin bloquearse.
    if (rates.length === 0 && (shippoApiKey.startsWith("shippo_test_") || process.env.NODE_ENV === "development")) {
      console.warn("⚠️ Shippo retornó 0 tarifas reales en pruebas. Generando tarifas simuladas de respaldo.");
      const currency = country_to === "US" ? "USD" : "MXN";
      const factor = currency === "USD" ? 1 : 20;

      const simulatedRates = [
        {
          object_id: "rate_sim_dhl",
          provider: "DHL Express (Simulado)",
          servicelevel: "Express Worldwide",
          amount: (150 * qty * factor).toFixed(2),
          currency,
          estimated_days: 2,
          duration_terms: "Envío aéreo express - Entrega rápida (Respaldo Pruebas)"
        },
        {
          object_id: "rate_sim_fedex",
          provider: "FedEx (Simulado)",
          servicelevel: "Ground / Priority",
          amount: (85 * qty * factor).toFixed(2),
          currency,
          estimated_days: 4,
          duration_terms: "Tránsito terrestre nacional estándar (Respaldo Pruebas)"
        },
        {
          object_id: "rate_sim_ups",
          provider: "UPS (Simulado)",
          servicelevel: "Standard Ground",
          amount: (65 * qty * factor).toFixed(2),
          currency,
          estimated_days: 5,
          duration_terms: "Envío económico terrestre (Respaldo Pruebas)"
        }
      ];

      return NextResponse.json({ success: true, rates: simulatedRates, simulated: true });
    }

    return NextResponse.json({ success: true, rates });
  } catch (error: any) {
    console.error("❌ Error en POST /api/shipping/rates:", error);
    return NextResponse.json(
      { error: "Ocurrió un error interno del servidor al procesar la cotización de Shippo" },
      { status: 500 }
    );
  }
}
