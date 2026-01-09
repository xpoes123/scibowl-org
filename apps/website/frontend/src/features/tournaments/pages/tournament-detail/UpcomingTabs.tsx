import { useState } from "react";
import type { TournamentDetail } from "../../types";
import { ContactTab } from "../../components/ContactTab";

type UpcomingTabsProps = {
  tournament: TournamentDetail;
};

type TabId = "general" | "schedule" | "field" | "sponsors" | "contact";

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

export function UpcomingTabs({ tournament }: UpcomingTabsProps) {
  const tabs: Tab[] = [
    { id: "general", label: "General Info", available: true },
    { id: "schedule", label: "Schedule", available: true },
    { id: "field", label: "Field", available: true },
    { id: "sponsors", label: "Sponsors", available: true },
    { id: "contact", label: "Contact", available: !!(tournament.contacts && tournament.contacts.length > 0) },
  ];

  const availableTabs = tabs.filter((tab) => tab.available);
  const [activeTab, setActiveTab] = useState<TabId>(availableTabs[0]?.id || "general");

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
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === "schedule" && (
          <div role="tabpanel" id="tab-panel-schedule" aria-labelledby="tab-schedule">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Tournament Schedule</h2>
              </header>
              <div className="sbTabSectionBody">
                <p className="sbMuted">Schedule information coming soon.</p>
              </div>
            </section>
          </div>
        )}

        {/* Field Tab */}
        {activeTab === "field" && (
          <div role="tabpanel" id="tab-panel-field" aria-labelledby="tab-field">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Registered Teams</h2>
              </header>
              <div className="sbTabSectionBody">
                <p className="sbMuted">Team list coming soon.</p>
              </div>
            </section>
          </div>
        )}

        {/* Sponsors Tab */}
        {activeTab === "sponsors" && (
          <div role="tabpanel" id="tab-panel-sponsors" aria-labelledby="tab-sponsors">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Tournament Sponsors</h2>
              </header>
              <div className="sbTabSectionBody">
                <p className="sbMuted">Sponsor information coming soon.</p>
              </div>
            </section>
          </div>
        )}

        {/* Contact Tab */}
        {activeTab === "contact" && tournament.contacts && tournament.contacts.length > 0 && (
          <div role="tabpanel" id="tab-panel-contact" aria-labelledby="tab-contact">
            <ContactTab contacts={tournament.contacts} />
          </div>
        )}
      </div>
    </div>
  );
}
