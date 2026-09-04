import { StatCard } from "@/components/profile/stat-card";
import { WeeklyChart } from "@/components/profile/weekly-chart";
import { db } from "@/lib/db";
import { users, habitLogs, habits, categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MonthlySection } from "@/components/profile/monthly-section";
import { Heatmap } from "@/components/profile/heatmap";
import { ProfileHeader } from "@/components/profile/profile-header";

export async function ProfileView({ targetUserId, isOwnProfile }: { targetUserId: string; isOwnProfile: boolean }) {


  // Fetch the synced public user profile from our database
  const profile = await db.query.users.findFirst({
    where: eq(users.id, targetUserId)
  });

  const joinDate = profile?.createdAt 
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently";

  const today = new Date();
  
  // Fetch ALL habits for the user to compute exact stats in JS (faster and cleaner for this scale)
  const allHabits = await db
    .select({
      date: habits.date,
      isActive: habits.isActive,
      category: categories.name,
      title: habits.title,
      currentValue: habits.currentValue,
      targetValue: habits.targetValue,
      unit: habits.unit,
    })
    .from(habits)
    .innerJoin(categories, eq(habits.categoryId, categories.id))
    .where(eq(habits.userId, targetUserId));

  // Safe Date Formatting for Habits (Postgres driver returns JS Date objects)
  const safeHabits = allHabits.map(h => {
    let dStr = "";
    if (typeof h.date === 'string') dStr = h.date.split('T')[0];
    else if ((h.date as any) instanceof Date) dStr = (h.date as any).toISOString().split('T')[0];
    else dStr = String(h.date);
    return { ...h, date: dStr };
  });

  // --- ALL-TIME STATS ---
  const totalHabits = safeHabits.length;
  const totalCompleted = safeHabits.filter(h => !h.isActive).length;
  const completionRate = totalHabits > 0 ? Math.round((totalCompleted / totalHabits) * 100) : 0;

  // --- CALENDAR DATA ---
  const calendarData: Record<string, { completed: number, total: number }> = {};
  safeHabits.forEach(h => {
    if (!calendarData[h.date]) calendarData[h.date] = { completed: 0, total: 0 };
    calendarData[h.date].total += 1;
    if (!h.isActive) calendarData[h.date].completed += 1;
  });

  const completedLogs = await db.select({
    date: habitLogs.completedDate,
  })
  .from(habitLogs)
  .innerJoin(habits, eq(habitLogs.habitId, habits.id))
  .where(eq(habits.userId, targetUserId));

  // --- STREAK LOGIC ---
  const logDates = Array.from(new Set(completedLogs.map(l => {
    if (typeof l.date === 'string') return l.date.split('T')[0];
    if ((l.date as any) instanceof Date) return (l.date as any).toISOString().split('T')[0];
    return String(l.date);
  }))).sort(); // Sort chronologically ascending

  let dynamicStreak = 0;
  let maxHistoricalStreak = 0;
  
  if (logDates.length > 0) {
    let tempStreak = 0;
    let prevDate = null;
    
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
          tempStreak = 1;
        }
      }
      
      if (tempStreak > maxHistoricalStreak) {
        maxHistoricalStreak = tempStreak;
      }
      prevDate = currDate;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    const lastLogDate = logDates[logDates.length - 1];
    
    if (lastLogDate === todayStr || lastLogDate === yesterdayStr) {
      dynamicStreak = tempStreak;
    } else {
      dynamicStreak = 0;
    }
  }

  let currentStreak = dynamicStreak;
  let bestStreak = Math.max(maxHistoricalStreak, profile?.bestStreak || 0, currentStreak);

  // --- WEEKLY CHART DATA ---
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dy = d.getFullYear(); const dm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${dy}-${dm}-${dd}`;
    
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const dateName = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    const dayStats = calendarData[dateStr] || { completed: 0, total: 0 };
    const percent = dayStats.total > 0 ? Math.round((dayStats.completed / dayStats.total) * 100) : 0;
    
    weeklyData.push({
      label: `${dayName}|${dateName}`,
      dayName,
      dateName,
      percent,
      completed: dayStats.completed,
      total: dayStats.total,
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 min-h-full">
      <ProfileHeader 
        userId={targetUserId} 
        name={profile?.name || ""} 
        avatarUrl={profile?.avatarUrl || null} 
        joinDate={joinDate}
        isOwnProfile={isOwnProfile}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-6 mb-8">
        <StatCard title="Current Streak" value={currentStreak} subtitle="Days in a row"  />
        <StatCard title="Best Streak" value={bestStreak} subtitle="Personal record" />
        <StatCard title="Total Completed" value={totalCompleted} subtitle="Habits accomplished" />
        <StatCard title="Success Rate" value={`${completionRate}%`} subtitle="All-time consistency" />
      </div>

      {/* 12-Week Heatmap */}
      <div className="mb-8">
        <Heatmap data={calendarData} successThreshold={profile?.successThreshold ?? 75} />
      </div>

      {/* Weekly Progress Chart */}
      <div className="mb-8">
        <WeeklyChart data={weeklyData} />
      </div>

      {/* Interactive Calendar & Synchronized Monthly Stats */}
      <MonthlySection
        safeHabits={safeHabits}
        calendarData={calendarData}
        initialMonth={today.getMonth()}
        initialYear={today.getFullYear()}
        successThreshold={profile?.successThreshold ?? 75}
      />
    </div>
  );
}
