import { useState } from "react";
import type { TournamentDetail } from "../../types";
import { ContactTab } from "../../components/ContactTab";

type FinishedTabsProps = {
  tournament: TournamentDetail;
};

type TabId = "logistics" | "results" | "statistics" | "packets";

interface Tab {
  id: TabId;
  label: string;
  available: boolean;
}

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
  // Extract sheet ID from various Google Sheets URL formats
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function GoogleSheetEmbed({ url }: { url: string }) {
  const sheetId = extractGoogleSheetId(url);

  if (!sheetId) {
    // If we can't extract the ID, just show a link
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
      <iframe
        src={embedUrl}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Google Sheets Embed"
      />
    </div>
  );
}

export function FinishedTabs({ tournament }: FinishedTabsProps) {
  const resultsLink = tournament.links?.find(link => link.type === "RESULTS");
  const statsLink = tournament.links?.find(link => link.type === "STATS");
  const packetsLink = tournament.links?.find(link => link.type === "PACKETS");

  const tabs: Tab[] = [
    { id: "logistics", label: "Logistics", available: true },
    { id: "results", label: "Results", available: !!resultsLink },
    { id: "statistics", label: "Statistics", available: !!statsLink },
    { id: "packets", label: "Packets", available: !!packetsLink },
  ];

  const availableTabs = tabs.filter((tab) => tab.available);
  const [activeTab, setActiveTab] = useState<TabId>(availableTabs[0]?.id || "logistics");

  const logisticsBullets = tournament.notes?.logistics ? splitLogistics(tournament.notes.logistics) : [];
  const rounds = tournament.format.rounds_guaranteed;
  const formatSummary = tournament.format.summary;

  return (
    <div className="card" aria-label="Tournament details">
      {/* Tab Navigation */}
      <div className="sbTabNav" role="tablist" aria-label="Tournament sections">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tab-panel-${tab.id}`}
            className={activeTab === tab.id ? "sbTabButton sbTabButtonActive" : "sbTabButton"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="sbTabStack" style={{ padding: "1.5rem" }}>
        {/* Logistics Tab */}
        {activeTab === "logistics" && (
          <div role="tabpanel" id="tab-panel-logistics" aria-labelledby="tab-logistics">
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

            {tournament.contacts && tournament.contacts.length > 0 && (
              <ContactTab contacts={tournament.contacts} />
            )}
          </div>
        )}

        {/* Results Tab */}
        {activeTab === "results" && resultsLink && (
          <div role="tabpanel" id="tab-panel-results" aria-labelledby="tab-results">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Results</h2>
              </header>
              <div className="sbTabSectionBody">
                <GoogleSheetEmbed url={resultsLink.url} />
              </div>
            </section>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === "statistics" && statsLink && (
          <div role="tabpanel" id="tab-panel-statistics" aria-labelledby="tab-statistics">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Statistics</h2>
              </header>
              <div className="sbTabSectionBody">
                <GoogleSheetEmbed url={statsLink.url} />
              </div>
            </section>
          </div>
        )}

        {/* Packets Tab */}
        {activeTab === "packets" && packetsLink && (
          <div role="tabpanel" id="tab-panel-packets" aria-labelledby="tab-packets">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Question Packets</h2>
              </header>
              <div className="sbTabSectionBody">
                <div className="sbBody">
                  <a href={packetsLink.url} target="_blank" rel="noreferrer" className="sbInlineLink">
                    View packets <span aria-hidden="true">{"\u2197"}</span>
                  </a>
                  <p className="sbMuted sbTopSpace">PDF viewer coming soon.</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
