export default function Card({
  children,
  glass = false,
  className = '',
}) {
  const baseClasses = 'rounded-2xl border border-white/10 bg-white/5';
  const glassClasses = glass ? 'p-8 backdrop-blur-xl shadow-2xl' : 'p-6';

  return (
    <div className={`${baseClasses} ${glassClasses} ${className}`}>
      {children}
    </div>
  );
}
