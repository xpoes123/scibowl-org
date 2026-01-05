import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LevelPills } from "../components/LevelPills";
import { useTournament } from "../hooks/useTournament";
import type { TournamentStatus } from "../types";
import { formatTournamentDateRange } from "../utils/date";
import { FieldTab } from "./tournament-detail/FieldTab";
import { OverviewTab } from "./tournament-detail/OverviewTab";

type TournamentTab = "overview" | "field";

function parseTab(value: string | null): TournamentTab {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "field") return "field";
  return "overview";
}

function getTournamentStatusBadgeClass(status: TournamentStatus): string {
  switch (status) {
    case "LIVE":
      return "sbBadge sbBadgeLive";
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

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const { data: tournament, loading, error } = useTournament(id);

  const setTab = (nextTab: TournamentTab) => {
    const next = new URLSearchParams(searchParams);
    if (nextTab === "overview") next.delete("tab");
    else next.set("tab", nextTab);
    setSearchParams(next, { replace: false });
  };

  if (loading) {
    return (
      <div className="card sbCenter">
        <div className="sbSpinner" aria-label="Loading tournament" />
        <p className="sbMuted sbTopSpace">Loading tournament…</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="card sbCenter">
        <h1 className="sbTitle">Tournament not found</h1>
        <p className="sbMuted sbTopSpace">{error ? error : "The tournament you are looking for does not exist."}</p>
        <Link to="/tournaments" className="sbHeaderLink sbTopSpace">
          Back to tournaments
        </Link>
      </div>
    );
  }

  const locationLabel = `${tournament.location_city}, ${tournament.location_state}`;
  const dateLabel = formatTournamentDateRange(tournament.start_date, tournament.end_date);
  const fieldCap = tournament.field_limit ?? tournament.format.field_limit;
  const fieldLabel = fieldCap ? `${tournament.teams.length} teams / ${fieldCap} cap` : `${tournament.teams.length} teams`;

  const overviewTabId = "tournament-tab-overview";
  const fieldTabId = "tournament-tab-field";
  const panelId = "tournament-tabpanel";

  return (
    <div className="sbStack">
      <div className="card sbTournamentCard" aria-label="Tournament summary">
        <div className="sbTournamentHeader">
          <div className="sbMinW0">
            <Link to="/tournaments" className="sbInlineLink">
              <ArrowLeftIcon className="sbIcon" aria-hidden="true" /> Back
            </Link>

            <h1 className="sbHeroTitle sbTopSpace">{tournament.name}</h1>

            <div className="sbBadgesRow">
              <span className="sbBadge sbBadgeNeutral">
                <MapPinIcon className="sbIcon" aria-hidden="true" /> {locationLabel}
              </span>
              <span className="sbBadge sbBadgeNeutral">
                <CalendarDaysIcon className="sbIcon" aria-hidden="true" /> {dateLabel}
              </span>
              <LevelPills levels={tournament.levels} />
            </div>
          </div>

          <div className="sbTournamentDate">
            <StatusBadge status={tournament.status} />
          </div>
        </div>

        <div className="sbInfoGrid sbTopSpace" aria-label="Tournament metadata">
          {tournament.difficulty && (
            <div className="sbInfoItem">
              <div className="sbLabel">Difficulty</div>
              <div className="sbValue">{tournament.difficulty}</div>
            </div>
          )}
          {tournament.writing_team && (
            <div className="sbInfoItem">
              <div className="sbLabel">Writing team</div>
              <div className="sbValue">{tournament.writing_team}</div>
            </div>
          )}
          <div className="sbInfoItem">
            <div className="sbLabel">Field size</div>
            <div className="sbValue">{fieldLabel}</div>
          </div>
          {tournament.registration.cost && (
            <div className="sbInfoItem">
              <div className="sbLabel">Cost</div>
              <div className="sbValue">{tournament.registration.cost}</div>
            </div>
          )}
          {tournament.website_url && (
            <div className="sbInfoItem">
              <div className="sbLabel">Website</div>
              <div className="sbValue">
                <a className="sbInlineLink" href={tournament.website_url} target="_blank" rel="noreferrer">
                  Website <span aria-hidden="true">{"\u2197"}</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sbPills" role="tablist" aria-label="Tournament sections">
        <button
          type="button"
          id={overviewTabId}
          role="tab"
          aria-selected={tab === "overview"}
          aria-controls={panelId}
          className={tab === "overview" ? "sbPill sbPillActive" : "sbPill"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          id={fieldTabId}
          role="tab"
          aria-selected={tab === "field"}
          aria-controls={panelId}
          className={tab === "field" ? "sbPill sbPillActive" : "sbPill"}
          onClick={() => setTab("field")}
        >
          Field
        </button>
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tab === "overview" ? overviewTabId : fieldTabId}
        aria-label={tab === "overview" ? "Overview" : "Field"}
      >
        {tab === "overview" ? <OverviewTab tournament={tournament} /> : <FieldTab tournament={tournament} />}
      </div>
    </div>
  );
}

