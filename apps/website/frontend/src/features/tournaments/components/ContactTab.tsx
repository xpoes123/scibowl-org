import type { TournamentContact } from "../types";

type ContactTabProps = {
  contacts?: TournamentContact[];
};

export function ContactTab({ contacts }: ContactTabProps) {
  // If no contact info at all
  if (!contacts || contacts.length === 0) {
    return (
      <section className="sbTabSection">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Contact Information</h2>
        </header>
        <div className="sbTabSectionBody">
          <p className="sbMuted">No contact information available.</p>
        </div>
      </section>
    );
  }

  // Group contacts by type
  const emailContacts = contacts.filter(c => c.type === "EMAIL");
  const discordContacts = contacts.filter(c => c.type === "DISCORD");
  const phoneContacts = contacts.filter(c => c.type === "PHONE");
  const otherContacts = contacts.filter(c => c.type === "OTHER");

  return (
    <section className="sbTabSection">
      <header className="sbSectionHeader">
        <h2 className="sbSectionTitle">Contact Information</h2>
      </header>
      <div className="sbTabSectionBody">
        {emailContacts.length > 0 && (
          <div style={{ marginBottom: (discordContacts.length > 0 || phoneContacts.length > 0 || otherContacts.length > 0) ? "1.5rem" : "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--sb-muted)" }}
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <h3 className="sbLabel" style={{ margin: 0, fontSize: "14px" }}>Email</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {emailContacts.map((contact, idx) => (
                <div key={idx}>
                  <a href={`mailto:${contact.value}`} className="sbInlineLink">
                    {contact.value}
                  </a>
                  {contact.label && <span className="sbMuted sbSmall" style={{ marginLeft: "0.5rem" }}>({contact.label})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {discordContacts.length > 0 && (
          <div style={{ marginBottom: (phoneContacts.length > 0 || otherContacts.length > 0) ? "1.5rem" : "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ color: "#5865F2" }}
              >
                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
              </svg>
              <h3 className="sbLabel" style={{ margin: 0, fontSize: "14px" }}>Discord</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {discordContacts.map((contact, idx) => (
                <div key={idx}>
                  <span style={{ fontFamily: "monospace", color: "var(--sb-text)" }}>
                    {contact.value}
                  </span>
                  {contact.label && <span className="sbMuted sbSmall" style={{ marginLeft: "0.5rem" }}>({contact.label})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {phoneContacts.length > 0 && (
          <div style={{ marginBottom: otherContacts.length > 0 ? "1.5rem" : "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <h3 className="sbLabel" style={{ margin: 0, fontSize: "14px" }}>Phone</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {phoneContacts.map((contact, idx) => (
                <div key={idx}>
                  <a href={`tel:${contact.value}`} className="sbInlineLink">
                    {contact.value}
                  </a>
                  {contact.label && <span className="sbMuted sbSmall" style={{ marginLeft: "0.5rem" }}>({contact.label})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {otherContacts.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <h3 className="sbLabel" style={{ margin: 0, fontSize: "14px" }}>Other</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {otherContacts.map((contact, idx) => (
                <div key={idx}>
                  <span className="sbBody">{contact.value}</span>
                  {contact.label && <span className="sbMuted sbSmall" style={{ marginLeft: "0.5rem" }}>({contact.label})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
