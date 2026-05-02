import { Card } from '../ui';

export default function AuthLayout({
  eyebrow = 'SUBIS · Authentication',
  title,
  lede,
  message,
  messageType = 'success',
  error,
  children,
}) {
  return (
    <div className="page-container">
      <Card glass className="w-full max-w-xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-bold text-slate-100 mb-3">{title}</h1>
          <p className="text-base text-slate-300 leading-relaxed">{lede}</p>
        </header>

        {message && (
          <div className={`alert alert-${messageType} mb-4`}>
            {message}
          </div>
        )}
        {error && (
          <div className="alert alert-error mb-4">
            {error}
          </div>
        )}

        {children}
      </Card>
    </div>
  );
}
