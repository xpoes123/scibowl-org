import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TournamentDetail, TournamentLink, TournamentStatus } from "../../types";
import { ContactTab } from "../../components/ContactTab";
import { formatTournamentDate } from "../../utils/date";
import { useTournamentStandings } from "../../hooks/useTournamentStandings";
import { useTournamentStatsManifest } from "../../hooks/useTournamentStatsManifest";
import { useTournamentStatsReportsIndex } from "../../hooks/useTournamentStatsReportsIndex";
import { useTournamentStatsCsv } from "../../hooks/useTournamentStatsCsv";
import { useRosterIndex } from "../../hooks/useRosterIndex";
import { IndividualStandingsTable, TeamStandingsTable } from "./StandingsTables";
import { FieldTab } from "./FieldTab";
import { ScoreboardView } from "./ScoreboardView";

type TournamentTabsProps = {
  tournament: TournamentDetail;
  variant: TournamentStatus;
};

type TabId = "overview" | "field" | "results" | "statistics";

type Tab = {
  id: TabId;
  label: string;
  disabled: boolean;
};

function toTitleCase(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function humanizeCategoryLabel(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "Uncategorized";

  const upper = trimmed.toUpperCase();
  if (upper === "EARTH_SPACE" || upper === "EARTH_AND_SPACE") return "Earth/Space";

  const normalized = trimmed.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return toTitleCase(normalized);
}

function statsBaseDirFromManifestPath(manifestPath: string): string {
  const normalized = (manifestPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function joinStatsPath(baseDir: string, file: string): string {
  const normalizedFile = (file || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!baseDir) return normalizedFile;
  if (!normalizedFile) return baseDir;
  return `${baseDir}/${normalizedFile}`;
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

function scrollChildIntoViewX(container: HTMLElement, child: HTMLElement, behavior: ScrollBehavior) {
  const containerRect = container.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();

  const childLeft = childRect.left - containerRect.left + container.scrollLeft;
  const childRight = childLeft + childRect.width;
  const visibleLeft = container.scrollLeft;
  const visibleRight = visibleLeft + container.clientWidth;

  if (childLeft >= visibleLeft && childRight <= visibleRight) return;

  const targetLeft = childLeft - (container.clientWidth - childRect.width) / 2;
  container.scrollTo({ left: Math.max(0, targetLeft), behavior });
}

function OverviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-6 first:pt-0 border-t border-[var(--sb-border)] first:border-t-0">
      <h2 className="m-0 text-base font-semibold leading-6">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function TournamentTabs({ tournament, variant }: TournamentTabsProps) {
  const resultsLink = useMemo(() => findLink(tournament, "RESULTS"), [tournament]);
  const statsLink = useMemo(() => findLink(tournament, "STATS"), [tournament]);
  const packetsLink = useMemo(() => findLink(tournament, "PACKETS"), [tournament]);

  const isUpcoming = variant === "UPCOMING";
  const isLive = variant === "LIVE";
  const isFinished = variant === "FINISHED";

  const standingsEnabled = !isUpcoming;

  const { data: statsReportsIndex, loading: statsReportsLoading } = useTournamentStatsReportsIndex(tournament.slug, standingsEnabled);
  const reports = statsReportsIndex?.reports ?? null;
  const defaultReportKey = statsReportsIndex?.default_report_key ?? "combined";

  const [reportKey, setReportKey] = useState<string>("combined");
  const [reportKeyTouched, setReportKeyTouched] = useState<boolean>(false);

  useEffect(() => {
    setReportKey("combined");
    setReportKeyTouched(false);
  }, [tournament.slug]);

  useEffect(() => {
    if (!standingsEnabled) return;
    if (!reports || reports.length === 0) return;

    const available = new Set(reports.map((r) => r.key));
    const preferredDefault = available.has(defaultReportKey) ? defaultReportKey : reports[0].key;

    let next = reportKey;
    if (!reportKeyTouched) next = preferredDefault;
    if (!available.has(next)) next = preferredDefault;

    if (next !== reportKey) setReportKey(next);
  }, [defaultReportKey, reportKey, reportKeyTouched, reports, standingsEnabled]);

  const selectedReport = useMemo(() => {
    if (!reports) return null;
    return reports.find((r) => r.key === reportKey) ?? null;
  }, [reportKey, reports]);

  const manifestPath = selectedReport?.manifest_path ?? "manifest.json";
  const reportBaseDir = useMemo(() => statsBaseDirFromManifestPath(manifestPath), [manifestPath]);

  const { data: statsManifest, loading: statsManifestLoading } = useTournamentStatsManifest(tournament.slug, standingsEnabled, manifestPath);

  type ResultsViewId = "standings" | "scoreboard";
  const [resultsView, setResultsView] = useState<ResultsViewId>("standings");
  useEffect(() => {
    setResultsView("standings");
  }, [reportKey, tournament.slug]);

  const scoreboardDatasets = statsManifest?.datasets ?? null;
  const scoreboardAvailable =
    standingsEnabled &&
    !!scoreboardDatasets?.games &&
    !!scoreboardDatasets?.game_teams &&
    !!scoreboardDatasets?.game_players &&
    !!scoreboardDatasets?.rounds;
  const scoreboardEnabled = scoreboardAvailable && resultsView === "scoreboard";

  useEffect(() => {
    if (resultsView !== "scoreboard") return;
    if (scoreboardAvailable) return;
    setResultsView("standings");
  }, [resultsView, scoreboardAvailable]);

  const gamesPath = scoreboardDatasets?.games ? joinStatsPath(reportBaseDir, scoreboardDatasets.games) : null;
  const gameTeamsPath = scoreboardDatasets?.game_teams ? joinStatsPath(reportBaseDir, scoreboardDatasets.game_teams) : null;
  const gamePlayersPath = scoreboardDatasets?.game_players ? joinStatsPath(reportBaseDir, scoreboardDatasets.game_players) : null;
  const roundsPath = scoreboardDatasets?.rounds ? joinStatsPath(reportBaseDir, scoreboardDatasets.rounds) : null;

  const { rows: gameRows, loading: gamesLoading, error: gamesError } = useTournamentStatsCsv(tournament.slug, scoreboardEnabled, gamesPath);
  const { rows: gameTeamRows, loading: gameTeamsLoading, error: gameTeamsError } = useTournamentStatsCsv(tournament.slug, scoreboardEnabled, gameTeamsPath);
  const { rows: gamePlayerRows, loading: gamePlayersLoading, error: gamePlayersError } = useTournamentStatsCsv(tournament.slug, scoreboardEnabled, gamePlayersPath);
  const { rows: roundRows, loading: roundsLoading, error: roundsError } = useTournamentStatsCsv(tournament.slug, scoreboardEnabled, roundsPath);

  const scoreboardLoading = gamesLoading || gameTeamsLoading || gamePlayersLoading || roundsLoading;
  const scoreboardError = gamesError || gameTeamsError || gamePlayersError || roundsError;

  const [scoreboardRound, setScoreboardRound] = useState<string>("all");
  useEffect(() => {
    setScoreboardRound("all");
  }, [reportKey, resultsView, tournament.slug]);
  const overallFiles = useMemo(() => {
    if (!statsManifest) return null;
    return {
      team: joinStatsPath(reportBaseDir, statsManifest.views.team_standings),
      individual: joinStatsPath(reportBaseDir, statsManifest.views.individual_standings),
    };
  }, [reportBaseDir, statsManifest]);

  const overallEnabled = standingsEnabled && !!overallFiles;
  const { data: overallStandings, loading: overallLoading, error: overallError } = useTournamentStandings(tournament.slug, overallEnabled, overallFiles);
  const hasStandings = (overallStandings?.team_standings?.length ?? 0) > 0;

  const categories = useMemo(() => {
    const entries = statsManifest?.views?.category_standings ?? [];
    return entries.map((e) => ({
      key: e.key,
      label: e.category?.trim() ? e.category : "Uncategorized",
      files: {
        team: joinStatsPath(reportBaseDir, e.team_standings),
        individual: joinStatsPath(reportBaseDir, e.individual_standings),
      },
    }));
  }, [reportBaseDir, statsManifest]);

  const [standingsCategoryKey, setStandingsCategoryKey] = useState<string>("overall");
  useEffect(() => {
    setStandingsCategoryKey("overall");
  }, [reportKey, tournament.slug]);

  const activeCategory = useMemo(() => {
    if (standingsCategoryKey === "overall") return null;
    return categories.find((c) => c.key === standingsCategoryKey) ?? null;
  }, [categories, standingsCategoryKey]);

  useEffect(() => {
    if (standingsCategoryKey === "overall") return;
    if (activeCategory) return;
    setStandingsCategoryKey("overall");
  }, [activeCategory, standingsCategoryKey]);

  const categoryEnabled = standingsEnabled && standingsCategoryKey !== "overall" && !!activeCategory;
  const { data: categoryStandings, loading: categoryLoading, error: categoryError } = useTournamentStandings(
    tournament.slug,
    categoryEnabled,
    activeCategory?.files ?? null,
  );

  const standings = standingsCategoryKey === "overall" ? overallStandings : categoryStandings;
  const standingsLoading = standingsCategoryKey === "overall" ? overallLoading : categoryLoading;
  const standingsError = standingsCategoryKey === "overall" ? overallError : categoryError;
  const showWinsLosses = standingsCategoryKey === "overall";
  const standingsLabel = standingsCategoryKey === "overall" ? "Overall" : humanizeCategoryLabel(activeCategory?.label ?? "");

  const { slugs: rosterIndexSlugs, loading: rosterIndexLoading } = useRosterIndex();
  const hasField = rosterIndexSlugs?.has(tournament.slug) ?? false;
  const fieldDisabled = rosterIndexLoading || !hasField;

  const tabs: Tab[] = useMemo(() => {
    if (isUpcoming) {
      return [
        { id: "overview", label: "Overview", disabled: false },
        { id: "field", label: "Field", disabled: fieldDisabled },
        { id: "results", label: "Standings", disabled: true },
        { id: "statistics", label: "Buzzpoints", disabled: true },
      ];
    }

    if (isLive) {
      return [
        { id: "overview", label: "Overview", disabled: false },
        { id: "field", label: "Field", disabled: fieldDisabled },
        { id: "results", label: "Standings", disabled: false },
        { id: "statistics", label: "Buzzpoints", disabled: !statsLink },
      ];
    }

    return [
      { id: "overview", label: "Overview", disabled: false },
      { id: "field", label: "Field", disabled: fieldDisabled },
      { id: "results", label: "Standings", disabled: !resultsLink && !hasStandings && !statsManifestLoading && !statsReportsLoading },
      { id: "statistics", label: "Buzzpoints", disabled: !statsLink },
    ];
  }, [fieldDisabled, hasStandings, isLive, isUpcoming, resultsLink, statsLink, statsManifestLoading, statsReportsLoading]);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const tabNavRef = useRef<HTMLDivElement | null>(null);
  const standingsSubNavRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const active = tabs.find((tab) => tab.id === activeTab);
    if (active && !active.disabled) return;
    const firstEnabled = tabs.find((tab) => !tab.disabled);
    if (firstEnabled) setActiveTab(firstEnabled.id);
  }, [activeTab, tabs]);

  useEffect(() => {
    const nav = tabNavRef.current;
    if (!nav) return;

    const activeButton = nav.querySelector<HTMLElement>(`#tab-${activeTab}`);
    if (!activeButton) return;

    const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    scrollChildIntoViewX(nav, activeButton, reducedMotion ? "auto" : "smooth");
  }, [activeTab, tabs]);

  const logisticsBullets = tournament.notes?.logistics ? splitLogistics(tournament.notes.logistics) : [];
  const formatSummary = tournament.format.summary;

  const deadlines = isUpcoming ? (tournament.registration?.deadlines ?? []) : [];

  const showStandingsSubnav = activeTab === "results" && resultsView === "standings" && categories.length > 0;

  useEffect(() => {
    if (!showStandingsSubnav) return;
    const nav = standingsSubNavRef.current;
    if (!nav) return;

    const activeButton = nav.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!activeButton) return;

    const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    scrollChildIntoViewX(nav, activeButton, reducedMotion ? "auto" : "smooth");
  }, [showStandingsSubnav, standingsCategoryKey]);

  return (
    <div className="card sbTabsCard" aria-label="Tournament details">
      <div ref={tabNavRef} className="sbTabNav" role="tablist" aria-label="Tournament sections">
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

      {showStandingsSubnav && (
        <div ref={standingsSubNavRef} className="sbTabSubNav" role="navigation" aria-label="Standings views">
          <button
            type="button"
            className={standingsCategoryKey === "overall" ? "sbTabSubButton sbTabSubButtonActive" : "sbTabSubButton"}
            aria-pressed={standingsCategoryKey === "overall"}
            onClick={() => setStandingsCategoryKey("overall")}
          >
            Overall
          </button>
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              className={standingsCategoryKey === c.key ? "sbTabSubButton sbTabSubButtonActive" : "sbTabSubButton"}
              aria-pressed={standingsCategoryKey === c.key}
              onClick={() => setStandingsCategoryKey(c.key)}
            >
              {humanizeCategoryLabel(c.label)}
            </button>
          ))}
        </div>
      )}

      <div className="sbTabsBody sbTabStack">
        {activeTab === "overview" && (
          <div role="tabpanel" id="tab-panel-overview" aria-labelledby="tab-overview">
            <OverviewSection title="Logistics">
              {logisticsBullets.length > 0 ? (
                <ul className="sbBulletList m-0 gap-0" aria-label="Logistics notes">
                  {logisticsBullets.map((bullet, idx) => (
                    <li key={`${idx}-${bullet}`}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="sbMuted m-0">No logistics details available.</p>
              )}
            </OverviewSection>

            <OverviewSection title="Format">
              <div className="space-y-2">
                <p className="sbBody m-0">{formatSummary}</p>
              </div>
            </OverviewSection>

            {isUpcoming && tournament.registration && (
              <OverviewSection title="Registration">
                <div className="space-y-3">
                  {tournament.registration.cost && (
                    <p className="sbBody m-0">
                      <span className="sbLabelInline">Cost:</span> {tournament.registration.cost}
                    </p>
                  )}
                  <p className="sbBody sbPreLine m-0">{tournament.registration.instructions}</p>
                </div>
              </OverviewSection>
            )}

            {isUpcoming && deadlines.length > 0 && (
              <OverviewSection title="Deadlines">
                <div className="sbInlineRows" aria-label="Registration deadlines">
                  {deadlines.map((deadline) => (
                    <div key={`${deadline.label}-${deadline.date}`} className="sbInlineRow">
                      <span className="sbInlineRowLabel">{deadline.label}</span>
                      <span className="sbInlineRowValue">{formatTournamentDate(deadline.date) || deadline.date}</span>
                    </div>
                  ))}
                </div>
              </OverviewSection>
            )}

            {tournament.contacts && tournament.contacts.length > 0 && <ContactTab contacts={tournament.contacts} />}

            {isFinished && packetsLink && (
              <OverviewSection title="Question Packets">
                <p className="sbBody m-0">
                  <a href={packetsLink.url} target="_blank" rel="noreferrer" className="sbInlineLink">
                    View packets <span aria-hidden="true">{"\u2197"}</span>
                  </a>
                </p>
              </OverviewSection>
            )}
          </div>
        )}

        {activeTab === "results" && (
          <div role="tabpanel" id="tab-panel-results" aria-labelledby="tab-results">
            <section className="sbTabSection">
              <div className="sbTabSectionBody">
                {!isUpcoming && (scoreboardAvailable || (reports && reports.length > 1)) && (
                  <div className="sbListingControls" style={{ marginBottom: "12px" }}>
                    {reports && reports.length > 1 && (
                      <div className="sbField" style={{ flex: "0 1 260px", minWidth: "200px" }}>
                        <label className="sbFieldLabel" htmlFor="standings-report">
                          Report
                        </label>
                        <select
                          id="standings-report"
                          className="sbSelect"
                          value={reportKey}
                          onChange={(e) => {
                            setReportKey(e.target.value);
                            setReportKeyTouched(true);
                          }}
                        >
                          {reports.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {scoreboardAvailable && (
                      <div className="sbField" style={{ flex: "0 1 220px", minWidth: "200px" }}>
                        <label className="sbFieldLabel" htmlFor="standings-view">
                          View
                        </label>
                        <select
                          id="standings-view"
                          className="sbSelect"
                          value={resultsView}
                          onChange={(e) => setResultsView(e.target.value as ResultsViewId)}
                        >
                          <option value="standings">Standings</option>
                          <option value="scoreboard">Scoreboard</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
                {isUpcoming ? (
                  <p className="sbMuted">Standings will be available after the tournament.</p>
                ) : resultsView === "scoreboard" ? (
                  !scoreboardAvailable ? (
                    <p className="sbMuted">Scoreboard is not available for this tournament.</p>
                  ) : scoreboardError ? (
                    <p className="sbMuted">Failed to load scoreboard: {scoreboardError}</p>
                  ) : scoreboardLoading || statsManifestLoading || statsReportsLoading ? (
                    <p className="sbMuted">Loading scoreboard…</p>
                  ) : gameRows && gameTeamRows && gamePlayerRows && roundRows ? (
                    <ScoreboardView
                      games={gameRows}
                      gameTeams={gameTeamRows}
                      gamePlayers={gamePlayerRows}
                      rounds={roundRows}
                      roundValue={scoreboardRound}
                      onRoundChange={setScoreboardRound}
                    />
                  ) : (
                    <p className="sbMuted">Scoreboard data files were not found.</p>
                  )
                ) : standingsError ? (
                  <p className="sbMuted">Failed to load standings: {standingsError}</p>
                ) : standingsLoading || statsManifestLoading || statsReportsLoading ? (
                  <p className="sbMuted">Loading standings…</p>
                ) : hasStandings && standings ? (
                  <div className="sbTabStack">
                    <div>
                      <h3 className="m-0 text-sm font-semibold">Team Standings ({standingsLabel})</h3>
                      <div className="sbTopSpace">
                        <TeamStandingsTable rows={standings.team_standings} showWinsLosses={showWinsLosses} />
                      </div>
                    </div>
                    <div>
                      <h3 className="m-0 text-sm font-semibold">Individual Standings ({standingsLabel})</h3>
                      <div className="sbTopSpace">
                        <IndividualStandingsTable rows={standings.individual_standings} />
                      </div>
                    </div>
                  </div>
                ) : resultsLink ? (
                  <GoogleSheetEmbed url={resultsLink.url} />
                ) : isLive ? (
                  <p className="sbMuted">Standings are not available yet.</p>
                ) : (
                  <p className="sbMuted">Standings are not available.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "field" && (
          <div role="tabpanel" id="tab-panel-field" aria-labelledby="tab-field">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Field</h2>
              </header>
              <div className="sbTabSectionBody">
                <FieldTab slug={tournament.slug} />
              </div>
            </section>
          </div>
        )}

        {activeTab === "statistics" && (
          <div role="tabpanel" id="tab-panel-statistics" aria-labelledby="tab-statistics">
            <section className="sbTabSection">
              <header className="sbSectionHeader">
                <h2 className="sbSectionTitle">Buzzpoints</h2>
              </header>
              <div className="sbTabSectionBody">
                {isUpcoming ? (
                  <p className="sbMuted">Buzzpoints will be available after the tournament.</p>
                ) : statsLink ? (
                  <GoogleSheetEmbed url={statsLink.url} />
                ) : (
                  <p className="sbMuted">Buzzpoints are not available.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
