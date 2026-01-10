import { ChevronRightIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import type { TournamentStatus, TournamentSummary } from "../types";
import { formatTournamentDate } from "../utils/date";
import { LevelPills } from "./LevelPills";

type TournamentRowProps = {
  tournament: TournamentSummary;
  showStatusPill?: boolean;
};

function getTournamentStatusBadgeClass(status: TournamentStatus): string {
  switch (status) {
    case "LIVE":
      return "sbBadge sbBadgeLive sbBadgeLiveInline";
    case "UPCOMING":
      return "sbBadge sbBadgeUpcoming";
    case "FINISHED":
      return "sbBadge sbBadgeCompleted";
    default:
      return "sbBadge sbBadgeNeutral";
  }
}

function StatusBadge({ status }: { status: TournamentStatus }) {
  const isLive = status === "LIVE";
  return (
    <span className={getTournamentStatusBadgeClass(status)}>
      {isLive && <span className="sbLivePulse sbLivePulseInBadge" aria-hidden="true" />}
      {status}
    </span>
  );
}

export const TournamentRow = memo(function TournamentRow({ tournament, showStatusPill = true }: TournamentRowProps) {
  // Determine lifecycle status from dates in tournament's timezone
  const lifecycleStatus: TournamentStatus = useMemo(() => {
    const now = new Date();
    const startDateStr = `${tournament.dates.start}T00:00:00`;
    const endDateStr = `${tournament.dates.end}T23:59:59`;

    // Get current time in tournament's timezone
    const nowInTournamentTZStr = now.toLocaleString('en-US', {
      timeZone: tournament.timezone,
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
    return isFinished ? "FINISHED" : isUpcoming ? "UPCOMING" : "LIVE";
  }, [tournament.dates.start, tournament.dates.end, tournament.timezone]);

  const dateLabel = useMemo(() => formatTournamentDate(tournament.dates.start), [tournament.dates.start]);
  const locationLabel = tournament.location ? `${tournament.location.city}, ${tournament.location.state}` : "Online";

  return (
    <Link to={`/tournaments/${tournament.slug}`} className="sbTournamentRow">
      <div className="sbTournamentRowContent sbTournamentRowContentStatus">
        <div className="sbRowMain">
          <div className="sbMinW0">
            <div className="sbRowNameLine">
              <span className="sbRowName">{tournament.name}</span>
            </div>
            <div className="sbRowMetaMobile">
              <span className="sbRowMetaItem">
                <MapPinIcon className="sbIcon" aria-hidden="true" />
                {locationLabel}
              </span>
              <span className="sbRowMetaSep" aria-hidden="true">
                {"\u2022"}
              </span>
              <span className="sbRowMetaItem">{dateLabel}</span>
            </div>
          </div>
        </div>

        <div className="sbRowLocation">
          <MapPinIcon className="sbIcon" aria-hidden="true" />
          <span className="sbRowLocationText">{locationLabel}</span>
        </div>

        <div className="sbRowDate">{dateLabel}</div>

        <LevelPills levels={tournament.divisions} />

        <div className="sbRowStatus" aria-hidden={!showStatusPill} aria-label={showStatusPill ? "Tournament status" : undefined}>
          {showStatusPill ? <StatusBadge status={lifecycleStatus} /> : null}
        </div>

        <div className="sbRowRight">
          <ChevronRightIcon className="sbRowChevron" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
});
