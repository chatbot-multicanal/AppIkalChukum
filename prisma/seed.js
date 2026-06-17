require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed de base de datos con PostgreSQL (Supabase)...");

  // 1. Limpiar base de datos para evitar duplicados
  await prisma.systemSetting.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.product.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  console.log("Limpieza completada.");

  // 2. Crear Usuarios por defecto (Roles)
  const admin1 = await prisma.user.create({
    data: {
      email: "admin@ikalchukum.com",
      name: "Admin Chukum",
      role: "ADMIN",
      password: "nosecuartea2026",
      active: true,
    },
  });

  const admin2 = await prisma.user.create({
    data: {
      email: "socio@ikalchukum.com",
      name: "Socio Chukum",
      role: "ADMIN",
      password: "password123",
      active: true,
    },
  });

  const gerente = await prisma.user.create({
    data: {
      email: "gerente@ikalchukum.com",
      name: "Gerente Ikal",
      role: "GERENTE",
      password: "password123",
      active: true,
    },
  });

  const vendedor = await prisma.user.create({
    data: {
      email: "vendedor@ikalchukum.com",
      name: "Vendedor Pro",
      role: "VENDEDOR",
      password: "password123",
      active: true,
    },
  });

  const adminAsf = await prisma.user.create({
    data: {
      email: "asf2485@gmail.com",
      name: "Arturo Silva",
      role: "ADMIN",
      password: "quiensabe",
      active: true,
    },
  });

  const vendedorClaudio = await prisma.user.create({
    data: {
      email: "claudioalp6@gmail.com",
      name: "Claudio Alp",
      role: "VENDEDOR",
      password: "Gallosix",
      active: true,
    },
  });

  const vendedorDan = await prisma.user.create({
    data: {
      email: "dantorre86@gmail.com",
      name: "Dan Torre",
      role: "VENDEDOR",
      password: "contoronjas2026",
      active: true,
    },
  });

  // Crear configuración de comisión por defecto (3%)
  await prisma.systemSetting.create({
    data: {
      key: "commission_rate",
      value: "3.0"
    }
  });

  console.log("Usuarios y configuraciones iniciales creados.");


  // 3. Crear Clientes de prueba
  const client1 = await prisma.client.create({
    data: {
      name: "Constructora del Norte",
      contact: "Ing. Roberto M.",
      email: "contacto@constructoranorte.com",
      phone: "9991234567",
      address: "Calle 60 #102 x 21 y 23",
      city: "Mérida",
      country: "México",
    },
  });
  const client2 = await prisma.client.create({
    data: {
      name: "Ing. Arturo Silva",
      contact: "Arturo Silva",
      email: "arturo.silva@silvaconsulting.com",
      phone: "8187654321",
      address: "Av. Constitución 405",
      city: "Monterrey",
      country: "México",
    },
  });
  console.log("Clientes creados.");

  // 4. Crear Bodegas (Mérida y Miami)
  const whMerida = await prisma.warehouse.create({
    data: {
      name: "Bodega Mérida",
      city: "Mérida",
      country: "México",
      timezone: "America/Mexico_City",
      active: true,
    },
  });

  const whMiami = await prisma.warehouse.create({
    data: {
      name: "Bodega Miami",
      city: "Miami",
      country: "Estados Unidos",
      address: "10850 NW 21st Street, Suite 210",
      state: "FL",
      zip: "33172",
      timezone: "America/New_York",
      active: true,
    },
  });
  console.log("Bodegas creadas (Mérida, Miami).");

  // 5. Crear Productos (Kits de Chukum, Sacos y Bidón con precios reales)
  const productsData = [
    // Kits de Venta
    { sku: "KIT-NAT-001", name: "Kit Natural", description: "Kit base acabado natural", color: "Natural", basePrice: 1300.0, costPrice: 805.0 },
    { sku: "KIT-GRS-002", name: "Kit Gris", description: "Kit base color gris", color: "Gris", basePrice: 1300.0, costPrice: 850.0 },
    { sku: "KIT-PDR-003", name: "Kit Palo de Rosa", description: "Kit base color palo de rosa", color: "Palo de Rosa", basePrice: 1350.0, costPrice: 850.0 },
    { sku: "KIT-AZM-004", name: "Kit Azul Maya", description: "Kit base color azul maya", color: "Azul Maya", basePrice: 1350.0, costPrice: 850.0 },
    { sku: "KIT-VJD-005", name: "Kit Verde Jade", description: "Kit base color verde jade", color: "Verde Jade", basePrice: 1350.0, costPrice: 850.0 },
    { sku: "KIT-AMH-006", name: "Kit Amarillo Hacienda", description: "Kit base color amarillo hacienda", color: "Amarillo Hacienda", basePrice: 1350.0, costPrice: 850.0 },
    { sku: "KIT-PXR-007", name: "Kit Pixoy Rojo", description: "Kit base color rojo pixoy", color: "Rojo Pixoy", basePrice: 1400.0, costPrice: 850.0 },
    { sku: "KIT-NGR-008", name: "Kit Negro", description: "Kit base color negro", color: "Negro", basePrice: 1500.0, costPrice: 850.0 },
    { sku: "KIT-TRA-009", name: "Kit Tierra", description: "Kit base color pigmento terra", color: "Tierra", basePrice: 1500.0, costPrice: 850.0 },

    // Componentes de Sacos (físicos en bodega)
    { sku: "SACO-NAT-001", name: "Saco Natural", description: "Saco de mezcla base natural", color: "Natural", basePrice: 370.0, costPrice: 270.0 },
    { sku: "SACO-GRS-002", name: "Saco Gris", description: "Saco de mezcla base color gris", color: "Gris", basePrice: 400.0, costPrice: 320.0 },
    { sku: "SACO-PDR-003", name: "Saco Palo de Rosa", description: "Saco de mezcla base color palo de rosa", color: "Palo de Rosa", basePrice: 400.0, costPrice: 320.0 },
    { sku: "SACO-AZM-004", name: "Saco Azul Maya", description: "Saco de mezcla base color azul maya", color: "Azul Maya", basePrice: 400.0, costPrice: 320.0 },
    { sku: "SACO-VJD-005", name: "Saco Verde Jade", description: "Saco de mezcla base color verde jade", color: "Verde Jade", basePrice: 400.0, costPrice: 320.0 },
    { sku: "SACO-AMH-006", name: "Saco Amarillo Hacienda", description: "Saco de mezcla base color amarillo hacienda", color: "Amarillo Hacienda", basePrice: 400.0, costPrice: 320.0 },
    { sku: "SACO-PXR-007", name: "Saco Pixoy Rojo", description: "Saco de mezcla base color rojo pixoy", color: "Rojo Pixoy", basePrice: 400.0, costPrice: 320.0 },
    { sku: "SACO-NGR-008", name: "Saco Negro", description: "Saco de mezcla base color negro", color: "Negro", basePrice: 400.0, costPrice: 320.0 },
    { sku: "SACO-TRA-009", name: "Saco Tierra", description: "Saco de mezcla base color pigmento terra", color: "Tierra", basePrice: 400.0, costPrice: 320.0 },

    // Componente Bidón (físico en bodega)
    { sku: "BIDON-RES-001", name: "Bidón Resina", description: "Bidón de resina líquida concentrada", color: null, basePrice: 440.0, costPrice: 340.0 },
  ];

  const products = [];
  for (const prod of productsData) {
    const p = await prisma.product.create({ data: prod });
    products.push(p);
  }
  console.log("Productos creados.");

  // 6. Asignar Stock de componentes (Miami basado en Excel, Mérida el doble de Miami)
  const stockMiamiComponents = {
    "SACO-NAT-001": 420.0, // Saco Base Color Natural
    "SACO-GRS-002": 240.0, // Saco Base Color Gris
    "SACO-PDR-003": 30.0,  // Saco Base Palo de Rosa
    "SACO-AZM-004": 30.0,  // Saco Base Azul Maya
    "SACO-VJD-005": 30.0,  // Saco Base Verde Jade
    "SACO-AMH-006": 0.0,   // Amarillo Hacienda
    "SACO-PXR-007": 30.0,  // Saco Base Rojo Pixoy
    "SACO-NGR-008": 0.0,   // Negro
    "SACO-TRA-009": 10.0,  // Saco Pigmento Terra
    "BIDON-RES-001": 260.0, // Agua de Chukum Bidón
  };

  for (const product of products) {
    let qtyMiami = stockMiamiComponents[product.sku] || 0;
    let qtyMerida = qtyMiami * 2; // Mérida tiene el doble de stock que Miami

    // Stock en Miami
    await prisma.inventory.create({
      data: {
        warehouseId: whMiami.id,
        productId: product.id,
        quantity: qtyMiami,
      },
    });

    // Stock en Mérida
    await prisma.inventory.create({
      data: {
        warehouseId: whMerida.id,
        productId: product.id,
        quantity: qtyMerida,
      },
    });
  }

  console.log("Stock real asignado a las bodegas de Miami y Mérida (Mérida = 2x Miami).");

  // 7. Crear una cotización de prueba aprobada para Mérida
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: "COT-2026-0501",
      clientId: client1.id,
      userId: admin1.id,
      warehouseId: whMerida.id,
      status: "APPROVED",
      currency: "MXN",
      exchangeRate: 1.0,
      subtotal: 31000.00,
      tax: 4960.00,
      total: 35960.00,
      items: {
        create: [
          {
            productId: products[0].id, // Kit Natural (1200 venta)
            quantity: 15.0,
            unitPrice: 1200.0,
            total: 18000.0,
          },
          {
            productId: products[4].id, // Kit Verde Jade (1300 venta)
            quantity: 10.0,
            unitPrice: 1300.0,
            total: 13000.0,
          }
        ]
      }
    }
  });

  // Crear su respectivo Pedido
  await prisma.order.create({
    data: {
      quoteId: quote.id,
      status: "PENDING",
      scheduledDeliveryAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
    }
  });

  // 8. Descontar stock correspondiente al pedido de prueba en Mérida
  const naturalSaco = products.find(p => p.sku === "SACO-NAT-001");
  const jadeSaco = products.find(p => p.sku === "SACO-VJD-005");
  const resinBidon = products.find(p => p.sku === "BIDON-RES-001");

  await prisma.inventory.update({
    where: { warehouseId_productId: { warehouseId: whMerida.id, productId: naturalSaco.id } },
    data: { quantity: { decrement: 15.0 * 3 } } // 45 sacos
  });

  await prisma.inventory.update({
    where: { warehouseId_productId: { warehouseId: whMerida.id, productId: jadeSaco.id } },
    data: { quantity: { decrement: 10.0 * 3 } } // 30 sacos
  });

  await prisma.inventory.update({
    where: { warehouseId_productId: { warehouseId: whMerida.id, productId: resinBidon.id } },
    data: { quantity: { decrement: 25.0 } } // 15 + 10 = 25 bidones
  });

  console.log("Seed finalizado con éxito.");
}

main()
  .catch((e) => {
    console.error("Error ejecutando el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
