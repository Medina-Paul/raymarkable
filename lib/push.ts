import webpush from 'web-push';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Ensure VAPID configuration is initialized once
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@raymarkable.com';
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

/**
 * Dispatches a native Web Push notification to all active devices registered for a user.
 * Automatically cleans up expired or invalidated subscriptions (HTTP 404 / 410).
 */
export async function sendWebPush(
  userId: string,
  payload: PushNotificationPayload
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[WebPush] VAPID keys not configured; skipping push dispatch.');
    return { success: false, sentCount: 0, reason: 'VAPID_NOT_CONFIGURED' };
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) {
    return { success: true, sentCount: 0 };
  }

  const notificationContent = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-192x192.png',
    url: payload.url || '/dashboard/habits',
    tag: payload.tag,
  });

  let sentCount = 0;

  await Promise.all(
    subs.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, notificationContent, {
          TTL: 86400, // Retain for 24 hours on push server if device is temporarily offline
          urgency: 'high', // Signal push gateways (APNs/FCM) to wake sleeping/background devices immediately
        });
        sentCount++;
      } catch (err: unknown) {
        const error = err as { statusCode?: number; message?: string };
        // HTTP 404 (Not Found) or 410 (Gone) indicates the subscription is expired or revoked
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          console.log(`[WebPush] Pruning expired subscription: ${sub.id}`);
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id))
            .catch((delErr) => console.warn('[WebPush] Failed to prune sub:', delErr));
        } else {
          console.error(`[WebPush] Failed to send to sub ${sub.id}:`, error?.message || err);
        }
      }
    })
  );

  return { success: true, sentCount };
}
