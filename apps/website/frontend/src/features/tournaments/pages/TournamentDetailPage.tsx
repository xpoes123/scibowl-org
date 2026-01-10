import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { LevelPills } from "../components/LevelPills";
import { useTournament } from "../hooks/useTournament";
import type { TournamentStatus } from "../types";
import { formatTournamentDateRange } from "../utils/date";
import { FinishedTabs } from "./tournament-detail/FinishedTabs";
import { UpcomingTabs } from "./tournament-detail/UpcomingTabs";

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

  // Determine lifecycle status from publication status and dates in tournament's timezone
  const now = new Date();

  // Create dates in the tournament's timezone by using ISO string format with timezone
  // The tournament dates are stored as YYYY-MM-DD, which we interpret as midnight in the tournament's timezone
  const startDateStr = `${tournament.dates.start}T00:00:00`;
  const endDateStr = `${tournament.dates.end}T23:59:59`;

  // Get the current time string in the tournament's timezone
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

  // Parse the formatted string back to a Date for comparison
  // Format will be: MM/DD/YYYY, HH:mm:ss
  const [datePart, timePart] = nowInTournamentTZStr.split(', ');
  const [month, day, year] = datePart.split('/');
  const nowInTournamentTZISOStr = `${year}-${month}-${day}T${timePart}`;

  // Compare ISO strings directly (more reliable than Date objects with timezones)
  const isFinished = nowInTournamentTZISOStr > endDateStr;
  const isUpcoming = nowInTournamentTZISOStr < startDateStr;

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
  if (tournament.notes?.writing_team) {
    heroMetaItems.push({
      key: "writing_team",
      node: (
        <span>
          <span className="sbLabelInline">Writing team:</span> {tournament.notes.writing_team}
        </span>
      ),
    });
  }

  const websiteLink = tournament.links?.find(link => link.type === "WEBSITE");
  const lifecycleStatus: TournamentStatus = isFinished ? "FINISHED" : isUpcoming ? "UPCOMING" : "LIVE";

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
              <span className="sbBadge sbBadgeImportant">
                <MapPinIcon className="sbIcon" aria-hidden="true" /> {locationLabel}
              </span>
              <span className="sbBadge sbBadgeImportant">
                <CalendarDaysIcon className="sbIcon" aria-hidden="true" /> {dateLabel}
              </span>
              <LevelPills levels={tournament.divisions} />
            </div>

            {(websiteLink || tournament.difficulty || tournament.notes?.writing_team) && (
              <div className="sbHeroMetaRow sbHeroMetaRowSecondary" aria-label="Tournament details">
                {websiteLink && (
                  <div className="sbHeroMetaGroup sbHeroMetaGroupPrimary" aria-label="Participation info">
                    <a className="sbInlineLink sbInlineLinkSmall" href={websiteLink.url} target="_blank" rel="noreferrer">
                      Website <span aria-hidden="true">{"\u2197"}</span>
                    </a>
                  </div>
                )}

                {(tournament.difficulty || tournament.notes?.writing_team) && (
                  <div className="sbHeroMetaGroup sbHeroMetaGroupSecondary" aria-label="Reference info">
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
                )}
              </div>
            )}
          </div>

          <div className="sbTournamentDate" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.75rem" }}>
            <StatusBadge status={lifecycleStatus} />
            {/* Registration Button - show for upcoming tournaments with registration URL */}
            {isUpcoming && tournament.registration?.url && (
              <a
                className="sbCtaButton"
                href={tournament.registration.url}
                target="_blank"
                rel="noreferrer"
              >
                Register now
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Render different content based on tournament status */}
      {isFinished ? (
        <FinishedTabs tournament={tournament} />
      ) : isUpcoming ? (
        <UpcomingTabs tournament={tournament} />
      ) : (
        /* LIVE tournaments - to be implemented */
        <div className="card" aria-label="Tournament details">
          <div className="sbTabStack" style={{ padding: "1.5rem" }}>
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
