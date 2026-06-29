import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/** Rutas accesibles sin sesión. */
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Comprobación optimista basada en la cookie de sesión (sin tocar la BD).
 * La verificación real ocurre server-side en el layout del dashboard
 * (`requireSession`). No importar la instancia `auth` aquí: rompe el bundle edge.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!sessionCookie && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (sessionCookie && isPublicRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
