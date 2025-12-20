export function SocialPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Social</h1>
          <p className="text-slate-400">Connect with the Science Bowl community</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Community Update</h2>
          <div className="grid md:grid-cols-3 gap-3 opacity-50">
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Comments on Questions</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Comments on Profiles</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Friend System</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Messaging</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Achievements</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Karma System</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Weekly Events</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Topic Pages</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Textbook Groups</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Revamped Profiles</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Discord Integration</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
