export default function Alert({
  type = 'success',
  message,
  className = '',
}) {
  const baseClasses = 'rounded-lg border p-4';

  const types = {
    success: 'border-green-500/50 bg-green-900/30 text-green-200',
    error: 'border-red-500/50 bg-red-900/30 text-red-200',
    info: 'border-blue-500/50 bg-blue-900/30 text-blue-200',
    warning: 'border-amber-500/50 bg-amber-900/30 text-amber-200',
  };

  const typeClasses = types[type] || types.success;

  return (
    <div className={`${baseClasses} ${typeClasses} ${className}`} role="alert">
      {message}
    </div>
  );
}
