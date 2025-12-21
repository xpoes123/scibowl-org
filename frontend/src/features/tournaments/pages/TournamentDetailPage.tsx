import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { tournamentsAPI } from '../../../core/api/api';
import type { Tournament, Team } from '../../../shared/types/api';
import { Avatar } from '../../profile/components/Avatar';

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'pools' | 'contact'>('overview');

  useEffect(() => {
    if (id) {
      loadTournamentDetails();
    }
  }, [id]);

  const loadTournamentDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const [tournamentData, teamsData] = await Promise.all([
        tournamentsAPI.getTournament(Number(id)),
        tournamentsAPI.getTournamentTeams(Number(id)),
      ]);
      setTournament(tournamentData);
      setTeams(teamsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone shifts
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="text-slate-400 mt-4">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error || 'Tournament not found'}
          </div>
          <Link to="/tournaments" className="inline-block mt-4 text-purple-400 hover:text-purple-300">
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link to="/tournaments" className="text-purple-400 hover:text-purple-300 mb-4 inline-block">
            Back to Tournaments
          </Link>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{tournament.name}</h1>
              <div className="flex gap-2">
                <span className={`text-xs px-2 py-1 rounded border ${getStatusBadge(tournament.status)}`}>
                  {tournament.status.replace('_', ' ')}
                </span>
                <span className="text-xs px-2 py-1 rounded border bg-slate-700/30 text-slate-300 border-slate-600">
                  {tournament.division.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {tournament.website_url && (
                <a
                  href={tournament.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors font-semibold"
                >
                  Website
                </a>
              )}
              {tournament.registration_url && (
                <a
                  href={tournament.registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
                >
                  Register Team
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Tournament Date</div>
            <div className="text-white font-semibold">{formatDate(tournament.tournament_date)}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Location</div>
            <div className="text-white font-semibold">{tournament.location}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Format</div>
            <div className="text-white font-semibold">{tournament.format.replace('_', ' ')}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Teams Registered</div>
            <div className="text-white font-semibold">
              {tournament.current_teams}
              {tournament.max_teams && ` / ${tournament.max_teams}`}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'teams'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Teams ({teams.length})
          </button>
          {tournament.format === 'ROUND_ROBIN' && tournament.status === 'IN_PROGRESS' && (
            <button
              onClick={() => setActiveTab('pools')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'pools'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pools
            </button>
          )}
          <button
            onClick={() => setActiveTab('contact')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'contact'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Contact
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-3">About</h2>
              <p className="text-slate-300 mb-4">{tournament.description}</p>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-slate-400 text-sm">Venue</div>
                  <div className="text-white">{tournament.venue || 'TBD'}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">Host Organization</div>
                  <div className="text-white">{tournament.host_organization}</div>
                </div>
                {tournament.registration_deadline && (
                  <div>
                    <div className="text-slate-400 text-sm">Registration Deadline</div>
                    <div className="text-white">{formatDate(tournament.registration_deadline)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Registered Teams</h2>
            {teams.length === 0 ? (
              <p className="text-slate-400">No teams registered yet</p>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => (
                  <div key={team.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-white font-semibold">{team.name}</div>
                        <div className="text-slate-400 text-sm">{team.school}</div>
                      </div>
                      <div className="text-right">
                        {team.seed !== null && (
                          <div className="text-purple-400 text-sm">Seed #{team.seed}</div>
                        )}
                        <div className="text-slate-400 text-sm">{team.players_count} players</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pools' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Round Robin Pools</h2>
              <p className="text-slate-400">4 Groups of 4 Teams</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {['A', 'B', 'C', 'D'].map((pool) => {
                const poolTeams = teams.filter((team) => team.pool === pool);
                return (
                  <div key={pool} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-purple-400 mb-4 text-center">Pool {pool}</h3>
                    <div className="space-y-3">
                      {poolTeams.length === 0 ? (
                        <p className="text-slate-400 text-center">No teams assigned</p>
                      ) : (
                        poolTeams.map((team) => (
                          <div key={team.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-purple-500/30 transition-colors">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="text-white font-semibold">{team.name}</div>
                                <div className="text-slate-400 text-sm">{team.school}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-purple-400 text-sm font-medium">Seed #{team.seed}</div>
                                <div className="text-slate-500 text-xs">{team.players_count} players</div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Tournament Director</h2>
            {tournament.director ? (
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <Link to={`/profile/${tournament.director.username}`}>
                    <Avatar
                      username={tournament.director.username}
                      size={64}
                      className="border-2 border-purple-500/30 hover:border-purple-400/50 transition-colors cursor-pointer"
                    />
                  </Link>
                  <div className="flex-1">
                    <div className="mb-2">
                      <Link to={`/profile/${tournament.director.username}`}>
                        <h3 className="text-xl font-bold text-white hover:text-purple-300 transition-colors">
                          {tournament.director.first_name && tournament.director.last_name
                            ? `${tournament.director.first_name} ${tournament.director.last_name}`
                            : tournament.director.username}
                        </h3>
                      </Link>
                    </div>
                    {tournament.director.school && (
                      <div className="text-slate-400 mb-3">
                        <span className="font-medium">School:</span> {tournament.director.school}
                      </div>
                    )}
                    {tournament.director.bio && (
                      <p className="text-slate-300">{tournament.director.bio}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">No tournament director assigned yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
