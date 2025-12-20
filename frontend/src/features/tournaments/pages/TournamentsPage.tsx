export function TournamentsPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Tournaments</h1>
          <p className="text-slate-400">Organize and run Science Bowl tournaments</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Tournament Organizer Update</h2>
          <div className="grid md:grid-cols-3 gap-3 opacity-50">
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Online Buzzing</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">MODAQ Stats</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Live Game Results</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Room Dashboard</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Scorekeeper Tools</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Round Robin Generator</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Double Elimination</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Seeding & Scheduling</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
