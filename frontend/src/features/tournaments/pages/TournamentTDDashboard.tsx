import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tournamentsAPI } from '../../../core/api/api';
import type { Tournament, Team, Room, Game } from '../../../shared/types/api';

interface PoolStats {
  poolName: string;
  teams: TeamWithRecord[];
}

interface TeamWithRecord {
  id: number;
  name: string;
  school: string;
  seed: number | null;
  pool: string;
  players_count: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

type TabType = 'overview' | 'teams' | 'pools' | 'bracket' | 'questions' | 'staffing';

export default function TournamentTDDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [poolStats, setPoolStats] = useState<PoolStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Schedule generation state
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [generatedSchedule, setGeneratedSchedule] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch all tournament data in parallel
        const [tournamentData, teamsData, roomsData, gamesData] = await Promise.all([
          tournamentsAPI.getTournament(Number(id)),
          tournamentsAPI.getTournamentTeams(Number(id)),
          tournamentsAPI.getTournamentRooms(Number(id)),
          tournamentsAPI.getTournamentGames(Number(id)),
        ]);

        setTournament(tournamentData);
        setTeams(teamsData);
        setRooms(roomsData);
        setGames(gamesData);

        // Calculate pool statistics
        calculatePoolStats(teamsData, gamesData);
      } catch (err) {
        console.error('Error fetching tournament data:', err);
        setError('Failed to load tournament data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const calculatePoolStats = (teamsData: Team[], gamesData: Game[]) => {
    // Group teams by pool
    const poolMap = new Map<string, TeamWithRecord[]>();

    teamsData.forEach((team) => {
      const poolName = team.pool || 'Unassigned';

      // Calculate team's record from completed games
      const teamGames = gamesData.filter(
        (game) =>
          game.is_complete &&
          (game.team1_name === team.name || game.team2_name === team.name)
      );

      let wins = 0;
      let losses = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

      teamGames.forEach((game) => {
        const isTeam1 = game.team1_name === team.name;
        const teamScore = isTeam1 ? game.team1_score : game.team2_score;
        const oppScore = isTeam1 ? game.team2_score : game.team1_score;

        pointsFor += teamScore;
        pointsAgainst += oppScore;

        if (teamScore > oppScore) {
          wins++;
        } else if (teamScore < oppScore) {
          losses++;
        }
      });

      const teamWithRecord: TeamWithRecord = {
        ...team,
        wins,
        losses,
        pointsFor,
        pointsAgainst,
      };

      if (!poolMap.has(poolName)) {
        poolMap.set(poolName, []);
      }
      poolMap.get(poolName)!.push(teamWithRecord);
    });

    // Sort teams within each pool by wins (descending), then by point differential
    poolMap.forEach((teams) => {
      teams.sort((a, b) => {
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        const aDiff = a.pointsFor - a.pointsAgainst;
        const bDiff = b.pointsFor - b.pointsAgainst;
        return bDiff - aDiff;
      });
    });

    // Convert to array and sort pools alphabetically
    const poolsArray = Array.from(poolMap.entries())
      .map(([poolName, teams]) => ({ poolName, teams }))
      .sort((a, b) => {
        if (a.poolName === 'Unassigned') return 1;
        if (b.poolName === 'Unassigned') return -1;
        return a.poolName.localeCompare(b.poolName);
      });

    setPoolStats(poolsArray);
  };

  const handleGenerateSchedule = async () => {
    if (!id) return;

    // Validation checks
    if (rooms.length === 0) {
      alert('Please add rooms before generating the schedule.');
      return;
    }

    const teamsWithPools = teams.filter(t => t.pool && t.pool !== 'Unassigned');
    if (teamsWithPools.length === 0) {
      alert('Please assign teams to pools before generating the schedule.');
      return;
    }

    if (games.length > 0) {
      const confirmDelete = confirm(
        `This tournament already has ${games.length} games. Generating a new schedule will require deleting existing games. Continue?`
      );
      if (!confirmDelete) return;
    }

    try {
      setGenerating(true);
      const result = await tournamentsAPI.generateSchedule(Number(id));
      setGeneratedSchedule(result);
      setShowSchedulePreview(true);

      // Refresh games data
      const updatedGames = await tournamentsAPI.getTournamentGames(Number(id));
      setGames(updatedGames);
      calculatePoolStats(teams, updatedGames);
    } catch (err: any) {
      console.error('Error generating schedule:', err);
      alert(err.error || 'Failed to generate schedule. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'UPCOMING':
        return 'bg-blue-100 text-blue-800';
      case 'REGISTRATION':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-purple-100 text-purple-800';
      case 'COMPLETED':
        return 'bg-slate-100 text-slate-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getRoomStatusBadge = (status: string) => {
    switch (status) {
      case 'NOT_STARTED':
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded">Not Started</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">In Progress</span>;
      case 'FINISHED':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Finished</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error || 'Tournament not found'}</p>
          <button
            onClick={() => navigate('/tournaments')}
            className="mt-4 text-purple-600 hover:text-purple-700"
          >
            Return to tournaments
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactElement }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'pools',
      label: 'Pools',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'bracket',
      label: 'Bracket',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
    {
      id: 'questions',
      label: 'Questions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'staffing',
      label: 'Staffing',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/tournaments')}
            className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tournaments
          </button>

          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-slate-900">{tournament.name}</h1>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadgeClasses(tournament.status)}`}>
                  {tournament.status.replace('_', ' ')}
                </span>
                <span className="px-3 py-1 text-sm font-medium bg-indigo-100 text-indigo-800 rounded-full">
                  {tournament.division.replace('_', ' ')}
                </span>
              </div>
              <p className="text-slate-600 text-lg font-medium">Tournament Director Dashboard</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab
            tournament={tournament}
            teams={teams}
            rooms={rooms}
            games={games}
            poolStats={poolStats}
            generating={generating}
            handleGenerateSchedule={handleGenerateSchedule}
            getRoomStatusBadge={getRoomStatusBadge}
          />
        )}

        {activeTab === 'teams' && (
          <TeamsTab
            tournamentId={tournament.id}
            teams={teams}
            setTeams={setTeams}
          />
        )}

        {activeTab === 'pools' && (
          <PoolsTab teams={teams} setTeams={setTeams} calculatePoolStats={calculatePoolStats} games={games} />
        )}

        {activeTab === 'bracket' && <PlaceholderTab title="Bracket" description="Double elimination bracket view coming soon" />}
        {activeTab === 'questions' && <PlaceholderTab title="Questions" description="Question management coming soon" />}
        {activeTab === 'staffing' && <PlaceholderTab title="Staffing" description="Staff assignments and announcements coming soon" />}
      </div>

      {/* Schedule Preview Modal */}
      {showSchedulePreview && generatedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Schedule Generated Successfully</h2>
              <button
                onClick={() => setShowSchedulePreview(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="mb-6">
                <p className="text-slate-600">{generatedSchedule.message}</p>
                <div className="mt-4 flex gap-4">
                  {Object.entries(generatedSchedule.pools || {}).map(([pool, count]) => (
                    <div key={pool} className="px-3 py-2 bg-purple-50 rounded-lg">
                      <span className="text-sm font-medium text-purple-900">
                        Pool {pool}: {String(count)} teams
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-slate-900 mb-4">Generated Games</h3>
              <div className="space-y-6">
                {Object.entries(
                  (generatedSchedule.games || []).reduce((acc: any, game: any) => {
                    if (!acc[game.pool]) acc[game.pool] = [];
                    acc[game.pool].push(game);
                    return acc;
                  }, {})
                ).map(([pool, poolGames]: [string, any]) => (
                  <div key={pool} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <h4 className="font-semibold text-slate-900">Pool {pool}</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Round</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Room</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Matchup</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {poolGames.map((game: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-sm text-slate-900">{game.round_number}</td>
                              <td className="px-4 py-2 text-sm text-slate-600">{game.room_name}</td>
                              <td className="px-4 py-2 text-sm">
                                <span className="font-medium text-slate-900">{game.team1_name}</span>
                                <span className="text-slate-500 mx-2">vs</span>
                                <span className="font-medium text-slate-900">{game.team2_name}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSchedulePreview(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  tournament,
  teams,
  rooms,
  games,
  poolStats,
  generating,
  handleGenerateSchedule,
  getRoomStatusBadge,
}: {
  tournament: Tournament;
  teams: Team[];
  rooms: Room[];
  games: Game[];
  poolStats: PoolStats[];
  generating: boolean;
  handleGenerateSchedule: () => void;
  getRoomStatusBadge: (status: string) => React.ReactElement;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Pool Standings */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Round Robin Pools</h2>

          {poolStats.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-slate-500">No pools have been created yet.</p>
              <p className="text-sm text-slate-400 mt-2">Go to the Pools tab to configure pool assignments.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {poolStats.map((pool) => (
                <div key={pool.poolName} className="border-b border-slate-200 last:border-b-0 pb-6 last:pb-0">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    Pool {pool.poolName}
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({pool.teams.length} teams)
                    </span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Team</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">School</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">W-L</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">PF</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">PA</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Diff</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {pool.teams.map((team, index) => {
                          const diff = team.pointsFor - team.pointsAgainst;
                          return (
                            <tr key={team.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                                  {index + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-medium text-slate-900">{team.name}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{team.school}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className="font-semibold text-slate-900">
                                  {team.wins}-{team.losses}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center text-slate-600">{team.pointsFor}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-center text-slate-600">{team.pointsAgainst}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className={`font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Room Status & Quick Actions */}
      <div className="space-y-6">
        {/* Room Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Room Status</h2>

          {rooms.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-slate-500 text-sm">No rooms configured</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {rooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{room.name}</p>
                      <p className="text-sm text-slate-500">Round {room.current_round || 0}</p>
                    </div>
                    {getRoomStatusBadge(room.status)}
                  </div>
                ))}
              </div>

              {/* Room Summary */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{rooms.filter((r) => r.status === 'NOT_STARTED').length}</p>
                    <p className="text-xs text-slate-500 mt-1">Not Started</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{rooms.filter((r) => r.status === 'IN_PROGRESS').length}</p>
                    <p className="text-xs text-slate-500 mt-1">In Progress</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{rooms.filter((r) => r.status === 'FINISHED').length}</p>
                    <p className="text-xs text-slate-500 mt-1">Finished</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={handleGenerateSchedule}
              disabled={generating || games.length > 0}
              className={`block w-full px-4 py-2 text-center text-sm font-medium rounded-lg transition-colors ${
                games.length > 0
                  ? 'bg-green-50 text-green-700 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : games.length > 0 ? (
                '✓ Schedule Generated'
              ) : (
                'Generate Schedule'
              )}
            </button>
            <Link
              to={`/tournaments/${tournament.id}`}
              className="block w-full px-4 py-2 text-center text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              View Public Tournament Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pools Tab Component - Number-first pool configuration
function PoolsTab({
  teams,
  setTeams,
  calculatePoolStats,
  games,
}: {
  teams: Team[];
  setTeams: (teams: Team[]) => void;
  calculatePoolStats: (teams: Team[], games: Game[]) => void;
  games: Game[];
}) {
  const [poolCount, setPoolCount] = useState<number>(0);
  const [poolAssignments, setPoolAssignments] = useState<Map<string, Team[]>>(new Map());
  const [saving, setSaving] = useState(false);
  const [draggedTeam, setDraggedTeam] = useState<Team | null>(null);

  // Auto-distribute teams evenly across pools
  const autoDistribute = () => {
    if (poolCount < 1 || poolCount > 26) {
      alert('Please enter a valid number of pools (1-26)');
      return;
    }

    const poolNames = Array.from({ length: poolCount }, (_, i) => String.fromCharCode(65 + i)); // A, B, C...
    const teamsPerPool = Math.floor(teams.length / poolCount);
    const remainder = teams.length % poolCount;

    const newAssignments = new Map<string, Team[]>();
    let teamIndex = 0;

    poolNames.forEach((poolName, poolIndex) => {
      const poolSize = poolIndex < remainder ? teamsPerPool + 1 : teamsPerPool;
      const poolTeams = teams.slice(teamIndex, teamIndex + poolSize);
      newAssignments.set(poolName, poolTeams);
      teamIndex += poolSize;
    });

    setPoolAssignments(newAssignments);
  };

  // Save pool configuration
  const handleSave = async () => {
    setSaving(true);
    try {
      // Create batch of update promises
      const updatePromises: Promise<any>[] = [];

      poolAssignments.forEach((poolTeams, poolName) => {
        poolTeams.forEach((team) => {
          updatePromises.push(tournamentsAPI.updateTeamPool(team.id, poolName));
        });
      });

      await Promise.all(updatePromises);

      // Update local state
      const updatedTeams = teams.map((team) => {
        for (const [poolName, poolTeams] of poolAssignments.entries()) {
          if (poolTeams.find((t) => t.id === team.id)) {
            return { ...team, pool: poolName };
          }
        }
        return team;
      });

      setTeams(updatedTeams);
      calculatePoolStats(updatedTeams, games);

      alert('Pool configuration saved successfully!');
    } catch (error) {
      console.error('Error saving pool configuration:', error);
      alert('Failed to save pool configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Drag-and-drop handlers
  const handleDragStart = (team: Team) => {
    setDraggedTeam(team);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetPoolName: string) => {
    if (!draggedTeam) return;

    const newAssignments = new Map(poolAssignments);

    // Remove team from current pool
    for (const [poolName, poolTeams] of newAssignments.entries()) {
      const filteredTeams = poolTeams.filter((t) => t.id !== draggedTeam.id);
      if (filteredTeams.length !== poolTeams.length) {
        newAssignments.set(poolName, filteredTeams);
        break;
      }
    }

    // Add team to target pool
    const targetPool = newAssignments.get(targetPoolName) || [];
    newAssignments.set(targetPoolName, [...targetPool, draggedTeam]);

    setPoolAssignments(newAssignments);
    setDraggedTeam(null);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Pool Configuration</h2>

        {/* Current Status */}
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-900">
            <strong>Total teams:</strong> {teams.length}
          </p>
          <p className="text-sm text-purple-700 mt-1">
            Teams with pool assignments: {teams.filter((t) => t.pool && t.pool !== 'Unassigned').length}
          </p>
        </div>

        {/* Number Input */}
        <div className="flex items-end gap-4 mb-6">
          <div className="flex-1">
            <label htmlFor="poolCount" className="block text-sm font-medium text-slate-700 mb-2">
              How many pools?
            </label>
            <input
              type="number"
              id="poolCount"
              min="1"
              max="26"
              value={poolCount || ''}
              onChange={(e) => setPoolCount(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Enter number (1-26)"
            />
          </div>
          <button
            onClick={autoDistribute}
            disabled={poolCount < 1 || poolCount > 26}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Auto-Distribute
          </button>
        </div>

        {/* Instructions */}
        {poolAssignments.size === 0 && (
          <div className="text-sm text-slate-600 space-y-2">
            <p>Enter the number of pools and click "Auto-Distribute" to evenly distribute teams across pools.</p>
            <p>After distribution, you can drag-and-drop teams between pools to make manual adjustments.</p>
          </div>
        )}
      </div>

      {/* Pool Display */}
      {poolAssignments.size > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Pool Assignments</h2>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Pool Configuration'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from(poolAssignments.entries()).map(([poolName, poolTeams]) => (
              <div
                key={poolName}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(poolName)}
                className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50 hover:border-purple-400 transition-colors"
              >
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Pool {poolName}</span>
                  <span className="text-sm font-normal text-slate-500">({poolTeams.length} teams)</span>
                </h3>

                <div className="space-y-2">
                  {poolTeams.map((team) => (
                    <div
                      key={team.id}
                      draggable
                      onDragStart={() => handleDragStart(team)}
                      className="p-3 bg-white border border-slate-200 rounded-lg cursor-move hover:shadow-md hover:border-purple-300 transition-all"
                    >
                      <p className="font-medium text-slate-900">{team.name}</p>
                      <p className="text-xs text-slate-500">{team.school}</p>
                    </div>
                  ))}

                  {poolTeams.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      Drag teams here
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Teams Tab Component - Team and Player Management
function TeamsTab({
  tournamentId,
  teams,
  setTeams,
}: {
  tournamentId: number;
  teams: Team[];
  setTeams: (teams: Team[]) => void;
}) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [teamPlayers, setTeamPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // New team form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSchool, setNewTeamSchool] = useState('');

  // New player form state
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerGrade, setNewPlayerGrade] = useState('');

  // Load players for selected team
  const loadTeamPlayers = async (teamId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/teams/${teamId}/players/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTeamPlayers(data);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  // Select team and load its players
  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team);
    loadTeamPlayers(team.id);
  };

  // Add new team
  const handleAddTeam = async () => {
    if (!newTeamName.trim() || !newTeamSchool.trim()) {
      alert('Please enter both team name and school');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/teams/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          name: newTeamName,
          school: newTeamSchool,
          tournament: tournamentId,
        }),
      });

      if (response.ok) {
        const newTeam = await response.json();
        setTeams([...teams, newTeam]);
        setNewTeamName('');
        setNewTeamSchool('');
        setShowAddTeam(false);
        alert('Team added successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to add team: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding team:', error);
      alert('Failed to add team. Please try again.');
    }
  };

  // Delete team
  const handleDeleteTeam = async (teamId: number) => {
    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${teamId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        setTeams(teams.filter((t) => t.id !== teamId));
        if (selectedTeam?.id === teamId) {
          setSelectedTeam(null);
          setTeamPlayers([]);
        }
        alert('Team deleted successfully!');
      } else {
        alert('Failed to delete team.');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team. Please try again.');
    }
  };

  // Add player to team
  const handleAddPlayer = async () => {
    if (!selectedTeam) return;
    if (!newPlayerName.trim() || !newPlayerGrade.trim()) {
      alert('Please enter both player name and grade level');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/players/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          name: newPlayerName,
          grade_level: newPlayerGrade,
          team: selectedTeam.id,
        }),
      });

      if (response.ok) {
        const newPlayer = await response.json();
        setTeamPlayers([...teamPlayers, newPlayer]);
        setNewPlayerName('');
        setNewPlayerGrade('');
        setShowAddPlayer(false);

        // Update team's player count
        const updatedTeams = teams.map((t) =>
          t.id === selectedTeam.id ? { ...t, players_count: t.players_count + 1 } : t
        );
        setTeams(updatedTeams);

        alert('Player added successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to add player: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding player:', error);
      alert('Failed to add player. Please try again.');
    }
  };

  // Delete player
  const handleDeletePlayer = async (playerId: number) => {
    if (!confirm('Are you sure you want to remove this player?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/players/${playerId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        setTeamPlayers(teamPlayers.filter((p) => p.id !== playerId));

        // Update team's player count
        if (selectedTeam) {
          const updatedTeams = teams.map((t) =>
            t.id === selectedTeam.id ? { ...t, players_count: Math.max(0, t.players_count - 1) } : t
          );
          setTeams(updatedTeams);
        }

        alert('Player removed successfully!');
      } else {
        alert('Failed to remove player.');
      }
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Failed to remove player. Please try again.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Teams List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Teams ({teams.length})</h2>
          <button
            onClick={() => setShowAddTeam(!showAddTeam)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            {showAddTeam ? 'Cancel' : '+ Add Team'}
          </button>
        </div>

        {/* Add Team Form */}
        {showAddTeam && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Add New Team</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Team Name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="School"
                value={newTeamSchool}
                onChange={(e) => setNewTeamSchool(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                onClick={handleAddTeam}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create Team
              </button>
            </div>
          </div>
        )}

        {/* Teams List */}
        <div className="space-y-2">
          {teams.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No teams yet. Add your first team!</p>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedTeam?.id === team.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                }`}
                onClick={() => handleSelectTeam(team)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{team.name}</h3>
                    <p className="text-sm text-slate-600">{team.school}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>{team.players_count} players</span>
                      {team.pool && team.pool !== 'Unassigned' && <span>Pool {team.pool}</span>}
                      {team.seed && <span>Seed #{team.seed}</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTeam(team.id);
                    }}
                    className="text-red-600 hover:text-red-700 p-2"
                    title="Delete team"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column - Players for Selected Team */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        {selectedTeam ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedTeam.name}</h2>
                <p className="text-sm text-slate-600">{selectedTeam.school}</p>
              </div>
              <button
                onClick={() => setShowAddPlayer(!showAddPlayer)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                {showAddPlayer ? 'Cancel' : '+ Add Player'}
              </button>
            </div>

            {/* Add Player Form */}
            {showAddPlayer && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Add New Player</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Player Name"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <input
                    type="text"
                    placeholder="Grade Level (e.g., 9, 10, 11, 12)"
                    value={newPlayerGrade}
                    onChange={(e) => setNewPlayerGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <button
                    onClick={handleAddPlayer}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Add Player
                  </button>
                </div>
              </div>
            )}

            {/* Players List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-2 text-sm text-slate-500">Loading players...</p>
              </div>
            ) : teamPlayers.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No players yet. Add the first player!</p>
            ) : (
              <div className="space-y-2">
                {teamPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{player.name}</h3>
                        <p className="text-sm text-slate-600">Grade {player.grade_level}</p>
                      </div>
                      <button
                        onClick={() => handleDeletePlayer(player.id)}
                        className="text-red-600 hover:text-red-700 p-2"
                        title="Remove player"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-slate-500">Select a team to view and manage its players</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Placeholder Tab Component
function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
      <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}
