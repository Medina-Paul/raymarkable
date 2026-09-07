import { Elysia } from 'elysia';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

/*
REUSABLE ELYSIA AUTH PLUGIN

Reads the Supabase Auth session directly from:
1. Next.js server cookie store (when called within Next.js Route Handler request scope)
2. HTTP Authorization header (Bearer token)
3. Direct Cookie header parsing from incoming Request (as resilient fallback)
*/
export const authPlugin = new Elysia({ name: 'auth' })
  .derive({ as: 'global' }, async ({ request, cookie }) => {
    // 1. First attempt: Next.js native cookies() via createServerSupabase
    try {
      const serverClient = await createServerSupabase();
      const { data: { user }, error } = await serverClient.auth.getUser();
      if (!error && user) {
        return { user };
      }
    } catch {
      // Outside request scope or cookies() threw, proceed to fallbacks
    }

    // 2. Check for Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        }
      );
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          return { user };
        }
      } catch {
        // Fall through
      }
    }

    // 3. Fallback: Read from Cookie header directly from incoming Request
    const nextReqCookies = (request as unknown as { cookies?: { getAll?: () => Array<{ name: string; value: string }> } })?.cookies;
    let parsedCookies: { name: string; value: string }[] = [];
    if (typeof nextReqCookies?.getAll === 'function') {
      try {
        parsedCookies = nextReqCookies.getAll();
      } catch {
        parsedCookies = [];
      }
    }

    if (parsedCookies.length === 0) {
      const rawCookie = request.headers.get('cookie') || '';
      if (rawCookie) {
        const pairs = rawCookie.split(';');
        for (const pair of pairs) {
          const idx = pair.indexOf('=');
          if (idx > -1) {
            const name = pair.slice(0, idx).trim();
            let value = pair.slice(idx + 1).trim();
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            }
            try {
              value = decodeURIComponent(value);
            } catch {
              // keep raw value if URI decoding fails
            }
            if (name) {
              parsedCookies.push({ name, value });
            }
          }
        }
      }
    }

    if (parsedCookies.length === 0) {
      return { user: null };
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return parsedCookies;
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                if (cookie && cookie[name]) {
                  cookie[name].set({ value, ...options });
                }
              });
            } catch {
              // Ignore if headers are already committed
            }
          },
        },
      }
    );

    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return { user: null };
      }
      return { user };
    } catch {
      return { user: null };
    }
  });

export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(authPlugin)
  .onBeforeHandle({ as: 'scoped' }, ({ user, request, set }) => {
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        const rawCookies = request.headers.get('cookie');
        console.warn(`[API Auth 401] ${request.method} ${request.url} - Cookies received: ${rawCookies ? rawCookies.substring(0, 50) + '...' : 'NONE'}`);
      }
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
  })
  .resolve({ as: 'scoped' }, ({ user }) => {
    return { user: user! };
  });
