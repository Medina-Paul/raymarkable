import { Elysia } from 'elysia';
import { authPlugin } from '@/lib/api/auth';
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
  .use(authPlugin)

  /*
  POST /api/v1/push/subscribe
  Registers or updates a browser's PushSubscription object.
  */
  .post(
    '/subscribe',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return 'Unauthorized';
      }

      const { endpoint, keys } = body as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        set.status = 400;
        return 'Invalid subscription payload';
      }

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
    }
  )

  /*
  POST /api/v1/push/unsubscribe
  Removes a push subscription by its endpoint.
  */
  .post(
    '/unsubscribe',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return 'Unauthorized';
      }

      const { endpoint } = (body || {}) as { endpoint?: string };
      if (!endpoint) {
        set.status = 400;
        return 'Endpoint is required';
      }

      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, user.id),
            eq(pushSubscriptions.endpoint, endpoint)
          )
        );

      return { success: true };
    }
  )

  /*
  POST /api/v1/push/test
  Sends an immediate test push notification through web-push to the logged-in user.
  */
  .post('/test', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return 'Unauthorized';
    }

    const result = await sendWebPush(user.id, {
      title: 'Raymarkable Nudge Test',
      body: 'Web Push is active! You will now receive teammate alerts on this device.',
      url: '/dashboard/habits',
    });

    return result;
  });
