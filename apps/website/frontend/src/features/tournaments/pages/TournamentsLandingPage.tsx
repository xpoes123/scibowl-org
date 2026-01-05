import { useMemo } from "react";
import { useTournaments } from "../hooks/useTournaments";
import type { TournamentStatus, TournamentSummary } from "../types";
import { getStatusLabel, getStatusQueryParam } from "../utils/status";
import { TournamentSection } from "../components/TournamentSection";

function sortByStatus(status: TournamentStatus, tournaments: TournamentSummary[]): TournamentSummary[] {
  const sorted = tournaments.slice();

  if (status === "LIVE") {
    sorted.sort((a, b) => {
      const aKey = a.updated_at ?? a.start_date;
      const bKey = b.updated_at ?? b.start_date;
      if (aKey !== bKey) return bKey.localeCompare(aKey);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }

  if (status === "UPCOMING") {
    sorted.sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const aKey = a.end_date ?? a.start_date;
    const bKey = b.end_date ?? b.start_date;
    if (aKey !== bKey) return bKey.localeCompare(aKey);
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

export function TournamentsLandingPage() {
  const { tournaments } = useTournaments();

  const byStatus = useMemo(() => {
    const live = tournaments.filter((t) => t.status === "LIVE");
    const upcoming = tournaments.filter((t) => t.status === "UPCOMING");
    const finished = tournaments.filter((t) => t.status === "FINISHED");

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
        <h1 className="sbTitle">Tournaments</h1>
        <p className="sbMuted sbTopSpace">
          Live scores, upcoming tournaments, and official results from Science Bowl events.
        </p>
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
      />
    </div>
  );
}

