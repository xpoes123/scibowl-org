import type { TournamentDetail } from "../../types";
import { formatTournamentDateRange } from "../../utils/date";

type RegistrationTabProps = {
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

export function RegistrationTab({ tournament }: RegistrationTabProps) {
  const methodLabel = getRegistrationMethodLabel(tournament.registration.method);

  return (
    <div className="sbTabStack" aria-label="Tournament registration">
      <section className="sbTabSection" aria-label="Registration details">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Details</h2>
        </header>

        <div className="sbTabSectionBody">
          <div className="sbDetailRows" aria-label="Registration summary">
            <div className="sbDetailRow">
              <span className="sbLabel">Method</span>
              <span className="sbDetailValue">
                {tournament.registration.url ? (
                  <a className="sbInlineLink" href={tournament.registration.url} target="_blank" rel="noreferrer">
                    {methodLabel}
                  </a>
                ) : (
                  methodLabel
                )}
              </span>
            </div>
            {tournament.registration.cost && (
              <div className="sbDetailRow">
                <span className="sbLabel">Cost</span>
                <span className="sbDetailValue">{tournament.registration.cost}</span>
              </div>
            )}
          </div>

          <p className="sbBody sbTopSpace sbPreLine">{tournament.registration.instructions}</p>
        </div>
      </section>

      <section className="sbTabSection" aria-label="Registration deadlines">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Deadlines</h2>
        </header>

        <div className="sbTabSectionBody">
          {tournament.registration.deadlines.length === 0 ? (
            <p className="sbMuted">No deadlines listed.</p>
          ) : (
            <div className="sbDetailRows" aria-label="Registration deadlines">
              {tournament.registration.deadlines.map((deadline) => (
                <div key={`${deadline.label}-${deadline.date}`} className="sbDetailRow">
                  <span className="sbDetailValue">{deadline.label}</span>
                  <span className="sbMuted sbSmall">{formatTournamentDateRange(deadline.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

