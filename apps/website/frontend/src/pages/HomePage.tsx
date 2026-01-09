import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="px-4 py-8">
      <div className="max-w-6xl w-full mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/logo_big.png" alt="SciBowl" className="w-16 h-16" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
              SciBowl
            </h1>
          </div>
          <p className="text-lg text-slate-400">Browse Science Bowl tournaments</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link
            to="/tournaments"
            className="rounded-lg border border-purple-500/30 bg-slate-800/50 p-6 hover:border-purple-400/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-white mb-2">Tournaments</h2>
            <p className="text-sm text-slate-400">Browse upcoming events</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
