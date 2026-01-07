import type { TournamentDetail } from "../../types";

type OverviewTabProps = {
  tournament: TournamentDetail;
};

function normalizeLogisticsItem(text: string): string {
  return text
    .replace(/^\s*(?:(?:\\u2022|u2022|\\2022|•|\u2022)\s*)+/gi, "")
    .replace(/^\s*[-*]\s+/g, "")
    .trim();
}

function normalizeFormatSummary(text: string): string {
  return text
    .replace(/\s*\u0192\+'\s*/g, " \u2192 ")
    .replace(/\s*(?:->|\u2192)\s*/g, " \u2192 ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitLogistics(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const byLine = trimmed
    .split(/\n+/)
    .map((line) => normalizeLogisticsItem(line))
    .filter(Boolean);
  if (byLine.length > 1) return byLine;

  const sentences = trimmed
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((sentence) => normalizeLogisticsItem(sentence))
    .filter(Boolean);
  if (sentences && sentences.length > 1) return sentences;

  return [normalizeLogisticsItem(trimmed)].filter(Boolean);
}

export function OverviewTab({ tournament }: OverviewTabProps) {
  const logisticsBullets = tournament.logistics ? splitLogistics(tournament.logistics) : [];
  const fieldCap = tournament.field_limit ?? tournament.format.field_limit;
  const rounds = tournament.format.rounds;
  const formatSummary = normalizeFormatSummary(tournament.format.summary);

  return (
    <div className="sbTabStack" aria-label="Tournament overview">
      <section className="sbTabSection" aria-label="Logistics">
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

      <section className="sbTabSection" aria-label="Format">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Format</h2>
        </header>

        <div className="sbTabSectionBody">
          <div className="sbDetailRows" aria-label="Tournament format summary">
            <div className="sbDetailRow">
              <span className="sbLabel">Structure</span>
              <span className="sbDetailValue">{formatSummary ? formatSummary : "TBD"}</span>
            </div>
            <div className="sbDetailRow">
              <span className="sbLabel">Field cap</span>
              <span className="sbDetailValue">{fieldCap ? `${fieldCap} teams` : "TBD"}</span>
            </div>
            <div className="sbDetailRow">
              <span className="sbLabel">Rounds</span>
              <span className="sbDetailValue">{rounds ? `${rounds}` : "TBD"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sbTabSection" aria-label="Contacts">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Contacts</h2>
        </header>

        <div className="sbTabSectionBody">
          {tournament.contacts.length === 0 ? (
            <p className="sbMuted">No contacts listed.</p>
          ) : (
            <div className="sbDetailRows" aria-label="Tournament contacts">
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
        </div>
      </section>
    </div>
  );
}
