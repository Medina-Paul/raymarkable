export function StatCard({ 
  title, 
  value, 
  subtitle, 
}: { 
  title: string; 
  value: string | number; 
  subtitle: string; 
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-5 border border-gray-200 dark:border-zinc-800 flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">{title}</p>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-black dark:text-white">{value}</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-medium">{subtitle}</p>
      </div>
    </div>
  );
}
