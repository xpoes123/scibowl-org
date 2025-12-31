import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/logo_big.png" alt="SciBowl" className="w-16 h-16" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
              SciBowl
            </h1>
          </div>
          <p className="text-lg text-slate-400">
            A website like no other...
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link
            to="/study"
            className="rounded-lg border border-purple-500/30 bg-slate-800/50 p-6 hover:border-purple-400/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-white mb-2">Study</h2>
            <p className="text-sm text-slate-400">Practice and learn</p>
          </Link>

          <Link
            to="/multiplayer"
            className="rounded-lg border border-purple-500/30 bg-slate-800/50 p-6 hover:border-purple-400/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-white mb-2">Multiplayer</h2>
            <p className="text-sm text-slate-400">Compete with others</p>
          </Link>

          <Link
            to="/tournaments"
            className="rounded-lg border border-purple-500/30 bg-slate-800/50 p-6 hover:border-purple-400/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-white mb-2">Tournaments</h2>
            <p className="text-sm text-slate-400">Organize events</p>
          </Link>

          <Link
            to="/social"
            className="rounded-lg border border-purple-500/30 bg-slate-800/50 p-6 hover:border-purple-400/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-white mb-2">Social</h2>
            <p className="text-sm text-slate-400">Connect with community</p>
          </Link>

          <Link
            to="/coaching"
            className="rounded-lg border border-purple-500/30 bg-slate-800/50 p-6 hover:border-purple-400/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-white mb-2">Coaching</h2>
            <p className="text-sm text-slate-400">Team management</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
