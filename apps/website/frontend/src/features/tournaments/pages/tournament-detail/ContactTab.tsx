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
          {tournament.contact_info ? (
            <p className="sbBody sbPreLine">{tournament.contact_info}</p>
          ) : (
            <p className="sbMuted">No contact information listed.</p>
          )}
        </div>
      </section>
    </div>
  );
}
