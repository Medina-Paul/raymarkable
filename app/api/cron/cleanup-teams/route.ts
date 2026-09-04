import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teams } from '@/lib/db/schema';
import { lte, isNotNull, and } from 'drizzle-orm';

/*
CRON JOB: ABANDONED TEAMS CLEANUP

When all members leave a team, rather than instantly deleting the team (which might be
accidental), the team is marked with `abandonedAt = NOW()`.

This cron job runs periodically (e.g. daily via Vercel Cron or GitHub Actions) and
safely purges teams that have remained completely abandoned for 3+ consecutive days.
*/
export async function GET(req: Request) {
  // Security guard: verify CRON_SECRET if configured
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 3);

    const result = await db.delete(teams).where(
      and(
        isNotNull(teams.abandonedAt),
        lte(teams.abandonedAt, threshold)
      )
    ).returning({ id: teams.id });

    return NextResponse.json({
      success: true,
      deletedCount: result.length,
      deletedTeams: result.map(t => t.id)
    });
  } catch (error: any) {
    console.error('Error cleaning up abandoned teams:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
