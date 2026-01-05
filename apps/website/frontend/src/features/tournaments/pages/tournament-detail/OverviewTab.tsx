import type { TournamentDetail } from "../../types";
import { formatTournamentDateRange } from "../../utils/date";

type OverviewTabProps = {
  tournament: TournamentDetail;
};

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

function getRegistrationMethodLabel(method: TournamentDetail["registration"]["method"]): string {
  switch (method) {
    case "FORM":
      return "Google Form";
    case "EMAIL":
      return "Email organizer";
    case "WEBSITE":
      return "Website";
    case "OTHER":
      return "Other";
    default:
      return method;
  }
}

export function OverviewTab({ tournament }: OverviewTabProps) {
  const fieldCap = tournament.field_limit ?? tournament.format.field_limit;
  const logisticsBullets = tournament.logistics ? splitLogistics(tournament.logistics) : [];

  return (
    <div className="sbOverviewGrid" aria-label="Tournament overview">
      <section className="sbOverviewSection sbOverviewSectionMuted" aria-label="Logistics">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Logistics</h2>
        </header>

        {logisticsBullets.length > 0 ? (
          <ul className="sbBulletList sbTopSpace" aria-label="Logistics notes">
            {logisticsBullets.map((bullet, idx) => (
              <li key={`${idx}-${bullet}`}>{bullet}</li>
            ))}
          </ul>
        ) : (
          <p className="sbMuted sbTopSpace">No logistics details yet.</p>
        )}
      </section>

      <section className="sbOverviewSection sbOverviewSectionPrimary" aria-label="Registration">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Registration</h2>
          <p className="sbSectionSubtitle">Primary info for teams and coaches.</p>
        </header>

        <div className="sbDetailRows sbTopSpace" aria-label="Registration summary">
          <div className="sbDetailRow">
            <span className="sbLabel">Method</span>
            <span className="sbDetailValue">{getRegistrationMethodLabel(tournament.registration.method)}</span>
          </div>
          {tournament.registration.cost && (
            <div className="sbDetailRow">
              <span className="sbLabel">Cost</span>
              <span className="sbDetailValue">{tournament.registration.cost}</span>
            </div>
          )}
        </div>

        <p className="sbBody sbTopSpace sbPreLine">{tournament.registration.instructions}</p>

        {tournament.registration.url && (
          <div className="sbRegistrationCta">
            <a className="sbCtaButton" href={tournament.registration.url} target="_blank" rel="noreferrer">
              Open registration link
            </a>
          </div>
        )}

        {tournament.registration.deadlines.length > 0 && (
          <div className="sbDeadlinesBlock" aria-label="Registration deadlines">
            <div className="sbLabel">Deadlines</div>
            <div className="sbDetailRows sbTopSpace">
              {tournament.registration.deadlines.map((deadline) => (
                <div key={`${deadline.label}-${deadline.date}`} className="sbDetailRow">
                  <span className="sbDetailValue">{deadline.label}</span>
                  <span className="sbMuted sbSmall">{formatTournamentDateRange(deadline.date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="sbOverviewSection" aria-label="Format">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Format</h2>
        </header>

        <div className="sbFormatSummary sbTopSpace" aria-label="Format summary">
          <div className="sbBody sbFormatSummaryLine">{tournament.format.summary}</div>
        </div>

        <div className="sbDetailRows sbTopSpace" aria-label="Format details">
          {fieldCap && (
            <div className="sbDetailRow">
              <span className="sbLabel">Field cap</span>
              <span className="sbDetailValue">{fieldCap} teams</span>
            </div>
          )}
          {tournament.format.rounds && (
            <div className="sbDetailRow">
              <span className="sbLabel">Rounds</span>
              <span className="sbDetailValue">{tournament.format.rounds}</span>
            </div>
          )}
        </div>

        {tournament.format.phases.length > 0 && (
          <details className="sbDetails sbTopSpace">
            <summary className="sbDetailsSummary">Phase breakdown</summary>
            <div className="sbDetailsBody">
              <ul className="sbBulletList" aria-label="Tournament phases">
                {tournament.format.phases.map((phase) => (
                  <li key={phase.name}>
                    <span className="sbStrong">{phase.name}</span>
                    <span className="sbMuted sbSmall">{" — "}{phase.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </section>

      <section className="sbOverviewSection" aria-label="Contacts">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Contacts</h2>
          <p className="sbSectionSubtitle">Questions or need help? Reach out.</p>
        </header>

        {tournament.contacts.length === 0 ? (
          <p className="sbMuted sbTopSpace">No contacts listed.</p>
        ) : (
          <div className="sbDetailRows sbTopSpace" aria-label="Tournament contacts">
            {tournament.contacts.map((contact) => (
              <div key={contact.email ?? contact.name} className="sbContactRow">
                <div className="sbContactName">{contact.name}</div>
                <div className="sbContactMeta">
                  {contact.email && (
                    <a className="sbInlineLink" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && <span className="sbMuted sbSmall">{contact.phone}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
