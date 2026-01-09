import { useMemo, useState } from "react";
import type { TournamentDetail, TournamentLink } from "../../types";
import { ContactTab } from "../../components/ContactTab";

type TournamentTabsProps = {
  tournament: TournamentDetail;
  variant: "UPCOMING" | "FINISHED";
};

type TabId = "overview" | "results" | "statistics";

type Tab = {
  id: TabId;
  label: string;
  disabled: boolean;
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

function extractGoogleSheetId(url: string): string | null {
  const patterns = [/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/, /\/d\/([a-zA-Z0-9-_]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function GoogleSheetEmbed({ url }: { url: string }) {
  const sheetId = extractGoogleSheetId(url);

  if (!sheetId) {
    return (
      <div className="sbBody">
        <a href={url} target="_blank" rel="noreferrer" className="sbInlineLink">
          View spreadsheet <span aria-hidden="true">{"\u2197"}</span>
        </a>
      </div>
    );
  }

  const embedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlembed`;

  return (
    <div style={{ width: "100%", height: "600px", border: "1px solid var(--sb-border)", borderRadius: "8px", overflow: "hidden" }}>
      <iframe src={embedUrl} style={{ width: "100%", height: "100%", border: "none" }} title="Google Sheets Embed" />
    </div>
  );
}

function findLink(tournament: TournamentDetail, type: TournamentLink["type"]) {
  return tournament.links?.find((link) => link.type === type);
}

export function TournamentTabs({ tournament, variant }: TournamentTabsProps) {
  const resultsLink = useMemo(() => findLink(tournament, "RESULTS"), [tournament]);
  const statsLink = useMemo(() => findLink(tournament, "STATS"), [tournament]);
  const packetsLink = useMemo(() => findLink(tournament, "PACKETS"), [tournament]);

  const tabs: Tab[] = useMemo(() => {
    if (variant === "UPCOMING") {
      return [
        { id: "overview", label: "Overview", disabled: false },
        { id: "results", label: "Results", disabled: true },
        { id: "statistics", label: "Statistics", disabled: true },
      ];
    }

    return [
      { id: "overview", label: "Overview", disabled: false },
      { id: "results", label: "Results", disabled: !resultsLink },
      { id: "statistics", label: "Statistics", disabled: !statsLink },
    ];
  }, [resultsLink, statsLink, variant]);

  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const logisticsBullets = tournament.notes?.logistics ? splitLogistics(tournament.notes.logistics) : [];
  const rounds = tournament.format.rounds_guaranteed;
  const formatSummary = tournament.format.summary;

  const deadlines = variant === "UPCOMING" ? (tournament.registration?.deadlines ?? []) : [];

  return (
    <div className="card" aria-label="Tournament details">
      <div className="sbTabNav" role="tablist" aria-label="Tournament sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-disabled={tab.disabled}
            aria-controls={`tab-panel-${tab.id}`}
            disabled={tab.disabled}
            className={activeTab === tab.id ? "sbTabButton sbTabButtonActive" : "sbTabButton"}
            onClick={() => {
              if (tab.disabled) return;
              setActiveTab(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sbTabStack" style={{ padding: "1.5rem" }}>
        {activeTab === "overview" && (
          <div role="tabpanel" id="tab-panel-overview" aria-labelledby="tab-overview">
            <section className="sbTabSection">
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
                  <p className="sbMuted">No logistics details available.</p>
                )}
              </div>
            </section>

            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Format</h2>
              </header>
              <div className="sbTabSectionBody">
                <div className="sbBody">{formatSummary}</div>
                {rounds && (
                  <div className="sbMuted sbSmall sbTopSpace">
                    Rounds: {rounds}
                  </div>
                )}
              </div>
            </section>

            {variant === "UPCOMING" && tournament.registration && (
              <section className="sbTabSection">
                <header className="sbSectionHeader">
                  <h2 className="sbSectionTitle">Registration</h2>
                </header>
                <div className="sbTabSectionBody">
                  {tournament.registration.cost && (
                    <div className="sbBody">
                      <span className="sbLabelInline">Cost:</span> {tournament.registration.cost}
                    </div>
                  )}
                  <p className="sbBody sbPreLine sbTopSpace">{tournament.registration.instructions}</p>
                </div>
              </section>
            )}

            {variant === "UPCOMING" && deadlines.length > 0 && (
              <section className="sbTabSection">
                <header className="sbSectionHeader">
                  <h2 className="sbSectionTitle">Deadlines</h2>
                </header>
                <div className="sbTabSectionBody">
                  <ul className="sbBulletList" aria-label="Registration deadlines">
                    {deadlines.map((deadline) => (
                      <li key={`${deadline.label}-${deadline.date}`}>
                        <span className="sbLabelInline">{deadline.label}:</span> {deadline.date}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {tournament.contacts && tournament.contacts.length > 0 && <ContactTab contacts={tournament.contacts} />}

            {variant === "FINISHED" && packetsLink && (
              <section className="sbTabSection">
                <header className="sbSectionHeader">
                  <h2 className="sbSectionTitle">Question Packets</h2>
                </header>
                <div className="sbTabSectionBody">
                  <div className="sbBody">
                    <a href={packetsLink.url} target="_blank" rel="noreferrer" className="sbInlineLink">
                      View packets <span aria-hidden="true">{"\u2197"}</span>
                    </a>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "results" && (
          <div role="tabpanel" id="tab-panel-results" aria-labelledby="tab-results">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Results</h2>
              </header>
              <div className="sbTabSectionBody">
                {variant === "UPCOMING" ? (
                  <p className="sbMuted">Results will be available after the tournament.</p>
                ) : resultsLink ? (
                  <GoogleSheetEmbed url={resultsLink.url} />
                ) : (
                  <p className="sbMuted">Results are not available.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "statistics" && (
          <div role="tabpanel" id="tab-panel-statistics" aria-labelledby="tab-statistics">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Statistics</h2>
              </header>
              <div className="sbTabSectionBody">
                {variant === "UPCOMING" ? (
                  <p className="sbMuted">Statistics will be available after the tournament.</p>
                ) : statsLink ? (
                  <GoogleSheetEmbed url={statsLink.url} />
                ) : (
                  <p className="sbMuted">Statistics are not available.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

