import type { TournamentDetail } from "../../types";
import { formatTournamentDateRange } from "../../utils/date";

type RegistrationTabProps = {
  tournament: TournamentDetail;
};

export function RegistrationTab({ tournament }: RegistrationTabProps) {
  return (
    <div className="sbTabStack" aria-label="Tournament registration">
      <section className="sbTabSection" aria-label="Registration">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Registration</h2>
          <p className="sbSectionSubtitle">Primary info for teams and coaches.</p>
        </header>

        <div className="sbTabSectionBody">
          {tournament.registration.cost && (
            <div className="sbDetailRows" aria-label="Registration summary">
              <div className="sbDetailRow">
                <span className="sbLabel">Cost</span>
                <span className="sbDetailValue">{tournament.registration.cost}</span>
              </div>
            </div>
          )}

          <p className="sbBody sbTopSpace sbPreLine">{tournament.registration.instructions}</p>

          {tournament.registration.url && (
            <div className="sbRegistrationCta">
              <a className="sbCtaButton" href={tournament.registration.url} target="_blank" rel="noreferrer">
                Register now
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
        </div>
      </section>
    </div>
  );
}

