import { Elysia, t } from 'elysia';
import { requireAuth } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/*
CATEGORIES API ROUTES
Manages habit categories with preset visibility management.
*/
export const categoriesRoutes = new Elysia()
  .use(requireAuth)

  /*
  GET /api/v1/categories
  Fetches all active category presets belonging to the current user.
  */
  .get('/categories', async ({ user }) => {
    const result = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.userId, user.id), eq(categories.isActive, true)));
    return result;
  })

  /*
  DELETE /api/v1/categories/:id
  Removes a category from the active preset suggestions in the modal.
  Does NOT delete or modify past habits, archives, or streaks.
  */
  .delete('/categories/:id', async ({ user, params }) => {
    // Soft hide: Set isActive to false so it disappears from the suggestion dropdown
    // while keeping all past habits and archive records intact.
    await db
      .update(categories)
      .set({ isActive: false })
      .where(and(eq(categories.id, params.id), eq(categories.userId, user.id)));
      
    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ minLength: 1 })
    })
  });

