import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
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
import { RoundReportView } from "./RoundReportView";
import { TeamDetailView } from "./TeamDetailView";
import { PlayerDetailView } from "./PlayerDetailView";

type TournamentTabsProps = {
  tournament: TournamentDetail;
  variant: TournamentStatus;
};

type TabId = "overview" | "field" | "results" | "games" | "rounds" | "statistics";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlInitSlugRef = useRef<string | null>(null);
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
  const hasCombinedReport = useMemo(() => (reports ?? []).some((r) => r.key === "combined"), [reports]);

  const [reportKey, setReportKey] = useState<string>("combined");
  const [reportKeyTouched, setReportKeyTouched] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const tabNavRef = useRef<HTMLDivElement | null>(null);
  const statsReportsSubNavRef = useRef<HTMLDivElement | null>(null);
  const standingsModeSubNavRef = useRef<HTMLDivElement | null>(null);
  const standingsSubNavRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!standingsEnabled) return;
    if (!reports || reports.length === 0) return;

    if (hasCombinedReport) {
      if (reportKey !== "combined") setReportKey("combined");
      if (reportKeyTouched) setReportKeyTouched(false);
      return;
    }

    const available = new Set(reports.map((r) => r.key));
    const preferredDefault = available.has(defaultReportKey) ? defaultReportKey : reports[0].key;

    let next = reportKey;
    if (!reportKeyTouched) next = preferredDefault;
    if (!available.has(next)) next = preferredDefault;

    if (next !== reportKey) setReportKey(next);
  }, [defaultReportKey, hasCombinedReport, reportKey, reportKeyTouched, reports, standingsEnabled]);

  const selectedReport = useMemo(() => {
    if (!reports) return null;
    return reports.find((r) => r.key === reportKey) ?? null;
  }, [reportKey, reports]);

  const manifestPath = selectedReport?.manifest_path ?? "manifest.json";
  const reportBaseDir = useMemo(() => statsBaseDirFromManifestPath(manifestPath), [manifestPath]);

  const { data: statsManifest, loading: statsManifestLoading } = useTournamentStatsManifest(tournament.slug, standingsEnabled, manifestPath);

  type StandingsViewId = "standings" | "team" | "player";
  const [standingsView, setStandingsView] = useState<StandingsViewId>("standings");

  const scoreboardDatasets = statsManifest?.datasets ?? null;
  const scoreboardAvailable =
    standingsEnabled &&
    !!scoreboardDatasets?.games &&
    !!scoreboardDatasets?.game_teams &&
    !!scoreboardDatasets?.game_players &&
    !!scoreboardDatasets?.rounds;
  const gameDataEnabled =
    scoreboardAvailable &&
    (activeTab === "games" || activeTab === "rounds" || (activeTab === "results" && (standingsView === "team" || standingsView === "player")));

  useEffect(() => {
    if (statsManifestLoading) return;
    if (scoreboardAvailable) return;
    if (standingsView !== "standings") setStandingsView("standings");
  }, [scoreboardAvailable, standingsView, statsManifestLoading]);

  const gamesPath = scoreboardDatasets?.games ? joinStatsPath(reportBaseDir, scoreboardDatasets.games) : null;
  const gameTeamsPath = scoreboardDatasets?.game_teams ? joinStatsPath(reportBaseDir, scoreboardDatasets.game_teams) : null;
  const gamePlayersPath = scoreboardDatasets?.game_players ? joinStatsPath(reportBaseDir, scoreboardDatasets.game_players) : null;
  const roundsPath = scoreboardDatasets?.rounds ? joinStatsPath(reportBaseDir, scoreboardDatasets.rounds) : null;

  const { rows: gameRows, loading: gamesLoading, error: gamesError } = useTournamentStatsCsv(tournament.slug, gameDataEnabled, gamesPath);
  const { rows: gameTeamRows, loading: gameTeamsLoading, error: gameTeamsError } = useTournamentStatsCsv(tournament.slug, gameDataEnabled, gameTeamsPath);
  const { rows: gamePlayerRows, loading: gamePlayersLoading, error: gamePlayersError } = useTournamentStatsCsv(tournament.slug, gameDataEnabled, gamePlayersPath);
  const { rows: roundRows, loading: roundsLoading, error: roundsError } = useTournamentStatsCsv(tournament.slug, gameDataEnabled, roundsPath);

  const gameDataLoading = gamesLoading || gameTeamsLoading || gamePlayersLoading || roundsLoading;
  const gameDataError = gamesError || gameTeamsError || gamePlayersError || roundsError;

  const [roundValue, setRoundValue] = useState<string>("all");

  const [teamValue, setTeamValue] = useState<string>("");

  const [playerValue, setPlayerValue] = useState<string>("");

  const availableTeamValues = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of gameTeamRows ?? []) {
      const raw = row.team_id;
      const teamId = raw ? Number.parseInt(raw, 10) : NaN;
      if (!Number.isFinite(teamId)) continue;
      map.set(teamId, row.team_name ?? `Team ${teamId}`);
    }
    const out = Array.from(map.entries()).map(([id, label]) => ({ value: String(id), label }));
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [gameTeamRows]);

  useEffect(() => {
    if (activeTab !== "results") return;
    if (standingsView !== "team") return;
    if (availableTeamValues.length === 0) return;
    if (availableTeamValues.some((t) => t.value === teamValue)) return;
    setTeamValue(availableTeamValues[0].value);
  }, [activeTab, availableTeamValues, standingsView, teamValue]);

  const availablePlayerValues = useMemo(() => {
    const map = new Map<number, { player_name: string; team_name: string }>();
    for (const row of gamePlayerRows ?? []) {
      const raw = row.player_id;
      const playerId = raw ? Number.parseInt(raw, 10) : NaN;
      if (!Number.isFinite(playerId)) continue;
      if (map.has(playerId)) continue;
      map.set(playerId, { player_name: row.player_name ?? `Player ${playerId}`, team_name: row.team_name ?? "" });
    }
    const out = Array.from(map.entries()).map(([id, meta]) => ({
      value: String(id),
      label: meta.team_name ? `${meta.player_name} (${meta.team_name})` : meta.player_name,
      player_name: meta.player_name,
      team_name: meta.team_name,
    }));
    out.sort((a, b) => a.player_name.localeCompare(b.player_name) || a.team_name.localeCompare(b.team_name));
    return out;
  }, [gamePlayerRows]);

  useEffect(() => {
    if (activeTab !== "results") return;
    if (standingsView !== "player") return;
    if (availablePlayerValues.length === 0) return;
    if (availablePlayerValues.some((p) => p.value === playerValue)) return;
    setPlayerValue(availablePlayerValues[0].value);
  }, [activeTab, availablePlayerValues, playerValue, standingsView]);
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

  const categoryFactsAvailable = standingsEnabled && !!scoreboardDatasets?.game_teams_by_category && !!scoreboardDatasets?.game_players_by_category;
  const categoryFactsEnabled =
    categoryFactsAvailable &&
    activeTab === "results" &&
    (standingsView === "team" || standingsView === "player") &&
    standingsCategoryKey !== "overall" &&
    !!activeCategory;
  const gameTeamsByCategoryPath = scoreboardDatasets?.game_teams_by_category ? joinStatsPath(reportBaseDir, scoreboardDatasets.game_teams_by_category) : null;
  const gamePlayersByCategoryPath = scoreboardDatasets?.game_players_by_category ? joinStatsPath(reportBaseDir, scoreboardDatasets.game_players_by_category) : null;
  const { rows: gameTeamByCategoryRows, loading: gameTeamsByCategoryLoading, error: gameTeamsByCategoryError } = useTournamentStatsCsv(
    tournament.slug,
    categoryFactsEnabled,
    gameTeamsByCategoryPath,
  );
  const { rows: gamePlayerByCategoryRows, loading: gamePlayersByCategoryLoading, error: gamePlayersByCategoryError } = useTournamentStatsCsv(
    tournament.slug,
    categoryFactsEnabled,
    gamePlayersByCategoryPath,
  );

  const { slugs: rosterIndexSlugs, loading: rosterIndexLoading } = useRosterIndex();
  const hasField = rosterIndexSlugs?.has(tournament.slug) ?? false;
  const fieldDisabled = rosterIndexLoading || !hasField;

  const tabs: Tab[] = useMemo(() => {
    if (isUpcoming) {
      return [
        { id: "overview", label: "Overview", disabled: false },
        { id: "field", label: "Field", disabled: fieldDisabled },
        { id: "results", label: "Results", disabled: true },
        { id: "games", label: "Games", disabled: true },
        { id: "rounds", label: "Rounds", disabled: true },
        { id: "statistics", label: "Buzzpoints", disabled: true },
      ];
    }

    if (isLive) {
      return [
        { id: "overview", label: "Overview", disabled: false },
        { id: "field", label: "Field", disabled: fieldDisabled },
        { id: "results", label: "Results", disabled: false },
        { id: "games", label: "Games", disabled: false },
        { id: "rounds", label: "Rounds", disabled: false },
        { id: "statistics", label: "Buzzpoints", disabled: !statsLink },
      ];
    }

    return [
      { id: "overview", label: "Overview", disabled: false },
      { id: "field", label: "Field", disabled: fieldDisabled },
      { id: "results", label: "Results", disabled: false },
      { id: "games", label: "Games", disabled: false },
      { id: "rounds", label: "Rounds", disabled: false },
      { id: "statistics", label: "Buzzpoints", disabled: !statsLink },
    ];
  }, [fieldDisabled, isLive, isUpcoming, statsLink]);

  useEffect(() => {
    urlInitSlugRef.current = null;
  }, [tournament.slug]);

  useLayoutEffect(() => {
    if (urlInitSlugRef.current === tournament.slug) return;

    const tabParam = searchParams.get("tab");
    const reportParam = searchParams.get("statsReport");
    const viewParam = searchParams.get("statsView");
    const catParam = searchParams.get("statsCat");
    const roundParam = searchParams.get("statsRound");
    const teamParam = searchParams.get("statsTeam");
    const playerParam = searchParams.get("statsPlayer");

    const hasAnyStatsParams = !!(reportParam || viewParam || catParam || roundParam || teamParam || playerParam);

    const inferredTabFromStats: TabId | null =
      viewParam === "round_report"
        ? "rounds"
        : viewParam === "scoreboard" || roundParam
          ? "games"
          : viewParam === "team" || viewParam === "player" || teamParam || playerParam || catParam
            ? "results"
            : null;

    if (tabParam === "overview" || tabParam === "field" || tabParam === "statistics") {
      setActiveTab(tabParam);
    } else if (tabParam === "results" || tabParam === "games" || tabParam === "rounds") {
      setActiveTab(inferredTabFromStats ?? tabParam);
    } else if (hasAnyStatsParams) {
      setActiveTab(inferredTabFromStats ?? "results");
    } else {
      setActiveTab("overview");
    }

    if (reportParam) {
      setReportKey(reportParam);
      setReportKeyTouched(true);
    } else {
      setReportKey("combined");
      setReportKeyTouched(false);
    }

    if (viewParam === "team" || teamParam) setStandingsView("team");
    else if (viewParam === "player" || playerParam) setStandingsView("player");
    else setStandingsView("standings");

    setStandingsCategoryKey(catParam ?? "overall");
    setRoundValue(roundParam ?? "all");
    setTeamValue(teamParam ?? "");
    setPlayerValue(playerParam ?? "");

    urlInitSlugRef.current = tournament.slug;
  }, [searchParams, tournament.slug]);

  useEffect(() => {
    if (urlInitSlugRef.current !== tournament.slug) return;

    const next = new URLSearchParams(searchParams);

    if (hasCombinedReport) {
      next.delete("statsReport");
    } else {
      const defaultForUrl = statsReportsIndex?.default_report_key ?? reports?.[0]?.key ?? "combined";
      if (reportKey && reportKey !== defaultForUrl) next.set("statsReport", reportKey);
      else next.delete("statsReport");
    }

    if (activeTab === "results") {
      if (standingsView !== "standings") next.set("statsView", standingsView);
      else next.delete("statsView");
    } else {
      next.delete("statsView");
    }

    if (standingsCategoryKey !== "overall") next.set("statsCat", standingsCategoryKey);
    else next.delete("statsCat");

    if (activeTab === "games" || activeTab === "rounds") {
      if (roundValue && roundValue !== "all") next.set("statsRound", roundValue);
      else next.delete("statsRound");
    } else {
      next.delete("statsRound");
    }

    if (standingsView === "team") {
      if (teamValue) next.set("statsTeam", teamValue);
      else next.delete("statsTeam");
    } else {
      next.delete("statsTeam");
    }

    if (standingsView === "player") {
      if (playerValue) next.set("statsPlayer", playerValue);
      else next.delete("statsPlayer");
    } else {
      next.delete("statsPlayer");
    }

    const hasAnyStatsParams = !!(
      next.get("statsReport") ||
      next.get("statsView") ||
      next.get("statsCat") ||
      next.get("statsRound") ||
      next.get("statsTeam") ||
      next.get("statsPlayer")
    );

    if (activeTab !== "overview") next.set("tab", activeTab);
    else if (hasAnyStatsParams) next.delete("tab");
    else next.delete("tab");

    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [
    activeTab,
    hasCombinedReport,
    playerValue,
    reportKey,
    roundValue,
    reports,
    searchParams,
    setSearchParams,
    statsReportsIndex,
    standingsCategoryKey,
    standingsView,
    teamValue,
    tournament.slug,
  ]);

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

  const showStatsReportsSubnav =
    standingsEnabled && !hasCombinedReport && (activeTab === "results" || activeTab === "games" || activeTab === "rounds") && (reports?.length ?? 0) > 1;
  const showStandingsModeSubnav = activeTab === "results" && standingsEnabled;
  const showStandingsSubnav = activeTab === "results" && categories.length > 0;

  useEffect(() => {
    if (!showStatsReportsSubnav) return;
    const nav = statsReportsSubNavRef.current;
    if (!nav) return;

    const activeButton = nav.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!activeButton) return;

    const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    scrollChildIntoViewX(nav, activeButton, reducedMotion ? "auto" : "smooth");
  }, [reportKey, showStatsReportsSubnav]);

  useEffect(() => {
    if (!showStandingsModeSubnav) return;
    const nav = standingsModeSubNavRef.current;
    if (!nav) return;

    const activeButton = nav.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!activeButton) return;

    const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    scrollChildIntoViewX(nav, activeButton, reducedMotion ? "auto" : "smooth");
  }, [showStandingsModeSubnav, standingsView]);

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

      {showStatsReportsSubnav && reports && (
        <div ref={statsReportsSubNavRef} className="sbTabSubNav" role="navigation" aria-label="Stats reports">
          {reports.map((r) => (
            <button
              key={r.key}
              type="button"
              className={reportKey === r.key ? "sbTabSubButton sbTabSubButtonActive" : "sbTabSubButton"}
              aria-pressed={reportKey === r.key}
              onClick={() => {
                setReportKey(r.key);
                setReportKeyTouched(true);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {showStandingsModeSubnav && (
        <div ref={standingsModeSubNavRef} className="sbTabSubNav" role="navigation" aria-label="Standings views">
          <button
            type="button"
            className={standingsView === "standings" ? "sbTabSubButton sbTabSubButtonActive" : "sbTabSubButton"}
            aria-pressed={standingsView === "standings"}
            onClick={() => setStandingsView("standings")}
          >
            Standings
          </button>
          <button
            type="button"
            className={standingsView === "team" ? "sbTabSubButton sbTabSubButtonActive" : "sbTabSubButton"}
            aria-pressed={standingsView === "team"}
            disabled={!scoreboardAvailable && !statsManifestLoading}
            aria-disabled={!scoreboardAvailable && !statsManifestLoading}
            onClick={() => setStandingsView("team")}
          >
            Team Detail
          </button>
          <button
            type="button"
            className={standingsView === "player" ? "sbTabSubButton sbTabSubButtonActive" : "sbTabSubButton"}
            aria-pressed={standingsView === "player"}
            disabled={!scoreboardAvailable && !statsManifestLoading}
            aria-disabled={!scoreboardAvailable && !statsManifestLoading}
            onClick={() => setStandingsView("player")}
          >
            Player Detail
          </button>
        </div>
      )}

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
                {isUpcoming ? (
                  <p className="sbMuted">Standings will be available after the tournament.</p>
                ) : (
                  <div className="sbTabStack">
                    {standingsView === "team" ? (
                      !scoreboardAvailable && !statsManifestLoading ? (
                        <p className="sbMuted">Team view is not available for this tournament.</p>
                      ) : gameDataError ? (
                        <p className="sbMuted">Failed to load team view: {gameDataError}</p>
                      ) : standingsCategoryKey !== "overall" && (gameTeamsByCategoryError || gamePlayersByCategoryError) ? (
                        <p className="sbMuted">Failed to load category facts: {gameTeamsByCategoryError || gamePlayersByCategoryError}</p>
                      ) : gameDataLoading ||
                        statsManifestLoading ||
                        statsReportsLoading ||
                        (standingsCategoryKey !== "overall" && (gameTeamsByCategoryLoading || gamePlayersByCategoryLoading)) ? (
                        <p className="sbMuted">Loading team view…</p>
                      ) : gameRows && gameTeamRows && gamePlayerRows && roundRows ? (
                        standingsCategoryKey !== "overall" && (!gameTeamByCategoryRows || !gamePlayerByCategoryRows) ? (
                          <p className="sbMuted">Category facts were not found for this report.</p>
                        ) : (
                          <TeamDetailView
                            games={gameRows}
                            gameTeams={gameTeamRows}
                            gamePlayers={gamePlayerRows}
                            rounds={roundRows}
                            teamValue={teamValue}
                            onTeamChange={setTeamValue}
                            onPlayerSelect={(playerId) => {
                              setPlayerValue(String(playerId));
                              setStandingsView("player");
                            }}
                            categoryKey={standingsCategoryKey === "overall" ? null : activeCategory?.label ?? standingsCategoryKey.toUpperCase()}
                            categoryLabel={
                              standingsCategoryKey === "overall"
                                ? null
                                : humanizeCategoryLabel((activeCategory?.label ?? standingsCategoryKey).trim())
                            }
                            gameTeamsByCategory={standingsCategoryKey === "overall" ? null : gameTeamByCategoryRows}
                            gamePlayersByCategory={standingsCategoryKey === "overall" ? null : gamePlayerByCategoryRows}
                          />
                        )
                      ) : (
                        <p className="sbMuted">Team view data files were not found.</p>
                      )
                    ) : standingsView === "player" ? (
                      !scoreboardAvailable && !statsManifestLoading ? (
                        <p className="sbMuted">Player view is not available for this tournament.</p>
                      ) : gameDataError ? (
                        <p className="sbMuted">Failed to load player view: {gameDataError}</p>
                      ) : standingsCategoryKey !== "overall" && (gameTeamsByCategoryError || gamePlayersByCategoryError) ? (
                        <p className="sbMuted">Failed to load category facts: {gameTeamsByCategoryError || gamePlayersByCategoryError}</p>
                      ) : gameDataLoading ||
                        statsManifestLoading ||
                        statsReportsLoading ||
                        (standingsCategoryKey !== "overall" && (gameTeamsByCategoryLoading || gamePlayersByCategoryLoading)) ? (
                        <p className="sbMuted">Loading player view…</p>
                      ) : gameRows && gameTeamRows && gamePlayerRows && roundRows ? (
                        standingsCategoryKey !== "overall" && !gamePlayerByCategoryRows ? (
                          <p className="sbMuted">Category facts were not found for this report.</p>
                        ) : (
                          <PlayerDetailView
                            games={gameRows}
                            gameTeams={gameTeamRows}
                            gamePlayers={gamePlayerRows}
                            rounds={roundRows}
                            playerValue={playerValue}
                            onPlayerChange={setPlayerValue}
                            onTeamSelect={(teamId) => {
                              setTeamValue(String(teamId));
                              setStandingsView("team");
                            }}
                            categoryKey={standingsCategoryKey === "overall" ? null : activeCategory?.label ?? standingsCategoryKey.toUpperCase()}
                            categoryLabel={
                              standingsCategoryKey === "overall"
                                ? null
                                : humanizeCategoryLabel((activeCategory?.label ?? standingsCategoryKey).trim())
                            }
                            gamePlayersByCategory={standingsCategoryKey === "overall" ? null : gamePlayerByCategoryRows}
                          />
                        )
                      ) : (
                        <p className="sbMuted">Player view data files were not found.</p>
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
                            <TeamStandingsTable
                              rows={standings.team_standings}
                              showWinsLosses={showWinsLosses}
                              onTeamSelect={
                                scoreboardAvailable
                                  ? (teamId) => {
                                      setTeamValue(String(teamId));
                                      setStandingsView("team");
                                    }
                                  : undefined
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <h3 className="m-0 text-sm font-semibold">Individual Standings ({standingsLabel})</h3>
                          <div className="sbTopSpace">
                            <IndividualStandingsTable
                              rows={standings.individual_standings}
                              onPlayerSelect={
                                scoreboardAvailable
                                  ? (playerId) => {
                                      setPlayerValue(String(playerId));
                                      setStandingsView("player");
                                    }
                                  : undefined
                              }
                            />
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
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "games" && (
          <div role="tabpanel" id="tab-panel-games" aria-labelledby="tab-games">
            <section className="sbTabSection">
              <div className="sbTabSectionBody" style={{ marginTop: 0 }}>
                {isUpcoming ? (
                  <p className="sbMuted">Games will be available after the tournament.</p>
                ) : (
                  <div className="sbTabStack">
                    {!scoreboardAvailable && !statsManifestLoading ? (
                      <p className="sbMuted">Games are not available for this tournament.</p>
                    ) : gameDataError ? (
                      <p className="sbMuted">Failed to load games: {gameDataError}</p>
                    ) : gameDataLoading || statsManifestLoading || statsReportsLoading ? (
                      <p className="sbMuted">Loading games…</p>
                    ) : gameRows && gameTeamRows && gamePlayerRows && roundRows ? (
                      <ScoreboardView
                        games={gameRows}
                        gameTeams={gameTeamRows}
                        gamePlayers={gamePlayerRows}
                        rounds={roundRows}
                        roundValue={roundValue}
                        onRoundChange={setRoundValue}
                      />
                    ) : (
                      <p className="sbMuted">Games data files were not found.</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "rounds" && (
          <div role="tabpanel" id="tab-panel-rounds" aria-labelledby="tab-rounds">
            <section className="sbTabSection">
              <div className="sbTabSectionBody" style={{ marginTop: 0 }}>
                {isUpcoming ? (
                  <p className="sbMuted">Rounds will be available after the tournament.</p>
                ) : (
                  <div className="sbTabStack">
                    {!scoreboardAvailable && !statsManifestLoading ? (
                      <p className="sbMuted">Rounds are not available for this tournament.</p>
                    ) : gameDataError ? (
                      <p className="sbMuted">Failed to load rounds: {gameDataError}</p>
                    ) : gameDataLoading || statsManifestLoading || statsReportsLoading ? (
                      <p className="sbMuted">Loading rounds…</p>
                    ) : gameRows && gameTeamRows && gamePlayerRows && roundRows ? (
                      <RoundReportView
                        games={gameRows}
                        gameTeams={gameTeamRows}
                        gamePlayers={gamePlayerRows}
                        rounds={roundRows}
                        roundValue={roundValue}
                        onRoundChange={setRoundValue}
                      />
                    ) : (
                      <p className="sbMuted">Rounds data files were not found.</p>
                    )}
                  </div>
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
