import { Link } from "react-router-dom";

export function StudyPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Study</h1>
          <p className="text-slate-400">Practice and improve your skills</p>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Available Now</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              to="/practice"
              className="rounded-lg border border-purple-500/30 bg-slate-800/50 p-6 hover:border-purple-400/50 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white mb-1">Practice</h3>
              <p className="text-sm text-slate-400">Solo reading & flashcard play</p>
            </Link>

            <Link
              to="/database"
              className="rounded-lg border border-purple-500/30 bg-slate-800/50 p-6 hover:border-purple-400/50 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white mb-1">Database</h3>
              <p className="text-sm text-slate-400">Browse and search questions</p>
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Community</h2>
          <div className="grid md:grid-cols-3 gap-3 opacity-50">
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Question Submissions</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Question Reporting</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Question Rating</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Study Update</h2>
          <div className="grid md:grid-cols-3 gap-3 opacity-50">
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Adaptive Difficulty</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Topic Drills</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">AI Hints</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Study Plans</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Textbook Integration</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <p className="text-sm text-slate-400">Progress Tracking</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
