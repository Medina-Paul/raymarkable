import { Elysia } from 'elysia';
import { authPlugin } from '@/lib/api/auth';
import { userRoutes } from '@/lib/api/routes/user';
import { categoriesRoutes } from '@/lib/api/routes/categories';
import { habitsRoutes } from '@/lib/api/routes/habits';
import { teamsRoutes } from '@/lib/api/routes/teams';
import { notificationsRoutes } from '@/lib/api/routes/notifications';
import { pushRoutes } from '@/lib/api/routes/push';

const app = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)
  .onError(({ code, error, set }) => {
    console.error(`[API Error] ${code}:`, error);
    if (code === 'VALIDATION') {
      set.status = 400;
      const validationError = error as unknown as { all?: Array<{ summary?: string }> };
      const summary = validationError?.all?.[0]?.summary;
      return {
        success: false,
        error: summary || (error instanceof Error ? error.message : 'Validation error'),
      };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { success: false, error: 'Not found' };
    }
    const currentStatus = typeof set.status === 'number' ? set.status : 500;
    set.status = currentStatus >= 400 ? currentStatus : 500;
    const errorRecord = error as unknown as Record<string, unknown> | null;
    const message =
      error instanceof Error
        ? error.message
        : typeof errorRecord?.message === 'string'
        ? errorRecord.message
        : 'Internal server error';
    return { success: false, error: message };
  })
  .use(userRoutes)
  .use(categoriesRoutes)
  .use(habitsRoutes)
  .use(teamsRoutes)
  .use(notificationsRoutes)
  .use(pushRoutes);

export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const PATCH = app.handle;
export const DELETE = app.handle;
