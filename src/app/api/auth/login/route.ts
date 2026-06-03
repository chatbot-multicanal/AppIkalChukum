import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "El correo y la contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Buscar el usuario por email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Comprobar la contraseña (en producción usar hash con bcrypt)
    if (user.password !== password) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { error: "Esta cuenta está desactivada" },
        { status: 403 }
      );
    }

    // Crear la respuesta
    const response = NextResponse.json({
      success: true,
      message: "Ingreso exitoso",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    const isProd = process.env.NODE_ENV === "production";
    const oneWeek = 60 * 60 * 24 * 7;

    // Cookie de sesión (HTTP-only para seguridad)
    response.cookies.set("user_session", user.id, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: oneWeek,
    });

    // Cookie de rol (accesible por JS en cliente para UI)
    response.cookies.set("user_role", user.role, {
      path: "/",
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: oneWeek,
    });

    // Cookie del nombre (para mostrar en el frontend)
    response.cookies.set("user_name", user.name, {
      path: "/",
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: oneWeek,
    });

    return response;
  } catch (error: any) {
    console.error("Error en POST /api/auth/login:", error);
    return NextResponse.json(
      { error: "Ocurrió un error interno del servidor" },
      { status: 500 }
    );
  }
}
