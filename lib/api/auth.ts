import { Elysia } from 'elysia';
import { createClient } from '@/lib/supabase/server';

/*
REUSABLE ELYSIA AUTH PLUGIN

Instead of writing `const user = await getUser()` in every single route handler,
this plugin automatically reads the Supabase Auth session from request cookies
and injects `{ user }` into the context of every endpoint that uses it.

`as: 'scoped'` ensures that any Elysia sub-router mounting this plugin will inherit
full TypeScript type inference for the `user` property.
*/
export const authPlugin = new Elysia({ name: 'auth' })
  .derive({ as: 'scoped' }, async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { user };
  });
