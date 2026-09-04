import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      // Upsert the user to our public schema
      try {
        await db.insert(users).values({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
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

      const forwardedHost = request.headers.get('x-forwarded-host') 
      const isLocalhost = process.env.NODE_ENV === 'development'
      
      if (isLocalhost) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // If there's an error or no code, redirect back to login
  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}
