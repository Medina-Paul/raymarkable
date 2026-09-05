import { Elysia } from 'elysia';
import { userRoutes } from '@/lib/api/routes/user';
import { categoriesRoutes } from '@/lib/api/routes/categories';
import { habitsRoutes } from '@/lib/api/routes/habits';
import { teamsRoutes } from '@/lib/api/routes/teams';
import { notificationsRoutes } from '@/lib/api/routes/notifications';
import { pushRoutes } from '@/lib/api/routes/push';

const app = new Elysia({ prefix: '/api/v1' })
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
