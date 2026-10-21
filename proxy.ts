import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/** Rutas accesibles sin sesión. */
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Comprobación optimista basada en la cookie de sesión (sin tocar la BD).
 * La verificación real ocurre server-side en el layout del dashboard
 * (`requireSession`). No importar la instancia `auth` aquí: rompe el bundle edge.
 *
 * Importante: `getSessionCookie` solo mira si la cookie existe, no si la
 * sesión sigue vigente en la BD (eso requeriría tocar la BD, lo que no
 * queremos hacer acá). Por eso NO redirigimos lejos de `/login` solo porque
 * haya cookie: si la sesión real ya expiró, `requireSession()` manda para
 * acá, la cookie todavía está puesta, y "cookie presente ⇒ ya logueado"
 * terminaría rebotando de nuevo a `/` en loop infinito (`/auto` → `/login` →
 * `/` → `/login` → …), que es justo el bug que se reportó. La página de
 * login hace su propio chequeo real (`verifySession`) para saltear el
 * formulario cuando la sesión sí es válida.
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.).*)'],
};
