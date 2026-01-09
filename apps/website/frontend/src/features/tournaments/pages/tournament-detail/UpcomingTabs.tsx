import { useState } from "react";
import type { TournamentDetail } from "../../types";
import { ContactTab } from "../../components/ContactTab";

type UpcomingTabsProps = {
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

export function UpcomingTabs({ tournament }: UpcomingTabsProps) {
  const tabs: Tab[] = [
    { id: "general", label: "General Info", disabled: false },
    { id: "results", label: "Results", disabled: true },
    { id: "statistics", label: "Statistics", disabled: true },
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

            {tournament.registration && (
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
                  {tournament.registration.deadlines && tournament.registration.deadlines.length > 0 && (
                    <div className="sbTopSpace">
                      <div className="sbLabel">Deadlines</div>
                      <ul className="sbBulletList sbTopSpace">
                        {tournament.registration.deadlines.map((deadline) => (
                          <li key={deadline.label}>
                            <span className="sbLabelInline">{deadline.label}:</span> {deadline.date}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {tournament.contacts && tournament.contacts.length > 0 && <ContactTab contacts={tournament.contacts} />}
          </div>
        )}

        {activeTab === "results" && (
          <div role="tabpanel" id="tab-panel-results" aria-labelledby="tab-results">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Results</h2>
              </header>
              <div className="sbTabSectionBody">
                <p className="sbMuted">Results will be available after the tournament.</p>
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
                <p className="sbMuted">Statistics will be available after the tournament.</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
