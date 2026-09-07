import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const forwardedHost = request.headers.get('x-forwarded-host') 
    const isLocalhost = process.env.NODE_ENV === 'development'
    const redirectUrl = (!isLocalhost && forwardedHost) 
      ? `https://${forwardedHost}${next}` 
      : `${origin}${next}`

    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error("[Auth Callback] exchangeCodeForSession failed:", error.message || error);
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }
    
    if (user) {
      // Upsert the user to our public schema
      try {
        await db.insert(users).values({
          id: user.id,
          email: user.email || '',
          name: (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous').substring(0, 25),
          avatarUrl: user.user_metadata?.avatar_url || null,
        }).onConflictDoUpdate({
          target: users.id,
          set: {
            email: user.email || ''
          }
        });
      } catch (err) {
        console.error("Failed to sync user to database:", err);
      }

      return response
    }
  } else {
    console.warn("[Auth Callback] No code provided in URL searchParams");
  }

  // If there's an error or no code, redirect back to login
  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}
