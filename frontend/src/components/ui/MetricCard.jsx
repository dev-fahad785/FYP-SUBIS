export default function MetricCard({
  label,
  value,
  compact = false,
  className = '',
}) {
  return (
    <div className={`metric-card ${className}`}>
      <strong className={`${compact ? 'text-xl' : 'text-2xl'} text-slate-100`}>
        {value}
      </strong>
      <span className="metric-label">{label}</span>
    </div>
  );
}
