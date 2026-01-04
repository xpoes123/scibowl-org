import { useEffect, useState } from 'react';
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
      UPCOMING: 'sbBadge sbBadgeUpcoming',
      REGISTRATION: 'sbBadge sbBadgeRegistration',
      IN_PROGRESS: 'sbBadge sbBadgeInProgress',
      COMPLETED: 'sbBadge sbBadgeCompleted',
      CANCELLED: 'sbBadge sbBadgeCancelled',
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
    <div className="sbStack">
      <div className="card">
        <div className="sbHeaderRow">
          <div className="sbBrand">
            <img src="/logo_big.png" alt="SciBowl" className="sbLogo" />
            <div>
              <h1 className="sbTitle">Tournaments</h1>
              <p className="sbMuted">Browse and register for upcoming Science Bowl tournaments</p>
            </div>
          </div>
        </div>

        <div className="sbPills" role="tablist" aria-label="Tournament filter">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'sbPill sbPillActive' : 'sbPill'}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('upcoming')}
            className={filter === 'upcoming' ? 'sbPill sbPillActive' : 'sbPill'}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setFilter('live')}
            className={filter === 'live' ? 'sbPill sbPillActive' : 'sbPill'}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => setFilter('finished')}
            className={filter === 'finished' ? 'sbPill sbPillActive' : 'sbPill'}
          >
            Finished
          </button>
        </div>
      </div>

        {/* Loading State */}
        {loading && (
          <div className="card sbCenter">
            <div className="sbSpinner" aria-hidden="true" />
            <p className="sbMuted sbTopSpace">Loading tournaments...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card sbError">{error}</div>
        )}

        {/* Tournaments List */}
        {!loading && !error && (
          <div className="sbStack">
            {tournaments.length === 0 ? (
              <div className="card sbCenter">
                <p className="sbMuted">No tournaments found</p>
              </div>
            ) : (
              tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="card sbTournamentCard"
                >
                  <div className="sbTournamentHeader">
                    <div className="sbMinW0">
                      <h3 className="sbTournamentName">{tournament.name}</h3>
                      <div className="sbBadgesRow">
                        <span className={getStatusBadge(tournament.status)}>
                          {tournament.status.replace('_', ' ')}
                        </span>
                        <span className="sbBadge sbBadgeNeutral">
                          {getDivisionBadge(tournament.division)}
                        </span>
                      </div>
                    </div>
                    <div className="sbTournamentDate">
                      <div className="sbMuted sbSmall">Tournament Date</div>
                      <div className="sbStrong">{formatDate(tournament.tournament_date)}</div>
                    </div>
                  </div>

                  <p className="sbBody sbTopSpace">{tournament.description}</p>

                  <div className="sbInfoGrid sbTopSpace">
                    <div className="sbInfoItem">
                      <div className="sbLabel">Location</div>
                      <div className="sbValue">{tournament.location}</div>
                    </div>
                    <div className="sbInfoItem">
                      <div className="sbLabel">Format</div>
                      <div className="sbValue">{tournament.format.replace('_', ' ')}</div>
                    </div>
                    <div className="sbInfoItem">
                      <div className="sbLabel">Teams</div>
                      <div className="sbValue">
                        {tournament.current_teams}
                        {tournament.max_teams && ` / ${tournament.max_teams}`}
                      </div>
                    </div>
                    <div className="sbInfoItem">
                      <div className="sbLabel">Host</div>
                      <div className="sbValue">{tournament.host_organization}</div>
                    </div>
                  </div>

                  {(tournament.registration_deadline || tournament.website_url || tournament.registration_url) && (
                    <div className="sbTournamentFooter">
                      {tournament.registration_deadline && (
                        <div className="sbMuted sbSmall">
                          Registration closes:{' '}
                          <span className="sbStrong">{formatDate(tournament.registration_deadline)}</span>
                        </div>
                      )}
                      <div className="sbActions">
                        {tournament.website_url && (
                          <a
                            href={tournament.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sbActionLink"
                          >
                            Website
                          </a>
                        )}
                        {tournament.registration_url && (
                          <a
                            href={tournament.registration_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sbActionLink"
                          >
                            Register
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
    </div>
  );
}
