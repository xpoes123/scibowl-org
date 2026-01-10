import type { TournamentDetail } from "../../types";

type ContactTabProps = {
  tournament: TournamentDetail;
};

export function ContactTab({ tournament }: ContactTabProps) {
  return (
    <div className="sbTabStack" aria-label="Tournament contact">
      <section className="sbTabSection" aria-label="Contact">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Contact</h2>
          <p className="sbSectionSubtitle">Questions or need help? Reach out.</p>
        </header>

        <div className="sbTabSectionBody">
          {tournament.contacts && tournament.contacts.length > 0 ? (
            <div className="sbDetailRows">
              {tournament.contacts.map((contact, idx) => (
                <div key={idx} className="sbDetailRow">
                  <span className="sbLabel">{contact.label || contact.type}</span>
                  <span className="sbDetailValue">{contact.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="sbMuted">No contact information listed.</p>
          )}
        </div>
      </section>
    </div>
  );
}
