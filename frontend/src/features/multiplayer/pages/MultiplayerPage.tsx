export function MultiplayerPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Multiplayer</h1>
          <p className="text-slate-400">Compete with other players</p>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Community</h2>
          <div className="grid md:grid-cols-2 gap-3 opacity-50">
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">1v1 Matches</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Profile Stats</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Leaderboards</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Competitive Update</h2>
          <div className="grid md:grid-cols-3 gap-3 opacity-50">
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Multiplayer Rooms</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Competitive Queue</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">n v m Matches</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Competitive Analytics</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
