import { Elysia, t } from 'elysia';
import { requireAuth } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { sendWebPush } from '@/lib/push';
import { eq, and } from 'drizzle-orm';

/*
PUSH NOTIFICATIONS API ROUTES
Handles registering and unregistering Web Push subscriptions for user devices,
and triggering test push notifications.
*/
export const pushRoutes = new Elysia({ prefix: '/push' })
  .use(requireAuth)

  /*
  POST /api/v1/push/subscribe
  Registers or updates a browser's PushSubscription object.
  */
  .post(
    '/subscribe',
    async ({ user, body }) => {
      const { endpoint, keys } = body;

      await db
        .insert(pushSubscriptions)
        .values({
          userId: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        })
        .onConflictDoUpdate({
          target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
          set: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
        });

      return { success: true };
    },
    {
      body: t.Object({
        endpoint: t.String({ minLength: 1 }),
        keys: t.Object({
          p256dh: t.String({ minLength: 1 }),
          auth: t.String({ minLength: 1 }),
        }),
      }),
    }
  )

  /*
  POST /api/v1/push/unsubscribe
  Removes a push subscription by its endpoint.
  */
  .post(
    '/unsubscribe',
    async ({ user, body }) => {
      const { endpoint } = body;

      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, user.id),
            eq(pushSubscriptions.endpoint, endpoint)
          )
        );

      return { success: true };
    },
    {
      body: t.Object({
        endpoint: t.String({ minLength: 1 }),
      }),
    }
  )

  /*
  POST /api/v1/push/test
  Sends an immediate test push notification through web-push to the logged-in user.
  */
  .post('/test', async ({ user }) => {
    const result = await sendWebPush(user.id, {
      title: 'Raymarkable Nudge Test',
      body: 'Web Push is active! You will now receive teammate alerts on this device.',
      url: '/dashboard/habits',
    });

    return result;
  });

