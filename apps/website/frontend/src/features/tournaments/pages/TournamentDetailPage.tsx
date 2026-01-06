import { ArrowLeftIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LevelPills } from "../components/LevelPills";
import { useTournament } from "../hooks/useTournament";
import type { TournamentStatus } from "../types";
import { formatTournamentDateRange } from "../utils/date";
import { FieldTab } from "./tournament-detail/FieldTab";
import { OverviewTab } from "./tournament-detail/OverviewTab";
import { RegistrationTab } from "./tournament-detail/RegistrationTab";

type TournamentTab = "overview" | "registration" | "field";

function parseTab(value: string | null): TournamentTab {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "registration") return "registration";
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
  if (status === "LIVE") {
    return (
      <span className="sbBadge sbBadgeLive sbBadgeLiveInline">
        <span className="sbLivePulse sbLivePulseInBadge" aria-hidden="true" />
        LIVE
      </span>
    );
  }

  return <span className={getTournamentStatusBadgeClass(status)}>{status}</span>;
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
    setSearchParams(next, { replace: false, preventScrollReset: true });
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

  const overviewTabId = "tournament-tab-overview";
  const registrationTabId = "tournament-tab-registration";
  const fieldTabId = "tournament-tab-field";
  const panelId = "tournament-tabpanel";

  return (
    <div className="sbStack">
      <div className="card sbTournamentCard sbHeroCard" aria-label="Tournament summary">
        <div className="sbTournamentHeader">
          <div className="sbMinW0">
            <Link to="/tournaments" className="sbInlineLink">
              <ArrowLeftIcon className="sbIcon" aria-hidden="true" /> Back
            </Link>

            <h1 className="sbHeroTitle sbHeroTitleTight">{tournament.name}</h1>

            <div className="sbHeroMetaRow" aria-label="Tournament basics">
              <div className="sbHeroMetaCompact" aria-label="Tournament location and date">
                <span className="sbRowMetaItem">
                  <MapPinIcon className="sbIcon" aria-hidden="true" />
                  {locationLabel}
                </span>
                <span className="sbRowMetaSep" aria-hidden="true">
                  {"\u2022"}
                </span>
                <span className="sbRowMetaItem">{dateLabel}</span>
              </div>
              <span className="sbRowMetaSep" aria-hidden="true">
                {"\u2022"}
              </span>
              <LevelPills levels={tournament.levels} />
              {tournament.website_url && (
                <>
                  <span className="sbRowMetaSep" aria-hidden="true">
                    {"\u2022"}
                  </span>
                  <a className="sbInlineLink sbInlineLinkSmall" href={tournament.website_url} target="_blank" rel="noreferrer">
                    Website <span aria-hidden="true">{"\u2197"}</span>
                  </a>
                </>
              )}
            </div>

            <div className="sbHeroMetaRow sbHeroMetaRowSecondary" aria-label="Tournament details">
              {(tournament.difficulty || tournament.writing_team) && (
                <div className="sbHeroMetaGroupSecondaryRows" aria-label="Reference info">
                  {tournament.difficulty && (
                    <div>
                      <span className="sbLabelInline">Difficulty:</span> {tournament.difficulty}
                    </div>
                  )}
                  {tournament.writing_team && (
                    <div>
                      <span className="sbLabelInline">Writing team:</span> {tournament.writing_team}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="sbTournamentDate">
            <StatusBadge status={tournament.status} />
          </div>
        </div>
      </div>

      <section className="card sbTabsCard sbTabsCardSpaced" aria-label="Tournament content">
        <div className="sbTabsBar" role="tablist" aria-label="Tournament sections">
          <button
            type="button"
            id={overviewTabId}
            role="tab"
            aria-selected={tab === "overview"}
            aria-controls={panelId}
            className={tab === "overview" ? "sbTab sbTabActive" : "sbTab"}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            id={registrationTabId}
            role="tab"
            aria-selected={tab === "registration"}
            aria-controls={panelId}
            className={tab === "registration" ? "sbTab sbTabActive" : "sbTab"}
            onClick={() => setTab("registration")}
          >
            Registration
          </button>
          <button
            type="button"
            id={fieldTabId}
            role="tab"
            aria-selected={tab === "field"}
            aria-controls={panelId}
            className={tab === "field" ? "sbTab sbTabActive" : "sbTab"}
            onClick={() => setTab("field")}
          >
            Field
          </button>
        </div>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tab === "overview" ? overviewTabId : tab === "registration" ? registrationTabId : fieldTabId}
          aria-label={tab === "overview" ? "Overview" : tab === "registration" ? "Registration" : "Field"}
          className="sbTabsBody"
        >
          {tab === "overview" ? (
            <OverviewTab tournament={tournament} />
          ) : tab === "registration" ? (
            <RegistrationTab tournament={tournament} />
          ) : (
            <FieldTab tournament={tournament} />
          )}
        </div>
      </section>
    </div>
  );
}
