export default function Badge({
  variant = 'primary',
  children,
  className = '',
}) {
  const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider';

  const variants = {
    primary: 'bg-blue-500/20 text-blue-200',
    live: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
    simulated: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
    danger: 'bg-red-500/20 text-red-200',
    success: 'bg-green-500/20 text-green-200',
  };

  const variantClasses = variants[variant] || variants.primary;

  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
}
