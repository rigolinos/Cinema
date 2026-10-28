import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - manifest.webmanifest (app instalável: o navegador busca sem login)
     * - .well-known (o Android lê o assetlinks.json do app da Google Play sem login)
     * - public folder files
     */
    '/((?!_next/static|_next/image|manifest.webmanifest|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
