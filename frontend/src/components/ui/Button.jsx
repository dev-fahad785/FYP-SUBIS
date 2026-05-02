export default function Button({
  variant = 'primary',
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const baseClasses = 'rounded-lg font-bold transition-all duration-100 cursor-pointer border';

  const variants = {
    primary: 'px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-slate-950 border-blue-400 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg disabled:hover:translate-y-0',
    ghost: 'px-4 py-3 bg-white/5 border-white/10 text-slate-100 hover:bg-white/10 hover:-translate-y-0.5',
    danger: 'px-4 py-3 bg-red-900/20 border-red-500/50 text-red-200 hover:bg-red-900/30 hover:border-red-500/65',
    link: 'bg-none border-none text-blue-300 hover:text-blue-200 p-0 font-bold',
  };

  const variantClasses = variants[variant] || variants.primary;

  return (
    <button
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
