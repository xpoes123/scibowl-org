import type { TournamentContact } from "../types";

type ContactTabProps = {
  contacts?: TournamentContact[];
};

export function ContactTab({ contacts }: ContactTabProps) {
  // If no contact info at all
  if (!contacts || contacts.length === 0) {
    return (
      <section className="py-6 first:pt-0 border-t border-[var(--sb-border)] first:border-t-0">
        <h2 className="m-0 text-base font-semibold leading-6">Contact Information</h2>
        <div className="mt-3">
          <p className="sbMuted m-0">No contact information available.</p>
        </div>
      </section>
    );
  }

  // Group contacts by type
  const emailContacts = contacts.filter(c => c.type === "EMAIL");
  const discordContacts = contacts.filter(c => c.type === "DISCORD");
  const phoneContacts = contacts.filter(c => c.type === "PHONE");
  const otherContacts = contacts.filter(c => c.type === "OTHER");

  const getDiscordHref = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^(discord\.gg|discord\.com|www\.discord\.gg|www\.discord\.com)\//i.test(trimmed)) return `https://${trimmed}`;
    return null;
  };

  const isDiscordInviteLink = (href: string): boolean => {
    try {
      const url = new URL(href);
      const host = url.hostname.toLowerCase();
      if (host === "discord.gg" || host.endsWith(".discord.gg")) return true;
      if (host === "discord.com" || host.endsWith(".discord.com")) {
        return url.pathname.toLowerCase().startsWith("/invite/");
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <section className="py-6 first:pt-0 border-t border-[var(--sb-border)] first:border-t-0">
      <h2 className="m-0 text-base font-semibold leading-6">Contact Information</h2>
      <div className="mt-3 space-y-3">
        {emailContacts.length > 0 && (
          <div className="flex flex-col gap-2">
            {emailContacts.map((contact, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2">
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
                    aria-hidden="true"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span className="sbLabel text-sm">{contact.label ? contact.label : "Email"}</span>
                </div>
                <a href={`mailto:${contact.value}`} className="sbInlineLink">
                  {contact.value}
                </a>
              </div>
            ))}
          </div>
        )}

        {discordContacts.length > 0 && (
          <div className="flex flex-col gap-2">
            {discordContacts.map((contact, idx) => {
              const href = getDiscordHref(contact.value);
              const inviteHref = href && isDiscordInviteLink(href) ? href : null;
              const label = contact.label ? contact.label : "Discord";

              return (
                <div key={idx} className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      style={{ color: "#5865F2" }}
                      aria-hidden="true"
                    >
                      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
                    </svg>
                    <span className="sbLabel text-sm">{inviteHref ? label : contact.value}</span>
                  </div>

                  {inviteHref && (
                    <a href={inviteHref} target="_blank" rel="noreferrer" className="sbInlineLink">
                      {contact.value} <span aria-hidden="true">{"\u2197"}</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {phoneContacts.length > 0 && (
          <div className="flex flex-col gap-2">
            {phoneContacts.map((contact, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2">
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
                    aria-hidden="true"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.33 1.7.62 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.19a2 2 0 0 1 2.11-.45c.8.29 1.64.5 2.5.62A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="sbLabel text-sm">Phone</span>
                </div>
                <a href={`tel:${contact.value}`} className="sbInlineLink">
                  {contact.value}
                </a>
              </div>
            ))}
          </div>
        )}

        {otherContacts.length > 0 && (
          <div className="flex flex-col gap-2">
            {otherContacts.map((contact, idx) => (
              <p key={idx} className="sbBody m-0">
                {contact.label ? `${contact.label}: ${contact.value}` : contact.value}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
