import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  className = '',
  ...props
}, ref) => {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input
        ref={ref}
        className={`w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-base text-slate-100 transition-all duration-200 placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:bg-blue-500/10 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-300">{error}</span>}
    </label>
  );
});

Input.displayName = 'Input';

export default Input;
