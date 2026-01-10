import type { TournamentDetail } from "../../types";

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

export function OverviewTab({ tournament }: OverviewTabProps) {
  const logisticsBullets = tournament.notes?.logistics ? splitLogistics(tournament.notes.logistics) : [];
  const fieldCap = tournament.format.rounds_guaranteed;
  const formatSummary = tournament.format.summary;

  // Check if tournament is finished based on dates
  const now = new Date();
  const endDate = new Date(tournament.dates.end);
  const isFinished = now > endDate;

  const resultsLink = tournament.links?.find(link => link.type === 'RESULTS');
  const statsLink = tournament.links?.find(link => link.type === 'STATS');
  const packetsLink = tournament.links?.find(link => link.type === 'PACKETS');
  const hasPostTournamentLinks = isFinished && (resultsLink || statsLink || packetsLink);

  return (
    <div className="sbTabStack" aria-label="Tournament overview">
      <section className="sbTabSection" aria-label="Overview">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Overview</h2>
          <p className="sbSectionSubtitle">High-level logistics and format at a glance.</p>
        </header>

        <div className="sbTabSectionBody">
          <div className="sbLabel">Logistics</div>
          {logisticsBullets.length > 0 ? (
            <ul className="sbBulletList sbTopSpace" aria-label="Logistics notes">
              {logisticsBullets.map((bullet, idx) => (
                <li key={`${idx}-${bullet}`}>{bullet}</li>
              ))}
            </ul>
          ) : (
            <p className="sbMuted sbTopSpace">No logistics details yet.</p>
          )}

          <div className="sbTabDivider" role="separator" aria-hidden="true" />

          <div className="sbLabel">Format</div>
          <div className="sbBody sbTopSpace">{formatSummary}</div>
          {fieldCap && (
            <div className="sbMuted sbSmall sbTopSpace">
              Rounds guaranteed: {fieldCap}
            </div>
          )}

          {hasPostTournamentLinks && (
            <>
              <div className="sbTabDivider" role="separator" aria-hidden="true" />
              <div className="sbLabel">Post-Tournament Resources</div>
              <div className="sbTopSpace" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {resultsLink && (
                  <a
                    href={resultsLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="sbCtaButton"
                    style={{ width: "fit-content" }}
                  >
                    {resultsLink.label || 'View Results'}
                  </a>
                )}
                {statsLink && (
                  <a
                    href={statsLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="sbCtaButton"
                    style={{ width: "fit-content" }}
                  >
                    {statsLink.label || 'View Stats'}
                  </a>
                )}
                {packetsLink && (
                  <a
                    href={packetsLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="sbCtaButton"
                    style={{ width: "fit-content" }}
                  >
                    {packetsLink.label || 'View Packets'}
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
