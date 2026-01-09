import { useState } from "react";
import type { TournamentDetail } from "../../types";
import { ContactTab } from "../../components/ContactTab";

type FinishedTabsProps = {
  tournament: TournamentDetail;
};

type TabId = "general" | "results" | "statistics";

interface Tab {
  id: TabId;
  label: string;
  disabled: boolean;
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

  const tabs: Tab[] = [
    { id: "general", label: "General Info", disabled: false },
    { id: "results", label: "Results", disabled: !resultsLink },
    { id: "statistics", label: "Statistics", disabled: !statsLink },
  ];

  const [activeTab, setActiveTab] = useState<TabId>("general");

  const logisticsBullets = tournament.notes?.logistics ? splitLogistics(tournament.notes.logistics) : [];
  const rounds = tournament.format.rounds_guaranteed;
  const formatSummary = tournament.format.summary;

  return (
    <div className="card" aria-label="Tournament details">
      {/* Tab Navigation */}
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

      {/* Tab Content */}
      <div className="sbTabStack" style={{ padding: "1.5rem" }}>
        {/* General Info Tab */}
        {activeTab === "general" && (
          <div role="tabpanel" id="tab-panel-general" aria-labelledby="tab-general">
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
        {activeTab === "results" && (
          <div role="tabpanel" id="tab-panel-results" aria-labelledby="tab-results">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Results</h2>
              </header>
              <div className="sbTabSectionBody">
                {resultsLink ? <GoogleSheetEmbed url={resultsLink.url} /> : <p className="sbMuted">Results are not available.</p>}
              </div>
            </section>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === "statistics" && (
          <div role="tabpanel" id="tab-panel-statistics" aria-labelledby="tab-statistics">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Statistics</h2>
              </header>
              <div className="sbTabSectionBody">
                {statsLink ? <GoogleSheetEmbed url={statsLink.url} /> : <p className="sbMuted">Statistics are not available.</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
