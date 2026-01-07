import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { LevelPills } from "../components/LevelPills";
import { useTournament } from "../hooks/useTournament";
import type { TournamentStatus } from "../types";
import { formatTournamentDateRange } from "../utils/date";

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

function splitLogistics(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const byLine = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;

  const sentences = trimmed
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences && sentences.length > 1) return sentences;

  return [trimmed];
}

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament, loading, error } = useTournament(id);

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
  const logisticsBullets = tournament.logistics ? splitLogistics(tournament.logistics) : [];
  const rounds = tournament.format.rounds;
  const formatSummary = tournament.format.summary;
  const isFinished = tournament.status === "FINISHED";
  const isUpcoming = tournament.status === "UPCOMING";
  const hasPostTournamentLinks = isFinished && (tournament.results_url || tournament.stats_url || tournament.packets_url);

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
              <LevelPills levels={tournament.levels} />
            </div>

            <div className="sbHeroMetaRow sbHeroMetaRowSecondary" aria-label="Tournament details">
              <div className="sbHeroMetaGroup sbHeroMetaGroupPrimary" aria-label="Participation info">
                {tournament.registration.cost && <span className="sbHeroMetaEmphasis">{tournament.registration.cost}</span>}
                {tournament.website_url && (
                  <a className="sbInlineLink sbInlineLinkSmall" href={tournament.website_url} target="_blank" rel="noreferrer">
                    Website <span aria-hidden="true">{"\u2197"}</span>
                  </a>
                )}
              </div>

              {(tournament.difficulty || tournament.writing_team) && (
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
          </div>

          <div className="sbTournamentDate">
            <StatusBadge status={tournament.status} />
          </div>
        </div>
      </div>

      <div className="card" aria-label="Tournament details">
        {/* Registration Button - show for upcoming tournaments with registration URL */}
        {isUpcoming && tournament.registration.url && (
          <div style={{ padding: "1.5rem 1.5rem 0 1.5rem" }}>
            <a
              className="sbCtaButton"
              href={tournament.registration.url}
              target="_blank"
              rel="noreferrer"
              style={{ width: "fit-content" }}
            >
              Register now
            </a>
          </div>
        )}

        <div className="sbTabStack" style={{ padding: "1.5rem" }}>
          {/* Logistics Section */}
          <section className="sbTabSection">
            <header className="sbSectionHeader">
              <h2 className="sbSectionTitle">Logistics</h2>
            </header>
            <div className="sbTabSectionBody">
              {logisticsBullets.length > 0 ? (
                <ul className="sbBulletList" aria-label="Logistics notes">
                  {logisticsBullets.map((bullet, idx) => (
                    <li key={`${idx}-${bullet}`}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="sbMuted">No logistics details yet.</p>
              )}
            </div>
          </section>

          {/* Format Section */}
          <section className="sbTabSection">
            <header className="sbSectionHeader">
              <h2 className="sbSectionTitle">Format</h2>
            </header>
            <div className="sbTabSectionBody">
              <div className="sbBody">{formatSummary}</div>
              {rounds && (
                <div className="sbMuted sbSmall sbTopSpace">
                  Rounds: {rounds}
                </div>
              )}
            </div>
          </section>

          {/* Registration Section - show for upcoming tournaments */}
          {isUpcoming && (
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Registration</h2>
              </header>
              <div className="sbTabSectionBody">
                <p className="sbBody sbPreLine">{tournament.registration.instructions}</p>
                {tournament.registration.deadlines.length > 0 && (
                  <div className="sbTopSpace">
                    <div className="sbLabel">Deadlines</div>
                    <ul className="sbBulletList sbTopSpace">
                      {tournament.registration.deadlines.map((deadline) => (
                        <li key={deadline.label}>
                          <span className="sbLabelInline">{deadline.label}:</span> {deadline.date}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Contact Section */}
          {tournament.contact_info && (
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Contact</h2>
              </header>
              <div className="sbTabSectionBody">
                <p className="sbBody sbPreLine">{tournament.contact_info}</p>
              </div>
            </section>
          )}

          {/* Post-Tournament Resources - show for finished tournaments */}
          {hasPostTournamentLinks && (
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Post-Tournament Resources</h2>
              </header>
              <div className="sbTabSectionBody">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {tournament.results_url && (
                    <a
                      href={tournament.results_url}
                      target="_blank"
                      rel="noreferrer"
                      className="sbCtaButton"
                      style={{ width: "fit-content" }}
                    >
                      View Results
                    </a>
                  )}
                  {tournament.stats_url && (
                    <a
                      href={tournament.stats_url}
                      target="_blank"
                      rel="noreferrer"
                      className="sbCtaButton"
                      style={{ width: "fit-content" }}
                    >
                      View Stats
                    </a>
                  )}
                  {tournament.packets_url && (
                    <a
                      href={tournament.packets_url}
                      target="_blank"
                      rel="noreferrer"
                      className="sbCtaButton"
                      style={{ width: "fit-content" }}
                    >
                      View Packets
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
