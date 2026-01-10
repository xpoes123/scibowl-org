import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { LevelPills } from "../components/LevelPills";
import { useTournament } from "../hooks/useTournament";
import type { TournamentStatus } from "../types";
import { formatTournamentDateRange } from "../utils/date";
import { TournamentTabs } from "./tournament-detail/TournamentTabs";

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
  const { slug } = useParams<{ slug: string }>();
  const { data: tournament, loading, error } = useTournament(slug);

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

  const locationLabel = tournament.location ? `${tournament.location.city}, ${tournament.location.state}` : "Online";
  const dateLabel = formatTournamentDateRange(tournament.dates.start, tournament.dates.end);

  // Determine lifecycle status from publication status and dates
  const now = new Date();
  const startDate = new Date(tournament.dates.start);
  const endDate = new Date(tournament.dates.end);
  const isFinished = now > endDate;
  const isUpcoming = now < startDate;

  const websiteLink = tournament.links?.find(link => link.type === "WEBSITE");
  const lifecycleStatus: TournamentStatus = isFinished ? "FINISHED" : isUpcoming ? "UPCOMING" : "LIVE";

  const heroMetaItemsPrimary: Array<{ key: string; node: React.ReactNode }> = [
    {
      key: "location",
      node: (
        <span className="sbHeroMetaItem">
          <MapPinIcon className="sbIcon" aria-hidden="true" /> {locationLabel}
        </span>
      ),
    },
    {
      key: "date",
      node: (
        <span className="sbHeroMetaItem">
          <CalendarDaysIcon className="sbIcon" aria-hidden="true" /> {dateLabel}
        </span>
      ),
    },
    {
      key: "divisions",
      node: <LevelPills levels={tournament.divisions} />,
    },
  ];

  if (websiteLink) {
    heroMetaItemsPrimary.push({
      key: "website",
      node: (
        <a className="sbInlineLink sbInlineLinkSmall" href={websiteLink.url} target="_blank" rel="noreferrer">
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

            <div className="sbHeroMetaLine" aria-label="Tournament basics">
              {heroMetaItemsPrimary.map((item, idx) => (
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

          <div className="sbTournamentDate sbTournamentDateHero">
            <StatusBadge status={lifecycleStatus} />
            {/* Registration Button - show for upcoming tournaments with registration URL */}
            {isUpcoming && tournament.registration?.url && (
              <a
                className="sbCtaButton"
                href={tournament.registration.url}
                target="_blank"
                rel="noreferrer"
              >
                Register
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Render different content based on tournament status */}
      {isFinished ? (
        <TournamentTabs tournament={tournament} variant="FINISHED" />
      ) : isUpcoming ? (
        <TournamentTabs tournament={tournament} variant="UPCOMING" />
      ) : (
        /* LIVE tournaments - to be implemented */
        <div className="card sbTabsCard" aria-label="Tournament details">
          <div className="sbTabsBody sbTabStack">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Live Tournament</h2>
              </header>
              <div className="sbTabSectionBody">
                <p className="sbMuted">Live tournament view coming soon.</p>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
