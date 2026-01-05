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
  const isLive = tournament.status === "LIVE";
  const dateLabel = useMemo(() => formatTournamentDate(tournament.start_date), [tournament.start_date]);
  const locationLabel = `${tournament.location_city}, ${tournament.location_state}`;

  return (
    <Link to={`/tournaments/${tournament.id}`} className="sbTournamentRow">
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

        <LevelPills levels={tournament.level} />

        <div className="sbRowRight">
          <ChevronRightIcon className="sbRowChevron" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
});
