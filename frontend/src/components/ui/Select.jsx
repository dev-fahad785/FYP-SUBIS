export default function Select({
  label,
  options = [],
  className = '',
  ...props
}) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <select
        className={`w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-base text-slate-100 transition-all duration-200 focus:outline-none focus:border-blue-400 focus:bg-blue-500/10 cursor-pointer ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
