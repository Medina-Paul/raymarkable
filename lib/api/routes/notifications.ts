import { Elysia, t } from 'elysia';
import { requireAuth } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/*
NOTIFICATIONS API ROUTES
Fetches unread nudge notifications and marks them as read/dismissed.
*/
export const notificationsRoutes = new Elysia()
  .use(requireAuth)

  /*
  GET /api/v1/notifications
  Fetches only active, unread notifications for the logged-in user.
  */
  .get('/notifications', async ({ user }) => {
    const result = await db.select().from(notifications).where(and(eq(notifications.receiverId, user.id), eq(notifications.isRead, false)));
    return result;
  })
  
  /*
  POST /api/v1/notifications/:id/read
  Marks a notification as read when dismissed from the inbox or toast.
  */
  .post('/notifications/:id/read', async ({ user, params }) => {
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, params.id), eq(notifications.receiverId, user.id)));
    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ minLength: 1 })
    })
  });

