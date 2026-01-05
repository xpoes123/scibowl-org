import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { Fragment, useMemo } from "react";
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

  const heroMetaItems: Array<{ key: string; node: React.ReactNode }> = [];
  if (tournament.difficulty) {
    heroMetaItems.push({
      key: "difficulty",
      node: (
        <span>
          <span className="sbLabelInline">Difficulty:</span> {tournament.difficulty}
        </span>
      ),
    });
  }
  if (tournament.writing_team) {
    heroMetaItems.push({
      key: "writing_team",
      node: (
        <span>
          <span className="sbLabelInline">Writing team:</span> {tournament.writing_team}
        </span>
      ),
    });
  }
  heroMetaItems.push({
    key: "field_size",
    node: (
      <span>
        <span className="sbLabelInline">Field size:</span> {fieldLabel}
      </span>
    ),
  });
  if (tournament.registration.cost) {
    heroMetaItems.push({
      key: "cost",
      node: (
        <span>
          <span className="sbLabelInline">Cost:</span> {tournament.registration.cost}
        </span>
      ),
    });
  }
  if (tournament.website_url) {
    heroMetaItems.push({
      key: "website",
      node: (
        <a className="sbInlineLink sbInlineLinkSmall" href={tournament.website_url} target="_blank" rel="noreferrer">
          Website <span aria-hidden="true">{"\u2197"}</span>
        </a>
      ),
    });
  }

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
              <span className="sbBadge sbBadgeNeutral">
                <MapPinIcon className="sbIcon" aria-hidden="true" /> {locationLabel}
              </span>
              <span className="sbBadge sbBadgeNeutral">
                <CalendarDaysIcon className="sbIcon" aria-hidden="true" /> {dateLabel}
              </span>
              <LevelPills levels={tournament.levels} />
            </div>

            <div className="sbHeroMetaRow sbHeroMetaRowSecondary" aria-label="Tournament details">
              {heroMetaItems.map((item, idx) => (
                <Fragment key={item.key}>
                  {idx > 0 && (
                    <span className="sbHeroMetaSep" aria-hidden="true">
                      {"\u2022"}
                    </span>
                  )}
                  {item.node}
                </Fragment>
              ))}
            </div>
          </div>

          <div className="sbTournamentDate">
            <StatusBadge status={tournament.status} />
          </div>
        </div>
      </div>

      <section className="card sbTabsCard" aria-label="Tournament content">
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
          aria-labelledby={tab === "overview" ? overviewTabId : fieldTabId}
          aria-label={tab === "overview" ? "Overview" : "Field"}
          className="sbTabsBody"
        >
          {tab === "overview" ? <OverviewTab tournament={tournament} /> : <FieldTab tournament={tournament} />}
        </div>
      </section>
    </div>
  );
}
