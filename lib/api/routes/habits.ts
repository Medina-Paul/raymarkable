import { Elysia } from 'elysia';
import { authPlugin } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { habits, categories, habitLogs, users, teamEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/*
HABITS API ROUTES
Covers the full lifecycle of habits: Listing, Creation, Updates, Increments, Toggles, and Deletions.
*/
export const habitsRoutes = new Elysia()
  .use(authPlugin)

  /*
  GET /api/v1/habits
  Fetches all habits owned by the authenticated user, joined with their category names.
  */
  .get('/habits', async ({ user, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    
    const result = await db
      .select({
        id: habits.id,
        title: habits.title,
        category: categories.name,
        date: habits.date,
        deadlineTime: habits.deadlineTime,
        habitType: habits.habitType,
        targetValue: habits.targetValue,
        currentValue: habits.currentValue,
        unit: habits.unit,
        scheduledDays: habits.scheduledDays,
        isActive: habits.isActive
      })
      .from(habits)
      .innerJoin(categories, eq(habits.categoryId, categories.id))
      .where(eq(habits.userId, user.id));
      
    return result.map(h => ({
      id: h.id,
      title: h.title,
      category: h.category,
      date: typeof h.date === 'string' ? h.date.split('T')[0] : ((h.date as any) instanceof Date ? (h.date as any).toISOString().split('T')[0] : String(h.date)),
      deadlineTime: h.deadlineTime,
      habitType: (h.habitType || 'boolean') as 'boolean' | 'numeric',
      targetValue: h.targetValue,
      currentValue: h.currentValue || 0,
      unit: h.unit,
      scheduledDays: h.scheduledDays ? JSON.parse(h.scheduledDays) : null,
      completed: !h.isActive, // In schema: isActive=false means accomplished
    }));
  })
  
  /*
  POST /api/v1/habits
  Creates a new habit for today, tomorrow, or yesterday (enforcing a 48h grace window).
  */
  .post('/habits', async ({ user, body, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    
    const payload = body as { 
      title: string; 
      category: string; 
      date: string; 
      deadlineTime?: string | null;
      habitType?: 'boolean' | 'numeric';
      targetValue?: number | null;
      unit?: string | null;
      scheduledDays?: string[] | null;
    };

    const { date, habitType = 'boolean', targetValue, scheduledDays } = payload;
    const deadlineTime = payload.deadlineTime || "23:59";
    const title = payload.title?.trim()?.substring(0, 60);
    const category = payload.category?.trim()?.substring(0, 25);
    const unit = payload.unit?.trim()?.substring(0, 20) || null;
    
    // Anti-cheat / 48-Hour Grace Window:
    // Users can log today, tomorrow, or yesterday (if they forgot to log before midnight),
    // but cannot backdate habits into the deep past.
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayObj.getDate()).padStart(2, '0')}`;
    
    if (date < yesterdayStr) {
      set.status = 400;
      return 'Cannot create habits older than the 48-hour grace period';
    }
    
    if (!title || !category) {
      set.status = 400;
      return 'Title and category are required';
    }
    
    // Auto-create category if it doesn't exist, or re-activate if hidden
    let categoryRecord = await db.select().from(categories).where(and(eq(categories.name, category), eq(categories.userId, user.id))).limit(1).then(res => res[0]);
    if (!categoryRecord) {
      categoryRecord = await db.insert(categories).values({ name: category, userId: user.id, isActive: true }).returning().then(res => res[0]);
    } else if (!categoryRecord.isActive) {
      categoryRecord = await db.update(categories).set({ isActive: true }).where(eq(categories.id, categoryRecord.id)).returning().then(res => res[0]);
    }
    
    const newHabit = await db.insert(habits).values({
      userId: user.id,
      title,
      categoryId: categoryRecord.id,
      date: date,
      deadlineTime,
      habitType,
      targetValue: habitType === 'numeric' ? (Number(targetValue) || 1) : null,
      currentValue: 0,
      unit: habitType === 'numeric' ? unit : null,
      scheduledDays: scheduledDays && scheduledDays.length > 0 ? JSON.stringify(scheduledDays) : null,
    }).returning().then(res => res[0]);
    
    return {
      id: newHabit.id,
      title: newHabit.title,
      category: categoryRecord.name,
      date: newHabit.date,
      deadlineTime: newHabit.deadlineTime,
      habitType: newHabit.habitType,
      targetValue: newHabit.targetValue,
      currentValue: newHabit.currentValue,
      unit: newHabit.unit,
      scheduledDays: newHabit.scheduledDays ? JSON.parse(newHabit.scheduledDays) : null,
      completed: false,
    };
  })
  
  /*
  PUT /api/v1/habits/:id
  Edits an existing habit's title, scheduled days, deadline, or targets.
  */
  .put('/habits/:id', async ({ user, params, body, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    
    const { 
      title, 
      category, 
      date, 
      deadlineTime,
      habitType = 'boolean',
      targetValue,
      unit,
      scheduledDays
    } = body as { 
      title: string; 
      category: string; 
      date: string; 
      deadlineTime?: string | null;
      habitType?: 'boolean' | 'numeric';
      targetValue?: number | null;
      unit?: string | null;
      scheduledDays?: string[] | null;
    };
    
    let categoryRecord = await db.select().from(categories).where(and(eq(categories.name, category), eq(categories.userId, user.id))).limit(1).then(res => res[0]);
    if (!categoryRecord) {
      categoryRecord = await db.insert(categories).values({ name: category, userId: user.id, isActive: true }).returning().then(res => res[0]);
    } else if (!categoryRecord.isActive) {
      categoryRecord = await db.update(categories).set({ isActive: true }).where(eq(categories.id, categoryRecord.id)).returning().then(res => res[0]);
    }
    
    const updated = await db.update(habits).set({
      title: title?.trim()?.substring(0, 60),
      categoryId: categoryRecord.id,
      date,
      deadlineTime,
      habitType,
      targetValue: habitType === 'numeric' ? (Number(targetValue) || 1) : null,
      unit: habitType === 'numeric' ? (unit?.trim()?.substring(0, 20) || null) : null,
      scheduledDays: scheduledDays && scheduledDays.length > 0 ? JSON.stringify(scheduledDays) : null,
    }).where(and(eq(habits.id, params.id), eq(habits.userId, user.id))).returning().then(res => res[0]);
    
    if (!updated) {
      set.status = 404;
      return 'Not found';
    }
    
    return {
      id: updated.id,
      title: updated.title,
      category: categoryRecord.name,
      date: updated.date,
      deadlineTime: updated.deadlineTime,
      habitType: updated.habitType,
      targetValue: updated.targetValue,
      currentValue: updated.currentValue,
      unit: updated.unit,
      scheduledDays: updated.scheduledDays ? JSON.parse(updated.scheduledDays) : null,
      completed: !updated.isActive,
    };
  })

  /*
  PATCH /api/v1/habits/:id/progress
  Handles step increments for numeric habits (e.g. +1 page or +250ml water).
  Automatically synchronizes the permanent completion log in habit_logs and broadcasts to team feed.
  */
  .patch('/habits/:id/progress', async ({ user, params, body, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    
    const { delta, value } = body as { delta?: number; value?: number };
    
    const habit = await db.select().from(habits).where(and(eq(habits.id, params.id), eq(habits.userId, user.id))).limit(1).then(res => res[0]);
    if (!habit) { set.status = 404; return 'Not found'; }
    
    let newVal = habit.currentValue;
    if (typeof delta === 'number') {
      newVal = Math.max(0, habit.currentValue + delta);
    } else if (typeof value === 'number') {
      newVal = Math.max(0, value);
    }
    
    const target = habit.targetValue || 1;
    const isCompleted = newVal >= target;
    const wasCompleted = !habit.isActive;
    
    const updated = await db.update(habits).set({
      currentValue: newVal,
      isActive: !isCompleted,
    }).where(eq(habits.id, habit.id)).returning().then(res => res[0]);
    
    // Sync with habitLogs historical ledger
    const habitDateStr = typeof habit.date === 'string' ? habit.date.split('T')[0] : ((habit.date as any) instanceof Date ? (habit.date as any).toISOString().split('T')[0] : String(habit.date));
    
    if (isCompleted) {
      const existingLog = await db.select().from(habitLogs).where(eq(habitLogs.habitId, habit.id)).limit(1).then(res => res[0]);
      if (existingLog) {
        await db.update(habitLogs).set({
          loggedValue: newVal,
          status: true,
          completedDate: habitDateStr,
        }).where(eq(habitLogs.id, existingLog.id));
      } else {
        await db.insert(habitLogs).values({
          habitId: habit.id,
          completedDate: habitDateStr,
          loggedValue: newVal,
          status: true,
        });
      }
      
      // If user achieved target completion and is in a team, broadcast social celebration event
      if (!wasCompleted) {
        const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
        if (currentUser?.teamId) {
          await db.insert(teamEvents).values({
            teamId: currentUser.teamId,
            eventType: 'COMPLETION',
            actorId: user.id,
            message: `completed '${habit.title}' (${newVal}/${target} ${habit.unit || 'units'})`
          });
        }
      }
    } else {
      // If uncompleted (e.g. subtracted progress below target), remove log
      await db.delete(habitLogs).where(eq(habitLogs.habitId, habit.id));
    }
    
    return {
      id: updated.id,
      title: updated.title,
      currentValue: updated.currentValue,
      targetValue: updated.targetValue,
      unit: updated.unit,
      completed: isCompleted,
    };
  })

  /*
  PATCH /api/v1/habits/:id/toggle
  Toggles completion on/off for boolean habits with 1-click.
  */
  .patch('/habits/:id/toggle', async ({ user, params, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    
    const habit = await db.select().from(habits).where(and(eq(habits.id, params.id), eq(habits.userId, user.id))).limit(1).then(res => res[0]);
    if (!habit) { set.status = 404; return 'Not found'; }
    
    const newIsActive = !habit.isActive;
    const isNowCompleted = !newIsActive;
    
    let updatedCurrentValue = habit.currentValue;
    if (habit.habitType === 'numeric') {
      if (isNowCompleted && habit.currentValue < (habit.targetValue || 1)) {
        updatedCurrentValue = habit.targetValue || 1;
      } else if (!isNowCompleted) {
        updatedCurrentValue = 0;
      }
    }
    
    await db.update(habits).set({ 
      isActive: newIsActive,
      currentValue: updatedCurrentValue
    }).where(eq(habits.id, habit.id));
    
    const habitDateStr = typeof habit.date === 'string' ? habit.date.split('T')[0] : ((habit.date as any) instanceof Date ? (habit.date as any).toISOString().split('T')[0] : String(habit.date));
    
    if (isNowCompleted) {
      const existingLog = await db.select().from(habitLogs).where(eq(habitLogs.habitId, habit.id)).limit(1).then(res => res[0]);
      if (existingLog) {
        await db.update(habitLogs).set({
          completedDate: habitDateStr,
          loggedValue: updatedCurrentValue || 1,
          status: true,
        }).where(eq(habitLogs.id, existingLog.id));
      } else {
        await db.insert(habitLogs).values({
          habitId: habit.id,
          completedDate: habitDateStr,
          loggedValue: updatedCurrentValue || 1,
          status: true,
        });
      }
      
      const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
      if (currentUser?.teamId) {
        await db.insert(teamEvents).values({
          teamId: currentUser.teamId,
          eventType: 'COMPLETION',
          actorId: user.id,
          message: `completed '${habit.title}'`
        });
      }
    } else {
      await db.delete(habitLogs).where(eq(habitLogs.habitId, habit.id));
    }
    
    return { success: true };
  })
  
  /*
  DELETE /api/v1/habits/:id
  Permanently removes a habit and cascades deletion of its history logs.
  */
  .delete('/habits/:id', async ({ user, params, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    await db.delete(habits).where(and(eq(habits.id, params.id), eq(habits.userId, user.id)));
    return { success: true };
  });
