import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // CSRF protection: Verify Origin header on mutating API requests
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    // Allow requests with no origin (same-origin non-CORS requests from some browsers)
    // but reject requests where origin doesn't match host
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return new NextResponse('Forbidden', { status: 403 });
        }
      } catch {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
    Match all request paths except for the ones starting with:
    - _next/static (static files)
    - _next/image (image optimization files)
    - favicon.ico (favicon file)
    - icons (PWA icons)
    - sw.js (service worker)
    - manifest.webmanifest (manifest)
    - manifest.json (manifest fallback)
    */
    '/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
