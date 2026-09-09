import { Elysia, t } from 'elysia';
import { requireAuth } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { habits, habitLogs, users, teams, teamMembers } from '@/lib/db/schema';
import { eq, and, ne, desc } from 'drizzle-orm';
import { calculateStreaks, normalizeDate } from '@/lib/services/streak';
import { createClient } from '@/lib/supabase/server';

/*
USER PROFILE, STREAK & ACCOUNT DELETION ROUTES
Handles fetching current user stats, dynamic streaks, updating profile settings,
and permanently deleting accounts with complete data wipes.
*/
export const userRoutes = new Elysia()
  .use(requireAuth)
  
  /*
  GET /api/v1/me
  Fetches the user's dashboard overview: total habits, completed habits, and live streak.
  */
  .get('/me', async ({ user, headers, set }) => {
    const me = await db.select().from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!me) {
      set.status = 404;
      return { success: false, error: 'User not found' };
    }
    
    const clientDate = (headers['x-client-date'] as string) || normalizeDate(new Date());

    // 1. Fetch today's total and completed habits count
    const totalHabits = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.userId, user.id), eq(habits.date, clientDate)));

    const completedCount = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.userId, user.id), eq(habits.date, clientDate), eq(habits.isActive, false)));
    
    // 2. Fetch the most recent completed habit activity (ordered properly by date and creation)
    const latest = await db.select({ title: habits.title, date: habits.date }).from(habits)
      .where(and(eq(habits.userId, user.id), eq(habits.isActive, false)))
      .orderBy(desc(habits.date), desc(habits.createdAt))
      .limit(1).then(res => res[0]);

    // 3. Dynamic Streak Calculation
    // Instead of relying on a static counter, we calculate consecutive active days dynamically
    // from actual completed dates in habit_logs, anchored to the user's localized device date.
    const logs = await db.select({ completedDate: habitLogs.completedDate })
      .from(habitLogs)
      .innerJoin(habits, eq(habitLogs.habitId, habits.id))
      .where(eq(habits.userId, user.id))
      .orderBy(habitLogs.completedDate);
      
    const { currentStreak, bestStreak: calculatedBest } = calculateStreaks(
      logs.map(l => l.completedDate),
      clientDate
    );

    // Maintain historical best record (e.g. 13) or upgrade when currentStreak surpasses it
    const effectiveBest = Math.max(calculatedBest, me.bestStreak || 0, currentStreak);
    
    if (effectiveBest > (me.bestStreak || 0) || currentStreak !== me.currentStreak) {
      await db.update(users).set({
        bestStreak: effectiveBest,
        currentStreak: currentStreak,
      }).where(eq(users.id, user.id));
    }

    return {
      name: me.name,
      avatarUrl: me.avatarUrl,
      streak: currentStreak,
      bestStreak: effectiveBest,
      totalHabits: totalHabits.length,
      completedHabits: completedCount.length,
      activeHabits: totalHabits.length - completedCount.length,
      latestActivity: latest ? { title: latest.title, date: normalizeDate(latest.date) } : null
    };
  })

  
  /*
  PATCH /api/v1/me
  Updates user settings (e.g. daily success threshold percentage, display name, avatar).
  */
  .patch('/me', async ({ body, user }) => {
    const { successThreshold, name, avatarUrl } = body;
    
    const updates: { successThreshold?: number; name?: string; avatarUrl?: string } = {};
    if (successThreshold !== undefined) updates.successThreshold = successThreshold;
    if (name !== undefined) updates.name = name.trim().substring(0, 25);
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    
    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, user.id));
    }
    
    return { success: true };
  }, {
    body: t.Object({
      successThreshold: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
      name: t.Optional(t.String()),
      avatarUrl: t.Optional(t.String()),
    })
  })

  /*
  DELETE /api/v1/me
  Permanently deletes the user account and purges all habits, categories, logs, and notifications.
  Handles team leadership succession or team cleanup if the user is in a pod.
  */
  .delete('/me', async ({ user, set }) => {
    const currentUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!currentUser) {
      set.status = 404;
      return { success: false, error: 'User not found' };
    }

    // If the user belongs to any teams, handle team cleanup or leader succession across all pods
    const userMemberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id));

    for (const membership of userMemberships) {
      const remainingMembers = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, membership.teamId), ne(teamMembers.userId, user.id)))
        .orderBy(teamMembers.joinedAt);

      if (remainingMembers.length === 0) {
        // If user was the only member, delete the team
        await db.delete(teams).where(eq(teams.id, membership.teamId));
      } else {
        // If user was team leader, pass the crown to the next member
        const team = await db
          .select({ createdBy: teams.createdBy })
          .from(teams)
          .where(eq(teams.id, membership.teamId))
          .limit(1)
          .then((res) => res[0]);

        if (team && team.createdBy === user.id) {
          const nextLeaderId = remainingMembers[0].userId;
          await db.update(teams).set({ createdBy: nextLeaderId }).where(eq(teams.id, membership.teamId));
          await db
            .update(teamMembers)
            .set({ role: 'leader' })
            .where(and(eq(teamMembers.teamId, membership.teamId), eq(teamMembers.userId, nextLeaderId)));
        }
      }
    }

    // Deleting from users automatically cascades to habits, habitLogs, categories, notifications, and events
    await db.delete(users).where(eq(users.id, user.id));

    // Sign out Supabase auth session so the client cookies are cleared
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (authErr) {
      console.warn('[User] Failed to sign out supabase session on account deletion:', authErr);
    }

    return { success: true };
  });

