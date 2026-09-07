import { Elysia, t } from 'elysia';
import { requireAuth } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { users, teams, teamEvents, habitLogs, habits, notifications } from '@/lib/db/schema';
import { eq, and, inArray, gte, desc } from 'drizzle-orm';
import { sendWebPush } from '@/lib/push';
import { calculateStreaks, normalizeDate } from '@/lib/services/streak';
import { MAX_NUDGES_PER_MINUTE, NUDGE_WINDOW_MS, GRACE_PERIOD_HOURS, MAX_TEAM_MEMBERS } from '@/lib/constants';

/*
In-memory rate-limiting ledger for teammate nudges.
Prevents a single user from spamming nudges (max 5 nudges per 60s sliding window).
*/
const nudgeRateLimitMap = new Map<string, number[]>();

function checkNudgeRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = nudgeRateLimitMap.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < NUDGE_WINDOW_MS);

  if (recent.length >= MAX_NUDGES_PER_MINUTE) {
    return false;
  }

  recent.push(now);
  nudgeRateLimitMap.set(userId, recent);
  return true;
}

/*
TEAMS & ACCOUNTABILITY POD ROUTES
Handles creating teams, joining via invite ID, team rosters, leaving, and nudging teammates.
*/
export const teamsRoutes = new Elysia()
  .use(requireAuth)

  /*
  GET /api/v1/teams/me
  Fetches the user's current team, member roster, today's and grace-period pending tasks per member, and live activity feed.
  */
  .get('/teams/me', async ({ user }) => {
    // Check if the current user belongs to a team
    const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!currentUser?.teamId) {
      return { team: null, members: [], events: [] };
    }
    
    const team = await db.select().from(teams).where(eq(teams.id, currentUser.teamId)).limit(1).then(res => res[0]);
    if (!team) {
      return { team: null, members: [], events: [] };
    }
    
    // Fetch all teammates in this pod
    const membersData = await db.select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      currentStreak: users.currentStreak
    }).from(users).where(eq(users.teamId, team.id));

    const memberIds = membersData.map((m) => m.id);
    if (memberIds.length === 0) {
      return { team, members: [], events: [], currentUserId: user.id };
    }
    
    const now = new Date();
    const todayStr = normalizeDate(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = normalizeDate(yesterday);
    const nowMs = now.getTime();

    // 1. Batch query active habits for today and yesterday (48h grace window)
    const activeHabitsData = await db
      .select({
        id: habits.id,
        userId: habits.userId,
        title: habits.title,
        date: habits.date,
        deadlineTime: habits.deadlineTime,
      })
      .from(habits)
      .where(
        and(
          inArray(habits.userId, memberIds),
          eq(habits.isActive, true),
          gte(habits.date, yesterdayStr)
        )
      );

    // Group active habits by member, filtering out any habit that exceeded the 48h grace window
    const memberHabitsMap = new Map<string, Array<{ id: string; title: string; deadlineTime: string | null; date: string; isGrace: boolean }>>();
    for (const h of activeHabitsData) {
      const dateStr = normalizeDate(h.date);
      const [year, month, day] = dateStr.split("-").map(Number);
      const [hh, mm] = h.deadlineTime ? h.deadlineTime.split(":").map(Number) : [23, 59];
      const scheduledMs = new Date(year, month - 1, day, hh, mm, 59).getTime();
      const graceEndMs = scheduledMs + GRACE_PERIOD_HOURS * 60 * 60 * 1000;

      // Include if within 48h grace window
      if (nowMs <= graceEndMs) {
        const isGrace = dateStr < todayStr;
        const list = memberHabitsMap.get(h.userId) || [];
        list.push({
          id: h.id,
          title: h.title,
          deadlineTime: h.deadlineTime,
          date: dateStr,
          isGrace,
        });
        memberHabitsMap.set(h.userId, list);
      }
    }

    // Sort member habits: urgent Grace Period habits first
    for (const [, list] of memberHabitsMap.entries()) {
      list.sort((a, b) => (b.isGrace ? 1 : 0) - (a.isGrace ? 1 : 0));
    }

    // 2. Batch query all completion logs for members to compute live streaks using centralized service
    const memberLogs = await db
      .select({
        userId: habits.userId,
        completedDate: habitLogs.completedDate,
      })
      .from(habitLogs)
      .innerJoin(habits, eq(habitLogs.habitId, habits.id))
      .where(inArray(habits.userId, memberIds))
      .orderBy(habitLogs.completedDate);

    const memberLogsMap = new Map<string, string[]>();
    for (const log of memberLogs) {
      const list = memberLogsMap.get(log.userId) || [];
      list.push(normalizeDate(log.completedDate));
      memberLogsMap.set(log.userId, list);
    }

    // Compose members with centralized streak calculation and grace-aware active habits
    const members = membersData.map((member) => {
      const userLogDates = memberLogsMap.get(member.id) || [];
      const { currentStreak } = calculateStreaks(userLogDates);
      const activeHabits = memberHabitsMap.get(member.id) || [];

      return {
        ...member,
        currentStreak,
        activeHabits,
      };
    });
    
    // Fetch last 50 social team events for the live feed
    const events = await db.select({
      id: teamEvents.id,
      eventType: teamEvents.eventType,
      message: teamEvents.message,
      createdAt: teamEvents.createdAt,
      actor: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl
      }
    }).from(teamEvents)
      .innerJoin(users, eq(teamEvents.actorId, users.id))
      .where(eq(teamEvents.teamId, team.id))
      .orderBy(desc(teamEvents.createdAt))
      .limit(50);

    // Reverse to display chronologically (oldest at top, newest at bottom)
    events.reverse();
      
    return { team, members, events, currentUserId: user.id };
  })
  
  /*
  POST /api/v1/teams
  Creates a new accountability team and sets the creator as Team Leader.
  */
  .post('/teams', async ({ user, body, set }) => {
    const { name } = body;
    
    const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (currentUser?.teamId) {
      set.status = 400;
      return { success: false, error: 'You are already in a team. Leave it first.' };
    }
    
    const newTeam = await db.insert(teams).values({ name: name.trim().substring(0, 50), createdBy: user.id }).returning().then(res => res[0]);
    await db.update(users).set({ teamId: newTeam.id }).where(eq(users.id, user.id));
    
    return { success: true, team: newTeam };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 50 })
    })
  })
  
  /*
  POST /api/v1/teams/join
  Joins an existing team via its unique invite ID (enforces 5-member max cap).
  */
  .post('/teams/join', async ({ user, body, set }) => {
    const { teamId } = body;
    
    const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (currentUser?.teamId) {
      set.status = 400;
      return { success: false, error: 'You are already in a team. Leave it first.' };
    }

    // Verify team exists
    const targetTeam = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1).then(res => res[0]);
    if (!targetTeam) {
      set.status = 404;
      return { success: false, error: 'Team not found.' };
    }
    
    try {
      await db.transaction(async (tx) => {
        // Strict accountability rule: Max members per pod
        const memberCount = await tx.select({ id: users.id }).from(users).where(eq(users.teamId, teamId));
        if (memberCount.length >= MAX_TEAM_MEMBERS) {
          throw new Error(`This team is already full (max ${MAX_TEAM_MEMBERS} members).`);
        }
        
        await tx.update(users).set({ teamId }).where(eq(users.id, user.id));
        
        // If the team was previously abandoned, resurrect it
        await tx.update(teams).set({ abandonedAt: null }).where(eq(teams.id, teamId));
        
        await tx.insert(teamEvents).values({
          teamId,
          eventType: 'JOIN',
          actorId: user.id,
          message: 'joined the team!'
        });
      });

      return { success: true };
    } catch (err: unknown) {
      set.status = 400;
      const message = err instanceof Error ? err.message : 'Failed to join team.';
      return { success: false, error: message };
    }
  }, {
    body: t.Object({
      teamId: t.String({ minLength: 1 })
    })
  })
  
  /*
  POST /api/v1/teams/leave
  Leaves the current team. If leader leaves, reassigns leadership to next member.
  If all members leave, marks team as abandoned.
  */
  .post('/teams/leave', async ({ user }) => {
    const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!currentUser?.teamId) {
      return { success: true };
    }
    
    await db.insert(teamEvents).values({
      teamId: currentUser.teamId,
      eventType: 'LEAVE',
      actorId: user.id,
      message: 'left the team.'
    });
    
    await db.update(users).set({ teamId: null }).where(eq(users.id, user.id));
    
    const remainingMembers = await db.select({ id: users.id }).from(users).where(eq(users.teamId, currentUser.teamId));
    if (remainingMembers.length === 0) {
      // Mark for automatic cleanup after 7 days
      await db.update(teams).set({ abandonedAt: new Date() }).where(eq(teams.id, currentUser.teamId));
    } else {
      // Reassign leader crown if the creator leaves
      const team = await db.select({ createdBy: teams.createdBy }).from(teams).where(eq(teams.id, currentUser.teamId)).limit(1).then(res => res[0]);
      if (team && team.createdBy === user.id) {
        await db.update(teams).set({ createdBy: remainingMembers[0].id }).where(eq(teams.id, currentUser.teamId));
      }
    }
    
    return { success: true };
  })
  
  /*
  POST /api/v1/teams/remove-member
  Allows the team leader to kick a member from the pod.
  */
  .post('/teams/remove-member', async ({ user, body, set }) => {
    const { targetId } = body;

    if (targetId === user.id) {
      set.status = 400;
      return { success: false, error: 'Team leader cannot remove themselves. Use leave team instead.' };
    }
    
    const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!currentUser?.teamId) {
      set.status = 400;
      return { success: false, error: 'You are not in a team.' };
    }
    
    const team = await db.select({ createdBy: teams.createdBy }).from(teams).where(eq(teams.id, currentUser.teamId)).limit(1).then(res => res[0]);
    if (team?.createdBy !== user.id) {
      set.status = 403;
      return { success: false, error: 'Only the team leader can remove members.' };
    }
    
    const targetUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, targetId)).limit(1).then(res => res[0]);
    if (targetUser?.teamId !== currentUser.teamId) {
      set.status = 400;
      return { success: false, error: 'Target user is not in your team.' };
    }
    
    await db.insert(teamEvents).values({
      teamId: currentUser.teamId,
      eventType: 'KICK',
      actorId: user.id,
      targetId: targetId,
      message: 'was removed from the team.'
    });
    
    await db.update(users).set({ teamId: null }).where(eq(users.id, targetId));
    
    return { success: true };
  }, {
    body: t.Object({
      targetId: t.String({ minLength: 1 })
    })
  })
  
  /*
  POST /api/v1/teams/nudge
  Sends an accountability nudge to a teammate who has pending habits today.
  Includes a rate-limiting guard (max 5/min) and team scoping verification.
  */
  .post('/teams/nudge', async ({ user, body, set }) => {
    const { targetId, taskTitle } = body;

    // Security guard: Prevent self-nudging
    if (targetId === user.id) {
      set.status = 400;
      return { success: false, error: 'You cannot nudge yourself.' };
    }

    // Rate limit guard: Max 5 nudges per 60 seconds per user to prevent spam
    if (!checkNudgeRateLimit(user.id)) {
      set.status = 429;
      return { success: false, error: 'You are nudging too quickly. Please wait a minute before sending another nudge.' };
    }
    
    const currentUser = await db.select({ teamId: users.teamId, name: users.name }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!currentUser?.teamId) {
      set.status = 400;
      return { success: false, error: 'You are not in a team.' };
    }
    
    // Security guard: Verify target user belongs to the SAME accountability pod
    const targetUser = await db
      .select({ name: users.name, teamId: users.teamId })
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.teamId, currentUser.teamId)))
      .limit(1)
      .then(res => res[0]);

    if (!targetUser) {
      set.status = 403;
      return { success: false, error: 'Target user is not a member of your accountability team.' };
    }
    
    const targetName = targetUser.name || 'a teammate';
    const sanitizedTask = taskTitle.trim().substring(0, 100);

    // Broadcast to team live feed
    await db.insert(teamEvents).values({
      teamId: currentUser.teamId,
      eventType: 'NUDGE',
      actorId: user.id,
      targetId,
      message: `nudged ${targetName} to complete '${sanitizedTask}'`
    });
    
    // Push targeted notification to the recipient's inbox and device
    const nudgeMessage = `${currentUser.name || 'A teammate'} nudged you to complete '${sanitizedTask}'`;
    await db.insert(notifications).values({
      senderId: user.id,
      receiverId: targetId,
      message: nudgeMessage
    });

    // Send native background push notification to target user's registered devices
    sendWebPush(targetId, {
      title: 'Teammate Nudge',
      body: nudgeMessage,
      url: '/dashboard/habits',
    }).catch((pushErr) => {
      console.warn('[Teams] Background push delivery error:', pushErr);
    });
    
    return { success: true };
  }, {
    body: t.Object({
      targetId: t.String({ minLength: 1 }),
      taskTitle: t.String({ minLength: 1, maxLength: 100 })
    })
  });
