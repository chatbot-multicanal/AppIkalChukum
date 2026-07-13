import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Obtener las cookies de autenticación
  const userSession = request.cookies.get("user_session")?.value;
  const userRole = request.cookies.get("user_role")?.value;

  // Definir qué rutas son consideradas públicas o internas
  const isLoginPage = pathname === "/login";
  const isAuthApi = pathname.startsWith("/api/auth");
  const isStaticFile = 
    pathname.startsWith("/_next") || 
    pathname.includes(".") || 
    pathname === "/favicon.ico";

  const isApiRoute = pathname.startsWith("/api");
  const isCriticalApi = pathname.startsWith("/api/comisiones/config");

  // Permitir el paso para archivos estáticos, APIs de autenticación y APIs normales sin redirección
  if (isStaticFile || isAuthApi || (isApiRoute && !isCriticalApi)) {
    return NextResponse.next();
  }

  // 2. Si no tiene sesión iniciada y no está en la página de login, redirigir a /login
  if (!userSession && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Si tiene sesión iniciada e intenta acceder a /login, redirigir al home
  if (userSession && isLoginPage) {
    const dashboardUrl = new URL("/", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 4. Protección específica de Administración para APIs o vistas críticas
  // Si intenta actualizar la configuración de comisión y no es ADMIN
  if (isCriticalApi && userRole !== "ADMIN") {
    return NextResponse.json(
      { error: "No autorizado. Requiere rol de Administrador." },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

// Configurar en qué rutas se ejecutará el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (except for api/comisiones/config)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons)
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/comisiones/config"
  ],
};
