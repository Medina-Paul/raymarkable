import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
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
