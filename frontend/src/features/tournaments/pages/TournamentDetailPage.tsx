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
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'pools' | 'schedule' | 'contact'>('overview');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Pool editing state
  const [editingPools, setEditingPools] = useState(false);
  const [poolCount, setPoolCount] = useState<number>(0);
  const [poolAssignments, setPoolAssignments] = useState<Map<string, Team[]>>(new Map());
  const [savingPools, setSavingPools] = useState(false);
  const [draggedTeam, setDraggedTeam] = useState<Team | null>(null);

  // Team editing state
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<any[]>([]);
  const [teamCoaches, setTeamCoaches] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerGrade, setNewPlayerGrade] = useState('');
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachEmail, setNewCoachEmail] = useState('');
  const [newCoachPhone, setNewCoachPhone] = useState('');

  // Add team state
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSchool, setNewTeamSchool] = useState('');

  // Room and schedule state
  const [rooms, setRooms] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [editingGame, setEditingGame] = useState<number | null>(null);
  const [editingGameRoom, setEditingGameRoom] = useState<number | null>(null);
  const [editingGameScore, setEditingGameScore] = useState<number | null>(null);
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);

  // Check if current user is admin (tournament director)
  const isAdmin = currentUser && tournament?.director && currentUser.id === tournament.director.id;

  useEffect(() => {
    if (id) {
      loadTournamentDetails();
      loadCurrentUser();
    }
  }, [id]);

  useEffect(() => {
    if (id && activeTab === 'schedule') {
      loadRooms();
      loadGames();
    }
  }, [id, activeTab]);

  useEffect(() => {
    if (id && activeTab === 'pools') {
      loadGames();
    }
  }, [id, activeTab]);

  const loadCurrentUser = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('http://localhost:8000/api/profile/', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
      }
    } catch (err) {
      console.error('Failed to load current user:', err);
    }
  };

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

  // Auto-distribute teams across pools
  const autoDistribute = () => {
    if (poolCount < 1 || poolCount > 26) {
      alert('Please enter a valid number of pools (1-26)');
      return;
    }

    const poolNames = Array.from({ length: poolCount }, (_, i) => String.fromCharCode(65 + i));
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
    setEditingPools(true);
  };

  // Save pool configuration
  const handleSavePools = async () => {
    setSavingPools(true);
    try {
      const updatePromises: Promise<any>[] = [];

      poolAssignments.forEach((poolTeams, poolName) => {
        poolTeams.forEach((team) => {
          updatePromises.push(tournamentsAPI.updateTeamPool(team.id, poolName));
        });
      });

      await Promise.all(updatePromises);

      // Refresh teams data
      if (id) {
        const teamsData = await tournamentsAPI.getTournamentTeams(Number(id));
        setTeams(teamsData);
      }

      setEditingPools(false);
      alert('Pool configuration saved successfully!');
    } catch (error) {
      console.error('Error saving pool configuration:', error);
      alert('Failed to save pool configuration. Please try again.');
    } finally {
      setSavingPools(false);
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

  // Team management handlers
  const handleSelectTeam = async (team: Team) => {
    setSelectedTeam(team);
    setEditingTeam(null);

    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add auth header if user is logged in
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Load players for this team
    setLoadingPlayers(true);
    try {
      const response = await fetch(`http://localhost:8000/api/teams/${team.id}/players/`, {
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setTeamPlayers(data);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoadingPlayers(false);
    }

    // Load coaches for this team
    setLoadingCoaches(true);
    try {
      const response = await fetch(`http://localhost:8000/api/teams/${team.id}/coaches/`, {
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setTeamCoaches(data);
      }
    } catch (error) {
      console.error('Error loading coaches:', error);
    } finally {
      setLoadingCoaches(false);
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam({ ...team });
  };

  const handleSaveTeam = async () => {
    if (!editingTeam) return;

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${editingTeam.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          name: editingTeam.name,
          school: editingTeam.school,
        }),
      });

      if (response.ok) {
        const updatedTeam = await response.json();
        setTeams(teams.map(t => t.id === updatedTeam.id ? updatedTeam : t));
        setSelectedTeam(updatedTeam);
        setEditingTeam(null);
        alert('Team updated successfully!');
      } else {
        alert('Failed to update team');
      }
    } catch (error) {
      console.error('Error updating team:', error);
      alert('Failed to update team. Please try again.');
    }
  };

  const handleAddTeam = async () => {
    if (!tournament || !newTeamName.trim() || !newTeamSchool.trim()) {
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
          tournament: tournament.id,
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
        setTeams(teams.filter(t => t.id !== teamId));
        if (selectedTeam?.id === teamId) {
          setSelectedTeam(null);
          setTeamPlayers([]);
          setTeamCoaches([]);
        }
        alert('Team deleted successfully!');
      } else {
        alert('Failed to delete team');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team. Please try again.');
    }
  };

  const handleAddPlayer = async () => {
    if (!selectedTeam || !newPlayerName.trim() || !newPlayerGrade.trim()) {
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
        const updatedTeams = teams.map(t =>
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
        setTeamPlayers(teamPlayers.filter(p => p.id !== playerId));

        // Update team's player count
        if (selectedTeam) {
          const updatedTeams = teams.map(t =>
            t.id === selectedTeam.id ? { ...t, players_count: Math.max(0, t.players_count - 1) } : t
          );
          setTeams(updatedTeams);
        }

        alert('Player removed successfully!');
      } else {
        alert('Failed to remove player');
      }
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Failed to remove player. Please try again.');
    }
  };

  const handleAddCoach = async () => {
    if (!selectedTeam || !newCoachName.trim()) {
      alert('Please enter coach name');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/coaches/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          name: newCoachName,
          email: newCoachEmail,
          phone: newCoachPhone,
          team: selectedTeam.id,
        }),
      });

      if (response.ok) {
        const newCoach = await response.json();
        setTeamCoaches([...teamCoaches, newCoach]);
        setNewCoachName('');
        setNewCoachEmail('');
        setNewCoachPhone('');
        setShowAddCoach(false);
        alert('Coach added successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to add coach: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding coach:', error);
      alert('Failed to add coach. Please try again.');
    }
  };

  const handleDeleteCoach = async (coachId: number) => {
    if (!confirm('Are you sure you want to remove this coach?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/coaches/${coachId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        setTeamCoaches(teamCoaches.filter(c => c.id !== coachId));
        alert('Coach removed successfully!');
      } else {
        alert('Failed to remove coach');
      }
    } catch (error) {
      console.error('Error deleting coach:', error);
      alert('Failed to remove coach. Please try again.');
    }
  };

  // Room management handlers
  const loadRooms = async () => {
    if (!id) return;

    setLoadingRooms(true);
    try {
      const response = await fetch(`http://localhost:8000/api/tournaments/${id}/rooms/`);
      if (response.ok) {
        const data = await response.json();
        setRooms(data);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleAddRoom = async () => {
    if (!tournament || !newRoomName.trim()) {
      alert('Please enter a room name');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/rooms/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          name: newRoomName,
          tournament: tournament.id,
        }),
      });

      if (response.ok) {
        const newRoom = await response.json();
        setRooms([...rooms, newRoom]);
        setNewRoomName('');
        setShowAddRoom(false);
        alert('Room added successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to add room: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding room:', error);
      alert('Failed to add room. Please try again.');
    }
  };

  const handleDeleteRoom = async (roomId: number) => {
    if (!confirm('Are you sure you want to delete this room?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/rooms/${roomId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        setRooms(rooms.filter(r => r.id !== roomId));
        alert('Room deleted successfully!');
      } else {
        alert('Failed to delete room');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      alert('Failed to delete room. Please try again.');
    }
  };

  const handleClearSchedule = async () => {
    if (!id) return;

    if (!confirm('Delete all games and rounds? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/tournaments/${id}/clear_schedule/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        loadGames();
      } else {
        alert('Failed to clear schedule');
      }
    } catch (error) {
      console.error('Error clearing schedule:', error);
      alert('Failed to clear schedule. Please try again.');
    }
  };

  const handleGenerateSchedule = async () => {
    if (!id) return;

    if (!confirm('Generate round-robin schedule for all pools? This will create games for each team to play every other team in their pool.')) {
      return;
    }

    setGeneratingSchedule(true);
    try {
      const response = await fetch(`http://localhost:8000/api/tournaments/${id}/generate_schedule/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Pool info:', data.pool_info);
        alert(data.message);
        // Reload games
        loadGames();
      } else {
        const error = await response.json();
        alert(`Failed to generate schedule: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate schedule. Please try again.');
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const loadGames = async () => {
    if (!id) return;

    try {
      const response = await fetch(`http://localhost:8000/api/tournaments/${id}/games/`);
      if (response.ok) {
        const data = await response.json();
        setGames(data);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const handleUpdateGameRoom = async (gameId: number, newRoomId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/games/${gameId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          room: newRoomId,
        }),
      });

      if (response.ok) {
        // Reload games to get updated data
        loadGames();
        setEditingGame(null);
        setEditingGameRoom(null);
      } else {
        alert('Failed to update room assignment');
      }
    } catch (error) {
      console.error('Error updating game room:', error);
      alert('Failed to update room assignment. Please try again.');
    }
  };

  const handleUpdateGameScore = async (gameId: number, team1: number, team2: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/games/${gameId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          team1_score: team1,
          team2_score: team2,
          is_complete: true,
        }),
      });

      if (response.ok) {
        // Reload games to get updated data
        loadGames();
        setEditingGameScore(null);
        setTeam1Score(0);
        setTeam2Score(0);
      } else {
        alert('Failed to update game score');
      }
    } catch (error) {
      console.error('Error updating game score:', error);
      alert('Failed to update game score. Please try again.');
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
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'schedule'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Schedule
          </button>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Teams List */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Registered Teams ({teams.length})</h2>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddTeam(!showAddTeam)}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {showAddTeam ? 'Cancel' : '+ Add Team'}
                  </button>
                )}
              </div>

              {/* Add Team Form */}
              {isAdmin && showAddTeam && (
                <div className="mb-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <h4 className="text-sm font-semibold text-white mb-3">Add New Team</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Team Name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <input
                      type="text"
                      placeholder="School"
                      value={newTeamSchool}
                      onChange={(e) => setNewTeamSchool(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      onClick={handleAddTeam}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Add Team
                    </button>
                  </div>
                </div>
              )}

              {teams.length === 0 ? (
                <p className="text-slate-400">No teams registered yet</p>
              ) : (
                <div className="space-y-3">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className={`bg-slate-900/50 border rounded-lg p-4 transition-all cursor-pointer ${
                        selectedTeam?.id === team.id
                          ? 'border-purple-500 bg-purple-900/20'
                          : 'border-slate-700 hover:border-purple-500/50'
                      }`}
                      onClick={() => handleSelectTeam(team)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="text-white font-semibold">{team.name}</div>
                          <div className="text-slate-400 text-sm">{team.school}</div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>{team.players_count} players</span>
                            {team.pool && team.pool !== 'Unassigned' && <span>Pool {team.pool}</span>}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTeam(team.id);
                            }}
                            className="text-red-400 hover:text-red-300 p-2"
                            title="Delete team"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Team Details & Players */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              {selectedTeam ? (
                <>
                  {/* Team Info */}
                  <div className="mb-6">
                    {editingTeam?.id === selectedTeam.id ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Team Name</label>
                          <input
                            type="text"
                            value={editingTeam.name}
                            onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">School</label>
                          <input
                            type="text"
                            value={editingTeam.school}
                            onChange={(e) => setEditingTeam({ ...editingTeam, school: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setEditingTeam(null)}
                            className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveTeam}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h2 className="text-xl font-bold text-white">{selectedTeam.name}</h2>
                            <p className="text-slate-400">{selectedTeam.school}</p>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleEditTeam(selectedTeam)}
                              className="text-purple-400 hover:text-purple-300 p-2"
                              title="Edit team"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-slate-400">
                          <span>{selectedTeam.players_count} players</span>
                          {selectedTeam.pool && selectedTeam.pool !== 'Unassigned' && <span>Pool {selectedTeam.pool}</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Players Section */}
                  <div className="border-t border-slate-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Players</h3>
                      {isAdmin && (
                        <button
                          onClick={() => setShowAddPlayer(!showAddPlayer)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          {showAddPlayer ? 'Cancel' : '+ Add Player'}
                        </button>
                      )}
                    </div>

                    {/* Add Player Form */}
                    {isAdmin && showAddPlayer && (
                      <div className="mb-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                        <h4 className="text-sm font-semibold text-white mb-3">Add New Player</h4>
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Player Name"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                          <input
                            type="text"
                            placeholder="Grade Level (e.g., 9, 10, 11, 12)"
                            value={newPlayerGrade}
                            onChange={(e) => setNewPlayerGrade(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                    {loadingPlayers ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        <p className="mt-2 text-sm text-slate-400">Loading players...</p>
                      </div>
                    ) : teamPlayers.length === 0 ? (
                      <p className="text-center text-slate-400 py-8">No players yet</p>
                    ) : (
                      <div className="space-y-2">
                        {teamPlayers.map((player) => (
                          <div
                            key={player.id}
                            className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-white font-medium">{player.name}</div>
                                <div className="text-slate-400 text-sm">Grade {player.grade_level}</div>
                              </div>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeletePlayer(player.id)}
                                  className="text-red-400 hover:text-red-300 p-2"
                                  title="Remove player"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Coaches Section */}
                  <div className="border-t border-slate-700 pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Coaches</h3>
                      {isAdmin && (
                        <button
                          onClick={() => setShowAddCoach(!showAddCoach)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {showAddCoach ? 'Cancel' : '+ Add Coach'}
                        </button>
                      )}
                    </div>

                    {/* Add Coach Form */}
                    {isAdmin && showAddCoach && (
                      <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <h4 className="text-sm font-semibold text-white mb-3">Add New Coach</h4>
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Coach Name"
                            value={newCoachName}
                            onChange={(e) => setNewCoachName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="email"
                            placeholder="Email (optional)"
                            value={newCoachEmail}
                            onChange={(e) => setNewCoachEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="tel"
                            placeholder="Phone (optional)"
                            value={newCoachPhone}
                            onChange={(e) => setNewCoachPhone(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={handleAddCoach}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Add Coach
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Coaches List */}
                    {loadingCoaches ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        <p className="mt-2 text-sm text-slate-400">Loading coaches...</p>
                      </div>
                    ) : teamCoaches.length === 0 ? (
                      <p className="text-center text-slate-400 py-8">No coaches yet</p>
                    ) : (
                      <div className="space-y-2">
                        {teamCoaches.map((coach) => (
                          <div
                            key={coach.id}
                            className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-white font-medium">{coach.name}</div>
                                {coach.email && (
                                  <div className="text-slate-400 text-sm">{coach.email}</div>
                                )}
                                {coach.phone && (
                                  <div className="text-slate-400 text-sm">{coach.phone}</div>
                                )}
                              </div>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteCoach(coach.id)}
                                  className="text-red-400 hover:text-red-300 p-2"
                                  title="Remove coach"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="text-slate-400">Select a team to view details and manage players</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pools' && (
          <div className="space-y-6">
            {/* Admin Controls */}
            {isAdmin && !editingPools && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Pool Configuration</h3>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label htmlFor="poolCount" className="block text-sm font-medium text-slate-300 mb-2">
                      Number of pools
                    </label>
                    <input
                      type="number"
                      id="poolCount"
                      min="1"
                      max="26"
                      value={poolCount || ''}
                      onChange={(e) => setPoolCount(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter number (1-26)"
                    />
                  </div>
                  <button
                    onClick={autoDistribute}
                    disabled={poolCount < 1 || poolCount > 26}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Auto-Distribute Teams
                  </button>
                </div>
                <p className="text-sm text-slate-400 mt-3">
                  Enter the number of pools and click "Auto-Distribute" to evenly distribute teams.
                </p>
              </div>
            )}

            {/* Editing Mode - Admin can drag teams */}
            {editingPools && isAdmin && poolAssignments.size > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white">Adjust Pool Assignments</h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingPools(false)}
                      className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePools}
                      disabled={savingPools}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {savingPools ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  Drag and drop teams between pools to adjust assignments before saving.
                </p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from(poolAssignments.entries()).map(([poolName, poolTeams]) => (
                    <div
                      key={poolName}
                      className="bg-slate-900/50 border-2 border-dashed border-slate-600 rounded-lg p-4 hover:border-purple-500/50 transition-colors"
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(poolName)}
                    >
                      <h4 className="text-lg font-bold text-purple-400 mb-3">
                        Pool {poolName} ({poolTeams.length} teams)
                      </h4>
                      <div className="space-y-2 min-h-[100px]">
                        {poolTeams.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 text-sm">
                            Drop teams here
                          </div>
                        ) : (
                          poolTeams.map((team) => (
                            <div
                              key={team.id}
                              draggable
                              onDragStart={() => handleDragStart(team)}
                              className="bg-slate-800 border border-slate-600 rounded-lg p-3 cursor-move hover:bg-slate-700 hover:border-purple-500/50 transition-all active:opacity-50"
                            >
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                </svg>
                                <div className="flex-1">
                                  <div className="text-white font-medium">{team.name}</div>
                                  <div className="text-slate-400 text-sm">{team.school}</div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Read-only Pool View - for students and admins not editing */}
            {!editingPools && (
              <div>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Round Robin Pools</h2>
                  <p className="text-slate-400">
                    {teams.filter(t => t.pool && t.pool !== 'Unassigned').length > 0
                      ? `${new Set(teams.map(t => t.pool).filter(p => p && p !== 'Unassigned')).size} Pools`
                      : 'Pools not configured yet'}
                  </p>
                </div>
                <div className="space-y-8">
                  {Array.from(new Set(teams.map(t => t.pool).filter(p => p && p !== 'Unassigned'))).sort().map((pool) => {
                    const poolTeams = teams.filter((team) => team.pool === pool);
                    const poolGames = games.filter((game) => game.pool === pool);

                    // Calculate team stats
                    const teamStats = poolTeams.map(team => {
                      const teamGames = poolGames.filter(g =>
                        g.team1_name === team.name || g.team2_name === team.name
                      );
                      const completedGames = teamGames.filter(g => g.is_complete);

                      let wins = 0;
                      let losses = 0;
                      let totalPoints = 0;

                      completedGames.forEach(game => {
                        if (game.team1_name === team.name) {
                          totalPoints += game.team1_score;
                          if (game.team1_score > game.team2_score) wins++;
                          else if (game.team1_score < game.team2_score) losses++;
                        } else {
                          totalPoints += game.team2_score;
                          if (game.team2_score > game.team1_score) wins++;
                          else if (game.team2_score < game.team1_score) losses++;
                        }
                      });

                      return {
                        ...team,
                        wins,
                        losses,
                        totalPoints,
                        gamesPlayed: completedGames.length
                      };
                    });

                    // Sort by wins (desc), then total points (desc)
                    teamStats.sort((a, b) => {
                      if (b.wins !== a.wins) return b.wins - a.wins;
                      return b.totalPoints - a.totalPoints;
                    });

                    return (
                      <div key={pool} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                        <h3 className="text-xl font-bold text-purple-400 mb-4">Pool {pool}</h3>

                        {/* Standings Table */}
                        <div className="mb-6 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-slate-700">
                              <tr className="text-slate-400">
                                <th className="text-left py-2 px-2">Rank</th>
                                <th className="text-left py-2 px-2">Team</th>
                                <th className="text-center py-2 px-2">W</th>
                                <th className="text-center py-2 px-2">L</th>
                                <th className="text-center py-2 px-2">Pts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamStats.map((team, index) => (
                                <tr key={team.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                  <td className="py-2 px-2 text-slate-300">{index + 1}</td>
                                  <td className="py-2 px-2">
                                    <div className="text-white font-medium">{team.name}</div>
                                    <div className="text-slate-500 text-xs">{team.school}</div>
                                  </td>
                                  <td className="py-2 px-2 text-center text-green-400">{team.wins}</td>
                                  <td className="py-2 px-2 text-center text-red-400">{team.losses}</td>
                                  <td className="py-2 px-2 text-center text-slate-300">{team.totalPoints}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Match Matrix */}
                        {poolTeams.length > 1 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-300 mb-3">Head-to-Head Results</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr>
                                    <th className="border border-slate-700 bg-slate-900 p-2 text-left text-slate-400 sticky left-0 z-10">Team</th>
                                    {poolTeams.map((opponent) => (
                                      <th key={opponent.id} className="border border-slate-700 bg-slate-900 p-2 text-center text-slate-400 min-w-[60px]">
                                        <div className="truncate max-w-[60px]" title={opponent.name}>
                                          {opponent.name.substring(0, 8)}
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {poolTeams.map((team) => (
                                    <tr key={team.id}>
                                      <td className="border border-slate-700 bg-slate-900 p-2 text-white font-medium sticky left-0 z-10">
                                        <div className="truncate max-w-[120px]" title={team.name}>
                                          {team.name}
                                        </div>
                                      </td>
                                      {poolTeams.map((opponent) => {
                                        if (team.id === opponent.id) {
                                          return (
                                            <td key={opponent.id} className="border-2 border-slate-600 bg-slate-900/80 p-2 text-center">
                                              <div className="text-slate-700 font-bold text-sm">X</div>
                                            </td>
                                          );
                                        }

                                        const game = poolGames.find(g =>
                                          (g.team1_name === team.name && g.team2_name === opponent.name) ||
                                          (g.team2_name === team.name && g.team1_name === opponent.name)
                                        );

                                        if (!game || !game.is_complete) {
                                          return (
                                            <td key={opponent.id} className="border border-slate-700 bg-slate-800 p-2 text-center text-slate-500">
                                              {isAdmin && game ? (
                                                <button
                                                  onClick={() => {
                                                    setEditingGameScore(game.id);
                                                    setTeam1Score(game.team1_score || 0);
                                                    setTeam2Score(game.team2_score || 0);
                                                  }}
                                                  className="text-purple-400 hover:text-purple-300 text-[10px] px-2 py-1 hover:bg-slate-700 rounded transition-colors"
                                                >
                                                  Enter
                                                </button>
                                              ) : (
                                                '-'
                                              )}
                                            </td>
                                          );
                                        }

                                        const teamScore = game.team1_name === team.name ? game.team1_score : game.team2_score;
                                        const oppScore = game.team1_name === team.name ? game.team2_score : game.team1_score;
                                        const won = teamScore > oppScore;

                                        if (isAdmin && editingGameScore === game.id) {
                                          // Inline editing mode
                                          const isTeam1 = game.team1_name === team.name;
                                          return (
                                            <td key={opponent.id} className="border border-slate-700 bg-slate-700/50 p-1 text-center">
                                              <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-center gap-1">
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    value={isTeam1 ? team1Score : team2Score}
                                                    onChange={(e) => isTeam1 ? setTeam1Score(parseInt(e.target.value) || 0) : setTeam2Score(parseInt(e.target.value) || 0)}
                                                    className="w-10 px-1 py-0.5 bg-slate-900 border border-slate-600 rounded text-white text-[10px] text-center focus:ring-1 focus:ring-purple-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                  <span className="text-slate-500 text-[10px]">-</span>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    value={isTeam1 ? team2Score : team1Score}
                                                    onChange={(e) => isTeam1 ? setTeam2Score(parseInt(e.target.value) || 0) : setTeam1Score(parseInt(e.target.value) || 0)}
                                                    className="w-10 px-1 py-0.5 bg-slate-900 border border-slate-600 rounded text-white text-[10px] text-center focus:ring-1 focus:ring-purple-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                </div>
                                                <div className="flex gap-1 justify-center">
                                                  <button
                                                    onClick={() => handleUpdateGameScore(game.id, team1Score, team2Score)}
                                                    className="px-1.5 py-0.5 bg-green-600 text-white text-[9px] rounded hover:bg-green-700"
                                                  >
                                                    ✓
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setEditingGameScore(null);
                                                      setTeam1Score(0);
                                                      setTeam2Score(0);
                                                    }}
                                                    className="px-1.5 py-0.5 bg-slate-600 text-white text-[9px] rounded hover:bg-slate-700"
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        }

                                        return (
                                          <td
                                            key={opponent.id}
                                            className={`border border-slate-700 p-2 text-center ${won ? 'bg-green-900/20' : 'bg-red-900/20'} ${isAdmin ? 'cursor-pointer hover:bg-opacity-80 transition-colors' : ''}`}
                                            onClick={() => {
                                              if (isAdmin) {
                                                setEditingGameScore(game.id);
                                                setTeam1Score(game.team1_score);
                                                setTeam2Score(game.team2_score);
                                              }
                                            }}
                                            title={isAdmin ? 'Click to edit score' : ''}
                                          >
                                            <div className={won ? 'text-green-400' : 'text-red-400'}>
                                              {teamScore}-{oppScore}
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                              {won ? 'W' : 'L'}
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {teams.filter(t => t.pool && t.pool !== 'Unassigned').length === 0 && !isAdmin && (
                  <div className="text-center py-12">
                    <p className="text-slate-400">Pools will be announced before the tournament begins.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* Rooms Section */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Rooms ({rooms.length})</h2>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddRoom(!showAddRoom)}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {showAddRoom ? 'Cancel' : '+ Add Room'}
                  </button>
                )}
              </div>

              {/* Add Room Form */}
              {isAdmin && showAddRoom && (
                <div className="mb-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <h4 className="text-sm font-semibold text-white mb-3">Add New Room</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Room Name (e.g., Room 101, Auditorium)"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      onClick={handleAddRoom}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Add Room
                    </button>
                  </div>
                </div>
              )}

              {loadingRooms ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="mt-2 text-sm text-slate-400">Loading rooms...</p>
                </div>
              ) : rooms.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No rooms configured yet. Add rooms to enable schedule generation.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-white font-semibold">{room.name}</div>
                          <div className="text-slate-400 text-sm">
                            {room.status === 'NOT_STARTED' && 'Not Started'}
                            {room.status === 'IN_PROGRESS' && 'In Progress'}
                            {room.status === 'FINISHED' && 'Finished'}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="text-red-400 hover:text-red-300 p-2"
                            title="Delete room"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule Generation Section */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Round-Robin Schedule</h2>

              {isAdmin && (
                <div className="mb-6 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">Generate Schedule</h3>
                  <p className="text-slate-300 text-sm mb-4">
                    This will create round-robin matchups for all teams in each pool. Each team will play every other team in their pool once.
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleGenerateSchedule}
                      disabled={generatingSchedule || rooms.length === 0}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {generatingSchedule ? 'Generating...' : 'Generate Schedule'}
                    </button>
                    {games.length > 0 && (
                      <button
                        onClick={handleClearSchedule}
                        className="px-6 py-2 bg-amber-800 text-white rounded-lg hover:bg-amber-900 transition-colors font-medium"
                      >
                        Clear Schedule
                      </button>
                    )}
                    {rooms.length === 0 && (
                      <p className="text-amber-400 text-sm">Add rooms first to generate schedule</p>
                    )}
                  </div>
                </div>
              )}

              {/* Games Display */}
              {games.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  {isAdmin ? 'No schedule generated yet. Click "Generate Schedule" above to create round-robin matchups.' : 'Schedule will be available once the tournament director generates it.'}
                </p>
              ) : (
                <div className="space-y-4">
                  {Array.from(new Set(games.map(g => g.round_number))).sort((a, b) => a - b).map((roundNum) => {
                    const roundGames = games.filter(g => g.round_number === roundNum);
                    return (
                      <div key={roundNum} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                        <h3 className="text-lg font-bold text-purple-400 mb-3">Round {roundNum}</h3>
                        <div className="space-y-2">
                          {roundGames.map((game) => (
                            <div
                              key={game.id}
                              className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-lg p-3"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-4">
                                  {/* Pool Badge */}
                                  {game.pool && game.pool !== 'Unassigned' && (
                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded border border-purple-500/30 font-medium">
                                      Pool {game.pool}
                                    </span>
                                  )}

                                  {/* Room Assignment - Editable for admins */}
                                  {isAdmin && editingGame === game.id ? (
                                    <select
                                      value={editingGameRoom || game.room}
                                      onChange={(e) => setEditingGameRoom(Number(e.target.value))}
                                      className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    >
                                      {rooms.map((room) => (
                                        <option key={room.id} value={room.id}>
                                          {room.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-slate-400 text-sm min-w-[100px]">{game.room_name}</span>
                                  )}

                                  {/* Edit Room Button */}
                                  {isAdmin && editingGame === game.id ? (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleUpdateGameRoom(game.id, editingGameRoom || game.room)}
                                        className="text-green-400 hover:text-green-300 text-xs"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingGame(null);
                                          setEditingGameRoom(null);
                                        }}
                                        className="text-slate-400 hover:text-slate-300 text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : isAdmin && !game.is_complete ? (
                                    <button
                                      onClick={() => {
                                        setEditingGame(game.id);
                                        setEditingGameRoom(game.room);
                                      }}
                                      className="text-purple-400 hover:text-purple-300 text-xs"
                                      title="Edit room assignment"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                  ) : null}

                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">{game.team1_name}</span>
                                    <span className="text-slate-500">vs</span>
                                    <span className="text-white font-medium">{game.team2_name}</span>
                                  </div>
                                </div>
                              </div>
                              {/* Score Display/Entry */}
                              {game.is_complete ? (
                                <div className="flex items-center gap-4">
                                  <div className="text-sm">
                                    <span className="text-slate-400">{game.team1_score}</span>
                                    <span className="text-slate-500 mx-1">-</span>
                                    <span className="text-slate-400">{game.team2_score}</span>
                                  </div>
                                  {game.winner_name && (
                                    <span className="text-green-400 text-sm">Winner: {game.winner_name}</span>
                                  )}
                                </div>
                              ) : isAdmin && editingGameScore === game.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={team1Score}
                                    onChange={(e) => setTeam1Score(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                  />
                                  <span className="text-slate-500">-</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={team2Score}
                                    onChange={(e) => setTeam2Score(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                  />
                                  <button
                                    onClick={() => handleUpdateGameScore(game.id, team1Score, team2Score)}
                                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingGameScore(null);
                                      setTeam1Score(0);
                                      setTeam2Score(0);
                                    }}
                                    className="px-3 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-700 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : isAdmin ? (
                                <button
                                  onClick={() => {
                                    setEditingGameScore(game.id);
                                    setTeam1Score(game.team1_score || 0);
                                    setTeam2Score(game.team2_score || 0);
                                  }}
                                  className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                                >
                                  Enter Score
                                </button>
                              ) : (
                                <span className="text-slate-500 text-sm">Not started</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
