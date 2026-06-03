import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Sesión cerrada correctamente",
    });

    // Limpiar las cookies de sesión seteando maxAge a 0
    response.cookies.set("user_session", "", {
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("user_role", "", {
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("user_name", "", {
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Error en POST /api/auth/logout:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al cerrar sesión" },
      { status: 500 }
    );
  }
}
