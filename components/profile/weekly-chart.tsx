"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/hooks/use-mounted";

const CustomAxisTick = ({ x, y, payload }: any) => {
  const [day, date] = payload.value.split("|");
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="currentColor" className="text-gray-500 dark:text-zinc-400" fontSize={10} fontWeight={500}>
        {day}
      </text>
      <text x={0} y={0} dy={24} textAnchor="middle" fill="currentColor" className="text-gray-400 dark:text-zinc-500" fontSize={9}>
        {date}
      </text>
    </g>
  );
};

const CustomTooltip = (props: any) => {
  const { payload, active } = props;
  if (!active || !payload || payload.length === 0) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 flex flex-col items-center shadow-lg">
      <p className="text-xs font-bold text-black dark:text-white mb-3">{data.dayName}, {data.dateName}</p>
      
      {/* Circular Graph (Donut Chart) */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
          <circle cx="18" cy="18" r="15.915" fill="transparent" className="stroke-gray-100 dark:stroke-zinc-800" strokeWidth="4" />
          <circle
            cx="18" cy="18" r="15.915"
            fill="transparent" 
            className="stroke-black dark:stroke-white" 
            strokeWidth="4"
            strokeDasharray="100 100"
            strokeDashoffset={100 - data.percent}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute text-center">
          <span className="text-[10px] font-bold text-black dark:text-white">{data.percent}%</span>
        </div>
      </div>
      
      <div className="mt-3 text-[10px] text-gray-500 dark:text-zinc-400 font-medium text-center">
        <p><span className="text-black dark:text-white font-bold">{data.completed}</span> Complete</p>
        <p><span className="text-gray-400 dark:text-zinc-500">{data.total - data.completed}</span> Incomplete</p>
      </div>
    </div>
  );
};

export function WeeklyChart({ data }: { data: any[] }) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";
  const gridColor = isDark ? "#27272a" : "#e5e7eb";
  const lineColor = isDark ? "#ffffff" : "#000000";
  const cursorColor = isDark ? "#27272a" : "#f3f4f6";

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 pb-2 border border-gray-200 dark:border-zinc-800 h-full flex flex-col relative">
      <h3 className="text-sm font-bold text-black dark:text-white mb-6">Weekly Progress</h3>
      
      <div className="h-64 w-full mt-4 -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridColor} />
            
            <XAxis 
              dataKey="label" 
              interval={0} // <--- THIS FORCES ALL 7 DATES TO SHOW ALWAYS
              tick={<CustomAxisTick />} 
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 10 }}
              tickFormatter={(val) => `${val}%`}
              ticks={[0, 50, 100]}
              domain={[0, 100]}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: cursorColor, strokeWidth: 2 }} />
            
            <Line 
              type="monotone" 
              dataKey="percent" 
              stroke={lineColor} 
              strokeWidth={3} 
              dot={false} 
              activeDot={{ r: 6, fill: lineColor, stroke: isDark ? '#09090b' : '#fff', strokeWidth: 2 }} 
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
