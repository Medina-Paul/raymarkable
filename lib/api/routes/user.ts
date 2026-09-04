import { Elysia } from 'elysia';
import { authPlugin } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { habits, habitLogs, users, teams } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';

/*
USER PROFILE, STREAK & ACCOUNT DELETION ROUTES
Handles fetching current user stats, dynamic streaks, updating profile settings,
and permanently deleting accounts with complete data wipes.
*/
export const userRoutes = new Elysia()
  .use(authPlugin)
  
  /*
  GET /api/v1/me
  Fetches the user's dashboard overview: total habits, completed habits, and live streak.
  */
  .get('/me', async ({ user, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    
    const me = await db.select().from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!me) { set.status = 404; return 'User not found'; }
    
    // 1. Fetch total and completed habits count
    const totalHabits = await db.select({ id: habits.id }).from(habits).where(eq(habits.userId, user.id));
    const completedCount = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.userId, user.id), eq(habits.isActive, false)));
    
    // 2. Fetch the most recent completed habit activity
    const latest = await db.select({ title: habits.title, date: habits.date }).from(habits)
      .where(and(eq(habits.userId, user.id), eq(habits.isActive, false)))
      .limit(1).then(res => res[0]);

    // 3. Dynamic Streak Calculation
    // Instead of relying on a static counter, we calculate consecutive active days dynamically
    // from actual completed dates in habit_logs.
    const logs = await db.select({ completedDate: habitLogs.completedDate })
      .from(habitLogs)
      .innerJoin(habits, eq(habitLogs.habitId, habits.id))
      .where(eq(habits.userId, user.id))
      .orderBy(habitLogs.completedDate);
      
    // Deduplicate dates into unique sorted strings (YYYY-MM-DD)
    const logDates = Array.from(new Set(logs.map(l => {
      if (typeof l.completedDate === 'string') return l.completedDate.split('T')[0];
      if ((l.completedDate as any) instanceof Date) return (l.completedDate as any).toISOString().split('T')[0];
      return String(l.completedDate);
    }))).sort();
    
    let dynamicStreak = 0;
    if (logDates.length > 0) {
      let tempStreak = 0;
      let prevDate = null;
      
      // Traverse historical logs to count consecutive days
      for (let i = 0; i < logDates.length; i++) {
        const dStr = logDates[i];
        const [year, month, day] = dStr.split('-').map(Number);
        const currDate = new Date(year, month - 1, day);
        
        if (!prevDate) {
          tempStreak = 1;
        } else {
          const diffTime = currDate.getTime() - prevDate.getTime();
          const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
          
          if (diffDays === 1) {
            tempStreak++;
          } else if (diffDays > 1) {
            tempStreak = 1; // Gap detected -> reset streak counter
          }
        }
        prevDate = currDate;
      }
  
      // The streak remains alive if the user completed tasks either Today or Yesterday (48h grace)
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      
      const lastLogDate = logDates[logDates.length - 1];
      if (lastLogDate === todayStr || lastLogDate === yesterdayStr) {
        dynamicStreak = tempStreak;
      } else {
        dynamicStreak = 0; // Streak broken if no completions yesterday or today
      }
    }

    return {
      name: me.name,
      avatarUrl: me.avatarUrl,
      streak: dynamicStreak,
      totalHabits: totalHabits.length,
      completedHabits: completedCount.length,
      latestActivity: latest ? { title: latest.title, date: typeof latest.date === 'string' ? latest.date.split('T')[0] : ((latest.date as any) instanceof Date ? (latest.date as any).toISOString().split('T')[0] : String(latest.date)) } : null
    };
  })
  
  /*
  PATCH /api/v1/me
  Updates user settings (e.g. daily success threshold percentage, display name, avatar).
  */
  .patch('/me', async ({ body, user, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    const { successThreshold, name, avatarUrl } = body as any;
    
    const updates: any = {};
    if (successThreshold !== undefined) updates.successThreshold = successThreshold;
    if (name !== undefined) updates.name = name;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    
    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, user.id));
    }
    
    return { success: true };
  })

  /*
  DELETE /api/v1/me
  Permanently deletes the user account and purges all habits, categories, logs, and notifications.
  Handles team leadership succession or team cleanup if the user is in a pod.
  */
  .delete('/me', async ({ user, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }

    const currentUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!currentUser) { set.status = 404; return 'User not found'; }

    // If the user belongs to a team, handle team cleanup or leader succession
    if (currentUser.teamId) {
      const remainingMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.teamId, currentUser.teamId), ne(users.id, user.id)));

      if (remainingMembers.length === 0) {
        // If user was the only member, delete the team
        await db.delete(teams).where(eq(teams.id, currentUser.teamId));
      } else {
        // If user was team leader, pass the crown to the next member
        const team = await db.select().from(teams).where(eq(teams.id, currentUser.teamId)).limit(1).then(res => res[0]);
        if (team && team.createdBy === user.id) {
          await db.update(teams).set({ createdBy: remainingMembers[0].id }).where(eq(teams.id, currentUser.teamId));
        }
      }
    }

    // Deleting from users automatically cascades to habits, habitLogs, categories, notifications, and events
    await db.delete(users).where(eq(users.id, user.id));

    return { success: true };
  });
