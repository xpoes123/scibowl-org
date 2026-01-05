import type { TournamentDetail } from "../../types";
import { formatTournamentDateRange } from "../../utils/date";

type OverviewTabProps = {
  tournament: TournamentDetail;
};

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
  const locationLabel = `${tournament.location_city}, ${tournament.location_state}`;
  const dateLabel = formatTournamentDateRange(tournament.start_date, tournament.end_date);
  const levelLabel = tournament.levels.join(", ");
  const fieldCap = tournament.field_limit ?? tournament.format.field_limit;

  return (
    <div className="sbOverviewGrid" aria-label="Tournament overview">
      <section className="sbOverviewSection" aria-label="Logistics">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Logistics</h2>
        </header>

        {tournament.logistics ? (
          <p className="sbBody sbTopSpace">{tournament.logistics}</p>
        ) : (
          <p className="sbMuted sbTopSpace">No logistics details yet.</p>
        )}

        <div className="sbDetailRows sbTopSpace" aria-label="Logistics highlights">
          <div className="sbDetailRow">
            <span className="sbLabel">Location</span>
            <span className="sbDetailValue">{locationLabel}</span>
          </div>
          <div className="sbDetailRow">
            <span className="sbLabel">Dates</span>
            <span className="sbDetailValue">{dateLabel}</span>
          </div>
          <div className="sbDetailRow">
            <span className="sbLabel">Levels</span>
            <span className="sbDetailValue">{levelLabel}</span>
          </div>
          {tournament.difficulty && (
            <div className="sbDetailRow">
              <span className="sbLabel">Difficulty</span>
              <span className="sbDetailValue">{tournament.difficulty}</span>
            </div>
          )}
        </div>
      </section>

      <section className="sbOverviewSection" aria-label="Registration">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Registration</h2>
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
          <div className="sbTopSpace">
            <a className="sbActionLink" href={tournament.registration.url} target="_blank" rel="noreferrer">
              Open registration link
            </a>
          </div>
        )}

        {tournament.registration.deadlines.length > 0 && (
          <div className="sbTopSpace" aria-label="Registration deadlines">
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

        <p className="sbBody sbTopSpace">{tournament.format.summary}</p>

        {tournament.format.phases.length > 0 && (
          <ul className="sbBulletList sbTopSpace" aria-label="Tournament phases">
            {tournament.format.phases.map((phase) => (
              <li key={phase.name}>
                <span className="sbStrong">{phase.name}</span>
                <span className="sbMuted sbSmall">{" — "}{phase.description}</span>
              </li>
            ))}
          </ul>
        )}

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
      </section>

      <section className="sbOverviewSection" aria-label="Contacts">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Contacts</h2>
        </header>

        {tournament.contacts.length === 0 ? (
          <p className="sbMuted sbTopSpace">No contacts listed.</p>
        ) : (
          <div className="sbDetailRows sbTopSpace" aria-label="Tournament contacts">
            {tournament.contacts.map((contact) => (
              <div key={contact.email ?? contact.name} className="sbContactRow">
                <div className="sbStrong">{contact.name}</div>
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

