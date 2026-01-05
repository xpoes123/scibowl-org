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

  return (
    <div className="sbDetailGrid">
      <section className="card">
        <h2 className="sbCardTitle">Logistics</h2>
        {tournament.logistics ? <p className="sbBody sbTopSpace">{tournament.logistics}</p> : <p className="sbMuted sbTopSpace">No logistics details yet.</p>}

        <ul className="sbKeyValueList sbTopSpace" aria-label="Logistics highlights">
          <li>
            <span className="sbLabel">Location</span>
            <span className="sbDetailValue">{locationLabel}</span>
          </li>
          <li>
            <span className="sbLabel">Dates</span>
            <span className="sbDetailValue">{dateLabel}</span>
          </li>
          {tournament.difficulty && (
            <li>
              <span className="sbLabel">Difficulty</span>
              <span className="sbDetailValue">{tournament.difficulty}</span>
            </li>
          )}
        </ul>
      </section>

      <section className="card">
        <h2 className="sbCardTitle">Registration</h2>

        <div className="sbDetailRows sbTopSpace">
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
          <div className="sbTopSpace">
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

      <section className="card">
        <h2 className="sbCardTitle">Contacts</h2>
        {tournament.contacts.length === 0 ? (
          <p className="sbMuted sbTopSpace">No contacts listed.</p>
        ) : (
          <div className="sbDetailRows sbTopSpace">
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

      <section className="card">
        <h2 className="sbCardTitle">Format</h2>

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

        <div className="sbDetailRows sbTopSpace">
          {(tournament.field_limit ?? tournament.format.field_limit) && (
            <div className="sbDetailRow">
              <span className="sbLabel">Field cap</span>
              <span className="sbDetailValue">{tournament.field_limit ?? tournament.format.field_limit} teams</span>
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
    </div>
  );
}
