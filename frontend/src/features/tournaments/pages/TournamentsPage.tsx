import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { tournamentsAPI } from '../../../core/api/api';
import type { Tournament } from '../../../shared/types/api';

export function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('all');

  useEffect(() => {
    loadTournaments();
  }, [filter]);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      setError(null);
      let filters = {};
      if (filter === 'upcoming') {
        filters = { status: 'UPCOMING,REGISTRATION' };
      } else if (filter === 'live') {
        filters = { status: 'IN_PROGRESS' };
      } else if (filter === 'finished') {
        filters = { status: 'COMPLETED' };
      }
      const data = await tournamentsAPI.getTournaments(filters);
      setTournaments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      UPCOMING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      REGISTRATION: 'bg-green-500/10 text-green-400 border-green-500/20',
      IN_PROGRESS: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return badges[status as keyof typeof badges] || badges.UPCOMING;
  };

  const getDivisionBadge = (division: string) => {
    const displayNames = {
      HIGH_SCHOOL: 'High School',
      MIDDLE_SCHOOL: 'Middle School',
      COLLEGIATE: 'Collegiate',
      OPEN: 'Open',
    };
    return displayNames[division as keyof typeof displayNames] || division;
  };

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone shifts
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Tournaments</h1>
          <p className="text-slate-400">Browse and register for upcoming Science Bowl tournaments</p>
        </div>

        {/* Filter Slider */}
        <div className="inline-flex bg-slate-800/50 rounded-lg p-1 mb-6 border border-slate-700">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md transition-all ${
              filter === 'all'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-md transition-all ${
              filter === 'upcoming'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('live')}
            className={`px-4 py-2 rounded-md transition-all ${
              filter === 'live'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setFilter('finished')}
            className={`px-4 py-2 rounded-md transition-all ${
              filter === 'finished'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Finished
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="text-slate-400 mt-4">Loading tournaments...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Tournaments List */}
        {!loading && !error && (
          <div className="space-y-4">
            {tournaments.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 rounded-lg border border-slate-700">
                <p className="text-slate-400">No tournaments found</p>
              </div>
            ) : (
              tournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  to={`/tournaments/${tournament.id}`}
                  className="block bg-slate-800/50 hover:bg-slate-800/80 transition-colors rounded-lg border border-slate-700 hover:border-purple-600/50 p-6"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{tournament.name}</h3>
                      <div className="flex gap-2 items-center">
                        <span className={`text-xs px-2 py-1 rounded border ${getStatusBadge(tournament.status)}`}>
                          {tournament.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs px-2 py-1 rounded border bg-slate-700/30 text-slate-300 border-slate-600">
                          {getDivisionBadge(tournament.division)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">Tournament Date</div>
                      <div className="text-white font-semibold">{formatDate(tournament.tournament_date)}</div>
                    </div>
                  </div>

                  <p className="text-slate-300 mb-4">{tournament.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500">Location</div>
                      <div className="text-slate-200">{tournament.location}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Format</div>
                      <div className="text-slate-200">{tournament.format.replace('_', ' ')}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Teams</div>
                      <div className="text-slate-200">
                        {tournament.current_teams}
                        {tournament.max_teams && ` / ${tournament.max_teams}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Host</div>
                      <div className="text-slate-200">{tournament.host_organization}</div>
                    </div>
                  </div>

                  {(tournament.registration_deadline || tournament.website_url || tournament.registration_url) && (
                    <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                      {tournament.registration_deadline && (
                        <div className="text-sm text-slate-400">
                          Registration closes: <span className="text-slate-200">{formatDate(tournament.registration_deadline)}</span>
                        </div>
                      )}
                      <div className="flex gap-2 ml-auto">
                        {tournament.website_url && (
                          <a
                            href={tournament.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm px-3 py-1 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors"
                          >
                            Website
                          </a>
                        )}
                        {tournament.registration_url && (
                          <a
                            href={tournament.registration_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm px-3 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-colors"
                          >
                            Register
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
