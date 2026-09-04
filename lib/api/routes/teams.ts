import { Elysia } from 'elysia';
import { authPlugin } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { users, teams, teamEvents, habitLogs, habits, notifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/*
In-memory rate-limiting ledger for teammate nudges.
Prevents a single user from spamming nudges (max 5 nudges per 60s sliding window).
*/
const nudgeRateLimitMap = new Map<string, number[]>();

function checkNudgeRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxNudges = 5; // Max 5 nudges per minute

  const timestamps = nudgeRateLimitMap.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxNudges) {
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
  .use(authPlugin)

  /*
  GET /api/v1/teams/me
  Fetches the user's current team, member roster, today's pending tasks per member, and live activity feed.
  */
  .get('/teams/me', async ({ user, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    
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
    
    const now = new Date();
    const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, "0"); const d = String(now.getDate()).padStart(2, "0"); 
    const todayStr = `${y}-${m}-${d}`;
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yy = yesterday.getFullYear(); const ym = String(yesterday.getMonth() + 1).padStart(2, "0"); const yd = String(yesterday.getDate()).padStart(2, "0");
    const yesterdayStr = `${yy}-${ym}-${yd}`;

    // Enrich each teammate with their pending habits for today and their live streak
    const members = await Promise.all(membersData.map(async (member) => {
      const activeHabits = await db.select({
        id: habits.id,
        title: habits.title,
        deadlineTime: habits.deadlineTime
      }).from(habits)
        .where(and(eq(habits.userId, member.id), eq(habits.isActive, true), eq(habits.date, todayStr)));
      
      const logs = await db.select({ completedDate: habitLogs.completedDate })
        .from(habitLogs)
        .innerJoin(habits, eq(habitLogs.habitId, habits.id))
        .where(eq(habits.userId, member.id));
        
      const logDates = Array.from(new Set(logs.map(l => {
        if (typeof l.completedDate === 'string') return l.completedDate.split('T')[0];
        if ((l.completedDate as any) instanceof Date) return (l.completedDate as any).toISOString().split('T')[0];
        return String(l.completedDate);
      })));
      let dynamicStreak = 0;
      
      if (logDates.length > 0) {
        let currentCheckDate = new Date(now);
        if (logDates.includes(todayStr)) {
          dynamicStreak++;
          currentCheckDate = new Date(now);
        } else if (logDates.includes(yesterdayStr)) {
          dynamicStreak++;
          currentCheckDate = new Date(yesterday);
        }
        
        if (dynamicStreak > 0) {
          while (true) {
            currentCheckDate.setDate(currentCheckDate.getDate() - 1);
            const cy = currentCheckDate.getFullYear(); const cm = String(currentCheckDate.getMonth() + 1).padStart(2, "0"); const cd = String(currentCheckDate.getDate()).padStart(2, "0");
            const checkStr = `${cy}-${cm}-${cd}`;
            
            if (logDates.includes(checkStr)) {
              dynamicStreak++;
            } else {
              break;
            }
          }
        }
      }
      
      return { ...member, currentStreak: dynamicStreak, activeHabits };
    }));
    
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
      .orderBy(teamEvents.createdAt)
      .limit(50);
      
    return { team, members, events, currentUserId: user.id };
  })
  
  /*
  POST /api/v1/teams
  Creates a new accountability team and sets the creator as Team Leader.
  */
  .post('/teams', async ({ user, body, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    const { name } = body as { name: string };
    
    const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (currentUser?.teamId) {
      set.status = 400;
      return 'You are already in a team. Leave it first.';
    }
    
    const newTeam = await db.insert(teams).values({ name, createdBy: user.id }).returning().then(res => res[0]);
    await db.update(users).set({ teamId: newTeam.id }).where(eq(users.id, user.id));
    
    return { success: true, team: newTeam };
  })
  
  /*
  POST /api/v1/teams/join
  Joins an existing team via its unique invite ID (enforces 5-member max cap).
  */
  .post('/teams/join', async ({ user, body, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    const { teamId } = body as { teamId: string };
    
    const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (currentUser?.teamId) {
      set.status = 400;
      return 'You are already in a team. Leave it first.';
    }
    
    // Strict accountability rule: Max 5 members per pod
    const memberCount = await db.select({ id: users.id }).from(users).where(eq(users.teamId, teamId));
    if (memberCount.length >= 5) {
      set.status = 400;
      return 'This team is already full (max 5 members).';
    }
    
    await db.update(users).set({ teamId }).where(eq(users.id, user.id));
    
    // If the team was previously abandoned, resurrect it
    await db.update(teams).set({ abandonedAt: null }).where(eq(teams.id, teamId));
    
    await db.insert(teamEvents).values({
      teamId,
      eventType: 'JOIN',
      actorId: user.id,
      message: 'joined the team!'
    });
    
    return { success: true };
  })
  
  /*
  POST /api/v1/teams/leave
  Leaves the current team. If leader leaves, reassigns leadership to next member.
  If all members leave, marks team as abandoned.
  */
  .post('/teams/leave', async ({ user, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
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
    if (!user) { set.status = 401; return 'Unauthorized'; }
    const { targetId } = body as { targetId: string };
    
    const currentUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!currentUser?.teamId) {
      set.status = 400; return 'You are not in a team.';
    }
    
    const team = await db.select({ createdBy: teams.createdBy }).from(teams).where(eq(teams.id, currentUser.teamId)).limit(1).then(res => res[0]);
    if (team?.createdBy !== user.id) {
      set.status = 403; return 'Only the team leader can remove members.';
    }
    
    const targetUser = await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, targetId)).limit(1).then(res => res[0]);
    if (targetUser?.teamId !== currentUser.teamId) {
      set.status = 400; return 'Target user is not in your team.';
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
  })
  
  /*
  POST /api/v1/teams/nudge
  Sends an accountability nudge to a teammate who has pending habits today.
  Includes a rate-limiting guard (max 5/min) and team scoping verification.
  */
  .post('/teams/nudge', async ({ user, body, set }) => {
    if (!user) { set.status = 401; return 'Unauthorized'; }
    const { targetId, taskTitle } = body as { targetId: string, taskTitle: string };

    // Security guard: Prevent self-nudging
    if (targetId === user.id) {
      set.status = 400;
      return 'You cannot nudge yourself.';
    }

    // Rate limit guard: Max 5 nudges per 60 seconds per user to prevent spam
    if (!checkNudgeRateLimit(user.id)) {
      set.status = 429;
      return 'You are nudging too quickly. Please wait a minute before sending another nudge.';
    }
    
    const currentUser = await db.select({ teamId: users.teamId, name: users.name }).from(users).where(eq(users.id, user.id)).limit(1).then(res => res[0]);
    if (!currentUser?.teamId) {
      set.status = 400; return 'You are not in a team.';
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
      return 'Target user is not a member of your accountability team.';
    }
    
    const targetName = targetUser.name || 'a teammate';

    // Broadcast to team live feed
    await db.insert(teamEvents).values({
      teamId: currentUser.teamId,
      eventType: 'NUDGE',
      actorId: user.id,
      targetId,
      message: `nudged ${targetName} to complete '${taskTitle}'`
    });
    
    // Push targeted notification to the recipient's inbox and device
    await db.insert(notifications).values({
      senderId: user.id,
      receiverId: targetId,
      message: `${currentUser.name || 'A teammate'} nudged you to complete '${taskTitle}'`
    });
    
    return { success: true };
  });
