export default function BarChart({ points = [] }) {
  const maxValue = Math.max(...points.map((point) => point.total), 1);

  return (
    <div className="grid gap-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8">
      {points.map((point) => (
        <div
          key={point.label}
          className="flex flex-col items-center gap-2"
        >
          <div className="relative w-full h-32 bg-white/5 border border-white/10 rounded-lg flex items-end justify-center p-2">
            <div
              className="w-2 bg-gradient-to-t from-blue-500 to-blue-400 rounded-sm transition-all"
              style={{ height: `${Math.max((point.total / maxValue) * 100, point.total ? 12 : 4)}%` }}
              title={`${point.label}: ${point.total}`}
            />
          </div>
          <span className="text-xs text-center text-slate-400 truncate w-full">{point.label}</span>
        </div>
      ))}
    </div>
  );
}
