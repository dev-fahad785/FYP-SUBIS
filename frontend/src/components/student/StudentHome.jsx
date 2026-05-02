import { Button } from '../ui';
import LiveMap from '../LiveMap';

export default function StudentHome({
  userId,
  userName,
  userEmail,
  onLogout,
}) {
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 px-8 py-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center rounded-full px-2.5 py-1.5 bg-blue-500/20 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2">
            Live Map
          </div>
          <h2 className="text-3xl font-bold text-slate-100">
            Welcome{userEmail ? `, ${userEmail}` : ''}!
          </h2>
        </div>
        <Button variant="ghost" onClick={onLogout}>
          Log out
        </Button>
      </div>

      {/* Map Container */}
      <div className="flex-1 overflow-hidden">
        <LiveMap
          userId={userId}
          userName={userName || userEmail?.split('@')[0] || 'Student'}
        />
      </div>
    </div>
  );
}
