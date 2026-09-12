import { Elysia, t } from 'elysia';
import { requireAuth } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { users, teams, teamMembers, teamEvents, habitLogs, habits, notifications } from '@/lib/db/schema';
import { eq, and, inArray, gte, desc, sql } from 'drizzle-orm';
import { sendWebPush } from '@/lib/push';
import { calculateStreaks, normalizeDate } from '@/lib/services/streak';
import {
  MAX_NUDGES_PER_MINUTE,
  NUDGE_WINDOW_MS,
  GRACE_PERIOD_HOURS,
  MAX_TEAM_MEMBERS,
  MAX_TEAMS_PER_USER,
} from '@/lib/constants';

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

function safeIsoString(dateVal: unknown): string {
  if (dateVal instanceof Date) {
    return dateVal.toISOString();
  }
  if (typeof dateVal === 'string') {
    return dateVal;
  }
  return new Date().toISOString();
}

/*
TEAMS & ACCOUNTABILITY POD ROUTES (MULTI-TEAM ARCHITECTURE)
Handles listing all pods, pod detail views, creating teams, joining via invite UUID,
leaving pods, leader removal, and nudging teammates.
*/
export const teamsRoutes = new Elysia()
  .use(requireAuth)

  /*
  GET /api/v1/teams
  Fetches a summary list of all accountability pods the authenticated user is a member of.
  */
  .get('/teams', async ({ user }) => {
    // 1. Fetch all team memberships for this user
    const memberships = await db
      .select({
        teamId: teamMembers.teamId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id));

    if (memberships.length === 0) {
      return [];
    }

    const userTeamIds = memberships.map((m) => m.teamId);

    // 2. Fetch all team details
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        createdBy: teams.createdBy,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(inArray(teams.id, userTeamIds));

    // 3. Fetch all members across these teams for avatar snippets & counts
    const allMembersInTeams = await db
      .select({
        teamId: teamMembers.teamId,
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(inArray(teamMembers.teamId, userTeamIds));

    const teamMembersMap = new Map<
      string,
      Array<{ id: string; name: string; avatarUrl: string | null }>
    >();

    for (const m of allMembersInTeams) {
      const list = teamMembersMap.get(m.teamId) || [];
      list.push({
        id: m.userId,
        name: m.name,
        avatarUrl: m.avatarUrl,
      });
      teamMembersMap.set(m.teamId, list);
    }

    // 4. Compose team summaries
    const summaries = userTeams.map((team) => {
      const members = teamMembersMap.get(team.id) || [];
      return {
        id: team.id,
        name: team.name,
        createdBy: team.createdBy,
        isLeader: team.createdBy === user.id,
        memberCount: members.length,
        members,
        createdAt: safeIsoString(team.createdAt),
      };
    });

    return summaries;
  })

  /*
  GET /api/v1/teams/me
  Backwards compatibility route: returns the first pod details or null.
  */
  .get('/teams/me', async ({ user, headers }) => {
    const firstMembership = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id))
      .limit(1)
      .then((res) => res[0]);

    if (!firstMembership) {
      return { team: null, members: [], events: [], currentUserId: user.id };
    }

    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, firstMembership.teamId))
      .limit(1)
      .then((res) => res[0]);

    if (!team) {
      return { team: null, members: [], events: [], currentUserId: user.id };
    }

    const membersData = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        currentStreak: users.currentStreak,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, team.id));

    const memberIds = membersData.map((m) => m.id);
    const clientDate = (headers['x-client-date'] as string) || normalizeDate(new Date());

    return {
      team: {
        ...team,
        isLeader: team.createdBy === user.id,
      },
      members: membersData.map((m) => ({ ...m, activeHabits: [] })),
      events: [],
      currentUserId: user.id,
    };
  })

  /*
  GET /api/v1/teams/:teamId
  Fetches full details, member roster, today's pending tasks per member, live streaks,
  and social activity feed for a specific team.
  */
  .get('/teams/:teamId', async ({ user, params, headers, set }) => {
    const { teamId } = params;

    // Verify current user belongs to this team
    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
      .limit(1)
      .then((res) => res[0]);

    if (!membership) {
      set.status = 404;
      return { team: null, members: [], events: [], currentUserId: user.id };
    }

    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1)
      .then((res) => res[0]);

    if (!team) {
      set.status = 404;
      return { team: null, members: [], events: [], currentUserId: user.id };
    }

    // Fetch all teammates in this pod
    const membersData = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        currentStreak: users.currentStreak,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, team.id));

    const memberIds = membersData.map((m) => m.id);
    if (memberIds.length === 0) {
      return {
        team: { ...team, isLeader: team.createdBy === user.id },
        members: [],
        events: [],
        currentUserId: user.id,
      };
    }

    const clientDate = (headers['x-client-date'] as string) || normalizeDate(new Date());
    const todayStr = clientDate;
    const [y, m, d] = todayStr.split('-').map(Number);
    const yesterdayObj = new Date(Date.UTC(y, m - 1, d - 1));
    const yesterdayStr = yesterdayObj.toISOString().split('T')[0];
    const now = new Date();
    const nowMs = now.getTime();

    // 1. Batch query active habits for today and yesterday (24h grace window)
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

    // Group active habits by member, filtering out any habit exceeding 24h grace
    const memberHabitsMap = new Map<
      string,
      Array<{ id: string; title: string; deadlineTime: string | null; date: string; isGrace: boolean }>
    >();

    for (const h of activeHabitsData) {
      const dateStr = normalizeDate(h.date);
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hh, mm] = h.deadlineTime ? h.deadlineTime.split(':').map(Number) : [23, 59];
      const scheduledMs = new Date(year, month - 1, day, hh, mm, 59).getTime();
      const graceEndMs = scheduledMs + GRACE_PERIOD_HOURS * 60 * 60 * 1000;

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

    // 2. Batch query all completion logs for members to compute live streaks
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
      const { currentStreak } = calculateStreaks(userLogDates, clientDate);
      const activeHabits = memberHabitsMap.get(member.id) || [];

      return {
        ...member,
        currentStreak,
        activeHabits,
      };
    });

    // Fetch last 50 social team events for the live feed
    const events = await db
      .select({
        id: teamEvents.id,
        eventType: teamEvents.eventType,
        message: teamEvents.message,
        createdAt: teamEvents.createdAt,
        actor: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(teamEvents)
      .innerJoin(users, eq(teamEvents.actorId, users.id))
      .where(eq(teamEvents.teamId, team.id))
      .orderBy(desc(teamEvents.createdAt))
      .limit(50);

    // Reverse to display chronologically (oldest at top, newest at bottom)
    events.reverse();

    return {
      team: {
        ...team,
        isLeader: team.createdBy === user.id,
      },
      members,
      events,
      currentUserId: user.id,
    };
  }, {
    params: t.Object({
      teamId: t.String({ minLength: 1 }),
    }),
  })

  /*
  POST /api/v1/teams
  Creates a new accountability pod and designates the creator as Leader.
  Enforces MAX_TEAMS_PER_USER (10).
  */
  .post('/teams', async ({ user, body, set }) => {
    const { name } = body;

    // Check user's current team count
    const userTeamCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id))
      .then((res) => Number(res[0]?.count || 0));

    if (userTeamCount >= MAX_TEAMS_PER_USER) {
      set.status = 400;
      return {
        success: false,
        error: `You can join a maximum of ${MAX_TEAMS_PER_USER} accountability pods.`,
      };
    }

    const newTeam = await db
      .insert(teams)
      .values({
        name: name.trim().substring(0, 50),
        createdBy: user.id,
      })
      .returning()
      .then((res) => res[0]);

    // Insert user into team_members as leader
    await db.insert(teamMembers).values({
      teamId: newTeam.id,
      userId: user.id,
      role: 'leader',
    });

    // Also update users.teamId for backward compatibility
    await db.update(users).set({ teamId: newTeam.id }).where(eq(users.id, user.id));

    return {
      success: true,
      team: {
        id: newTeam.id,
        name: newTeam.name,
        createdBy: newTeam.createdBy,
        isLeader: true,
        memberCount: 1,
        members: [{ id: user.id, name: '', avatarUrl: null }],
        createdAt: safeIsoString(newTeam.createdAt),
      },
    };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 50 }),
    }),
  })

  /*
  POST /api/v1/teams/join
  Joins an existing team via its unique invite UUID.
  Enforces MAX_TEAMS_PER_USER (10) and MAX_TEAM_MEMBERS (5).
  */
  .post('/teams/join', async ({ user, body, set }) => {
    const { teamId } = body;

    // 1. Check user's current team count
    const userTeamCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id))
      .then((res) => Number(res[0]?.count || 0));

    if (userTeamCount >= MAX_TEAMS_PER_USER) {
      set.status = 400;
      return {
        success: false,
        error: `You can join a maximum of ${MAX_TEAMS_PER_USER} accountability pods.`,
      };
    }

    // 2. Verify team exists
    const targetTeam = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1)
      .then((res) => res[0]);

    if (!targetTeam) {
      set.status = 404;
      return { success: false, error: 'Team not found. Please check the invite code.' };
    }

    // 3. Verify user is not already a member of this team
    const alreadyMember = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
      .limit(1)
      .then((res) => res[0]);

    if (alreadyMember) {
      set.status = 400;
      return { success: false, error: 'You are already a member of this accountability pod.' };
    }

    try {
      await db.transaction(async (tx) => {
        // Enforce max members per pod (5)
        const memberCount = await tx
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId));

        if (memberCount.length >= MAX_TEAM_MEMBERS) {
          throw new Error(`This team is already full (max ${MAX_TEAM_MEMBERS} members).`);
        }

        await tx.insert(teamMembers).values({
          teamId,
          userId: user.id,
          role: 'member',
        });

        // Resurrect team if previously abandoned
        await tx.update(teams).set({ abandonedAt: null }).where(eq(teams.id, teamId));

        await tx.insert(teamEvents).values({
          teamId,
          eventType: 'JOIN',
          actorId: user.id,
          message: 'joined the team!',
        });
      });

      return { success: true, teamId };
    } catch (err: unknown) {
      set.status = 400;
      const message = err instanceof Error ? err.message : 'Failed to join team.';
      return { success: false, error: message };
    }
  }, {
    body: t.Object({
      teamId: t.String({ minLength: 1 }),
    }),
  })

  /*
  POST /api/v1/teams/:teamId/leave
  Leaves a specific team. If leader leaves, reassigns leadership to next member.
  If all members leave, marks team as abandoned for cron cleanup.
  */
  .post('/teams/:teamId/leave', async ({ user, params }) => {
    const { teamId } = params;

    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
      .limit(1)
      .then((res) => res[0]);

    if (!membership) {
      return { success: true };
    }

    await db.insert(teamEvents).values({
      teamId,
      eventType: 'LEAVE',
      actorId: user.id,
      message: 'left the team.',
    });

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));

    // Check remaining members in this pod
    const remainingMembers = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(teamMembers.joinedAt);

    if (remainingMembers.length === 0) {
      // Mark for automatic cleanup after 3 days
      await db.update(teams).set({ abandonedAt: new Date() }).where(eq(teams.id, teamId));
    } else {
      // Reassign leader crown if the creator leaves
      const team = await db
        .select({ createdBy: teams.createdBy })
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1)
        .then((res) => res[0]);

      if (team && team.createdBy === user.id) {
        const nextLeaderId = remainingMembers[0].userId;
        await db.update(teams).set({ createdBy: nextLeaderId }).where(eq(teams.id, teamId));
        await db
          .update(teamMembers)
          .set({ role: 'leader' })
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, nextLeaderId)));
      }
    }

    return { success: true };
  }, {
    params: t.Object({
      teamId: t.String({ minLength: 1 }),
    }),
  })

  /*
  POST /api/v1/teams/:teamId/remove-member
  Allows the team leader to kick a member from the pod.
  */
  .post('/teams/:teamId/remove-member', async ({ user, params, body, set }) => {
    const { teamId } = params;
    const { targetId } = body;

    if (targetId === user.id) {
      set.status = 400;
      return { success: false, error: 'Team leader cannot remove themselves. Use leave team instead.' };
    }

    const team = await db
      .select({ createdBy: teams.createdBy })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1)
      .then((res) => res[0]);

    if (!team) {
      set.status = 404;
      return { success: false, error: 'Team not found.' };
    }

    if (team.createdBy !== user.id) {
      set.status = 403;
      return { success: false, error: 'Only the team leader can remove members.' };
    }

    const targetMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetId)))
      .limit(1)
      .then((res) => res[0]);

    if (!targetMembership) {
      set.status = 400;
      return { success: false, error: 'Target user is not a member of this team.' };
    }

    await db.insert(teamEvents).values({
      teamId,
      eventType: 'KICK',
      actorId: user.id,
      targetId,
      message: 'was removed from the team.',
    });

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetId)));

    return { success: true };
  }, {
    params: t.Object({
      teamId: t.String({ minLength: 1 }),
    }),
    body: t.Object({
      targetId: t.String({ minLength: 1 }),
    }),
  })

  /*
  POST /api/v1/teams/:teamId/nudge
  Sends an accountability nudge to a teammate in a specific pod.
  Includes rate-limiting (max 5/min) and team scoping verification.
  */
  .post('/teams/:teamId/nudge', async ({ user, params, body, set }) => {
    const { teamId } = params;
    const { targetId, taskTitle } = body;

    // Security guard: Prevent self-nudging
    if (targetId === user.id) {
      set.status = 400;
      return { success: false, error: 'You cannot nudge yourself.' };
    }

    // Rate limit guard: Max 5 nudges per 60 seconds per user
    if (!checkNudgeRateLimit(user.id)) {
      set.status = 429;
      return {
        success: false,
        error: 'You are nudging too quickly. Please wait a minute before sending another nudge.',
      };
    }

    // Verify caller is in this team
    const callerMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
      .limit(1)
      .then((res) => res[0]);

    if (!callerMembership) {
      set.status = 403;
      return { success: false, error: 'You are not a member of this team.' };
    }

    // Verify target user is in this team
    const targetUser = await db
      .select({ name: users.name })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetId)))
      .limit(1)
      .then((res) => res[0]);

    if (!targetUser) {
      set.status = 403;
      return { success: false, error: 'Target user is not a member of this accountability pod.' };
    }

    const caller = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((res) => res[0]);

    const targetName = targetUser.name || 'a teammate';
    const sanitizedTask = taskTitle.trim().substring(0, 100);

    // Broadcast to team live feed
    await db.insert(teamEvents).values({
      teamId,
      eventType: 'NUDGE',
      actorId: user.id,
      targetId,
      message: `nudged ${targetName} to complete '${sanitizedTask}'`,
    });

    // Push targeted notification to the recipient's inbox and device
    const nudgeMessage = `${caller?.name || 'A teammate'} nudged you to complete '${sanitizedTask}'`;
    await db.insert(notifications).values({
      senderId: user.id,
      receiverId: targetId,
      message: nudgeMessage,
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
    params: t.Object({
      teamId: t.String({ minLength: 1 }),
    }),
    body: t.Object({
      targetId: t.String({ minLength: 1 }),
      taskTitle: t.String({ minLength: 1, maxLength: 100 }),
    }),
  });
