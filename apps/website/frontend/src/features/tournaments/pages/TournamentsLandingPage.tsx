import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTournaments } from "../hooks/useTournaments";
import type { TournamentStatus, TournamentSummary } from "../types";
import { getStatusLabel, getStatusQueryParam } from "../utils/status";
import { TournamentSection } from "../components/TournamentSection";

function sortByStatus(status: TournamentStatus, tournaments: TournamentSummary[]): TournamentSummary[] {
  const sorted = tournaments.slice();

  if (status === "LIVE") {
    sorted.sort((a, b) => {
      const aKey = a.updated_at ?? a.dates.start;
      const bKey = b.updated_at ?? b.dates.start;
      if (aKey !== bKey) return bKey.localeCompare(aKey);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }

  if (status === "UPCOMING") {
    sorted.sort((a, b) => {
      if (a.dates.start !== b.dates.start) return a.dates.start.localeCompare(b.dates.start);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const aKey = a.dates.end;
    const bKey = b.dates.end;
    if (aKey !== bKey) return bKey.localeCompare(aKey);
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

export function TournamentsLandingPage() {
  const { tournaments } = useTournaments();

  const byStatus = useMemo(() => {
    // Determine lifecycle status from dates in tournament's timezone
    const now = new Date();
    const live: TournamentSummary[] = [];
    const upcoming: TournamentSummary[] = [];
    const finished: TournamentSummary[] = [];

    tournaments.forEach(t => {
      const startDateStr = `${t.dates.start}T00:00:00`;
      const endDateStr = `${t.dates.end}T23:59:59`;

      // Get current time in tournament's timezone
      const nowInTournamentTZStr = now.toLocaleString('en-US', {
        timeZone: t.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      // Parse to ISO format for comparison
      const [datePart, timePart] = nowInTournamentTZStr.split(', ');
      const [month, day, year] = datePart.split('/');
      const nowInTournamentTZISOStr = `${year}-${month}-${day}T${timePart}`;

      const isFinished = nowInTournamentTZISOStr > endDateStr;
      const isUpcoming = nowInTournamentTZISOStr < startDateStr;

      if (isFinished) {
        finished.push(t);
      } else if (isUpcoming) {
        upcoming.push(t);
      } else {
        live.push(t);
      }
    });

    return {
      live: sortByStatus("LIVE", live),
      upcoming: sortByStatus("UPCOMING", upcoming),
      finished: sortByStatus("FINISHED", finished),
    };
  }, [tournaments]);

  const liveCount = byStatus.live.length;
  const upcomingCount = byStatus.upcoming.length;
  const finishedCount = byStatus.finished.length;

  // Default: Live + Upcoming expanded, Finished collapsed.
  return (
    <div className="sbStack">
      <div className="card sbPageHeader">
        <div className="sbHeaderRow">
          <div className="sbMinW0">
            <h1 className="sbTitle">Tournaments</h1>
            <p className="sbMuted sbTopSpace">
              Live scores, upcoming tournaments, and official results from Science Bowl events.
            </p>
          </div>
          <Link to="/tournaments" className="sbHeaderLink">
            View all tournaments <span aria-hidden="true">{"\u2192"}</span>
          </Link>
        </div>
      </div>

      <TournamentSection
        status="LIVE"
        title={getStatusLabel("LIVE")}
        count={liveCount}
        countLabel={String(liveCount)}
        tournaments={byStatus.live}
        defaultOpen
        viewAllTo={`/tournaments?status=${getStatusQueryParam("LIVE")}`}
        viewAllLabel="View all live tournaments"
        showStatusPill={false}
      />

      <TournamentSection
        status="UPCOMING"
        title={getStatusLabel("UPCOMING")}
        count={upcomingCount}
        countLabel={upcomingCount > 10 ? "10+" : String(upcomingCount)}
        tournaments={byStatus.upcoming}
        defaultOpen
        viewAllTo={`/tournaments?status=${getStatusQueryParam("UPCOMING")}`}
        viewAllLabel="View all upcoming tournaments"
        showStatusPill={false}
      />

      <TournamentSection
        status="FINISHED"
        title={getStatusLabel("FINISHED")}
        count={finishedCount}
        countLabel={String(finishedCount)}
        tournaments={byStatus.finished}
        defaultOpen={false}
        viewAllTo={`/tournaments?status=${getStatusQueryParam("FINISHED")}`}
        viewAllLabel="View all finished tournaments"
        showStatusPill={false}
      />
    </div>
  );
}
