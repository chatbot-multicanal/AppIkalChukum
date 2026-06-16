import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendCommentNotification } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const warehouseId = searchParams.get("warehouseId");

    // Construir filtros de búsqueda
    const where: any = {};
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;

    const comments = await db.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, comments });
  } catch (error: any) {
    console.error("Error en GET /api/inventario/comentarios:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener comentarios" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_session")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Sesión no válida." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, productId, warehouseId } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "El contenido del comentario es requerido." },
        { status: 400 }
      );
    }

    // Crear el comentario en la base de datos
    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        productId: productId || null,
        warehouseId: warehouseId || null,
        userId: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Enviar notificación por correo de forma asíncrona (sin bloquear la respuesta HTTP)
    try {
      const productSku = comment.product?.sku;
      const productName = comment.product?.name;
      const warehouseName = comment.warehouse?.name;
      
      // Llamar a la utilidad de correo
      await sendCommentNotification(comment, productSku, productName, warehouseName);
    } catch (mailError) {
      console.error("Error al enviar notificación de comentario por correo:", mailError);
    }

    return NextResponse.json({ success: true, comment });
  } catch (error: any) {
    console.error("Error en POST /api/inventario/comentarios:", error);
    return NextResponse.json(
      { error: error.message || "Error al guardar el comentario" },
      { status: 500 }
    );
  }
}
