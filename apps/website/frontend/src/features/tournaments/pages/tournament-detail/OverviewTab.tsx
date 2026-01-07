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
  const logisticsBullets = tournament.logistics ? splitLogistics(tournament.logistics) : [];
  const fieldCap = tournament.field_limit ?? tournament.format.field_limit;
  const rounds = tournament.format.rounds;
  const formatSummary = tournament.format.summary;
  const isFinished = tournament.status === "FINISHED";
  const hasPostTournamentLinks = isFinished && (tournament.results_url || tournament.stats_url || tournament.packets_url);

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
          {(fieldCap || rounds) && (
            <div className="sbMuted sbSmall sbTopSpace">
              {fieldCap ? `Field cap: ${fieldCap} teams` : ""}
              {fieldCap && rounds ? " \u2022 " : ""}
              {rounds ? `Rounds: ${rounds}` : ""}
            </div>
          )}

          {hasPostTournamentLinks && (
            <>
              <div className="sbTabDivider" role="separator" aria-hidden="true" />
              <div className="sbLabel">Post-Tournament Resources</div>
              <div className="sbTopSpace" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {tournament.results_url && (
                  <a
                    href={tournament.results_url}
                    target="_blank"
                    rel="noreferrer"
                    className="sbCtaButton"
                    style={{ width: "fit-content" }}
                  >
                    View Results
                  </a>
                )}
                {tournament.stats_url && (
                  <a
                    href={tournament.stats_url}
                    target="_blank"
                    rel="noreferrer"
                    className="sbCtaButton"
                    style={{ width: "fit-content" }}
                  >
                    View Stats
                  </a>
                )}
                {tournament.packets_url && (
                  <a
                    href={tournament.packets_url}
                    target="_blank"
                    rel="noreferrer"
                    className="sbCtaButton"
                    style={{ width: "fit-content" }}
                  >
                    View Packets
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
