import { ChevronRightIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import type { TournamentSummary } from "../types";
import { formatTournamentDate } from "../utils/date";
import { LevelPills } from "./LevelPills";

type TournamentRowProps = {
  tournament: TournamentSummary;
};

export const TournamentRow = memo(function TournamentRow({ tournament }: TournamentRowProps) {
  // Determine lifecycle status from dates
  const now = new Date();
  const startDate = new Date(tournament.dates.start);
  const endDate = new Date(tournament.dates.end);
  const isFinished = now > endDate;
  const isUpcoming = now < startDate;
  const isLive = !isFinished && !isUpcoming;

  const dateLabel = useMemo(() => formatTournamentDate(tournament.dates.start), [tournament.dates.start]);
  const locationLabel = tournament.location ? `${tournament.location.city}, ${tournament.location.state}` : "Online";

  return (
    <Link to={`/tournaments/${tournament.slug}`} className="sbTournamentRow">
      <div className="sbTournamentRowContent">
        <div className="sbRowMain">
          <div className="sbMinW0">
            <div className="sbRowNameLine">
              <span className="sbRowName">{tournament.name}</span>
              {isLive && (
                <span className="sbBadge sbBadgeLive sbBadgeLiveInline">
                  <span className="sbLivePulse sbLivePulseInBadge" aria-hidden="true" />
                  LIVE
                </span>
              )}
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

        <div className="sbRowRight">
          <ChevronRightIcon className="sbRowChevron" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
});
