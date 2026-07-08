"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { sendOrderStatusNotification } from "@/lib/mail";

/**
 * Fetches all orders, populated with quotes, items, client, and warehouse details.
 */
export async function getOrdersAction() {
  try {
    const orders = await db.order.findMany({
      include: {
        warehouse: true,
        quote: {
          include: {
            client: true,
            user: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      orders,
    };
  } catch (error: any) {
    console.error("Error in getOrdersAction:", error);
    return {
      success: false,
      error: error.message || "Error al obtener pedidos.",
      orders: [],
    };
  }
}

/**
 * Fetches active warehouses to let users choose which one will fulfill the order.
 */
export async function getActiveWarehousesAction() {
  try {
    const warehouses = await db.warehouse.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return {
      success: true,
      warehouses,
    };
  } catch (error: any) {
    console.error("Error in getActiveWarehousesAction:", error);
    return {
      success: false,
      error: error.message || "Error al obtener bodegas activas.",
      warehouses: [],
    };
  }
}

/**
 * Transitions order status and manages warehouse stock and salesperson commissions.
 */
export async function updateOrderStatusAction(
  orderId: string,
  newStatus: "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
  warehouseId?: string
) {
  try {
    // Validar autorización a nivel backend (Solo ADMIN, GERENTE o BODEGA (para PREPARING/SHIPPED) pueden cambiar estados)
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;
    const userId = cookieStore.get("user_session")?.value;

    const isBodegaAllowed = userRole === "BODEGA" && (newStatus === "PREPARING" || newStatus === "SHIPPED");
    if (userRole !== "ADMIN" && userRole !== "GERENTE" && !isBodegaAllowed) {
      throw new Error("No autorizado. Solo administradores o gerentes pueden modificar pedidos, o encargado de bodega para preparar y dar salida.");
    }

    // 1. Fetch current order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        quote: {
          include: {
            client: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error("El pedido solicitado no existe.");
    }

    // Validar que el encargado de bodega solo modifique pedidos de su sucursal
    if (userRole === "BODEGA") {
      const user = userId ? await db.user.findUnique({ where: { id: userId } }) : null;
      const targetWarehouseId = order.warehouseId || order.quote.warehouseId;
      if (!user || user.warehouseId !== targetWarehouseId) {
        throw new Error("No tienes permisos para modificar pedidos asignados a otra bodega.");
      }
    }

    if (order.status === newStatus) {
      return { success: true };
    }

    // 2. Perform actions inside transaction
    await db.$transaction(async (tx) => {
      
      // LÓGICA DE STOCK: Al pasar a PREPARING (Iniciar Preparación)
      if (newStatus === "PREPARING") {
        if (!warehouseId) {
          throw new Error("Se debe seleccionar una bodega para iniciar la preparación.");
        }

        // Evitar doble deducción de stock
        if (order.status !== "PENDING" && order.status !== "CANCELLED") {
          throw new Error("Este pedido ya ha salido del estado pendiente o cancelado.");
        }

        // Agrupar cantidades requeridas de cada SKU (Sacos y Bidón)
        const requiredQuantities: Record<string, { qty: number; name: string }> = {};

        for (const item of order.quote.items) {
          const sku = item.product.sku;
          if (sku.startsWith("KIT-")) {
            const sacoSku = sku.replace("KIT-", "SACO-");
            const bidonSku = "BIDON-RES-001";

            requiredQuantities[sacoSku] = {
              qty: (requiredQuantities[sacoSku]?.qty || 0) + item.quantity * 3,
              name: item.product.name.replace("Kit", "Saco")
            };
            requiredQuantities[bidonSku] = {
              qty: (requiredQuantities[bidonSku]?.qty || 0) + item.quantity * 1,
              name: "Bidón Resina"
            };
          } else {
            requiredQuantities[sku] = {
              qty: (requiredQuantities[sku]?.qty || 0) + item.quantity,
              name: item.product.name
            };
          }
        }

        // Si la bodega seleccionada es distinta a la de la cotización original (y no venimos de CANCELLED donde ya se devolvió stock)
        // O si venimos de CANCELLED (donde el stock ya se restauró y debemos descontarlo en la nueva bodega)
        const isChangingWarehouse = order.status === "PENDING" && warehouseId !== order.quote.warehouseId;
        const isFromCancelled = order.status === "CANCELLED";

        if (isChangingWarehouse) {
          // Revertir descuento de stock en la bodega de la cotización original
          if (order.quote.warehouseId) {
            for (const [sku, req] of Object.entries(requiredQuantities)) {
              const product = await tx.product.findUnique({ where: { sku } });
              if (product) {
                await tx.inventory.update({
                  where: {
                    warehouseId_productId: {
                      warehouseId: order.quote.warehouseId,
                      productId: product.id,
                    },
                  },
                  data: {
                    quantity: { increment: req.qty },
                  },
                });
              }
            }
          }
        }

        // Si cambiamos de bodega o venimos de cancelado, descontamos en la bodega seleccionada (validando stock)
        if (isChangingWarehouse || isFromCancelled) {
          // Validar stock en la nueva bodega
          for (const [sku, req] of Object.entries(requiredQuantities)) {
            const product = await tx.product.findUnique({ where: { sku } });
            if (!product) {
              throw new Error(`El componente con SKU "${sku}" no existe en el catálogo.`);
            }

            const inv = await tx.inventory.findUnique({
              where: {
                warehouseId_productId: {
                  warehouseId: warehouseId,
                  productId: product.id,
                },
              },
            });

            const stockAvailable = inv ? inv.quantity : 0;
            if (stockAvailable < req.qty) {
              const unitLabel = sku.startsWith("BIDON-") ? "bidones" : "sacos";
              throw new Error(
                `Stock insuficiente para el componente "${req.name}" en la bodega seleccionada. Stock disponible: ${stockAvailable} ${unitLabel}, Requerido: ${req.qty}.`
              );
            }
          }

          // Descontar en la nueva bodega
          for (const [sku, req] of Object.entries(requiredQuantities)) {
            const product = await tx.product.findUnique({ where: { sku } });
            if (product) {
              await tx.inventory.update({
                where: {
                  warehouseId_productId: {
                    warehouseId: warehouseId,
                    productId: product.id,
                  },
                },
                data: {
                  quantity: { decrement: req.qty },
                },
              });
            }
          }
        }

        // Asignar bodega y actualizar estatus
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            warehouseId: warehouseId,
          },
        });
      }
      
      // LÓGICA DE RETORNO DE STOCK: Si se CANCELA
      else if (newStatus === "CANCELLED") {
        // Determinamos de dónde se descontó el stock. 
        // Si estaba en PREPARING o SHIPPED, se descontó de order.warehouseId.
        // Si estaba en PENDING, se descontó de order.quote.warehouseId.
        const wasDeducted = order.status === "PREPARING" || order.status === "SHIPPED" || order.status === "PENDING";
        const targetWarehouseId = (order.status === "PREPARING" || order.status === "SHIPPED") 
          ? order.warehouseId 
          : order.quote.warehouseId;

        if (wasDeducted && targetWarehouseId) {
          // Agrupar cantidades requeridas de cada SKU (Sacos y Bidón)
          const requiredQuantities: Record<string, number> = {};

          for (const item of order.quote.items) {
            const sku = item.product.sku;
            if (sku.startsWith("KIT-")) {
              const sacoSku = sku.replace("KIT-", "SACO-");
              const bidonSku = "BIDON-RES-001";

              requiredQuantities[sacoSku] = (requiredQuantities[sacoSku] || 0) + item.quantity * 3;
              requiredQuantities[bidonSku] = (requiredQuantities[bidonSku] || 0) + item.quantity * 1;
            } else {
              requiredQuantities[sku] = (requiredQuantities[sku] || 0) + item.quantity;
            }
          }

          // Devolver sacos y bidones al inventario
          for (const [sku, qty] of Object.entries(requiredQuantities)) {
            const product = await tx.product.findUnique({ where: { sku } });
            if (product) {
              await tx.inventory.update({
                where: {
                  warehouseId_productId: {
                    warehouseId: targetWarehouseId,
                    productId: product.id,
                  },
                },
                data: {
                  quantity: { increment: qty },
                },
              });
            }
          }
        }

        // Si existía comisión, la cancelamos
        await tx.commission.updateMany({
          where: { quoteId: order.quoteId },
          data: {
            status: "CANCELLED"
          }
        });

        await tx.order.update({
          where: { id: orderId },
          data: { status: newStatus },
        });
      }

      // LÓGICA DE REAPERTURA: Si se cambia de CANCELLED a PENDING
      else if (newStatus === "PENDING" && order.status === "CANCELLED") {
        if (!order.quote.warehouseId) {
          throw new Error("El pedido no tiene una bodega asignada en la cotización.");
        }

        // Agrupar cantidades requeridas de cada SKU (Sacos y Bidón)
        const requiredQuantities: Record<string, { qty: number; name: string }> = {};

        for (const item of order.quote.items) {
          const sku = item.product.sku;
          if (sku.startsWith("KIT-")) {
            const sacoSku = sku.replace("KIT-", "SACO-");
            const bidonSku = "BIDON-RES-001";

            requiredQuantities[sacoSku] = {
              qty: (requiredQuantities[sacoSku]?.qty || 0) + item.quantity * 3,
              name: item.product.name.replace("Kit", "Saco")
            };
            requiredQuantities[bidonSku] = {
              qty: (requiredQuantities[bidonSku]?.qty || 0) + item.quantity * 1,
              name: "Bidón Resina"
            };
          } else {
            requiredQuantities[sku] = {
              qty: (requiredQuantities[sku]?.qty || 0) + item.quantity,
              name: item.product.name
            };
          }
        }

        // Validar stock en la bodega de la cotización
        for (const [sku, req] of Object.entries(requiredQuantities)) {
          const product = await tx.product.findUnique({ where: { sku } });
          if (!product) {
            throw new Error(`El componente con SKU "${sku}" no existe en el catálogo.`);
          }

          const inv = await tx.inventory.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: order.quote.warehouseId,
                productId: product.id,
              },
            },
          });

          const stockAvailable = inv ? inv.quantity : 0;
          if (stockAvailable < req.qty) {
            const unitLabel = sku.startsWith("BIDON-") ? "bidones" : "sacos";
            throw new Error(
              `Stock insuficiente para reabrir el pedido. Falta componente "${req.name}" en la bodega de origen. Disponible: ${stockAvailable} ${unitLabel}, Requerido: ${req.qty}.`
            );
          }
        }

        // Descontar en la bodega de la cotización y reiniciar warehouseId a null (ya que es PENDING)
        for (const [sku, req] of Object.entries(requiredQuantities)) {
          const product = await tx.product.findUnique({ where: { sku } });
          if (product) {
            await tx.inventory.update({
              where: {
                warehouseId_productId: {
                  warehouseId: order.quote.warehouseId,
                  productId: product.id,
                },
              },
              data: {
                quantity: { decrement: req.qty },
              },
            });
          }
        }

        await tx.order.update({
          where: { id: orderId },
          data: { 
            status: newStatus,
            warehouseId: null,
          },
        });
      }
      
      // LÓGICA DE COMISIONES: Al pasar a DELIVERED (Entregado)
      else if (newStatus === "DELIVERED") {
        if (order.status === "CANCELLED") {
          throw new Error("No se puede entregar un pedido que ha sido cancelado.");
        }

        // Obtener la tasa de comisión global actual de los ajustes o defecto 3%
        const setting = await tx.systemSetting.findUnique({
          where: { key: "commission_rate" }
        });
        const rate = setting ? parseFloat(setting.value) : 3.0;

        // Calcular comisión: rate% del subtotal de la cotización
        const commissionAmount = order.quote.subtotal * (rate / 100);
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 15); // Cobro en 15 días

        const commissionUserId = order.quote.client.userId || order.quote.userId;

        // Crear o actualizar la comisión en base de datos
        await tx.commission.upsert({
          where: { quoteId: order.quoteId },
          create: {
            quoteId: order.quoteId,
            userId: commissionUserId,
            amount: commissionAmount,
            status: "PENDING",
            scheduledDate: scheduledDate,
          },
          update: {
            userId: commissionUserId,
            amount: commissionAmount,
            status: "PENDING",
            scheduledDate: scheduledDate,
          }
        });

        // Actualizar estatus del pedido y registrar fecha de entrega
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            deliveredAt: new Date(),
          },
        });
      }
      
      // Para cualquier otro cambio de estatus estándar (ej. SHIPPED)
      else {
        await tx.order.update({
          where: { id: orderId },
          data: { status: newStatus },
        });
      }

      // 3. Crear registro en la bitácora de auditoría
      await tx.auditLog.create({
        data: {
          entity: "Order",
          entityId: orderId,
          action: `UPDATE_STATUS_${newStatus}`,
          details: JSON.stringify({
            previousStatus: order.status,
            newStatus: newStatus,
            warehouseId: warehouseId || order.warehouseId,
          }),
        },
      });
    });

    // Enviar notificación por correo de forma asíncrona
    try {
      const updatedOrder = await db.order.findUnique({
        where: { id: orderId },
        include: {
          warehouse: true,
          quote: {
            include: {
              client: true
            }
          }
        }
      });
      if (updatedOrder) {
        // Ejecutar envío de correo sin bloquear la respuesta de la UI
        sendOrderStatusNotification(updatedOrder, order.status, newStatus).catch(err => {
          console.error("Error al enviar correo en background:", err);
        });
      }
    } catch (mailError) {
      console.error("Error al preparar notificación por correo:", mailError);
    }

    // 4. Revalidar vistas
    revalidatePath("/pedidos");
    revalidatePath("/inventario");
    revalidatePath("/cotizaciones");
    revalidatePath("/");

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error in updateOrderStatusAction:", error);
    return {
      success: false,
      error: error.message || "Error al actualizar el estado del pedido.",
    };
  }
}

/**
 * Acknowledges receipt of a pending/preparing order in warehouse by setting acknowledgedAt.
 */
export async function acknowledgeOrderAction(orderId: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_session")?.value;
    const userRole = cookieStore.get("user_role")?.value;

    if (!userId || (userRole !== "BODEGA" && userRole !== "ADMIN" && userRole !== "GERENTE")) {
      throw new Error("No autorizado. Solo encargado de bodega o administrador puede confirmar recepción.");
    }

    const order = await db.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error("El pedido solicitado no existe.");
    }

    const acknowledgedAt = new Date();

    await db.order.update({
      where: { id: orderId },
      data: {
        acknowledgedAt,
        acknowledgedById: userId,
      }
    });

    // Crear registro en la bitácora de auditoría
    await db.auditLog.create({
      data: {
        entity: "Order",
        entityId: orderId,
        action: "ACKNOWLEDGE",
        details: JSON.stringify({
          userId,
          acknowledgedAt,
        }),
      },
    });

    revalidatePath("/pedidos");
    revalidatePath("/");

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error in acknowledgeOrderAction:", error);
    return {
      success: false,
      error: error.message || "Error al confirmar recepción del pedido.",
    };
  }
}

/**
 * Compra la guía de envío de Shippo usando el rate ID seleccionado.
 */
export async function buyShippoLabelAction(orderId: string, rateObjectId: string) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;
    const userId = cookieStore.get("user_session")?.value;

    if (userRole !== "ADMIN" && userRole !== "GERENTE" && userRole !== "BODEGA") {
      throw new Error("No autorizado. Debes ser administrador, gerente o encargado de bodega para generar guías.");
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        warehouse: true,
        quote: {
          include: {
            client: true,
          }
        }
      }
    });

    if (!order) {
      throw new Error("El pedido solicitado no existe.");
    }

    if (order.shippingLabelUrl) {
      throw new Error("Este pedido ya cuenta con una guía de envío generada.");
    }

    const shippoApiKey = process.env.SHIPPO_API_KEY;
    
    let transactionData: {
      label_url: string;
      tracking_number: string;
      object_id: string;
    };

    // Si es una tarifa simulada o no hay API key real, simulamos la respuesta
    const isSimulated = rateObjectId.startsWith("rate_sim_") || !shippoApiKey || shippoApiKey.trim() === "";

    if (isSimulated) {
      console.log(`[Shippo Mock] Comprando tarifa simulada ${rateObjectId} para el pedido ${orderId}...`);
      
      const mockTracking = `1Z${Math.random().toString(36).substring(2, 10).toUpperCase()}${Math.floor(10000000 + Math.random() * 90000000)}`;
      
      transactionData = {
        label_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        tracking_number: mockTracking,
        object_id: `tx_sim_${Math.random().toString(36).substring(2, 12)}`
      };
    } else {
      console.log(`[Shippo API] Comprando guía con rate ID: ${rateObjectId}...`);
      const response = await fetch("https://api.goshippo.com/transactions/", {
        method: "POST",
        headers: {
          "Authorization": `ShippoToken ${shippoApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rate: rateObjectId,
          async: false
        })
      });

      const data = await response.json();
      if (!response.ok || data.status === "ERROR") {
        console.error("Error en Shippo Transaction:", data);
        const errMsg = data.messages?.[0]?.text || data.message || "Error al comprar la guía en Shippo.";
        throw new Error(errMsg);
      }

      transactionData = {
        label_url: data.label_url,
        tracking_number: data.tracking_number,
        object_id: data.object_id
      };
    }

    // Actualizar pedido
    await db.order.update({
      where: { id: orderId },
      data: {
        shippingLabelUrl: transactionData.label_url,
        trackingNumber: transactionData.tracking_number,
        shippoTransactionId: transactionData.object_id,
        status: "SHIPPED", // Transicionar automáticamente a Enviado
      }
    });

    // Registrar en auditoría
    await db.auditLog.create({
      data: {
        entity: "Order",
        entityId: orderId,
        action: "BUY_SHIPPING_LABEL",
        details: JSON.stringify({
          userId,
          trackingNumber: transactionData.tracking_number,
          shippoTransactionId: transactionData.object_id,
          simulated: isSimulated,
        }),
      },
    });

    revalidatePath("/pedidos");
    revalidatePath("/");

    return {
      success: true,
      trackingNumber: transactionData.tracking_number,
      labelUrl: transactionData.label_url
    };
  } catch (error: any) {
    console.error("Error in buyShippoLabelAction:", error);
    return {
      success: false,
      error: error.message || "Error al comprar la guía de envío."
    };
  }
}

/**
 * Agenda la recolección física del paquete comprado en la bodega.
 */
export async function scheduleShippoPickupAction(
  orderId: string,
  pickupDate: string, // Formato "YYYY-MM-DD"
  startTime: string,  // Formato "HH:MM" (e.g. "09:00")
  endTime: string,    // Formato "HH:MM" (e.g. "17:00")
  location: string    // e.g. "Warehouse"
) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get("user_role")?.value;
    const userId = cookieStore.get("user_session")?.value;

    if (userRole !== "ADMIN" && userRole !== "GERENTE" && userRole !== "BODEGA") {
      throw new Error("No autorizado. Debes ser administrador, gerente o encargado de bodega para programar recolecciones.");
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        warehouse: true,
      }
    });

    if (!order) {
      throw new Error("El pedido solicitado no existe.");
    }

    if (!order.shippoTransactionId) {
      throw new Error("Este pedido aún no tiene una guía de envío asociada para programar recolección.");
    }

    if (order.shippoPickupId) {
      throw new Error("Este pedido ya cuenta con una recolección agendada.");
    }

    const isSimulated = order.shippoTransactionId.startsWith("tx_sim_");
    const shippoApiKey = process.env.SHIPPO_API_KEY;

    let pickupObjectId = "";

    const startDateTimeStr = `${pickupDate}T${startTime}:00`;
    const endDateTimeStr = `${pickupDate}T${endTime}:00`;

    if (isSimulated || !shippoApiKey || shippoApiKey.trim() === "") {
      console.log(`[Shippo Mock] Agendando recolección simulada para pedido ${orderId}...`);
      pickupObjectId = `pk_sim_${Math.random().toString(36).substring(2, 12)}`;
    } else {
      console.log(`[Shippo API] Solicitando información de la transacción ${order.shippoTransactionId}...`);
      
      const txResponse = await fetch(`https://api.goshippo.com/transactions/${order.shippoTransactionId}`, {
        headers: { "Authorization": `ShippoToken ${shippoApiKey}` }
      });
      const txData = await txResponse.json();
      if (!txResponse.ok) {
        throw new Error(txData.message || "Error al obtener detalles de la transacción en Shippo.");
      }

      const carrierAccount = txData.rate?.carrier_account || txData.carrier_account;
      if (!carrierAccount) {
        throw new Error("No se pudo identificar la cuenta del transportista (carrier account) para programar la recolección.");
      }

      const warehouse = order.warehouse;
      if (!warehouse) {
        throw new Error("La bodega de origen no está configurada en el pedido.");
      }

      const isUsOrigin = warehouse.country === "Estados Unidos";
      const street1 = warehouse.address || "100 Biscayne Blvd";
      const city = warehouse.city || "Miami";
      const state = warehouse.state || "FL";
      const zip = warehouse.zip || "33132";
      const country = isUsOrigin ? "US" : "MX";
      const phone = warehouse.phone || "9991234567";

      console.log(`[Shippo API] Agendando recolección real con carrier_account: ${carrierAccount}...`);
      const response = await fetch("https://api.goshippo.com/pickups/", {
        method: "POST",
        headers: {
          "Authorization": `ShippoToken ${shippoApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          carrier_account: carrierAccount,
          transactions: [order.shippoTransactionId],
          pickup_time: {
            start_datetime: new Date(startDateTimeStr).toISOString(),
            end_datetime: new Date(endDateTimeStr).toISOString()
          },
          address: {
            name: warehouse.name,
            company: "Ikal Chukum",
            street1: street1,
            city: city,
            state: state,
            zip: zip,
            country: country,
            phone: phone,
            email: "bodega@ikalchukum.com"
          },
          requested_location: location
        })
      });

      const pickupData = await response.json();
      if (!response.ok) {
        console.error("Error en Shippo Pickup:", pickupData);
        throw new Error(pickupData.message || "Error al programar la recolección en Shippo.");
      }

      pickupObjectId = pickupData.object_id;
    }

    // Actualizar pedido
    await db.order.update({
      where: { id: orderId },
      data: {
        shippoPickupId: pickupObjectId
      }
    });

    // Registrar en auditoría
    await db.auditLog.create({
      data: {
        entity: "Order",
        entityId: orderId,
        action: "SCHEDULE_PICKUP",
        details: JSON.stringify({
          userId,
          pickupDate,
          startTime,
          endTime,
          location,
          shippoPickupId: pickupObjectId,
          simulated: isSimulated
        })
      }
    });

    revalidatePath("/pedidos");
    revalidatePath("/");

    return {
      success: true,
      pickupId: pickupObjectId
    };
  } catch (error: any) {
    console.error("Error in scheduleShippoPickupAction:", error);
    return {
      success: false,
      error: error.message || "Error al programar la recolección del envío."
    };
  }
}


