import { Elysia, t } from 'elysia';
import { requireAuth } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { habits, categories, habitLogs, users, teamEvents, teamMembers } from '@/lib/db/schema';
import { eq, and, isNotNull, isNull } from 'drizzle-orm';
import { formatLocalDate } from '@/lib/utils/formatters';
import { normalizeDate } from '@/lib/services/streak';


const habitBodySchema = t.Object({
  title: t.String({ minLength: 1 }),
  category: t.String({ minLength: 1 }),
  date: t.String({ minLength: 10 }),
  deadlineTime: t.Optional(t.Nullable(t.String())),
  habitType: t.Optional(t.Union([t.Literal('boolean'), t.Literal('numeric')])),
  targetValue: t.Optional(t.Nullable(t.Number())),
  unit: t.Optional(t.Nullable(t.String())),
  scheduledDays: t.Optional(t.Nullable(t.Array(t.String()))),
});

/*
HABITS API ROUTES
Covers the full lifecycle of habits: Listing, Creation, Updates, Increments, Toggles, and Deletions.
*/
export const habitsRoutes = new Elysia()
  .use(requireAuth)

  /*
  GET /api/v1/habits
  Fetches all habits owned by the authenticated user, joined with their category names.
  Auto-spawns scheduled recurring habits if today matches their repeat schedule.
  */
  .get('/habits', async ({ user, headers }) => {
    const clientDate = (headers['x-client-date'] as string) || normalizeDate(new Date());

    // 1. Auto-spawn recurring habits for clientDate if scheduled
    const recurringHabits = await db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, user.id), isNotNull(habits.scheduledDays)));

    if (recurringHabits.length > 0) {
      const [y, m, dayNum] = clientDate.split('-').map(Number);
      const dayIndex = new Date(Date.UTC(y, m - 1, dayNum)).getUTCDay();
      const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const currentDayKey = DAY_KEYS[dayIndex];

      // Deduplicate recurring blueprints by title and categoryId (keep latest)
      const uniqueRecurring = new Map<string, typeof recurringHabits[0]>();
      for (const rh of recurringHabits) {
        const key = `${rh.title.trim().toLowerCase()}:::${rh.categoryId}`;
        if (!uniqueRecurring.has(key)) {
          uniqueRecurring.set(key, rh);
        }
      }

      // Query habits already existing on clientDate
      const existingToday = await db
        .select({ title: habits.title, categoryId: habits.categoryId })
        .from(habits)
        .where(and(eq(habits.userId, user.id), eq(habits.date, clientDate)));

      const existingKeys = new Set(
        existingToday.map(h => `${h.title.trim().toLowerCase()}:::${h.categoryId}`)
      );

      for (const [key, rh] of uniqueRecurring.entries()) {
        try {
          const days: string[] = rh.scheduledDays ? JSON.parse(rh.scheduledDays) : [];
          if (Array.isArray(days) && days.includes(currentDayKey) && !existingKeys.has(key)) {
            // Spawn instance for clientDate
            await db.insert(habits).values({
              userId: user.id,
              title: rh.title,
              categoryId: rh.categoryId,
              date: clientDate,
              deadlineTime: rh.deadlineTime,
              habitType: rh.habitType,
              targetValue: rh.targetValue,
              currentValue: 0,
              unit: rh.unit,
              scheduledDays: rh.scheduledDays,
              isActive: true,
            });
            existingKeys.add(key);
          }
        } catch (err) {
          console.error('[Habits] Failed to parse scheduledDays or spawn repeating habit:', err);
        }
      }
    }

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
      date: normalizeDate(h.date),
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
    const { date, habitType = 'boolean', targetValue, scheduledDays } = body;
    const deadlineTime = body.deadlineTime || "23:59";
    const title = body.title.trim().substring(0, 60);
    const category = body.category.trim().substring(0, 25);
    const unit = body.unit?.trim().substring(0, 20) || null;
    
    // Anti-cheat / 48-Hour Grace Window:
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterdayObj);
    
    if (date < yesterdayStr) {
      set.status = 400;
      return { success: false, error: 'Cannot create habits older than the 48-hour grace period' };
    }
    
    if (!title || !category) {
      set.status = 400;
      return { success: false, error: 'Title and category are required' };
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
  }, {
    body: habitBodySchema,
  })
  
  /*
  PUT /api/v1/habits/:id
  Edits an existing habit's title, scheduled days, deadline, or targets.
  */
  .put('/habits/:id', async ({ user, params, body, set }) => {
    const { 
      title, 
      category, 
      date, 
      deadlineTime,
      habitType = 'boolean',
      targetValue,
      unit,
      scheduledDays
    } = body;
    
    // Anti-cheat / 48-Hour Grace Window:
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterdayObj);
    
    if (date < yesterdayStr) {
      set.status = 400;
      return { success: false, error: 'Cannot set habit dates older than the 48-hour grace period' };
    }
    
    let categoryRecord = await db.select().from(categories).where(and(eq(categories.name, category), eq(categories.userId, user.id))).limit(1).then(res => res[0]);
    if (!categoryRecord) {
      categoryRecord = await db.insert(categories).values({ name: category, userId: user.id, isActive: true }).returning().then(res => res[0]);
    } else if (!categoryRecord.isActive) {
      categoryRecord = await db.update(categories).set({ isActive: true }).where(eq(categories.id, categoryRecord.id)).returning().then(res => res[0]);
    }
    
    const updated = await db.update(habits).set({
      title: title.trim().substring(0, 60),
      categoryId: categoryRecord.id,
      date,
      deadlineTime: deadlineTime || "23:59",
      habitType,
      targetValue: habitType === 'numeric' ? (Number(targetValue) || 1) : null,
      unit: habitType === 'numeric' ? (unit?.trim().substring(0, 20) || null) : null,
      scheduledDays: scheduledDays && scheduledDays.length > 0 ? JSON.stringify(scheduledDays) : null,
    }).where(and(eq(habits.id, params.id), eq(habits.userId, user.id))).returning().then(res => res[0]);
    
    if (!updated) {
      set.status = 404;
      return { success: false, error: 'Not found' };
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
  }, {
    params: t.Object({
      id: t.String({ minLength: 1 })
    }),
    body: habitBodySchema,
  })

  /*
  PATCH /api/v1/habits/:id/progress
  Handles step increments for numeric habits (e.g. +1 page or +250ml water).
  Automatically synchronizes the permanent completion log in habit_logs and broadcasts to team feed.
  */
  .patch('/habits/:id/progress', async ({ user, params, body, set }) => {
    const { delta, value } = body;
    
    const habit = await db.select().from(habits).where(and(eq(habits.id, params.id), eq(habits.userId, user.id))).limit(1).then(res => res[0]);
    if (!habit) {
      set.status = 404;
      return { success: false, error: 'Not found' };
    }
    
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
    
    // Sync with habitLogs historical ledger for THIS DAY only
    const habitDateStr = normalizeDate(habit.date);
    
    if (isCompleted) {
      const existingLog = await db.select().from(habitLogs)
        .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.completedDate, habitDateStr)))
        .limit(1).then(res => res[0]);
      if (existingLog) {
        await db.update(habitLogs).set({
          loggedValue: newVal,
          status: true,
        }).where(eq(habitLogs.id, existingLog.id));
      } else {
        await db.insert(habitLogs).values({
          habitId: habit.id,
          completedDate: habitDateStr,
          loggedValue: newVal,
          status: true,
        });
      }
      
      // If user achieved target completion and is in teams, broadcast social celebration event to all user's pods
      if (!wasCompleted) {
        const userMemberships = await db
          .select({ teamId: teamMembers.teamId })
          .from(teamMembers)
          .where(eq(teamMembers.userId, user.id));

        for (const m of userMemberships) {
          await db.insert(teamEvents).values({
            teamId: m.teamId,
            eventType: 'COMPLETION',
            actorId: user.id,
            message: `completed '${habit.title}' (${newVal}/${target} ${habit.unit || 'units'})`,
          });
        }
      }
    } else {
      // If uncompleted (e.g. subtracted progress below target), remove log ONLY FOR THIS DAY
      await db.delete(habitLogs).where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.completedDate, habitDateStr)));
    }
    
    return {
      id: updated.id,
      title: updated.title,
      currentValue: updated.currentValue,
      targetValue: updated.targetValue,
      unit: updated.unit,
      completed: isCompleted,
    };
  }, {
    params: t.Object({
      id: t.String({ minLength: 1 })
    }),
    body: t.Object({
      delta: t.Optional(t.Number()),
      value: t.Optional(t.Number()),
    })
  })

  /*
  PATCH /api/v1/habits/:id/toggle
  Toggles completion on/off for boolean habits with 1-click.
  */
  .patch('/habits/:id/toggle', async ({ user, params, set }) => {
    const habit = await db.select().from(habits).where(and(eq(habits.id, params.id), eq(habits.userId, user.id))).limit(1).then(res => res[0]);
    if (!habit) {
      set.status = 404;
      return { success: false, error: 'Not found' };
    }
    
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
    
    const habitDateStr = normalizeDate(habit.date);
    
    if (isNowCompleted) {
      const existingLog = await db.select().from(habitLogs)
        .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.completedDate, habitDateStr)))
        .limit(1).then(res => res[0]);
      if (existingLog) {
        await db.update(habitLogs).set({
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
      
      const userMemberships = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, user.id));

      for (const m of userMemberships) {
        await db.insert(teamEvents).values({
          teamId: m.teamId,
          eventType: 'COMPLETION',
          actorId: user.id,
          message: `completed '${habit.title}'`,
        });
      }
    } else {
      // ONLY delete the log for this specific date!
      await db.delete(habitLogs).where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.completedDate, habitDateStr)));
    }

    
    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ minLength: 1 })
    })
  })
  
  /*
  PATCH /api/v1/habits/:id/stop-repeating
  Removes recurrence (scheduledDays) from this habit and all instances of the same series.
  */
  .patch('/habits/:id/stop-repeating', async ({ user, params, set }) => {
    const habit = await db.select().from(habits).where(and(eq(habits.id, params.id), eq(habits.userId, user.id))).limit(1).then(res => res[0]);
    if (!habit) {
      set.status = 404;
      return { success: false, error: 'Not found' };
    }

    // Clear scheduledDays for this habit and any matching series for this user
    const categoryCondition = habit.categoryId
      ? eq(habits.categoryId, habit.categoryId)
      : isNull(habits.categoryId);

    await db.update(habits).set({
      scheduledDays: null,
    }).where(and(
      eq(habits.userId, user.id),
      eq(habits.title, habit.title),
      categoryCondition
    ));

    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ minLength: 1 })
    })
  })

  /*
  DELETE /api/v1/habits/:id
  Permanently removes a habit and cascades deletion of its history logs.
  */
  .delete('/habits/:id', async ({ user, params }) => {
    await db.delete(habits).where(and(eq(habits.id, params.id), eq(habits.userId, user.id)));
    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ minLength: 1 })
    })
  });

