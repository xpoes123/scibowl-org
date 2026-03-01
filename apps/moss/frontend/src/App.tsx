import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { DndContext, PointerSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import katex from "katex";
import "katex/dist/katex.min.css";
import packetJson from "./assets/sample_packet.json";
import tournamentsJson from "./assets/tournaments.json";
import { splitRichParts, type RichTextPart } from "./text/renderPacketText";
import { getRemoteScoresheetId, postScoresheetEvent } from "./domain/scoresheetClient";
import {
  buildScoresheetEvent,
  encodeLocationForEvent,
  type ScoresheetEvent,
  type ScoresheetEventType,
} from "./domain/scoresheetEvents";
import {
  initialScoresheetState,
  reduceScoresheetEvents,
  type ScoresheetState,
} from "./domain/scoresheetReducer";
import {
  SCOREBOARD_CHANNEL_NAME,
  makeScoreboardClientId,
  safePostScoreboardMessage,
  type ScoreboardDisplayMessage,
} from "./scoreboard/scoreboardChannel";
import ScoreboardDisplaySettingsModal from "./scoreboard/ScoreboardDisplaySettingsModal";
import {
  loadScoreboardDisplayView,
  loadScoreboardRowAdvanceMode,
  saveScoreboardDisplayView,
  saveScoreboardRowAdvanceMode,
  type ScoreboardDisplayView,
  type ScoreboardRowAdvanceMode,
} from "./scoreboard/displaySettings";
import HoldToConfirmButton from "./ui/HoldToConfirmButton";
import useResizableRightColumn from "./ui/useResizableRightColumn";
import type {
  Attempt,
  AttemptLocation,
  AttemptResult,
  ScoresheetMarkerKind,
} from "./domain/scoresheetTypes";

type QuestionType = "TOSSUP" | "BONUS";
type QuestionStyle = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "IDENTIFY_ALL" | "RANK";

type DisplayMode = "scoreboard" | null;

function getDisplayModeFromLocation(): DisplayMode {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("display");
  return raw === "scoreboard" ? "scoreboard" : null;
}

const END_TOKEN = "END" as const;
const SCORESHEET_EXPORT_FORMAT = "moss_scoresheet" as const;
const SCORESHEET_EXPORT_VERSION = 3 as const;

const DISPLAY_CATEGORY: Record<string, string> = {
  BIOLOGY: "Biology",
  CHEMISTRY: "Chemistry",
  EARTH_SPACE: "Earth and Space",
  ENERGY: "Energy",
  MATH: "Math",
  PHYSICS: "Physics",
};

const DISPLAY_QUESTION_STYLE: Record<QuestionStyle, string> = {
  MULTIPLE_CHOICE: "Multiple Choice",
  SHORT_ANSWER: "Short Answer",
  IDENTIFY_ALL: "Short Answer",
  RANK: "Short Answer",
};

function renderRichParts(parts: RichTextPart[]): ReactNode {
  return parts.map((part, i) => {
    if (part.kind === "math") {
      const html = katex.renderToString(part.latex, { throwOnError: false, displayMode: false });
      return <span key={i} className="mathInline" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    if (part.kind === "bold") return <strong key={i}>{part.content}</strong>;
    return <span key={i}>{part.content}</span>;
  });
}

function isSameLocation(a: AttemptLocation, b: AttemptLocation): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "end") return true;
  if (a.kind === "question" && b.kind === "question") return a.wordIndex === b.wordIndex;
  if (a.kind === "option" && b.kind === "option") return a.optionIndex === b.optionIndex && a.wordIndex === b.wordIndex;
  return false;
}

function formatAttemptCellText(
  attemptValue: Attempt | undefined,
  questionType: QuestionType | undefined,
  playersById: Map<string, string>
): string {
  if (!attemptValue?.result) return "";
  const points = pointsForAttempt(attemptValue, questionType);
  const pointsLabel = points === undefined ? "" : points > 0 ? `+${points}` : String(points);
  if (questionType === "BONUS") return pointsLabel;
  const player = attemptValue.playerId ? playersById.get(attemptValue.playerId) : undefined;
  const who = player ? ` (${player})` : "";
  const tokenLabel = attemptValue.isEnd ? END_TOKEN : attemptValue.token;
  return `${pointsLabel} @ ${tokenLabel}${who}`;
}

function formatAttemptCellTextBrief(
  attemptValue: Attempt | undefined,
  questionType: QuestionType | undefined,
  playersById: Map<string, string>
): string {
  if (!attemptValue?.result) return "";
  const points = pointsForAttempt(attemptValue, questionType);
  const pointsLabel = points === undefined ? "" : points > 0 ? `+${points}` : String(points);
  if (questionType === "BONUS") return pointsLabel;
  const player = attemptValue.playerId ? playersById.get(attemptValue.playerId) : undefined;
  const who = player ? ` (${player})` : "";
  return `${pointsLabel}${who}`;
}

function teamIndexToDisplayLabel(teamIndex: number): string {
  let n = teamIndex;
  let letters = "";
  while (n >= 0) {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  }
  return `Team ${letters}`;
}

function useScoresheetStickyHeaderOffsets(headerKey: string): {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  wrapStyle: CSSProperties | undefined;
} {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [headerMetricsPx, setHeaderMetricsPx] = useState<{
    row1Height: number;
    row2Height: number;
    row3Height: number;
    row2Top: number;
    row3Top: number;
  } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const rows = Array.from(wrap.querySelectorAll("thead tr")).slice(0, 3) as HTMLElement[];
    const row1 = rows[0] ?? null;
    const row2 = rows[1] ?? null;
    const row3 = rows[2] ?? null;
    if (!row1 || !row2) return;

    const update = () => {
      const r1 = row1.getBoundingClientRect();
      const r2 = row2.getBoundingClientRect();
      const r3 = row3 ? row3.getBoundingClientRect() : null;

      const raw1Height = r1.height;
      const raw2Height = r2.height;
      const raw3Height = r3 ? r3.height : 0;

      const raw2Top = r2.top - r1.top;
      const raw3Top = r3 ? r3.top - r1.top : 0;

      const next1Height = Math.max(0, Math.round(raw1Height * 10) / 10);
      const next2Height = Math.max(0, Math.round(raw2Height * 10) / 10);
      const next3Height = Math.max(0, Math.round(raw3Height * 10) / 10);

      const next2Top = Math.max(0, Math.round(raw2Top * 100) / 100);
      const next3Top = Math.max(0, Math.round(raw3Top * 100) / 100);

      setHeaderMetricsPx((prev) => {
        if (!prev) {
          return {
            row1Height: next1Height,
            row2Height: next2Height,
            row3Height: next3Height,
            row2Top: next2Top,
            row3Top: next3Top,
          };
        }

        const same1 = Math.abs(prev.row1Height - next1Height) < 0.05;
        const same2 = Math.abs(prev.row2Height - next2Height) < 0.05;
        const same3 = Math.abs(prev.row3Height - next3Height) < 0.05;
        const same2Top = Math.abs(prev.row2Top - next2Top) < 0.05;
        const same3Top = Math.abs(prev.row3Top - next3Top) < 0.05;
        if (same1 && same2 && same3 && same2Top && same3Top) return prev;
        return {
          row1Height: same1 ? prev.row1Height : next1Height,
          row2Height: same2 ? prev.row2Height : next2Height,
          row3Height: same3 ? prev.row3Height : next3Height,
          row2Top: same2Top ? prev.row2Top : next2Top,
          row3Top: same3Top ? prev.row3Top : next3Top,
        };
      });
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(row1);
    ro.observe(row2);
    if (row3) ro.observe(row3);
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [headerKey]);

  const wrapStyle = useMemo(() => {
    if (!headerMetricsPx) return undefined;
    const headerTotalHeight =
      headerMetricsPx.row3Height > 0
        ? headerMetricsPx.row3Top + headerMetricsPx.row3Height
        : headerMetricsPx.row2Top + headerMetricsPx.row2Height;
    return {
      ["--scoresheetHeaderRow1Height" as string]: `${headerMetricsPx.row1Height}px`,
      ["--scoresheetHeaderRow2Height" as string]: `${headerMetricsPx.row2Height}px`,
      ["--scoresheetHeaderRow3Height" as string]: `${headerMetricsPx.row3Height}px`,
      ["--scoresheetHeaderRow2Top" as string]: `${headerMetricsPx.row2Top}px`,
      ["--scoresheetHeaderRow3Top" as string]: `${headerMetricsPx.row3Top}px`,
      ["--scoresheetHeaderTotalHeight" as string]: `${Math.max(0, Math.round(headerTotalHeight * 100) / 100)}px`,
    } as CSSProperties;
  }, [headerMetricsPx]);

  return { wrapRef, wrapStyle };
}

type ScoreboardSnapshotV1 = {
  format: "moss_scoreboard_snapshot";
  version: 1;
  session_id: string | null;
  packet: Packet;
  game: Game | null;
  scoresheet_base_state: ScoresheetState;
  scoresheet_events: ScoresheetEvent[];
  created_at_ms: number;
};

type ScoreboardDisplayMessageV1 = ScoreboardDisplayMessage<ScoreboardSnapshotV1>;

type Packet = {
  packet: string;
  year: number;
  questions: Question[];
};

type PacketChoice =
  | { kind: "sample"; label: string; subtext: string; packet: Packet }
  | { kind: "upload"; label: string; subtext: string; fileName: string; packet: Packet };

type MossTournament = {
  slug: string;
  name: string;
  timezone: string;
  dates: { start: string; end: string };
  status?: string;
};

type MossTournamentIndex = {
  format: "moss_tournaments";
  version: 1;
  tournaments: MossTournament[];
};

type FieldRosterTeam = {
  name: string;
  players: string[];
};

type FieldRoster = {
  format: "moss_field_roster";
  version: 1;
  tournament?: { slug?: string; name?: string };
  teams: FieldRosterTeam[];
};

type RosterIndex = {
  format: "moss_roster_index";
  version: 1;
  slugs: string[];
};

type ResolvedRosterTeam = {
  name: string;
  players: Array<{ name: string; isIn: boolean }>;
};

type CachedRoster = {
  format: "moss_cached_roster";
  version: 1;
  teams: ResolvedRosterTeam[];
};

type RosterChoice =
  | { kind: "custom"; label: string }
  | { kind: "previous"; label: string }
  | { kind: "upload"; label: string; fileName: string }
  | { kind: "tournament"; label: string; tournamentSlug: string };

type Question = {
  id: number;
  pair_id: number;
  question_type: QuestionType;
  question_style: QuestionStyle;
  category: string;
  question_text: string;
  options: string[];
  correct_answer: string | number[]; // matches your sample
  source?: string;
};

type PairRow = {
  pairId: number;
  tossup?: Question;
  bonus?: Question;
};

type Player = {
  id: string;
  name: string;
};

type DraftPlayer = Player & {
  isIn: boolean;
};

type LineupSegment = {
  startTossup: number;
  endTossup: number | null;
  activePlayerIds: string[];
};

type Team = {
  id: string;
  name: string;
  players: Player[];
  lineupSegments?: LineupSegment[];
};

type DraftTeam = Omit<Team, "players" | "lineupSegments"> & {
  players: DraftPlayer[];
};

type Game = {
  teams: Team[];
};

function GripSixDotsIcon({ size = 14 }: { size?: number }) {
  const r = Math.max(1, Math.round(size / 10));
  const gap = Math.max(3, Math.round(size / 3.5));
  const x1 = Math.round(size / 2 - gap / 2);
  const x2 = Math.round(size / 2 + gap / 2);
  const y1 = Math.round(size / 2 - gap);
  const y2 = Math.round(size / 2);
  const y3 = Math.round(size / 2 + gap);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <circle cx={x1} cy={y1} r={r} fill="currentColor" />
      <circle cx={x2} cy={y1} r={r} fill="currentColor" />
      <circle cx={x1} cy={y2} r={r} fill="currentColor" />
      <circle cx={x2} cy={y2} r={r} fill="currentColor" />
      <circle cx={x1} cy={y3} r={r} fill="currentColor" />
      <circle cx={x2} cy={y3} r={r} fill="currentColor" />
    </svg>
  );
}

function SortableDraftPlayerRow({
  teamId,
  player,
  playerIndex,
  canRemove,
  onUpdatePlayerName,
  onTogglePlayerIn,
  onRemovePlayer,
}: {
  teamId: string;
  player: DraftPlayer;
  playerIndex: number;
  canRemove: boolean;
  onUpdatePlayerName: (teamId: string, playerId: string, name: string) => void;
  onTogglePlayerIn: (teamId: string, playerId: string) => void;
  onRemovePlayer: (teamId: string, playerId: string) => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "playerRowWithToggle",
        "dndPlayerRow",
        canRemove ? "" : "noRemove",
        isDragging ? "dndDragging" : "",
      ].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="dndHandle dndHandlePlayer"
        ref={setActivatorNodeRef}
        aria-label="Drag to reorder player"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripSixDotsIcon size={14} />
      </button>

      <input
        className="textInput"
        value={player.name}
        onChange={(e) => onUpdatePlayerName(teamId, player.id, e.target.value)}
        placeholder={`Player ${playerIndex + 1}`}
      />

      <button
        type="button"
        role="switch"
        aria-checked={player.isIn}
        className={["inOutToggle", player.isIn ? "active" : "bench"].join(" ")}
        onClick={() => onTogglePlayerIn(teamId, player.id)}
        aria-label={`${player.isIn ? "Set Bench" : "Set Active"}: ${player.name || `Player ${playerIndex + 1}`}`}
      >
        {player.isIn ? "Active" : "Bench"}
      </button>

      {canRemove && (
        <button
          type="button"
          className="iconButton danger"
          aria-label="Remove player"
          onClick={() => onRemovePlayer(teamId, player.id)}
        >
          ×
        </button>
      )}
    </div>
  );
}

function SortableDraftTeamCol({
  team,
  teamIndex,
  canRemoveTeam,
  fieldRoster,
  selectedRosterTeamByDraftTeamId,
  onApplyRosterTeam,
  onUpdateTeamName,
  onRemoveTeam,
  onAddPlayer,
  onUpdatePlayerName,
  onTogglePlayerIn,
  onRemovePlayer,
  onReorderPlayers,
}: {
  team: DraftTeam;
  teamIndex: number;
  canRemoveTeam: boolean;
  fieldRoster: FieldRoster | null;
  selectedRosterTeamByDraftTeamId: Record<string, string>;
  onApplyRosterTeam: (draftTeamId: string, rosterTeamName: string) => void;
  onUpdateTeamName: (teamId: string, name: string) => void;
  onRemoveTeam: (teamId: string) => void;
  onAddPlayer: (teamId: string) => void;
  onUpdatePlayerName: (teamId: string, playerId: string, name: string) => void;
  onTogglePlayerIn: (teamId: string, playerId: string) => void;
  onRemovePlayer: (teamId: string, playerId: string) => void;
  onReorderPlayers: (teamId: string, activePlayerId: string, overPlayerId: string) => void;
}) {
  const teamLabel = teamIndexToDisplayLabel(teamIndex);
  const playerSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handlePlayerDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    onReorderPlayers(team.id, String(active.id), String(over.id));
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={["teamCol", isDragging ? "dndDragging dndTeamDragging" : ""].join(" ")}
    >
      <div className="fieldGroup">
        <div className="fieldLabelRow">
          <div className="draftTeamLabelLeft">
            <button
              type="button"
              className="dndHandle dndHandleTeam"
              ref={setActivatorNodeRef}
              aria-label="Drag to reorder team"
              title="Drag to reorder"
              {...attributes}
              {...listeners}
            >
              <GripSixDotsIcon size={16} />
            </button>
            <div className="fieldLabel">
              {teamLabel} <span className="required">*</span>
            </div>
          </div>

          {canRemoveTeam && (
            <button
              type="button"
              className="iconButton"
              aria-label="Remove team"
              onClick={() => onRemoveTeam(team.id)}
            >
              ×
            </button>
          )}
        </div>

        {fieldRoster && (
          <select
            className="textInput"
            value={selectedRosterTeamByDraftTeamId[team.id] ?? ""}
            onChange={(e) => onApplyRosterTeam(team.id, e.target.value)}
            aria-label={`Select team for ${teamLabel}`}
          >
            <option value="">Select team</option>
            {fieldRoster.teams.map((rt) => {
              const taken = Object.entries(selectedRosterTeamByDraftTeamId).some(
                ([otherId, otherName]) => otherId !== team.id && otherName === rt.name
              );
              return (
                <option key={rt.name} value={rt.name} disabled={taken}>
                  {rt.name}
                </option>
              );
            })}
          </select>
        )}

        {!fieldRoster && (
          <input
            className="textInput"
            value={team.name}
            placeholder={teamLabel}
            onChange={(e) => onUpdateTeamName(team.id, e.target.value)}
          />
        )}
      </div>

      <div className="fieldGroup">
        <div className="fieldLabel">Players</div>

        <DndContext
          sensors={playerSensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handlePlayerDragEnd}
        >
          <SortableContext items={team.players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="playerList">
              {team.players.map((player, playerIndex) => (
                <SortableDraftPlayerRow
                  key={player.id}
                  teamId={team.id}
                  player={player}
                  playerIndex={playerIndex}
                  canRemove={team.players.length > 1}
                  onUpdatePlayerName={onUpdatePlayerName}
                  onTogglePlayerIn={onTogglePlayerIn}
                  onRemovePlayer={onRemovePlayer}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          className="addRowButton"
          onClick={() => onAddPlayer(team.id)}
          title="Add player"
          aria-label="Add player"
        >
          <span className="addIcon">+</span>
        </button>
      </div>
    </div>
  );
}

function formatMultipleChoiceAnswerLabel(answer: string, options: string[]): string | undefined {
  const raw = answer.trim();
  const firstToken = raw.match(/[A-Za-z]|\d+/)?.[0];
  if (!firstToken) return undefined;

  const label = /[A-Za-z]/.test(firstToken) ? firstToken.toUpperCase() : firstToken;

  const index =
    "WXYZ".includes(label) ? "WXYZ".indexOf(label) :
      "ABCD".includes(label) ? "ABCD".indexOf(label) :
        /^\d+$/.test(label) ? Number(label) - 1 :
          -1;

  const option = options[index];
  if (!option) return undefined;

  const alreadyLabeled = new RegExp(`^\\s*${label}\\s*[\\)\\.]\\s*`, "i").test(option);
  return alreadyLabeled ? option : `${label}) ${option}`;
}

function formatCorrectAnswer(q: Question): string {
  if (typeof q.correct_answer === "string") {
    if (q.question_style === "MULTIPLE_CHOICE" && Array.isArray(q.options) && q.options.length > 0) {
      return formatMultipleChoiceAnswerLabel(q.correct_answer, q.options) ?? q.correct_answer;
    }
    return q.correct_answer;
  }

  if (Array.isArray(q.correct_answer)) {
    const indices = q.correct_answer;
    const labels = indices.map((i) => {
      const opt = q.options?.[i - 1];
      if (!opt) return String(i);
      const alreadyNumbered = new RegExp(`^\\s*${i}\\s*[\\)\\.]\\s*`).test(opt);
      return alreadyNumbered ? opt : `${i}) ${opt}`;
    });
    return labels.join("; ");
  }

  return String(q.correct_answer);
}

type TextSegment = { kind: "word" | "sep"; text: string };

function tokenizeText(text: string): TextSegment[] {
  const splitRe = /(\s+|[\p{Pd}\u00AD]+)/gu;
  const parts = text.split(splitRe).filter((p) => p !== "");

  return parts
    .map((part) => {
      if (/^\s+$/.test(part)) return { kind: "sep" as const, text: " " };
      if (/^[\p{Pd}\u00AD]+$/u.test(part)) return { kind: "sep" as const, text: part.replaceAll("\u00AD", "") };
      return { kind: "word" as const, text: part };
    })
    .filter((p) => p.text !== "");
}

type TokenizedRichTextSegment =
  | { kind: "sep"; text: string }
  | { kind: "math"; latex: string; partIndex: number }
  | { kind: "word"; chunks: Array<{ text: string; bold: boolean }> };

function tokenizeRichPartsForWordSelection(richParts: RichTextPart[]): TokenizedRichTextSegment[] {
  const segments: TokenizedRichTextSegment[] = [];

  for (let partIndex = 0; partIndex < richParts.length; partIndex += 1) {
    const part = richParts[partIndex];
    if (part.kind === "math") {
      segments.push({ kind: "math", latex: part.latex, partIndex });
      continue;
    }

    const isBold = part.kind === "bold";
    const tokens = tokenizeText(part.content);
    for (const token of tokens) {
      if (token.kind === "sep") {
        segments.push({ kind: "sep", text: token.text });
        continue;
      }

      // Rich-part splitting can create standalone punctuation tokens (e.g. `\textbf{...]}?`),
      // but users expect trailing punctuation like `?` to be part of the preceding token.
      if (/^[\p{P}]+$/u.test(token.text)) {
        const prev = segments[segments.length - 1];
        if (prev?.kind === "word") {
          prev.chunks.push({ text: token.text, bold: isBold });
          continue;
        }
      }

      segments.push({ kind: "word", chunks: [{ text: token.text, bold: isBold }] });
    }
  }

  return segments;
}

function needsLeadingSpaceBeforeRichParts(parts: RichTextPart[]): boolean {
  if (parts.length === 0) return false;
  const first = parts[0];
  if (first.kind === "math") return true;
  return !/^\s/.test(first.content);
}

function canonicalizeJson(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const v = obj[key];
      if (v === undefined) continue;
      out[key] = canonicalizeJson(v);
    }
    return out;
  }
  return value;
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

async function sha256Hex(text: string): Promise<string> {
  if (!("crypto" in window) || !crypto.subtle) throw new Error("Web Crypto API not available");
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "export";
}

type SnapshotMeta = {
  tournament_slug: string | null;
  packet_year: number;
  packet_name: string;
  team_a: string;
  team_b: string;
  game_instance_id: string;
};

function makeGameInstanceId(now: Date = new Date()): string {
  const iso = now.toISOString(); // e.g. 2026-02-22T19:30:45.123Z
  const stamp = iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); // 20260222T193045Z

  const rand7 = (() => {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    if ("crypto" in window && "getRandomValues" in crypto) {
      const bytes = new Uint8Array(7);
      crypto.getRandomValues(bytes);
      return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
    }
    return Math.random().toString(36).slice(2, 9).padEnd(7, "0").slice(0, 7);
  })();

  return `${stamp}_${rand7}`;
}

function parseSnapshotMeta(value: unknown): SnapshotMeta | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;

  const tournamentSlugRaw = rec.tournament_slug;
  const tournament_slug =
    tournamentSlugRaw === undefined || tournamentSlugRaw === null
      ? null
      : typeof tournamentSlugRaw === "string" && tournamentSlugRaw.trim()
        ? tournamentSlugRaw.trim()
        : null;

  const packet_year = typeof rec.packet_year === "number" && Number.isFinite(rec.packet_year) ? Math.trunc(rec.packet_year) : NaN;
  const packet_name = typeof rec.packet_name === "string" ? rec.packet_name.trim() : "";
  const team_a = typeof rec.team_a === "string" ? rec.team_a.trim() : "";
  const team_b = typeof rec.team_b === "string" ? rec.team_b.trim() : "";
  const game_instance_id = typeof rec.game_instance_id === "string" ? rec.game_instance_id.trim() : "";

  if (!Number.isFinite(packet_year)) return null;
  if (!packet_name || !team_a || !team_b || !game_instance_id) return null;

  return { tournament_slug, packet_year, packet_name, team_a, team_b, game_instance_id };
}

function pointsForAttempt(attempt: Attempt | undefined, questionType: QuestionType | undefined): number | undefined {
  if (!attempt?.result) return undefined;
  if (questionType === "BONUS") return attempt.result === "correct" ? 10 : 0;
  if (attempt.result === "correct") return 4;
  return attempt.isEnd ? 0 : -4;
}

type AnchorRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

type AttemptEditor = {
  questionId: number;
  left: number;
  top: number;
  selection: Omit<Attempt, "result">;
};

type ScoresheetAttemptEditModalState = {
  questionId: number;
  teamId: string;
  playerId: string;
  left: number;
  top: number;
} | null;

type ScoresheetBonusEditScore = "plus" | "zero";
type ScoresheetBonusEditModalState = {
  questionId: number;
  teamId: string;
  score: ScoresheetBonusEditScore;
  left: number;
  top: number;
} | null;

function getAnchorRect(el: HTMLElement): AnchorRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function getAnchorRectFromPoint(x: number, y: number): AnchorRect {
  return { left: x, top: y, right: x, bottom: y, width: 0, height: 0 };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function teamLetterLabelForIndex(index: number): string {
  // 0 -> A, 1 -> B, ... 25 -> Z, 26 -> AA, etc.
  let n = index;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function teamRoleLabelForIndex(index: number): string {
  return `Team ${teamLetterLabelForIndex(index)}`;
}

function formatRelativeTime(iso: string, nowMs: number): string {
  const thenMs = new Date(iso).getTime();
  if (!Number.isFinite(thenMs)) return iso;
  const diffSecRaw = Math.floor((nowMs - thenMs) / 1000);
  const diffSec = Math.max(0, diffSecRaw);
  if (diffSec < 3) return "just now";
  if (diffSec < 60) return "less than a minute ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

function computePopupPosition(
  anchor: AnchorRect,
  popup?: { width: number; height: number }
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const margin = 12;
  const popupWidth = popup?.width ?? 220;
  const popupHeight = popup?.height ?? 128;

  const rightLeft = anchor.right + margin;
  if (rightLeft + popupWidth <= vw - 8) {
    return { left: rightLeft, top: clamp(anchor.top, 8, vh - popupHeight - 8) };
  }

  const leftLeft = anchor.left - popupWidth - margin;
  if (leftLeft >= 8) {
    return { left: leftLeft, top: clamp(anchor.top, 8, vh - popupHeight - 8) };
  }

  const belowTop = anchor.bottom + margin;
  if (belowTop + popupHeight <= vh - 8) {
    return { left: clamp(anchor.left, 8, vw - popupWidth - 8), top: belowTop };
  }

  const aboveTop = anchor.top - popupHeight - margin;
  if (aboveTop >= 8) {
    return { left: clamp(anchor.left, 8, vw - popupWidth - 8), top: aboveTop };
  }

  return { left: 8, top: 8 };
}

function estimateAttemptPopupHeightPx(activePlayerCount: number, usePlayerPanel: boolean): number {
  // Overestimate a bit so we avoid positioning a taller popup off-screen.
  const paddingY = 24; // 12px top/bottom
  const selectorsGap = 8;
  const selectorsMarginBottom = 10;
  const teamControlHeight = 34;
  const playerControlHeight = usePlayerPanel ? activePlayerCount * 32 : 34;
  const buttonsHeight = 34 * 2 + 8;
  return paddingY + teamControlHeight + selectorsGap + playerControlHeight + selectorsMarginBottom + buttonsHeight + 12;
}

function parsePacketJson(jsonText: string): Packet {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("Packet JSON must be an object.");
  const obj = parsed as Partial<Packet>;
  if (typeof obj.packet !== "string") throw new Error("Packet JSON missing required string field: packet");
  if (typeof obj.year !== "number") throw new Error("Packet JSON missing required number field: year");
  if (!Array.isArray(obj.questions)) throw new Error("Packet JSON missing required array field: questions");
  return obj as Packet;
}

const CACHED_ROSTER_KEY = "moss_cached_roster_v1";

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function buildStatsUrl(pathname: string): string {
  const trimmedBase = String(import.meta.env.VITE_STATS_URL ?? "").replace(/\/+$/, "");
  const normalizedPath = pathname.replace(/^\/+/, "");
  if (trimmedBase) return `${trimmedBase}/${normalizedPath}`;
  return `${import.meta.env.BASE_URL}${normalizedPath}`;
}

function parseRosterIndexJson(jsonText: string): RosterIndex {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("Roster index JSON must be an object.");
  const obj = parsed as Partial<RosterIndex>;
  if (obj.format !== "moss_roster_index") throw new Error("Roster index JSON has unexpected format.");
  if (obj.version !== 1) throw new Error("Roster index JSON has unexpected version.");
  if (!Array.isArray(obj.slugs)) throw new Error("Roster index JSON missing required array field: slugs");
  const slugs = obj.slugs.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim());
  return { format: "moss_roster_index", version: 1, slugs };
}

function parseFieldRosterJson(jsonText: string): FieldRoster {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("Roster JSON must be an object.");
  const obj = parsed as Partial<FieldRoster>;
  if (obj.format !== "moss_field_roster") throw new Error("Roster JSON has unexpected format.");
  if (obj.version !== 1) throw new Error("Roster JSON has unexpected version.");
  if (!Array.isArray(obj.teams)) throw new Error("Roster JSON missing required array field: teams");

  const seen = new Set<string>();
  const teams: FieldRosterTeam[] = obj.teams.map((t, idx) => {
    if (!t || typeof t !== "object") throw new Error(`teams[${idx}] must be an object`);
    const tr = t as Partial<FieldRosterTeam>;
    const name = String(tr.name ?? "").trim();
    if (!name) throw new Error(`teams[${idx}].name must be a non-empty string`);
    if (seen.has(name)) throw new Error(`Duplicate team name in roster: ${name}`);
    seen.add(name);

    if (!Array.isArray(tr.players)) throw new Error(`teams[${idx}].players must be an array`);
    const players = tr.players
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean);

    return { name, players };
  });

  const tournamentRaw = obj.tournament;
  let tournament: FieldRoster["tournament"] | undefined;
  if (tournamentRaw && typeof tournamentRaw === "object") {
    const raw = tournamentRaw as Record<string, unknown>;
    const slug = typeof raw.slug === "string" ? raw.slug : undefined;
    const name = typeof raw.name === "string" ? raw.name : undefined;
    if (slug || name) tournament = { slug, name };
  }

  return { format: "moss_field_roster", version: 1, tournament, teams };
}

function getDateYmdInTimeZone(now: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

function isDraftRosterValid(draftTeams: DraftTeam[]): boolean {
  if (draftTeams.length < 1) return false;
  for (const team of draftTeams) {
    if (!team.name.trim()) return false;
    const nonEmptyPlayers = team.players.map((p) => p.name.trim()).filter(Boolean);
    if (nonEmptyPlayers.length < 1) return false;
  }
  return true;
}

function MossTopNav() {
  const logoSrc = `${import.meta.env.BASE_URL}logo_big.png`;
  const mossHomeHref = import.meta.env.BASE_URL;

  return (
    <header className="sbTopNav" role="banner">
      <div className="sbTopNavInner">
        <a href={mossHomeHref} className="sbTopNavBrand" aria-label="Go to MoSS home">
          <img src={logoSrc} alt="MoSS" className="sbTopNavLogo" />
          <span className="sbTopNavBrandText">MoSS</span>
        </a>
      </div>
    </header>
  );
}

function ScoreboardDisplayApp() {
  const [snapshot, setSnapshot] = useState<ScoreboardSnapshotV1 | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const emptyScoresheetBaseState = useMemo(() => initialScoresheetState(), []);
  const [displayView, setDisplayView] = useState<ScoreboardDisplayView>(() => loadScoreboardDisplayView());
  const [rowAdvanceMode, setRowAdvanceMode] = useState<ScoreboardRowAdvanceMode>(() => loadScoreboardRowAdvanceMode());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const lastAutoScrolledPairIdRef = useRef<number | null>(null);
  const projectorTeamNameElsRef = useRef<Record<string, HTMLSpanElement | null>>({});
  const [projectorTeamNameFitByTeamId, setProjectorTeamNameFitByTeamId] = useState<
    Record<string, { fontPx: number; allowWrap: boolean }>
  >({});

  useEffect(() => {
    saveScoreboardDisplayView(displayView);
  }, [displayView]);

  useEffect(() => {
    saveScoreboardRowAdvanceMode(rowAdvanceMode);
  }, [rowAdvanceMode]);

  useEffect(() => {
    document.title = "MoSS — Scoreboard";
  }, []);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      setChannelError("This browser does not support BroadcastChannel. Try Chrome/Edge/Firefox.");
      return;
    }

    const clientId = makeScoreboardClientId();

    const bc = new BroadcastChannel(SCOREBOARD_CHANNEL_NAME);
    bc.onmessage = (ev: MessageEvent) => {
      const data = ev.data as unknown;
      if (!data || typeof data !== "object") return;
      const msg = data as Partial<ScoreboardDisplayMessageV1>;
      if (msg.kind !== "moss.scoreboard.snapshot") return;
      if (msg.client_id && msg.client_id !== clientId) return;
      const snap = (msg as { snapshot?: ScoreboardSnapshotV1 }).snapshot;
      if (!snap || snap.format !== "moss_scoreboard_snapshot" || snap.version !== 1) return;
      setSnapshot(snap);
    };

    safePostScoreboardMessage(bc, { kind: "moss.scoreboard.hello", client_id: clientId });

    return () => {
      bc.close();
    };
  }, []);

  const data = snapshot?.packet ?? (packetJson as Packet);
  const questions = useMemo(() => data.questions ?? [], [data.questions]);
  const game = snapshot?.game ?? null;
  const scoresheetBaseState = snapshot?.scoresheet_base_state ?? emptyScoresheetBaseState;
  const scoresheetEvents = snapshot?.scoresheet_events ?? [];

  const teams = game?.teams ?? [];
  const playersById = useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const team of teams) {
      for (const player of team.players) entries.push([player.id, player.name]);
    }
    return new Map(entries);
  }, [teams]);

  const isProjectorLayout = displayView === "large" && teams.length === 2;
  const projectorTeamFitKey = useMemo(() => teams.map((t) => `${t.id}:${t.name}`).join("|"), [teams]);

  useEffect(() => {
    if (!isProjectorLayout) return;

    let raf = 0;

    const measureCanvas = document.createElement("canvas");
    const ctx = measureCanvas.getContext("2d");
    if (!ctx) return;

    const MAX_FONT_PX = 72;
    const MIN_FONT_PX = 36;

    const recompute = () => {
      const next: Record<string, { fontPx: number; allowWrap: boolean }> = {};

      for (const team of teams) {
        const el = projectorTeamNameElsRef.current[team.id];
        if (!el) continue;
        const available = el.clientWidth;
        if (!available) continue;

        const computed = window.getComputedStyle(el);
        const fontStyle = computed.fontStyle || "normal";
        const fontVariant = computed.fontVariant || "normal";
        const fontWeight = computed.fontWeight || "600";
        const fontFamily = computed.fontFamily || "system-ui";

        ctx.font = `${fontStyle} ${fontVariant} ${fontWeight} ${MAX_FONT_PX}px ${fontFamily}`;
        const textWidthAtMax = ctx.measureText(team.name).width;

        const targetWidth = Math.max(0, available - 6);
        if (textWidthAtMax <= targetWidth) {
          next[team.id] = { fontPx: MAX_FONT_PX, allowWrap: false };
          continue;
        }

        const scaled = Math.floor(MAX_FONT_PX * (targetWidth / Math.max(1, textWidthAtMax)));
        const clamped = Math.max(MIN_FONT_PX, Math.min(MAX_FONT_PX, scaled));
        const allowWrap = clamped === MIN_FONT_PX && scaled < MIN_FONT_PX;
        next[team.id] = { fontPx: clamped, allowWrap };
      }

      setProjectorTeamNameFitByTeamId(next);
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };

    schedule();
    window.addEventListener("resize", schedule);

    let ro: ResizeObserver | null = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(schedule);
      for (const team of teams) {
        const el = projectorTeamNameElsRef.current[team.id];
        if (el) ro.observe(el);
      }
    }

    return () => {
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    };
  }, [isProjectorLayout, projectorTeamFitKey]);

  const formatAttemptCellTextForView = (
    attemptValue: Attempt | undefined,
    questionType: QuestionType | undefined
  ): string => {
    if (displayView === "large") return formatAttemptCellTextBrief(attemptValue, questionType, playersById);
    return formatAttemptCellText(attemptValue, questionType, playersById);
  };
  const scoresheetState = useMemo(
    () => reduceScoresheetEvents(scoresheetEvents, scoresheetBaseState),
    [scoresheetBaseState, scoresheetEvents]
  );
  const pairIdx = scoresheetState.pairIndex;
  const attempts = scoresheetState.attemptsByQuestionId;
  const scoresheetMarkers = scoresheetState.markers;

  const pairRows = useMemo<PairRow[]>(() => {
    const byPair = new Map<number, PairRow>();
    for (const question of questions) {
      const current = byPair.get(question.pair_id) ?? { pairId: question.pair_id };
      if (question.question_type === "TOSSUP") current.tossup = question;
      if (question.question_type === "BONUS") current.bonus = question;
      byPair.set(question.pair_id, current);
    }

    return [...byPair.values()].sort((a, b) => a.pairId - b.pairId);
  }, [questions]);

  const scoredPairs = useMemo(() => {
    const runningByTeam: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));

    const rows = pairRows.map((pair) => {
      const tossupAttemptAll = pair.tossup ? attempts[pair.tossup.id] ?? [] : [];
      const bonusAttemptAll = pair.bonus ? attempts[pair.bonus.id] ?? [] : [];

      const perTeam = teams.map((team) => {
        const tossupAttempt = tossupAttemptAll.find((a) => a.teamId === team.id);
        const bonusAttempt = bonusAttemptAll.find((a) => a.teamId === team.id);

        const tossupPoints = pointsForAttempt(tossupAttempt, pair.tossup?.question_type) ?? 0;
        const bonusPoints = pointsForAttempt(bonusAttempt, pair.bonus?.question_type) ?? 0;
        const pairPoints = tossupPoints + bonusPoints;
        runningByTeam[team.id] += pairPoints;

        return {
          teamId: team.id,
          tossupAttempt,
          bonusAttempt,
          pairPoints,
          runningTotal: runningByTeam[team.id],
        };
      });

      return { ...pair, perTeam };
    });

    const totals = teams.map((t) => ({ teamId: t.id, total: runningByTeam[t.id] ?? 0 }));
    return { rows, totals };
  }, [attempts, pairRows, teams]);

  const mostRecentPairId = useMemo(() => {
    for (let i = scoredPairs.rows.length - 1; i >= 0; i--) {
      const row = scoredPairs.rows[i];
      const hasAnyAttempt = row.perTeam.some((teamRow) => teamRow.tossupAttempt || teamRow.bonusAttempt);
      if (hasAnyAttempt) return row.pairId;
    }
    return scoredPairs.rows[0]?.pairId;
  }, [scoredPairs.rows]);

  const displayHeaderKey = useMemo(() => `${displayView}|${teams.map((t) => t.name).join("|")}`, [displayView, teams]);
  const { wrapRef: displayScoresheetWrapRef, wrapStyle: displayScoresheetWrapStyle } =
    useScoresheetStickyHeaderOffsets(displayHeaderKey);

  useEffect(() => {
    lastAutoScrolledPairIdRef.current = null;
  }, [rowAdvanceMode]);

  useEffect(() => {
    if (rowAdvanceMode === "frozen") return;
    const wrap = displayScoresheetWrapRef.current;
    if (!wrap) return;

    const targetPairId =
      rowAdvanceMode === "follow_moderator"
        ? pairRows[pairIdx]?.pairId
        : rowAdvanceMode === "most_recent"
          ? mostRecentPairId
          : undefined;

    if (!targetPairId) return;
    if (lastAutoScrolledPairIdRef.current === targetPairId) return;

    const rowEl = wrap.querySelector(`[data-pair-id="${targetPairId}"]`) as HTMLElement | null;
    if (!rowEl) return;

    const computed = window.getComputedStyle(wrap);
    const h1 = Number.parseFloat(computed.getPropertyValue("--scoresheetHeaderRow1Height")) || 0;
    const h2 = Number.parseFloat(computed.getPropertyValue("--scoresheetHeaderRow2Height")) || 0;
    const stickyOffset = h1 + h2;

    const wrapRect = wrap.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const rowTopInWrap = wrap.scrollTop + (rowRect.top - wrapRect.top);
    const rowBottomInWrap = wrap.scrollTop + (rowRect.bottom - wrapRect.top);

    const visibleTop = wrap.scrollTop + stickyOffset;
    const visibleBottom = wrap.scrollTop + wrap.clientHeight;

    const maxScrollTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);

    if (rowAdvanceMode === "follow_moderator") {
      const visibleHeight = wrap.clientHeight - stickyOffset;
      if (visibleHeight > 0) {
        const rowCenterInWrap = (rowTopInWrap + rowBottomInWrap) / 2;
        const desiredScrollTop = rowCenterInWrap - stickyOffset - visibleHeight / 2;
        const clampedScrollTop = Math.min(maxScrollTop, Math.max(0, desiredScrollTop));
        if (Math.abs(wrap.scrollTop - clampedScrollTop) > 2) {
          wrap.scrollTo({ top: clampedScrollTop, behavior: "auto" });
        }
      }
    } else if (rowTopInWrap < visibleTop || rowBottomInWrap > visibleBottom) {
      wrap.scrollTo({ top: Math.min(maxScrollTop, Math.max(0, rowTopInWrap - stickyOffset)), behavior: "auto" });
    }

    lastAutoScrolledPairIdRef.current = targetPairId;
  }, [displayScoresheetWrapRef, mostRecentPairId, pairIdx, pairRows, rowAdvanceMode]);

  if (channelError) {
    return (
      <div className="scoreboardDisplayRoot">
        <div className="card">
          <div className="header">
            <div>
              <h2 className="title">Scoreboard Display</h2>
              <p className="muted">{channelError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot || !snapshot.game) {
    return (
      <div className="scoreboardDisplayRoot">
        <div className="card">
          <div className="header">
            <div>
              <h2 className="title">Scoreboard Display</h2>
              <p className="muted">Waiting for the moderator window…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "scoreboardDisplayRoot",
        displayView === "large" ? "scoreboardDisplayRoot--large" : "",
        isProjectorLayout ? "scoreboardDisplayRoot--projector" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Scoreboard display"
    >
      <div className="card scoresheetCard" aria-label="Scoresheet">
        <div className="header">
          <div>
            <h2 className="title">Scoresheet</h2>
          </div>
          <div className="scoreboardDisplayActions">
            <button
              type="button"
              className="secondary"
              onClick={() => setDisplayView((v) => (v === "default" ? "large" : "default"))}
            >
              Toggle Projector View
            </button>
            <button
              type="button"
              className="secondary scoreboardDisplayGearButton"
              aria-label="Open display settings"
              title="Display settings"
              onClick={() => setIsSettingsOpen(true)}
            >
              ⚙
            </button>
          </div>
        </div>

        <div ref={displayScoresheetWrapRef} className="scoresheetTableWrap" style={displayScoresheetWrapStyle}>
          <div className="scoresheetStickyHeaderBackplate" aria-hidden="true" />
          <table
            className={["scoresheetTable", isProjectorLayout ? "scoresheetTable--projector" : ""].filter(Boolean).join(" ")}
          >
            {isProjectorLayout && (
              <colgroup>
                <col className="scoresheetColPair" />
                <col className="scoresheetColT1" />
                <col className="scoresheetColB1" />
                <col className="scoresheetColR1" />
                <col className="scoresheetColT2" />
                <col className="scoresheetColB2" />
                <col className="scoresheetColR2" />
              </colgroup>
            )}
            <thead>
              {displayView === "default" && (
                <tr>
                  <th className="scoresheetPairHeader" aria-hidden="true" />
                  {teams.map((team, teamIndex) => (
                    <th
                      key={`role_${team.id}`}
                      colSpan={3}
                      className={[
                        "scoresheetTeamHeader",
                        "scoresheetTeamRoleHeader",
                        teamIndex < teams.length - 1 ? "scoresheetGroupEnd" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <div className="scoresheetTeamHeaderInner">
                        <span className={["scoresheetTeamName", "scoresheetTeamRole"].join(" ")}>
                          {teamRoleLabelForIndex(teamIndex)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              )}
              <tr>
                <th className="scoresheetPairHeader" aria-label="Pair number" />
                {teams.map((team, teamIndex) => (
                  <th
                    key={team.id}
                    colSpan={3}
                    className={[
                      "scoresheetTeamHeader",
                      teamIndex < teams.length - 1 ? "scoresheetGroupEnd" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <div className="scoresheetTeamHeaderInner">
                      <span
                        className="scoresheetTeamName"
                        ref={(el) => {
                          projectorTeamNameElsRef.current[team.id] = el;
                        }}
                        style={
                          isProjectorLayout
                            ? {
                              fontSize: `${projectorTeamNameFitByTeamId[team.id]?.fontPx ?? 72}px`,
                              whiteSpace: projectorTeamNameFitByTeamId[team.id]?.allowWrap ? "normal" : "nowrap",
                            }
                            : undefined
                        }
                      >
                        {team.name}
                      </span>
                      <span className="pill scoresheetScorePill">
                        {scoredPairs.totals.find((t) => t.teamId === team.id)?.total ?? 0}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                <th className="scoresheetPairHeader" aria-hidden="true" />
                {teams.flatMap((team, teamIndex) => [
                  <th key={`${team.id}_t`}>T</th>,
                  <th key={`${team.id}_b`}>B</th>,
                  <th
                    key={`${team.id}_r`}
                    className={teamIndex < teams.length - 1 ? "scoresheetGroupEnd" : ""}
                  >
                    {isProjectorLayout ? "S" : "Total"}
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const colSpan = 1 + teams.length * 3;
                const nodes: ReactNode[] = [];

                for (let i = 0; i < scoredPairs.rows.length; i++) {
                  const row = scoredPairs.rows[i];
                  const boundaryBeforeQuestion = row.pairId;
                  const markerKind: ScoresheetMarkerKind | undefined = scoresheetMarkers[boundaryBeforeQuestion];

                  if (markerKind !== undefined) {
                    nodes.push(
                      <tr
                        key={`boundary_${boundaryBeforeQuestion}`}
                        className={["scoresheetBoundaryRow", "scoresheetBoundaryRowMarked"].join(" ")}
                      >
                        <td colSpan={colSpan}>
                          <div className="scoresheetBoundaryButton" aria-hidden="true">
                            <span className="scoresheetBoundaryLabel">{markerKind}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const isActivePair = row.pairId === pairRows[pairIdx]?.pairId;
                  nodes.push(
                    <tr
                      key={`row_${row.pairId}`}
                      data-pair-id={row.pairId}
                      className={isActivePair ? "scoresheetRowActive" : undefined}
                    >
                      <td className="scoresheetPairCell">
                        <span className="pairLinkDisplay">{row.pairId}</span>
                      </td>
                      {row.perTeam.flatMap((teamRow, teamIndex) => {
                        const isGroupEnd = teamIndex < row.perTeam.length - 1;
                        const tossupResult = teamRow.tossupAttempt?.result;
                        const bonusResult = teamRow.bonusAttempt?.result;

                        const tossupCellClass = [
                          "scoresheetAttemptCell",
                          tossupResult === "correct"
                            ? "scoresheetCellCorrect"
                            : tossupResult === "incorrect"
                              ? "scoresheetCellIncorrect"
                              : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        const bonusCellClass = [
                          "scoresheetAttemptCell",
                          bonusResult === "correct"
                            ? "scoresheetCellCorrect"
                            : bonusResult === "incorrect"
                              ? "scoresheetCellIncorrect"
                              : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return [
                          <td key={`${teamRow.teamId}_t`} className={tossupCellClass || undefined}>
                            <span className="scoresheetAttemptCellDisplay">
                              {formatAttemptCellTextForView(teamRow.tossupAttempt, row.tossup?.question_type)}
                            </span>
                          </td>,
                          <td key={`${teamRow.teamId}_b`} className={bonusCellClass || undefined}>
                            <span className="scoresheetAttemptCellDisplay">
                              {formatAttemptCellTextForView(teamRow.bonusAttempt, row.bonus?.question_type)}
                            </span>
                          </td>,
                          <td
                            key={`${teamRow.teamId}_r`}
                            className={["scoresheetNumberCell", isGroupEnd ? "scoresheetGroupEnd" : ""].filter(Boolean).join(" ")}
                          >
                            {teamRow.runningTotal}
                          </td>,
                        ];
                      })}
                    </tr>
                  );
                }

                return nodes;
              })()}
            </tbody>
          </table>
        </div>
      </div>
      <ScoreboardDisplaySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mode={rowAdvanceMode}
        onModeChange={setRowAdvanceMode}
      />
    </div>
  );
}

function ModeratorApp() {
  const samplePacket = packetJson as Packet;
  const tournamentIndex = tournamentsJson as MossTournamentIndex;
  const [packet, setPacket] = useState<Packet | null>(null);
  const data = packet ?? samplePacket;

  const questions = useMemo(() => data.questions ?? [], [data.questions]);
  const questionsById = useMemo(() => new Map(questions.map((qq) => [qq.id, qq])), [questions]);
  const [game, setGame] = useState<Game | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<SnapshotMeta | null>(null);
  const [packetChecksum, setPacketChecksum] = useState<string | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const snapshotInFlightRef = useRef(false);
  const snapshotPendingRef = useRef(false);
  const lastSnapshotUploadedSeqRef = useRef(0);
  const snapshotSessionRef = useRef(0);
  const [lastExport, setLastExport] = useState<{ atEnd: boolean; lastSeq: number; exportedAtIso: string } | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isNewGameOpen, setIsNewGameOpen] = useState(false);
  const [isLoadGameOpen, setIsLoadGameOpen] = useState(false);
  const [isQuestionBlurred, setIsQuestionBlurred] = useState(false);
  const [loadGameFile, setLoadGameFile] = useState<File | null>(null);
  const [loadGameError, setLoadGameError] = useState<string | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const [draftTeams, setDraftTeams] = useState<DraftTeam[]>([]);
  const [draftRosterChoice, setDraftRosterChoice] = useState<RosterChoice>(() => ({
    kind: "custom",
    label: "Enter Custom Roster",
  }));
  const [isRosterChooserOpen, setIsRosterChooserOpen] = useState(false);
  const [isTournamentRosterChooserOpen, setIsTournamentRosterChooserOpen] = useState(false);
  const [showAllTournaments, setShowAllTournaments] = useState(false);
  const [tournamentSearchQuery, setTournamentSearchQuery] = useState("");
  const [rosterIndexLoading, setRosterIndexLoading] = useState(false);
  const [rosterIndexError, setRosterIndexError] = useState<string | null>(null);
  const [rosterIndexSlugs, setRosterIndexSlugs] = useState<Set<string> | null>(null);
  const [tournamentRosterLoading, setTournamentRosterLoading] = useState(false);
  const [tournamentRosterError, setTournamentRosterError] = useState<string | null>(null);
  const [fieldRoster, setFieldRoster] = useState<FieldRoster | null>(null);
  const [selectedRosterTeamByDraftTeamId, setSelectedRosterTeamByDraftTeamId] = useState<Record<string, string>>({});
  const [hasConfirmedAlteringPreloadedRosters, setHasConfirmedAlteringPreloadedRosters] = useState(false);
  const [rosterLoadError, setRosterLoadError] = useState<string | null>(null);
  const [draftPacketChoice, setDraftPacketChoice] = useState<PacketChoice | null>(null);
  const [isPacketChooserOpen, setIsPacketChooserOpen] = useState(false);
  const [packetLoadError, setPacketLoadError] = useState<string | null>(null);
  const [scoresheetBaseState, setScoresheetBaseState] = useState<ScoresheetState>(() => initialScoresheetState());
  const [scoresheetEvents, setScoresheetEvents] = useState<ScoresheetEvent[]>([]);
  const scoresheetState = useMemo(
    () => reduceScoresheetEvents(scoresheetEvents, scoresheetBaseState),
    [scoresheetBaseState, scoresheetEvents]
  );
  const pairIdx = scoresheetState.pairIndex;
  const attempts = scoresheetState.attemptsByQuestionId;
  const scoresheetMarkers = scoresheetState.markers;
  const lineupsByTeamId = scoresheetState.lineupsByTeamId;
  const [attemptEditor, setAttemptEditor] = useState<AttemptEditor | null>(null);
  const [bonusResultEditor, setBonusResultEditor] = useState<{ questionId: number; left: number; top: number } | null>(null);
  const [scoresheetAttemptEditModal, setScoresheetAttemptEditModal] = useState<ScoresheetAttemptEditModalState>(null);
  const [scoresheetBonusEditModal, setScoresheetBonusEditModal] = useState<ScoresheetBonusEditModalState>(null);
  const [lastActor, setLastActor] = useState<{ teamId: string; playerId?: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const attemptPopupRef = useRef<HTMLDivElement | null>(null);
  const bonusPopupRef = useRef<HTMLDivElement | null>(null);
  const scoresheetBoundaryPopupRef = useRef<HTMLDivElement | null>(null);
  const scoresheetAttemptEditPopupRef = useRef<HTMLDivElement | null>(null);
  const scoresheetBonusEditPopupRef = useRef<HTMLDivElement | null>(null);
  const packetFileInputRef = useRef<HTMLInputElement | null>(null);
  const rosterFileInputRef = useRef<HTMLInputElement | null>(null);
  const gameFileInputRef = useRef<HTMLInputElement | null>(null);

  const teams = game?.teams ?? [];

  type LineupPhase = ScoresheetMarkerKind | "START";
  type ScoresheetBoundaryPopupState = { boundaryBeforeQuestion: number; left: number; top: number } | null;
  type LineupChangeModalState = {
    phase: LineupPhase;
    boundaryBeforeQuestion: number;
    isCreatingMarker: boolean;
    draftInByTeamId: Record<string, Record<string, boolean>>;
  } | null;

  const [scoresheetBoundaryPopup, setScoresheetBoundaryPopup] = useState<ScoresheetBoundaryPopupState>(null);
  const [lineupChangeModal, setLineupChangeModal] = useState<LineupChangeModalState>(null);
  const isScoresheetExported = !!lastExport && lastExport.atEnd && lastExport.lastSeq === scoresheetState.lastSeq;

  useEffect(() => {
    if (!game) {
      setIsQuestionBlurred(false);
      return;
    }
    setIsQuestionBlurred(true);
  }, [game]);

  useEffect(() => {
    setLastExport(null);
    if (!game) setSnapshotMeta(null);
  }, [game]);

  useEffect(() => {
    snapshotSessionRef.current += 1;
    lastSnapshotUploadedSeqRef.current = 0;
    snapshotPendingRef.current = false;
    snapshotInFlightRef.current = false;
    if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = null;
  }, [game]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const canonicalPacketJson = stableJsonStringify({
          packet: data.packet,
          year: data.year,
          questions: data.questions ?? [],
        });
        const checksum = await sha256Hex(canonicalPacketJson);
        if (!cancelled) setPacketChecksum(checksum);
      } catch (e) {
        console.warn("Failed to compute packet checksum", e);
        if (!cancelled) setPacketChecksum(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data.packet, data.questions, data.year]);

  useEffect(() => {
    return () => {
      if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    };
  }, []);

  function ensureSnapshotMeta(): SnapshotMeta | null {
    if (!game) return null;
    if (snapshotMeta) return snapshotMeta;

    const names = game.teams.map((t) => t.name.trim()).filter(Boolean).slice(0, 2);
    const [team_a, team_b] = [...names].sort((x, y) => x.localeCompare(y));
    const derived: SnapshotMeta = {
      tournament_slug: null,
      packet_year: data.year,
      packet_name: data.packet,
      team_a: team_a ?? "TeamA",
      team_b: team_b ?? "TeamB",
      game_instance_id: makeGameInstanceId(),
    };
    setSnapshotMeta(derived);
    return derived;
  }

  function shouldTriggerAutosnapshot(eventType: ScoresheetEventType): boolean {
    return eventType !== "cursor.pair_index_set";
  }

  function scheduleAutosnapshot() {
    snapshotPendingRef.current = true;
    if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = window.setTimeout(() => {
      snapshotTimerRef.current = null;
      void maybeUploadSnapshot();
    }, 3000);
  }

  async function buildExportObject(meta: SnapshotMeta, exportedAtIso: string): Promise<Record<string, unknown>> {
    const canonicalPacketJson = stableJsonStringify({
      packet: data.packet,
      year: data.year,
      questions: data.questions ?? [],
    });
    const checksum = packetChecksum ?? await sha256Hex(canonicalPacketJson);

    function encodeLocation(location: AttemptLocation): unknown {
      if (location.kind === "end") return { kind: "end" };
      if (location.kind === "question") return { kind: "question", word_index: location.wordIndex };
      return {
        kind: "option",
        option_index: location.optionIndex,
        word_index: location.wordIndex,
      };
    }

    const attemptsByQuestionId: Record<string, unknown[]> = {};
    for (const [questionId, list] of Object.entries(attempts)) {
      const encoded = (list ?? [])
        .filter((a) => !!a.result)
        .map((a) => ({
          team_id: a.teamId,
          player_id: a.playerId ?? null,
          result: a.result,
          token: a.token,
          is_end: a.isEnd,
          location: encodeLocation(a.location),
        }));
      if (encoded.length) attemptsByQuestionId[String(questionId)] = encoded;
    }

    const sortedEvents = [...scoresheetEvents].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    const eventLog = sortedEvents.map((event, idx) => ({
      seq: event.seq ?? idx + 1,
      client_event_id: event.id,
      type: event.type,
      version: 1,
      client_ts: event.clientTs ?? null,
      payload: event.payload ?? {},
    }));
    const normalizedEventLog = (() => {
      if (eventLog.length) return eventLog;
      if (pairIdx === 0) return eventLog;
      return [
        {
          seq: 1,
          client_event_id: "export_cursor_seed",
          type: "cursor.pair_index_set",
          version: 1,
          client_ts: exportedAtIso,
          payload: { pair_index: pairIdx },
        },
      ];
    })();

    return {
      format: SCORESHEET_EXPORT_FORMAT,
      version: SCORESHEET_EXPORT_VERSION,
      exported_at: exportedAtIso,
      snapshot_meta: meta,
      packet: {
        packet: data.packet,
        year: data.year,
        questions: data.questions ?? [],
      },
      packet_checksum: {
        algorithm: "sha256",
        canonicalization: "json_sorted_keys_utf8_no_ws",
        value: checksum,
      },
      game: {
        teams: teams.map((t) => {
          const segments = lineupSegmentsForTeam(t);
          return {
            id: t.id,
            name: t.name,
            players: t.players.map((p) => ({ id: p.id, name: p.name })),
            ...(segments
              ? {
                lineup_segments: segments.map((seg) => ({
                  start_tossup: seg.startTossup,
                  end_tossup: seg.endTossup,
                  active_player_ids: [...seg.activePlayerIds],
                })),
              }
              : {}),
          };
        }),
      },
      rules: {
        tossup: { correct: 4, incorrect: -4, no_penalty: 0 },
        bonus: { correct: 10, incorrect: 0 },
      },
      event_log: {
        scoresheet_id: remoteScoresheetId,
        next_seq: scoresheetState.lastSeq + 1,
        events: normalizedEventLog,
      },
      state: {
        pair_index: pairIdx,
        attempts_by_question_id: attemptsByQuestionId,
      },
    };
  }

  async function maybeUploadSnapshot() {
    const session = snapshotSessionRef.current;
    if (!snapshotPendingRef.current) return;
    if (snapshotInFlightRef.current) return;
    if (!game) return;

    const currentSeq = scoresheetState.lastSeq;
    if (currentSeq <= lastSnapshotUploadedSeqRef.current) {
      snapshotPendingRef.current = false;
      return;
    }

    const meta = ensureSnapshotMeta();
    if (!meta) return;

    snapshotInFlightRef.current = true;
    snapshotPendingRef.current = false;
    try {
      const exportedAtIso = new Date().toISOString();
      const exportObj = await buildExportObject(meta, exportedAtIso);
      const response = await fetch("/api/moss-snapshots/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_meta: meta, export_obj: exportObj }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.warn("Autosnapshot upload failed", response.status, text.slice(0, 500));
        return;
      }
      if (snapshotSessionRef.current === session) {
        lastSnapshotUploadedSeqRef.current = Math.max(lastSnapshotUploadedSeqRef.current, currentSeq);
      }
    } catch (e) {
      console.warn("Autosnapshot upload failed", e);
    } finally {
      if (snapshotSessionRef.current === session) {
        snapshotInFlightRef.current = false;
        if (snapshotPendingRef.current) scheduleAutosnapshot();
      }
    }
  }

  useEffect(() => {
    if (!lastExport) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [lastExport]);

  useEffect(() => {
    if (!isTournamentRosterChooserOpen) return;
    let cancelled = false;

    setRosterIndexLoading(true);
    setRosterIndexError(null);
    setRosterIndexSlugs(null);

    void (async () => {
      try {
        const url = buildStatsUrl("stats/rosters/index.json");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          if (response.status === 404) {
            if (cancelled) return;
            setRosterIndexSlugs(new Set());
            return;
          }
          throw new Error(`Failed to load roster index (${response.status})`);
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
          if (cancelled) return;
          setRosterIndexSlugs(new Set());
          setRosterIndexError("No local stats found. Run `npm run dev` (or `npm run sync-stats`) in apps/moss/frontend.");
          return;
        }
        const text = await response.text();
        const parsed = parseRosterIndexJson(text);
        if (cancelled) return;
        setRosterIndexSlugs(new Set(parsed.slugs));
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load roster index";
        setRosterIndexError(msg);
        setRosterIndexSlugs(new Set());
      } finally {
        if (!cancelled) setRosterIndexLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isTournamentRosterChooserOpen]);

  const remoteScoresheetId = useMemo(() => getRemoteScoresheetId(), []);
  const remoteReady = useMemo(() => {
    if (!remoteScoresheetId || !game) return false;
    return game.teams.every((team) => {
      if (!Number.isFinite(Number(team.id))) return false;
      return team.players.every((player) => Number.isFinite(Number(player.id)));
    });
  }, [remoteScoresheetId, game]);

  function appendScoresheetEvents(newEvents: ScoresheetEvent[]) {
    if (!newEvents.length) return;
    const startSeq = scoresheetState.lastSeq + 1;
    if (remoteScoresheetId && !remoteReady) {
      console.warn("Remote scoresheet configured but local team ids are not numeric; skipping remote post.");
    }
    if (remoteReady && remoteScoresheetId) {
      void (async () => {
        for (let i = 0; i < newEvents.length; i += 1) {
          const event = newEvents[i];
          try {
            await postScoresheetEvent(remoteScoresheetId, event, startSeq + i);
          } catch (err) {
            console.warn("Failed to post scoresheet event", err);
            break;
          }
        }
      })();
    }

    if (newEvents.some((e) => shouldTriggerAutosnapshot(e.type))) {
      scheduleAutosnapshot();
    }

    setScoresheetEvents((prev) => {
      const lastSeq = prev.length ? prev[prev.length - 1].seq ?? prev.length : 0;
      const withSeq = newEvents.map((event, idx) => ({ ...event, seq: lastSeq + idx + 1 }));
      return [...prev, ...withSeq];
    });
  }

  function appendScoresheetEvent(event: ScoresheetEvent) {
    appendScoresheetEvents([event]);
  }

  const scoreboardSnapshot = useMemo<ScoreboardSnapshotV1>(() => ({
    format: "moss_scoreboard_snapshot",
    version: 1,
    session_id: snapshotMeta?.game_instance_id ?? null,
    packet: data,
    game,
    scoresheet_base_state: scoresheetBaseState,
    scoresheet_events: scoresheetEvents,
    created_at_ms: Date.now(),
  }), [data, game, scoresheetBaseState, scoresheetEvents, snapshotMeta?.game_instance_id]);

  const scoreboardChannelRef = useRef<BroadcastChannel | null>(null);
  const scoreboardSnapshotRef = useRef<ScoreboardSnapshotV1>(scoreboardSnapshot);

  useEffect(() => {
    scoreboardSnapshotRef.current = scoreboardSnapshot;
  }, [scoreboardSnapshot]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(SCOREBOARD_CHANNEL_NAME);
    scoreboardChannelRef.current = channel;

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as unknown;
      if (!data || typeof data !== "object") return;
      const msg = data as Partial<ScoreboardDisplayMessageV1>;
      if (msg.kind !== "moss.scoreboard.hello") return;
      const clientId = (msg as { client_id?: unknown }).client_id;
      if (typeof clientId !== "string" || !clientId) return;
      safePostScoreboardMessage(channel, {
        kind: "moss.scoreboard.snapshot",
        client_id: clientId,
        snapshot: scoreboardSnapshotRef.current,
      });
    };

    channel.addEventListener("message", onMessage);
    safePostScoreboardMessage(channel, { kind: "moss.scoreboard.snapshot", snapshot: scoreboardSnapshotRef.current });

    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
      if (scoreboardChannelRef.current === channel) scoreboardChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const channel = scoreboardChannelRef.current;
    if (!channel) return;
    safePostScoreboardMessage(channel, { kind: "moss.scoreboard.snapshot", snapshot: scoreboardSnapshot });
  }, [scoreboardSnapshot]);

  function openScoreboardDisplay() {
    const url = new URL(window.location.href);
    url.searchParams.set("display", "scoreboard");
    const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
    if (!opened) {
      alert("Popup blocked. Please allow popups for this site to open the scoreboard display.");
      return;
    }
  }

  function uniq<T>(items: T[]): T[] {
    return Array.from(new Set(items));
  }

  function sortLineupSegments(segments: LineupSegment[]): LineupSegment[] {
    const sorted = [...segments].sort((a, b) => a.startTossup - b.startTossup);
    const dedupedStarts: LineupSegment[] = [];
    for (const seg of sorted) {
      const prev = dedupedStarts[dedupedStarts.length - 1];
      const next = { ...seg, activePlayerIds: uniq(seg.activePlayerIds) };
      if (prev && prev.startTossup === next.startTossup) {
        dedupedStarts[dedupedStarts.length - 1] = next;
        continue;
      }
      dedupedStarts.push(next);
    }
    return dedupedStarts;
  }

  function normalizeLineupSegments(segments: LineupSegment[]): LineupSegment[] {
    const dedupedStarts = sortLineupSegments(segments);

    return dedupedStarts.map((seg, idx) => ({
      ...seg,
      endTossup: idx < dedupedStarts.length - 1 ? dedupedStarts[idx + 1].startTossup - 1 : null,
    }));
  }

  function activePlayerIdsForTeamAtTossup(team: Team, tossupNumber: number): Set<string> {
    const teamLineups = lineupsByTeamId[team.id];
    if (!teamLineups) return new Set(team.players.map((p) => p.id));

    const boundaries = Object.keys(teamLineups)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    let activeIds: string[] | null = null;
    for (const boundary of boundaries) {
      if (boundary > tossupNumber) break;
      activeIds = teamLineups[boundary] ?? null;
    }

    if (!activeIds?.length) return new Set(team.players.map((p) => p.id));
    return new Set(activeIds);
  }

  function lineupSegmentsForTeam(team: Team): LineupSegment[] | null {
    const teamLineups = lineupsByTeamId[team.id];
    if (!teamLineups || !Object.keys(teamLineups).length) return null;
    const segments: LineupSegment[] = [];
    for (const [boundary, activeIds] of Object.entries(teamLineups)) {
      const startTossup = Number(boundary);
      if (!Number.isFinite(startTossup)) continue;
      segments.push({
        startTossup,
        endTossup: null,
        activePlayerIds: uniq(activeIds),
      });
    }
    return normalizeLineupSegments(segments);
  }

  function setScoresheetMarker(boundaryBeforeQuestion: number, kind: ScoresheetMarkerKind) {
    if (scoresheetMarkers[boundaryBeforeQuestion] === kind) return;
    appendScoresheetEvent(buildScoresheetEvent("marker.set", {
      boundary_before_question: boundaryBeforeQuestion,
      kind,
    }));
  }

  function removeScoresheetMarker(boundaryBeforeQuestion: number) {
    if (!(boundaryBeforeQuestion in scoresheetMarkers)) return;
    const events: ScoresheetEvent[] = [
      buildScoresheetEvent("marker.removed", { boundary_before_question: boundaryBeforeQuestion }),
    ];
    for (const team of teams) {
      events.push(buildScoresheetEvent("lineup.removed", {
        team_id: team.id,
        boundary_before_question: boundaryBeforeQuestion,
      }));
    }
    appendScoresheetEvents(events);
  }

  function openScoresheetBoundaryPopup(boundaryBeforeQuestion: number, anchor: HTMLElement) {
    const pos = computePopupPosition(getAnchorRect(anchor));
    setScoresheetBoundaryPopup({ boundaryBeforeQuestion, left: pos.left, top: pos.top });
  }

  function openLineupChangeModal(phase: LineupPhase, boundaryBeforeQuestion: number, isCreatingMarker: boolean) {
    if (!game) return;

    const draft: Record<string, Record<string, boolean>> = {};
    for (const team of game.teams) {
      const active = activePlayerIdsForTeamAtTossup(team, boundaryBeforeQuestion);
      const map: Record<string, boolean> = {};
      for (const p of team.players) map[p.id] = active.has(p.id);
      draft[team.id] = map;
    }

    setLineupChangeModal({ phase, boundaryBeforeQuestion, isCreatingMarker, draftInByTeamId: draft });
  }

  function toggleLineupDraft(teamId: string, playerId: string) {
    setLineupChangeModal((prev) => {
      if (!prev) return prev;
      const teamDraft = prev.draftInByTeamId[teamId] ?? {};
      const current = !!teamDraft[playerId];
      return {
        ...prev,
        draftInByTeamId: {
          ...prev.draftInByTeamId,
          [teamId]: { ...teamDraft, [playerId]: !current },
        },
      };
    });
  }

  function saveLineupChangeModal() {
    if (!lineupChangeModal) return;
    if (!game) return;
    const { boundaryBeforeQuestion, phase, isCreatingMarker, draftInByTeamId } = lineupChangeModal;

    for (const t of game.teams) {
      const teamDraft = draftInByTeamId[t.id];
      const activeCount = t.players.filter((p) => !!teamDraft?.[p.id]).length;
      if (activeCount <= 0) return;
    }

    const events: ScoresheetEvent[] = [];
    for (const t of game.teams) {
      const teamDraft = draftInByTeamId[t.id];
      if (!teamDraft) continue;
      const activeIds = t.players.filter((p) => !!teamDraft[p.id]).map((p) => p.id);
      events.push(buildScoresheetEvent("lineup.set", {
        team_id: t.id,
        boundary_before_question: boundaryBeforeQuestion,
        active_player_ids: activeIds,
      }));
    }

    if (isCreatingMarker && phase !== "START") {
      events.push(buildScoresheetEvent("marker.set", {
        boundary_before_question: boundaryBeforeQuestion,
        kind: phase,
      }));
    }

    appendScoresheetEvents(events);
    setLineupChangeModal(null);
    setScoresheetBoundaryPopup(null);
  }

  useEffect(() => {
    if (!scoresheetBoundaryPopup) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setScoresheetBoundaryPopup(null);
    }

    function onMouseDown(e: MouseEvent) {
      const el = scoresheetBoundaryPopupRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setScoresheetBoundaryPopup(null);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [scoresheetBoundaryPopup]);

  useEffect(() => {
    if (!lineupChangeModal) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLineupChangeModal(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lineupChangeModal]);

  useEffect(() => {
    if (!scoresheetAttemptEditModal) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setScoresheetAttemptEditModal(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scoresheetAttemptEditModal]);

  useEffect(() => {
    if (!scoresheetBonusEditModal) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setScoresheetBonusEditModal(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scoresheetBonusEditModal]);

  useEffect(() => {
    if (!scoresheetAttemptEditModal && !scoresheetBonusEditModal) return;

    function onMouseDown(e: MouseEvent) {
      const elAttempt = scoresheetAttemptEditPopupRef.current;
      const elBonus = scoresheetBonusEditPopupRef.current;
      const target = e.target as Node;
      if (elAttempt && elAttempt.contains(target)) return;
      if (elBonus && elBonus.contains(target)) return;
      setScoresheetAttemptEditModal(null);
      setScoresheetBonusEditModal(null);
    }

    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [scoresheetAttemptEditModal, scoresheetBonusEditModal]);

  const playersById = useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const team of teams) {
      for (const player of team.players) entries.push([player.id, player.name]);
    }
    return new Map(entries);
  }, [teams]);

  const {
    layoutRef: mainLayoutRef,
    layoutStyle: mainLayoutStyle,
    isResizing: isMainLayoutResizing,
    resizerProps: mainLayoutResizerProps,
  } = useResizableRightColumn({
    storageKey: "moss_layout_scoresheet_width_px",
    defaultRightPx: 480,
    minLeftPx: 560,
    minRightPx: 420,
    gapPx: 18,
  });

  const moderatorHeaderKey = useMemo(() => teams.map((t) => t.name).join("|"), [teams]);
  const { wrapRef: moderatorScoresheetWrapRef, wrapStyle: moderatorScoresheetWrapStyle } =
    useScoresheetStickyHeaderOffsets(moderatorHeaderKey);

  const pairRows = useMemo<PairRow[]>(() => {
    const byPair = new Map<number, PairRow>();
    for (const question of questions) {
      const current = byPair.get(question.pair_id) ?? { pairId: question.pair_id };
      if (question.question_type === "TOSSUP") current.tossup = question;
      if (question.question_type === "BONUS") current.bonus = question;
      byPair.set(question.pair_id, current);
    }

    return [...byPair.values()].sort((a, b) => a.pairId - b.pairId);
  }, [questions]);

  useEffect(() => {
    if (!game) return;
    if (isScoresheetExported) return;

    const message =
      "Have you exported your scoresheet? Please ensure you have exported the latest version of your scoresheet before leaving. Unsaved scoresheets will be lost!";

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = message;
      return message;
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [game, isScoresheetExported]);

  const tossupQuestionByPairId = useMemo(() => {
    const map = new Map<number, Question>();
    for (const row of pairRows) {
      if (row.tossup) map.set(row.pairId, row.tossup);
    }
    return map;
  }, [pairRows]);

  const bonusQuestionByPairId = useMemo(() => {
    const map = new Map<number, Question>();
    for (const row of pairRows) {
      if (row.bonus) map.set(row.pairId, row.bonus);
    }
    return map;
  }, [pairRows]);

  const currentPair = pairRows[pairIdx];
  const tossupQ = currentPair?.tossup;
  const bonusQ = currentPair?.bonus;
  const q = tossupQ ?? bonusQ;
  const bonusEnabled = useMemo(() => {
    if (!tossupQ || !bonusQ) return false;
    return (attempts[tossupQ.id] ?? []).some((a) => a.result === "correct");
  }, [attempts, bonusQ, tossupQ]);

  const scoredPairs = useMemo(() => {
    const runningByTeam: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));

    const rows = pairRows.map((pair) => {
      const tossupAttemptAll = pair.tossup ? attempts[pair.tossup.id] ?? [] : [];
      const bonusAttemptAll = pair.bonus ? attempts[pair.bonus.id] ?? [] : [];

      const perTeam = teams.map((team) => {
        const tossupAttempt = tossupAttemptAll.find((a) => a.teamId === team.id);
        const bonusAttempt = bonusAttemptAll.find((a) => a.teamId === team.id);

        const tossupPoints = pointsForAttempt(tossupAttempt, pair.tossup?.question_type) ?? 0;
        const bonusPoints = pointsForAttempt(bonusAttempt, pair.bonus?.question_type) ?? 0;
        const pairPoints = tossupPoints + bonusPoints;
        runningByTeam[team.id] += pairPoints;

        return {
          teamId: team.id,
          tossupAttempt,
          bonusAttempt,
          pairPoints,
          runningTotal: runningByTeam[team.id],
        };
      });

      return { ...pair, perTeam };
    });

    const totals = teams.map((t) => ({ teamId: t.id, total: runningByTeam[t.id] ?? 0 }));
    return { rows, totals };
  }, [attempts, pairRows, teams]);

  async function exportScoresheet() {
    if (!game) return;

    setIsExporting(true);
    try {
      const metaToUse: SnapshotMeta = (() => {
        const meta = ensureSnapshotMeta();
        if (!meta) throw new Error("Unable to derive snapshot metadata");
        return meta;
      })();

      const exportedSeq = scoresheetState.lastSeq;
      const exportedAtEnd = pairIdx === pairRows.length - 1;
      const exportedAtIso = new Date().toISOString();
      const exportObj = await buildExportObject(metaToUse, exportedAtIso);

      // Export should always attempt to snapshot immediately (no debounce), since users often export and leave.
      // This is best-effort and should not block local export on failure.
      try {
        if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
        snapshotPendingRef.current = false;

        const response = await fetch("/api/moss-snapshots/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot_meta: metaToUse, export_obj: exportObj }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          console.warn("Export snapshot upload failed", response.status, text.slice(0, 500));
        } else {
          lastSnapshotUploadedSeqRef.current = Math.max(lastSnapshotUploadedSeqRef.current, exportedSeq);
        }
      } catch (e) {
        console.warn("Export snapshot upload failed", e);
      }

      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const tournamentPart = safeFilenamePart(metaToUse.tournament_slug ?? "custom");
      const packetPart = safeFilenamePart(`${metaToUse.packet_year}_${metaToUse.packet_name}`);
      const teamsPart = [metaToUse.team_a, metaToUse.team_b]
        .map(safeFilenamePart)
        .sort((x, y) => x.localeCompare(y))
        .join("__");
      a.href = url;
      a.download = `${tournamentPart}_${packetPart}_${teamsPart}_${metaToUse.game_instance_id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastExport({ atEnd: exportedAtEnd, lastSeq: exportedSeq, exportedAtIso });
    } catch (e) {
      console.error(e);
      alert("Export failed. See console for details.");
    } finally {
      setIsExporting(false);
    }
  }

  function openNewGame() {
    resetRostersToBlankCustom();
    setDraftPacketChoice(null);
    setPacketLoadError(null);
    setIsPacketChooserOpen(false);
    setIsNewGameOpen(true);
  }

  function closeNewGame() {
    setIsPacketChooserOpen(false);
    setIsRosterChooserOpen(false);
    setIsTournamentRosterChooserOpen(false);
    setIsNewGameOpen(false);
  }

  function makeBlankDraftTeams(teamCount = 2): DraftTeam[] {
    return Array.from({ length: teamCount }, () => ({
      id: makeId("team"),
      name: "",
      players: [
        { id: makeId("player"), name: "", isIn: true },
        { id: makeId("player"), name: "", isIn: true },
        { id: makeId("player"), name: "", isIn: true },
        { id: makeId("player"), name: "", isIn: true },
      ],
    }));
  }

  function resetRostersToBlankCustom() {
    setDraftRosterChoice({ kind: "custom", label: "Enter Custom Roster" });
    setIsRosterChooserOpen(false);
    setIsTournamentRosterChooserOpen(false);
    setShowAllTournaments(false);
    setTournamentSearchQuery("");
    setFieldRoster(null);
    setSelectedRosterTeamByDraftTeamId({});
    setHasConfirmedAlteringPreloadedRosters(false);
    setRosterLoadError(null);
    setDraftTeams(makeBlankDraftTeams());
  }

  function saveRosterToCache(teams: ResolvedRosterTeam[]) {
    try {
      const payload: CachedRoster = { format: "moss_cached_roster", version: 1, teams };
      localStorage.setItem(CACHED_ROSTER_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to cache roster", e);
    }
  }

  function loadCachedRosterTeams(): ResolvedRosterTeam[] | null {
    try {
      const raw = localStorage.getItem(CACHED_ROSTER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const obj = parsed as Partial<CachedRoster>;
      if (obj.format !== "moss_cached_roster" || obj.version !== 1 || !Array.isArray(obj.teams)) return null;

      const teams: ResolvedRosterTeam[] = [];
      for (const t of obj.teams) {
        if (!t || typeof t !== "object") continue;
        const tr = t as { name?: unknown; players?: unknown };
        const name = String(tr.name ?? "").trim();
        if (!name) continue;
        const playersRaw = tr.players;
        if (!Array.isArray(playersRaw)) continue;
        const players = playersRaw
          .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
          .map((p) => ({
            name: String(p.name ?? "").trim(),
            isIn: Boolean(p.isIn),
          }))
          .filter((p) => p.name);
        if (!players.length) continue;
        teams.push({ name, players });
      }

      return teams.length ? teams : null;
    } catch (e) {
      console.warn("Failed to load cached roster", e);
      return null;
    }
  }

  function hasCachedRoster(): boolean {
    try {
      return !!localStorage.getItem(CACHED_ROSTER_KEY);
    } catch {
      return false;
    }
  }

  function applyResolvedRosterToDraft(teams: ResolvedRosterTeam[]) {
    const draft: DraftTeam[] = teams.map((t) => ({
      id: makeId("team"),
      name: t.name,
      players: t.players.map((p) => ({ id: makeId("player"), name: p.name, isIn: p.isIn })),
    }));
    setDraftTeams(draft.length ? draft : makeBlankDraftTeams());
    setSelectedRosterTeamByDraftTeamId({});
    setFieldRoster(null);
  }

  function resetDraftTeamsForRosterMode() {
    setDraftTeams(makeBlankDraftTeams());
    setSelectedRosterTeamByDraftTeamId({});
  }

  function chooseCustomRoster() {
    resetRostersToBlankCustom();
  }

  function choosePreviousRoster() {
    const teams = loadCachedRosterTeams();
    if (!teams) {
      setRosterLoadError("No cached roster found.");
      setIsRosterChooserOpen(false);
      return;
    }
    setRosterLoadError(null);
    setDraftRosterChoice({ kind: "previous", label: "Load Previous Roster" });
    setIsRosterChooserOpen(false);
    setIsTournamentRosterChooserOpen(false);
    applyResolvedRosterToDraft(teams);
  }

  function requestUploadRoster() {
    setIsRosterChooserOpen(false);
    setRosterLoadError(null);
    rosterFileInputRef.current?.click();
  }

  async function onRosterFilePicked(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsedRoster = parseFieldRosterJson(text);
      setDraftRosterChoice({
        kind: "upload",
        fileName: file.name,
        label: "Upload Roster File",
      });
      resetDraftTeamsForRosterMode();
      setFieldRoster(parsedRoster);
      setSelectedRosterTeamByDraftTeamId({});
      setRosterLoadError(null);
    } catch {
      setRosterLoadError("ERROR: Unable to parse roster JSON");
    }
  }

  function openTournamentRosterChooser() {
    setIsRosterChooserOpen(false);
    setTournamentRosterError(null);
    setTournamentSearchQuery("");
    setIsTournamentRosterChooserOpen(true);
  }

  async function chooseTournamentRoster(tournament: MossTournament) {
    if (tournamentRosterLoading) return;

    setTournamentRosterLoading(true);
    setTournamentRosterError(null);
    try {
      const encodedSlug = encodeURIComponent(tournament.slug);
      const url = buildStatsUrl(`stats/${encodedSlug}/field.json`);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (response.status === 404) {
        throw new Error("No roster file found for this tournament.");
      }
      if (!response.ok) {
        throw new Error(`Failed to load roster (${response.status})`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        throw new Error("No local stats found. Run `npm run dev` (or `npm run sync-stats`) in apps/moss/frontend.");
      }
      const text = await response.text();
      const parsed = parseFieldRosterJson(text);

      setDraftRosterChoice({
        kind: "tournament",
        label: "Select Tournament Roster",
        tournamentSlug: tournament.slug,
      });
      resetDraftTeamsForRosterMode();
      setFieldRoster(parsed);
      setSelectedRosterTeamByDraftTeamId({});
      setRosterLoadError(null);
      setIsTournamentRosterChooserOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load tournament roster.";
      setTournamentRosterError(msg);
    } finally {
      setTournamentRosterLoading(false);
    }
  }

  function applyFieldRosterTeamToDraftTeam(draftTeamId: string, rosterTeamName: string) {
    if (!fieldRoster) return;
    const normalized = rosterTeamName.trim();
    if (!normalized) {
      setSelectedRosterTeamByDraftTeamId((prev) => {
        if (!(draftTeamId in prev)) return prev;
        const next = { ...prev };
        delete next[draftTeamId];
        return next;
      });
      return;
    }

    const rosterTeam = fieldRoster.teams.find((t) => t.name === normalized) ?? null;
    if (!rosterTeam) return;

    const current = draftTeams.find((t) => t.id === draftTeamId) ?? null;
    const hasExistingValues = !!current && (
      current.name.trim() !== "" ||
      current.players.some((p) => p.name.trim() !== "")
    );

    if (hasExistingValues) {
      const ok = window.confirm(`Overwrite this team with ${rosterTeam.name}? This will replace the team and player names.`);
      if (!ok) return;
    }

    setDraftTeams((prev) =>
      prev.map((t) => {
        if (t.id !== draftTeamId) return t;
        const players = rosterTeam.players.length
          ? rosterTeam.players.map((name, idx) => ({ id: makeId("player"), name, isIn: idx < 4 }))
          : [{ id: makeId("player"), name: "", isIn: true }];
        return { ...t, name: rosterTeam.name, players };
      })
    );

    setSelectedRosterTeamByDraftTeamId((prev) => ({ ...prev, [draftTeamId]: rosterTeam.name }));
  }

  function confirmAlteringPreloadedRostersIfNeeded(teamId: string): boolean {
    if (hasConfirmedAlteringPreloadedRosters) return true;
    if (draftRosterChoice.kind !== "tournament") return true;
    if (!selectedRosterTeamByDraftTeamId[teamId]) return true;

    const ok = window.confirm(
      "Are you sure you wish to alter the preloaded rosters?\n\nModifying rosters may break tournament statistics. It is strongly recommended to notify a tournament organizer before proceeding."
    );
    if (!ok) return false;
    setHasConfirmedAlteringPreloadedRosters(true);
    return true;
  }

  const draftTeamDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDraftTeamDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    setDraftTeams((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id);
      const newIndex = prev.findIndex((t) => t.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function reorderDraftPlayers(teamId: string, activePlayerId: string, overPlayerId: string) {
    setDraftTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        const oldIndex = t.players.findIndex((p) => p.id === activePlayerId);
        const newIndex = t.players.findIndex((p) => p.id === overPlayerId);
        if (oldIndex < 0 || newIndex < 0) return t;
        return { ...t, players: arrayMove(t.players, oldIndex, newIndex) };
      })
    );
  }

  function updateTeamName(teamId: string, name: string) {
    setDraftTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name } : t)));
  }

  function updatePlayerName(teamId: string, playerId: string, name: string) {
    setDraftTeams((prev) =>
      prev.map((t) =>
        t.id !== teamId ? t : { ...t, players: t.players.map((p) => (p.id === playerId ? { ...p, name } : p)) }
      )
    );
  }

  function toggleDraftPlayerIn(teamId: string, playerId: string) {
    setDraftTeams((prev) =>
      prev.map((t) =>
        t.id !== teamId
          ? t
          : { ...t, players: t.players.map((p) => (p.id === playerId ? { ...p, isIn: !p.isIn } : p)) }
      )
    );
  }

  function addPlayer(teamId: string) {
    if (!confirmAlteringPreloadedRostersIfNeeded(teamId)) return;
    const id = makeId("player");
    setDraftTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, players: [...t.players, { id, name: "", isIn: false }] } : t))
    );
  }

  function removePlayer(teamId: string, playerId: string) {
    if (!confirmAlteringPreloadedRostersIfNeeded(teamId)) return;
    const playerName = draftTeams
      .find((t) => t.id === teamId)
      ?.players.find((p) => p.id === playerId)
      ?.name.trim() ?? "";

    if (playerName) {
      const ok = window.confirm(`Are you sure you want to remove ${playerName}?`);
      if (!ok) return;
    }

    setDraftTeams((prev) =>
      prev.map((t) =>
        t.id !== teamId ? t : { ...t, players: t.players.filter((p) => p.id !== playerId) }
      )
    );
  }

  function addTeam() {
    const teamId = makeId("team");
    const playerId = makeId("player");
    setDraftTeams((prev) => [...prev, { id: teamId, name: "", players: [{ id: playerId, name: "", isIn: true }] }]);
  }

  function removeTeam(teamId: string) {
    const ok = window.confirm("Are you sure you want to remove this team? This will remove the team and all players.");
    if (!ok) return;
    setDraftTeams((prev) => prev.filter((t) => t.id !== teamId));
    setSelectedRosterTeamByDraftTeamId((prev) => {
      if (!(teamId in prev)) return prev;
      const next = { ...prev };
      delete next[teamId];
      return next;
    });
  }

  const canStartNewGame = useMemo(() => {
    if (!draftPacketChoice) return false;
    return isDraftRosterValid(draftTeams);
  }, [draftPacketChoice, draftTeams]);

  const canDownloadRosters = useMemo(() => isDraftRosterValid(draftTeams), [draftTeams]);

  function downloadCurrentRosters() {
    if (!canDownloadRosters) return;

    const teams: FieldRosterTeam[] = draftTeams.map((t) => ({
      name: t.name.trim(),
      players: t.players.map((p) => p.name.trim()).filter(Boolean),
    }));

    const tournament =
      draftRosterChoice.kind === "tournament"
        ? {
          slug: draftRosterChoice.tournamentSlug,
          name: fieldRoster?.tournament?.name,
        }
        : undefined;

    const payload: FieldRoster = {
      format: "moss_field_roster",
      version: 1,
      ...(tournament ? { tournament } : {}),
      teams,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
      a.download = `moss_roster_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function startNewGame() {
    if (!canStartNewGame || !draftPacketChoice) return;
    const initialEvents: ScoresheetEvent[] = [];
    const resolvedTeamsForCache: ResolvedRosterTeam[] = [];
    const nextSnapshotMeta: SnapshotMeta = (() => {
      const names = draftTeams.map((t) => t.name.trim()).filter(Boolean).slice(0, 2);
      const [team_a, team_b] = [...names].sort((x, y) => x.localeCompare(y));
      return {
        tournament_slug: draftRosterChoice.kind === "tournament" ? draftRosterChoice.tournamentSlug : null,
        packet_year: draftPacketChoice.packet.year,
        packet_name: draftPacketChoice.packet.packet,
        team_a: team_a ?? "TeamA",
        team_b: team_b ?? "TeamB",
        game_instance_id: makeGameInstanceId(),
      };
    })();
    const teams: Team[] = draftTeams.map((t) => {
      const teamName = t.name.trim();
      const roster = t.players
        .map((p) => ({ ...p, name: p.name.trim() }))
        .filter((p) => p.name);

      resolvedTeamsForCache.push({
        name: teamName,
        players: roster.map((p) => ({ name: p.name, isIn: p.isIn })),
      });
      const players: Player[] = roster.map(({ id, name }) => ({ id, name }));
      const activePlayerIds = roster.filter((p) => p.isIn).map((p) => p.id);
      initialEvents.push(buildScoresheetEvent("lineup.set", {
        team_id: t.id,
        boundary_before_question: 1,
        active_player_ids: activePlayerIds,
      }));
      return { id: t.id, name: teamName, players };
    });

    saveRosterToCache(resolvedTeamsForCache);
    setPacket(draftPacketChoice.packet);
    setGame({ teams });
    setSnapshotMeta(nextSnapshotMeta);
    const baseState = initialScoresheetState();
    setScoresheetBaseState(baseState);
    setScoresheetEvents(initialEvents.map((event, idx) => ({ ...event, seq: idx + 1 })));
    setAttemptEditor(null);
    setLastActor(null);
    setScoresheetBoundaryPopup(null);
    setLineupChangeModal(null);
    setIsNewGameOpen(false);
  }

  async function onPacketFilePicked(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsedPacket = parsePacketJson(text);
      setDraftPacketChoice({
        kind: "upload",
        label: "Upload Packet from Computer",
        fileName: file.name,
        subtext: file.name,
        packet: parsedPacket,
      });
      setPacketLoadError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load packet JSON.";
      setPacketLoadError(msg);
    }
  }

  function chooseSamplePacket() {
    setDraftPacketChoice({
      kind: "sample",
      label: "Use Sample Packet",
      subtext: "Built-in demo packet for testing",
      packet: samplePacket,
    });
    setPacketLoadError(null);
    setIsPacketChooserOpen(false);
  }

  function requestUploadPacket() {
    setIsPacketChooserOpen(false);
    setPacketLoadError(null);
    packetFileInputRef.current?.click();
  }

  function openLoadGame() {
    setLoadGameError(null);
    setLoadGameFile(null);
    setIsLoadGameOpen(true);
  }

  function closeLoadGame() {
    setLoadGameError(null);
    setLoadGameFile(null);
    setIsLoadGameOpen(false);
  }

  function requestUploadGame() {
    setLoadGameError(null);
    gameFileInputRef.current?.click();
  }

  async function openSelectedGameFile() {
    if (!loadGameFile) return;
    setIsLoadingGame(true);
    setLoadGameError(null);
    try {
      const jsonText = await loadGameFile.text();
      const parsed = JSON.parse(jsonText) as unknown;
      if (!parsed || typeof parsed !== "object") throw new Error("Game file JSON must be an object.");

      const obj = parsed as Record<string, unknown>;
      if (obj.format !== SCORESHEET_EXPORT_FORMAT) throw new Error(`Unsupported format: ${String(obj.format)}`);
      const exportVersion = obj.version;
      if (exportVersion !== 1 && exportVersion !== 2 && exportVersion !== 3) {
        throw new Error(`Unsupported version: ${String(obj.version)}`);
      }
      const isV3 = exportVersion === 3;
      const importedSnapshotMeta = parseSnapshotMeta(obj.snapshot_meta);

      const packetObj = obj.packet;
      const loadedPacket = parsePacketJson(JSON.stringify(packetObj));

      const checksumObj = obj.packet_checksum;
      if (!checksumObj || typeof checksumObj !== "object") throw new Error("Missing required field: packet_checksum");
      const checksumRec = checksumObj as Record<string, unknown>;
      if (checksumRec.algorithm !== "sha256") throw new Error("Unsupported packet_checksum.algorithm (expected sha256)");
      if (checksumRec.canonicalization !== "json_sorted_keys_utf8_no_ws") {
        throw new Error("Unsupported packet_checksum.canonicalization (expected json_sorted_keys_utf8_no_ws)");
      }
      if (typeof checksumRec.value !== "string") throw new Error("packet_checksum.value must be a string");

      const canonicalPacketJson = stableJsonStringify({
        packet: loadedPacket.packet,
        year: loadedPacket.year,
        questions: loadedPacket.questions ?? [],
      });
      const computedChecksum = await sha256Hex(canonicalPacketJson);
      if (computedChecksum !== checksumRec.value) throw new Error("Packet checksum mismatch (file may be corrupted).");

      const gameObj = obj.game;
      if (!gameObj || typeof gameObj !== "object") throw new Error("Missing required field: game");
      const gameRec = gameObj as Record<string, unknown>;
      const gameTeams = gameRec.teams;
      if (!Array.isArray(gameTeams)) throw new Error("game.teams must be an array");

      function makeId(prefix: string) {
        return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
      }

      const maxTossupNumber = (() => {
        const tossups = (loadedPacket.questions ?? []).filter((qq) => qq.question_type === "TOSSUP");
        const ids = tossups.map((qq) => qq.pair_id).filter((n) => Number.isFinite(n));
        return ids.length ? Math.max(...ids) : 0;
      })();

      const teamIdByName = new Map<string, string>();
      const playerIdByTeamNameThenPlayerName = new Map<string, string>();
      const seenTeamIds = new Set<string>();
      const seenPlayerIds = new Set<string>();
      const playerIdsByTeamId = new Map<string, Set<string>>();

      const importedLineupsByTeamId: Record<string, Record<number, string[]>> = {};
      const importedTeams: Team[] = gameTeams.map((t) => {
        if (!t || typeof t !== "object") throw new Error("Each game.teams[] item must be an object");
        const tr = t as Record<string, unknown>;
        if (typeof tr.name !== "string" || !tr.name.trim()) throw new Error("Each team must have a non-empty name");
        const teamName = tr.name.trim();

        const teamId = (() => {
          if (isV3) {
            const raw = tr.id;
            if (typeof raw !== "string" || !raw.trim()) throw new Error(`Team ${teamName}: id must be a non-empty string in v3`);
            const canonical = raw.trim();
            if (seenTeamIds.has(canonical)) throw new Error(`Duplicate team id: ${canonical}`);
            seenTeamIds.add(canonical);
            return canonical;
          }
          if (teamIdByName.has(teamName)) throw new Error(`Duplicate team name: ${teamName}`);
          const id = makeId("team");
          teamIdByName.set(teamName, id);
          return id;
        })();

        const playersRaw = tr.players;
        if (!Array.isArray(playersRaw)) throw new Error(`Team ${teamName}: players must be an array`);
        const players: Player[] = [];
        const playerIds = new Set<string>();
        for (const p of playersRaw) {
          if (typeof p === "string") {
            if (isV3) throw new Error(`Team ${teamName}: players must be objects in v3`);
            const name = p.trim();
            if (!name) continue;
            const id = makeId("player");
            players.push({ id, name });
            playerIds.add(id);
            playerIdByTeamNameThenPlayerName.set(`${teamName}\n${name}`, id);
            continue;
          }
          if (!p || typeof p !== "object") throw new Error(`Team ${teamName}: players must be strings or objects`);
          const pr = p as Record<string, unknown>;
          const name = typeof pr.name === "string" ? pr.name.trim() : "";
          if (!name) continue;
          const id = (() => {
            const raw = pr.id;
            if (typeof raw === "string" && raw.trim()) return raw.trim();
            if (isV3) throw new Error(`Team ${teamName}: player id must be a non-empty string in v3`);
            return makeId("player");
          })();
          if (playerIds.has(id)) throw new Error(`Team ${teamName}: duplicate player id: ${id}`);
          if (seenPlayerIds.has(id)) throw new Error(`Duplicate player id across teams: ${id}`);
          seenPlayerIds.add(id);
          playerIds.add(id);
          players.push({ id, name });
          if (!isV3) {
            playerIdByTeamNameThenPlayerName.set(`${teamName}\n${name}`, id);
          }
        }
        playerIdsByTeamId.set(teamId, playerIds);

        const lineupSegmentsRaw = tr.lineup_segments;
        let lineupSegments: LineupSegment[] | undefined = undefined;
        if (lineupSegmentsRaw !== undefined) {
          if (!Array.isArray(lineupSegmentsRaw)) {
            throw new Error(`Team ${teamName}: lineup_segments must be an array`);
          }

          const segs: LineupSegment[] = [];
          let lastCoveredEnd = 0;
          for (const seg of lineupSegmentsRaw) {
            if (!seg || typeof seg !== "object") throw new Error(`Team ${teamName}: lineup_segments[] must be objects`);
            const sr = seg as Record<string, unknown>;
            const startRaw = sr.start_tossup;
            const endRaw = sr.end_tossup;
            const activeByNameRaw = sr.active_players;
            const activeByIdRaw = sr.active_player_ids;
            const activeKind = Array.isArray(activeByIdRaw) ? "id" : "name";
            const activeRaw = activeKind === "id" ? activeByIdRaw : activeByNameRaw;

            if (typeof startRaw !== "number" || !Number.isFinite(startRaw)) {
              throw new Error(`Team ${teamName}: lineup_segments[].start_tossup must be a number`);
            }
            const startTossup = Math.trunc(startRaw);
            if (startTossup !== startRaw) throw new Error(`Team ${teamName}: lineup_segments[].start_tossup must be an integer`);
            if (startTossup < 1) throw new Error(`Team ${teamName}: lineup_segments[].start_tossup must be >= 1`);
            if (maxTossupNumber > 0 && startTossup > maxTossupNumber) {
              throw new Error(`Team ${teamName}: lineup_segments[].start_tossup exceeds max tossup (${maxTossupNumber})`);
            }

            const endTossup = (() => {
              if (endRaw === undefined || endRaw === null) return null;
              if (typeof endRaw !== "number" || !Number.isFinite(endRaw)) {
                throw new Error(`Team ${teamName}: lineup_segments[].end_tossup must be a number or null`);
              }
              const v = Math.trunc(endRaw);
              if (v !== endRaw) throw new Error(`Team ${teamName}: lineup_segments[].end_tossup must be an integer`);
              return v;
            })();

            const effectiveEnd = endTossup ?? (maxTossupNumber > 0 ? maxTossupNumber : startTossup);
            if (endTossup !== null) {
              if (endTossup < startTossup) {
                throw new Error(`Team ${teamName}: lineup_segments[].end_tossup must be >= start_tossup`);
              }
              if (maxTossupNumber > 0 && endTossup > maxTossupNumber) {
                throw new Error(`Team ${teamName}: lineup_segments[].end_tossup exceeds max tossup (${maxTossupNumber})`);
              }
            }

            if (startTossup <= lastCoveredEnd) {
              throw new Error(`Team ${teamName}: lineup_segments must be sorted and non-overlapping`);
            }
            if (maxTossupNumber > 0 && effectiveEnd < startTossup) {
              throw new Error(`Team ${teamName}: lineup_segments[].end_tossup invalid for packet`);
            }

            if (!Array.isArray(activeRaw)) throw new Error(`Team ${teamName}: lineup_segments[].active_players must be an array`);
            const activePlayerIds: string[] = [];
            for (const ap of activeRaw) {
              if (typeof ap !== "string") throw new Error(`Team ${teamName}: lineup_segments[].active_players must be strings`);
              const raw = ap.trim();
              if (!raw) continue;

              if (activeKind === "id") {
                if (!playerIds.has(raw)) throw new Error(`Team ${teamName}: lineup_segments references unknown player id: ${raw}`);
                if (activePlayerIds.includes(raw)) continue;
                activePlayerIds.push(raw);
                continue;
              }

              const key = `${teamName}\n${raw}`;
              const id = playerIdByTeamNameThenPlayerName.get(key) ?? (() => {
                if (isV3) throw new Error(`Team ${teamName}: lineup_segments must use active_player_ids in v3`);
                const created = makeId("player");
                players.push({ id: created, name: raw });
                playerIds.add(created);
                playerIdByTeamNameThenPlayerName.set(key, created);
                return created;
              })();
              if (activePlayerIds.includes(id)) continue;
              activePlayerIds.push(id);
            }

            segs.push({ startTossup, endTossup, activePlayerIds });
            lastCoveredEnd = effectiveEnd;
          }

          lineupSegments = segs;
        }

        if (lineupSegments?.length) {
          const map: Record<number, string[]> = {};
          for (const seg of lineupSegments) {
            map[seg.startTossup] = [...seg.activePlayerIds];
          }
          importedLineupsByTeamId[teamId] = map;
        }

        return { id: teamId, name: teamName, players };
      });
      const importedTeamsById = new Map(importedTeams.map((t) => [t.id, t]));

      function ensurePlayerId(teamName: string, playerName: string): string {
        const key = `${teamName}\n${playerName}`;
        const existing = playerIdByTeamNameThenPlayerName.get(key);
        if (existing) return existing;
        const team = importedTeams.find((tt) => tt.name === teamName);
        if (!team) throw new Error(`Attempt references unknown team: ${teamName}`);
        const id = makeId("player");
        team.players.push({ id, name: playerName });
        playerIdByTeamNameThenPlayerName.set(key, id);
        return id;
      }

      const stateObj = obj.state;
      const stateRec = (stateObj && typeof stateObj === "object") ? (stateObj as Record<string, unknown>) : null;
      const importedPairIdx = stateRec?.pair_index;
      if (stateRec && (typeof importedPairIdx !== "number" || !Number.isFinite(importedPairIdx))) {
        throw new Error("state.pair_index must be a number");
      }

      const attemptsByQuestionIdObj = stateRec?.attempts_by_question_id;
      if (stateRec && (!attemptsByQuestionIdObj || typeof attemptsByQuestionIdObj !== "object")) {
        throw new Error("state.attempts_by_question_id must be an object");
      }

      const questionIds = new Set((loadedPacket.questions ?? []).map((qq) => qq.id));

      function decodeLocation(location: unknown): AttemptLocation {
        if (!location || typeof location !== "object") throw new Error("Attempt.location must be an object");
        const lr = location as Record<string, unknown>;
        if (lr.kind === "end") return { kind: "end" };
        if (lr.kind === "question") {
          if (typeof lr.word_index !== "number") throw new Error("Question location missing word_index");
          return { kind: "question", wordIndex: lr.word_index };
        }
        if (lr.kind === "option") {
          if (typeof lr.option_index !== "number") throw new Error("Option location missing option_index");
          if (typeof lr.word_index !== "number") throw new Error("Option location missing word_index");
          return { kind: "option", optionIndex: lr.option_index, wordIndex: lr.word_index };
        }
        throw new Error(`Unknown location kind: ${String(lr.kind)}`);
      }

      const attemptsByQuestionId = (attemptsByQuestionIdObj ?? {}) as Record<string, unknown>;
      const importedAttempts: Record<number, Attempt[]> = {};
      for (const [questionIdStr, list] of Object.entries(attemptsByQuestionId)) {
        const questionId = Number(questionIdStr);
        if (!Number.isFinite(questionId)) continue;
        if (!questionIds.has(questionId)) continue;
        if (!Array.isArray(list)) throw new Error(`attempts_by_question_id.${questionIdStr} must be an array`);

        const decoded: Attempt[] = [];
        for (const item of list) {
          if (!item || typeof item !== "object") throw new Error("Attempt must be an object");
          const ar = item as Record<string, unknown>;
          const teamId = (() => {
            if (isV3) {
              const raw = ar.team_id;
              if (typeof raw !== "string" || !raw.trim()) throw new Error("Attempt.team_id must be a non-empty string");
              const id = raw.trim();
              if (!importedTeamsById.has(id)) throw new Error(`Attempt references unknown team id: ${id}`);
              return id;
            }
            if (typeof ar.team !== "string") throw new Error("Attempt.team must be a string");
            const teamName = ar.team.trim();
            const id = teamIdByName.get(teamName);
            if (!id) throw new Error(`Attempt references unknown team: ${teamName}`);
            return id;
          })();

          const playerId = (() => {
            if (isV3) {
              const raw = ar.player_id;
              if (raw === null || raw === undefined) return undefined;
              if (typeof raw !== "string" || !raw.trim()) throw new Error("Attempt.player_id must be a string or null");
              const id = raw.trim();
              const allowed = playerIdsByTeamId.get(teamId);
              if (allowed && !allowed.has(id)) throw new Error(`Attempt references unknown player id: ${id}`);
              return id;
            }

            const playerField = ar.player;
            const playerName = typeof playerField === "string" ? playerField.trim() : null;
            if (!playerName) return undefined;
            const teamName = (() => {
              const rawTeam = ar.team;
              return typeof rawTeam === "string" ? rawTeam.trim() : "";
            })();
            return ensurePlayerId(teamName, playerName);
          })();

          if (ar.result !== "correct" && ar.result !== "incorrect") throw new Error("Attempt.result invalid");
          if (typeof ar.token !== "string") throw new Error("Attempt.token must be a string");
          if (typeof ar.is_end !== "boolean") throw new Error("Attempt.is_end must be a boolean");

          decoded.push({
            teamId,
            playerId,
            result: ar.result,
            token: ar.token,
            isEnd: ar.is_end,
            location: decodeLocation(ar.location),
          });
        }
        if (decoded.length) importedAttempts[questionId] = decoded;
      }

      const byPair: Record<number, { tossupId?: number; bonusId?: number }> = {};
      for (const qq of loadedPacket.questions ?? []) {
        const row = byPair[qq.pair_id] ?? (byPair[qq.pair_id] = {});
        if (qq.question_type === "TOSSUP") row.tossupId = qq.id;
        if (qq.question_type === "BONUS") row.bonusId = qq.id;
      }

      for (const row of Object.values(byPair)) {
        if (!row.bonusId || !row.tossupId) continue;
        const tossupList = importedAttempts[row.tossupId] ?? [];
        const winnerTeamId = tossupList.find((a) => a.result === "correct")?.teamId ?? null;
        if (!winnerTeamId) {
          delete importedAttempts[row.bonusId];
          continue;
        }

        const bonusList = importedAttempts[row.bonusId] ?? [];
        if (!bonusList.length) continue;
        const first = bonusList[0];
        importedAttempts[row.bonusId] = [{ ...first, teamId: winnerTeamId, playerId: undefined }];
      }

      const pairIdSet = new Set((loadedPacket.questions ?? []).map((qq) => qq.pair_id));
      const pairCount = pairIdSet.size;
      const clampedPairIdx = typeof importedPairIdx === "number"
        ? (pairCount <= 0 ? 0 : clamp(importedPairIdx, 0, pairCount - 1))
        : 0;

      let importedEventLog: ScoresheetEvent[] = [];
      if (exportVersion === 2 || exportVersion === 3) {
        const eventLogObj = obj.event_log;
        if (eventLogObj && typeof eventLogObj === "object") {
          const eventLogRec = eventLogObj as Record<string, unknown>;
          const eventsRaw = eventLogRec.events;
          if (Array.isArray(eventsRaw)) {
            importedEventLog = eventsRaw
              .filter((ev) => !!ev && typeof ev === "object")
              .map((ev, idx) => {
                const rec = ev as Record<string, unknown>;
                const seq = typeof rec.seq === "number" ? rec.seq : idx + 1;
                const type = typeof rec.type === "string" ? rec.type : "";
                const payload = (rec.payload ?? {}) as Record<string, unknown>;
                const clientEventId = typeof rec.client_event_id === "string" ? rec.client_event_id : `imported_${idx}`;
                const clientTs = typeof rec.client_ts === "string" ? rec.client_ts : undefined;
                return {
                  id: clientEventId,
                  type: type as ScoresheetEvent["type"],
                  payload: payload as ScoresheetEvent["payload"],
                  clientTs,
                  seq,
                };
              })
              .filter((ev) => !!ev.type);
          }
        }
      }
      const importedEventsForState: ScoresheetEvent[] = importedEventLog.filter((ev) => {
        if (ev.type === "marker.set") {
          const payload = ev.payload as Record<string, unknown>;
          const boundary = Number(payload.boundary_before_question);
          const kind = payload.kind;
          return Number.isFinite(boundary) && (kind === "HALFTIME" || kind === "BREAK");
        }
        if (ev.type === "marker.removed") {
          const payload = ev.payload as Record<string, unknown>;
          const boundary = Number(payload.boundary_before_question);
          return Number.isFinite(boundary);
        }
        return false;
      });

      setPacket(loadedPacket);
      setGame({ teams: importedTeams });
      setSnapshotMeta((() => {
        if (importedSnapshotMeta) return importedSnapshotMeta;
        const names = importedTeams.map((t) => t.name.trim()).filter(Boolean).slice(0, 2);
        const [team_a, team_b] = [...names].sort((x, y) => x.localeCompare(y));
        return {
          tournament_slug: null,
          packet_year: loadedPacket.year,
          packet_name: loadedPacket.packet,
          team_a: team_a ?? "TeamA",
          team_b: team_b ?? "TeamB",
          game_instance_id: makeGameInstanceId(),
        };
      })());
      const baseState = initialScoresheetState();
      baseState.pairIndex = clampedPairIdx;
      baseState.lineupsByTeamId = importedLineupsByTeamId;
      baseState.attemptsByQuestionId = importedAttempts;
      setScoresheetBaseState(baseState);
      setScoresheetEvents(importedEventsForState);
      setAttemptEditor(null);
      setLastActor(null);
      setScoresheetBoundaryPopup(null);
      setLineupChangeModal(null);
      setIsNewGameOpen(false);
      closeLoadGame();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load game file.";
      setLoadGameError(msg);
    } finally {
      setIsLoadingGame(false);
    }
  }

  function prev() {
    setAttemptEditor(null);
    const nextIndex = Math.max(0, pairIdx - 1);
    if (nextIndex !== pairIdx) {
      appendScoresheetEvent(buildScoresheetEvent("cursor.pair_index_set", { pair_index: nextIndex }));
    }
  }

  function next() {
    setAttemptEditor(null);
    const nextIndex = Math.min(pairRows.length - 1, pairIdx + 1);
    if (nextIndex !== pairIdx) {
      appendScoresheetEvent(buildScoresheetEvent("cursor.pair_index_set", { pair_index: nextIndex }));
    }
  }

  function goToPair(pairId: number) {
    const i = pairRows.findIndex((p) => p.pairId === pairId);
    if (i < 0) return;
    setAttemptEditor(null);
    if (i !== pairIdx) {
      appendScoresheetEvent(buildScoresheetEvent("cursor.pair_index_set", { pair_index: i }));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setAttemptSelection(
    question: Question,
    selection: Pick<Attempt, "token" | "isEnd" | "location">,
    anchorEl: HTMLElement
  ) {
    if (!game) return;
    const currentGame = game;

    if (question.question_type === "BONUS") return;

    const anchor = getAnchorRect(anchorEl);

    const currentAttempts = attempts[question.id] ?? [];
    const currentCorrect = currentAttempts.find((a) => a.result === "correct");

    const existingAtLocation = currentAttempts.find((a) => isSameLocation(a.location, selection.location));

    function isPlayerAvailable(teamId: string, playerId: string) {
      const teamAlready = currentAttempts.some((a) => a.teamId === teamId);
      const playerAlready = currentAttempts.some((a) => a.playerId === playerId);
      return !teamAlready && !playerAlready;
    }

    function isPlayerActive(teamId: string, playerId: string) {
      const team = currentGame.teams.find((t) => t.id === teamId);
      if (!team) return false;
      return activePlayerIdsForTeamAtTossup(team, question.pair_id).has(playerId);
    }

    function isPlayerSelectable(teamId: string, playerId: string) {
      return isPlayerAvailable(teamId, playerId) && isPlayerActive(teamId, playerId);
    }

    let preferred: { teamId: string; playerId: string } | null = null;
    if (existingAtLocation?.playerId && isPlayerSelectable(existingAtLocation.teamId, existingAtLocation.playerId)) {
      preferred = { teamId: existingAtLocation.teamId, playerId: existingAtLocation.playerId };
    } else if (currentCorrect?.playerId && isPlayerSelectable(currentCorrect.teamId, currentCorrect.playerId)) {
      preferred = { teamId: currentCorrect.teamId, playerId: currentCorrect.playerId };
    } else if (
      lastActor?.playerId &&
      currentGame.teams.some((t) => t.id === lastActor.teamId && t.players.some((p) => p.id === lastActor.playerId)) &&
      isPlayerSelectable(lastActor.teamId, lastActor.playerId)
    ) {
      preferred = { teamId: lastActor.teamId, playerId: lastActor.playerId };
    } else {
      for (const team of currentGame.teams) {
        if (currentAttempts.some((a) => a.teamId === team.id)) continue;
        const active = activePlayerIdsForTeamAtTossup(team, question.pair_id);
        const candidate = team.players.find((p) => active.has(p.id) && isPlayerAvailable(team.id, p.id));
        if (!candidate) continue;
        preferred = { teamId: team.id, playerId: candidate.id };
        break;
      }
    }

    if (!preferred) return;

    const preferredTeam = currentGame.teams.find((t) => t.id === preferred.teamId);
    const preferredActiveCount = (() => {
      if (!preferredTeam) return 0;
      const ids = activePlayerIdsForTeamAtTossup(preferredTeam, question.pair_id);
      return preferredTeam.players.filter((p) => ids.has(p.id)).length;
    })();
    const usePlayerPanel = preferredActiveCount > 0 && preferredActiveCount <= 6;
    const position = computePopupPosition(anchor, {
      width: 220,
      height: estimateAttemptPopupHeightPx(preferredActiveCount, usePlayerPanel),
    });

    setAttemptEditor({
      questionId: question.id,
      left: position.left,
      top: position.top,
      selection: { ...selection, ...preferred },
    });
  }

  function setBonusResult(question: Question, result: AttemptResult) {
    if (question.question_type !== "BONUS") return;

    setAttemptEditor(null);
    const tossup = tossupQuestionByPairId.get(question.pair_id);
    const tossupAttempts = tossup ? attempts[tossup.id] ?? [] : [];
    const winnerTeamId = tossupAttempts.find((a) => a.result === "correct")?.teamId ?? null;
    if (!winnerTeamId) return;

    appendScoresheetEvent(buildScoresheetEvent("bonus.result_set", {
      bonus_question_id: question.id,
      team_id: winnerTeamId,
      result,
    }));
  }

  function openBonusResultEditor(question: Question, anchorX: number, anchorY: number) {
    if (question.question_type !== "BONUS") return;
    if (!bonusEnabled) return;

    const tossup = tossupQuestionByPairId.get(question.pair_id);
    const tossupAttempts = tossup ? attempts[tossup.id] ?? [] : [];
    const winnerTeamId = tossupAttempts.find((a) => a.result === "correct")?.teamId ?? null;
    if (!winnerTeamId) return;

    const anchor = getAnchorRectFromPoint(anchorX, anchorY);
    const position = computePopupPosition(anchor);

    setAttemptEditor(null);
    setBonusResultEditor({ questionId: question.id, left: position.left, top: position.top });
  }

  function setAttemptResult(questionId: number, result: AttemptResult) {
    const selection = attemptEditor?.questionId === questionId ? attemptEditor.selection : undefined;
    if (!selection) return;
    const question = questions.find((qq) => qq.id === questionId);
    if (!question) return;

    if (question.question_type === "BONUS") {
      appendScoresheetEvent(buildScoresheetEvent("bonus.result_set", {
        bonus_question_id: questionId,
        team_id: selection.teamId,
        result,
      }));
      return;
    }

    if (!selection.playerId) return;
    const current = attempts[questionId] ?? [];
    const currentCorrect = current.find((a) => a.result === "correct");
    if (currentCorrect && currentCorrect.playerId !== selection.playerId && result !== "correct") {
      return;
    }

    let nextList = current.filter(
      (a) => a.teamId !== selection.teamId && a.playerId !== selection.playerId
    );
    if (result === "correct") nextList = nextList.filter((a) => a.result !== "correct");
    nextList = [...nextList, { ...selection, result, playerId: selection.playerId }];

    const events: ScoresheetEvent[] = [
      buildScoresheetEvent("attempt.recorded", {
        question_id: questionId,
        team_id: selection.teamId,
        player_id: selection.playerId,
        result,
        token: selection.token,
        is_end: selection.isEnd,
        location: encodeLocationForEvent(selection.location),
      }),
    ];

    const bonus = bonusQuestionByPairId.get(question.pair_id);
    if (bonus) {
      const winnerTeamId = nextList.find((a) => a.result === "correct")?.teamId ?? null;
      const bonusAttempt = attempts[bonus.id]?.[0];
      if (!winnerTeamId || (bonusAttempt && bonusAttempt.teamId !== winnerTeamId)) {
        events.push(buildScoresheetEvent("attempts.question_cleared", { question_id: bonus.id }));
      }
    }

    appendScoresheetEvents(events);

    if (question.question_type === "TOSSUP") {
      setLastActor({ teamId: selection.teamId, playerId: selection.playerId });
    }
  }

  function clearAttemptsForQuestion(question: Question) {
    const events: ScoresheetEvent[] = [
      buildScoresheetEvent("attempts.question_cleared", { question_id: question.id }),
    ];

    if (question.question_type === "TOSSUP") {
      const bonus = bonusQuestionByPairId.get(question.pair_id);
      if (bonus) {
        events.push(buildScoresheetEvent("attempts.question_cleared", { question_id: bonus.id }));
      }
    }

    appendScoresheetEvents(events);

    if (question.question_type === "TOSSUP") setLastActor(null);
  }

  useEffect(() => {
    if (!attemptEditor) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAttemptEditor(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attemptEditor]);

  useEffect(() => {
    if (!bonusResultEditor) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setBonusResultEditor(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bonusResultEditor]);

  useEffect(() => {
    if (!bonusResultEditor) return;
    const currentBonusResultEditor = bonusResultEditor;

    function onMouseDown(e: MouseEvent) {
      const el = bonusPopupRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;

      if (e.target instanceof HTMLElement) {
        const toggleEl = e.target.closest("[data-bonus-question-id]");
        if (
          toggleEl &&
          toggleEl.getAttribute("data-bonus-question-id") === String(currentBonusResultEditor.questionId)
        ) {
          return;
        }
      }

      setBonusResultEditor(null);
    }

    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [bonusResultEditor]);

  function openScoresheetAttemptEditModal(question: Question, teamId: string, anchorEl: HTMLElement) {
    if (!game) return;
    if (question.question_type !== "TOSSUP") return;

    const attempt = (attempts[question.id] ?? []).find((a) => a.teamId === teamId);
    if (!attempt?.result || !attempt.playerId) return;

    const anchor = getAnchorRect(anchorEl);
    const position = computePopupPosition(anchor, { width: 320, height: 240 });

    setAttemptEditor(null);
    setBonusResultEditor(null);
    setScoresheetBonusEditModal(null);

    setScoresheetAttemptEditModal({
      questionId: question.id,
      teamId,
      playerId: attempt.playerId,
      left: position.left,
      top: position.top,
    });
  }

  function openScoresheetBonusEditModal(question: Question, teamId: string, anchorEl: HTMLElement) {
    if (!game) return;
    if (question.question_type !== "BONUS") return;

    const attempt = (attempts[question.id] ?? []).find((a) => a.teamId === teamId);
    if (!attempt?.result) return;

    const anchor = getAnchorRect(anchorEl);
    const position = computePopupPosition(anchor, { width: 320, height: 220 });

    setAttemptEditor(null);
    setBonusResultEditor(null);
    setScoresheetAttemptEditModal(null);

    setScoresheetBonusEditModal({
      questionId: question.id,
      teamId,
      score: attempt.result === "correct" ? "plus" : "zero",
      left: position.left,
      top: position.top,
    });
  }

  function saveScoresheetAttemptEditModal() {
    const state = scoresheetAttemptEditModal;
    if (!state) return;

    const question = questionsById.get(state.questionId);
    if (!question || question.question_type !== "TOSSUP") return;

    const team = teams.find((t) => t.id === state.teamId);
    if (!team) return;

    const activeIds = activePlayerIdsForTeamAtTossup(team, question.pair_id);
    if (!activeIds.has(state.playerId)) return;

    const current = attempts[question.id] ?? [];
    const existing = current.find((a) => a.teamId === state.teamId);
    if (!existing?.result || !existing.playerId) return;

    const nextAttempt: Attempt = { ...existing, playerId: state.playerId };

    const events: ScoresheetEvent[] = [
      buildScoresheetEvent("attempt.recorded", {
        question_id: question.id,
        team_id: nextAttempt.teamId,
        player_id: nextAttempt.playerId,
        result: nextAttempt.result,
        token: nextAttempt.token,
        is_end: nextAttempt.isEnd,
        location: encodeLocationForEvent(nextAttempt.location),
      }),
    ];

    const nextList = (() => {
      let next = current.filter((a) => a.teamId !== nextAttempt.teamId && a.playerId !== nextAttempt.playerId);
      if (nextAttempt.result === "correct") next = next.filter((a) => a.result !== "correct");
      return [...next, nextAttempt];
    })();

    const bonus = bonusQuestionByPairId.get(question.pair_id);
    if (bonus) {
      const winnerTeamId = nextList.find((a) => a.result === "correct")?.teamId ?? null;
      const bonusAttempt = attempts[bonus.id]?.[0];
      if (!winnerTeamId || (bonusAttempt && bonusAttempt.teamId !== winnerTeamId)) {
        events.push(buildScoresheetEvent("attempts.question_cleared", { question_id: bonus.id }));
      }
    }

    appendScoresheetEvents(events);
    setLastActor({ teamId: nextAttempt.teamId, playerId: nextAttempt.playerId });
    setScoresheetAttemptEditModal(null);
  }

  function saveScoresheetBonusEditModal() {
    const state = scoresheetBonusEditModal;
    if (!state) return;

    const question = questionsById.get(state.questionId);
    if (!question || question.question_type !== "BONUS") return;

    const tossup = tossupQuestionByPairId.get(question.pair_id);
    const tossupAttempts = tossup ? attempts[tossup.id] ?? [] : [];
    const winnerTeamId = tossupAttempts.find((a) => a.result === "correct")?.teamId ?? null;
    if (!winnerTeamId) return;
    if (winnerTeamId !== state.teamId) return;

    appendScoresheetEvent(buildScoresheetEvent("bonus.result_set", {
      bonus_question_id: question.id,
      team_id: winnerTeamId,
      result: state.score === "plus" ? "correct" : "incorrect",
    }));

    setScoresheetBonusEditModal(null);
  }

  function markedResultForQuestionLocation(questionId: number, location: AttemptLocation): AttemptResult | undefined {
    const list = attempts[questionId] ?? [];
    const found = list.find((a) => isSameLocation(a.location, location));
    return found?.result;
  }

  function renderQuestionSection(question: Question, title: string, disabled: boolean) {
    const selection = attemptEditor?.questionId === question.id ? attemptEditor.selection : null;
    const richParts = splitRichParts(question.question_text);
    const sectionClasses = ["qaSection", disabled ? "qaSectionDisabled" : ""].filter(Boolean).join(" ");
    const isBonus = question.question_type === "BONUS";
    const hasOptions = (question.options?.length ?? 0) > 0;
    const wordWrapClickableClass = disabled ? "" : "wordWrapClickable";
    const bonusResult = isBonus ? (attempts[question.id] ?? [])[0]?.result : undefined;
    const hasClearableAttempts = (() => {
      const ownAttempts = attempts[question.id] ?? [];
      if (isBonus) return ownAttempts.length > 0;
      const bonus = bonusQuestionByPairId.get(question.pair_id);
      const bonusAttempts = bonus ? attempts[bonus.id] ?? [] : [];
      return ownAttempts.length > 0 || bonusAttempts.length > 0;
    })();
    const clearDisabled = disabled || !hasClearableAttempts;
    const bonusTintClass =
      isBonus && bonusResult === "correct" ? "qaSectionCorrect" : isBonus && bonusResult === "incorrect" ? "qaSectionIncorrect" : "";

    function renderEndToken(keyPrefix: string): ReactElement[] {
      const endLocation: AttemptLocation = { kind: "end" };
      const endSelected = selection?.location.kind === "end";
      const endMarked = markedResultForQuestionLocation(question.id, endLocation);
      const endCorrectnessClass =
        endMarked === "correct"
          ? "wordWrapCorrect"
          : endMarked === "incorrect"
            ? "wordWrapIncorrect"
            : "";

      return [
        <span key={`${keyPrefix}-space`} aria-hidden="true">{" "}</span>,
        <span
          key={`${keyPrefix}-wrap`}
          className={[
            "wordWrap",
            wordWrapClickableClass,
            endSelected ? "wordWrapSelected" : "",
            endCorrectnessClass,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <button
            type="button"
            className={["word", "wordEnd"].join(" ")}
            disabled={disabled}
            onClick={(e) =>
              setAttemptSelection(
                question,
                { token: END_TOKEN, isEnd: true, location: endLocation },
                e.currentTarget
              )
            }
          >
            {END_TOKEN}
          </button>
        </span>,
      ];
    }

    return (
      <div
        className={[sectionClasses, bonusTintClass, isBonus ? "qaSectionClickable" : ""].filter(Boolean).join(" ")}
        data-bonus-question-id={isBonus ? String(question.id) : undefined}
        aria-label={title}
        aria-disabled={disabled}
        onClick={(e) => {
          if (!isBonus) return;
          if (disabled) return;
          if (e.target instanceof HTMLElement && e.target.closest("button, a, input, select, textarea")) return;
          if (bonusResultEditor?.questionId === question.id) {
            setBonusResultEditor(null);
            return;
          }
          openBonusResultEditor(question, e.clientX, e.clientY);
        }}
      >
        <div className="qaHeader">
          <div className="qaHeaderRow">
            <div className="qaTitle">{title}</div>
            <button
              type="button"
              className="secondary qaClearButton"
              disabled={clearDisabled}
              onClick={() => {
                setBonusResultEditor(null);
                setAttemptEditor(null);
                clearAttemptsForQuestion(question);
              }}
              aria-label={`Clear ${title} attempts`}
            >
              <svg className="refreshIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M20 12a8 8 0 1 1-2.34-5.66"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M20 4v6h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="questionText readText">
          <span className="questionMetaInline">
            {question.pair_id}){" "}
            {(DISPLAY_CATEGORY[question.category] ?? question.category).toUpperCase()}{" "}
            <em>{DISPLAY_QUESTION_STYLE[question.question_style] ?? question.question_style}</em>{" "}
          </span>
          {isBonus ? (
            <span>{renderRichParts(richParts)}</span>
          ) : (
            (() => {
              let wordIndex = 0;
              const nodes = tokenizeRichPartsForWordSelection(richParts).map((seg, segIndex) => {
                if (seg.kind === "math") {
                  const html = katex.renderToString(seg.latex, { throwOnError: false, displayMode: false });
                  return (
                    <span
                      key={`q-math-${seg.partIndex}-${segIndex}`}
                      className="mathInline"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                }

                if (seg.kind === "sep") {
                  return (
                    <span key={`q-sep-${segIndex}`} aria-hidden="true">
                      {seg.text}
                    </span>
                  );
                }

                const tokenText = seg.chunks.map((c) => c.text).join("");
                const defaultBold = seg.chunks[0]?.bold ?? false;

                const location: AttemptLocation = { kind: "question", wordIndex };
                const selected = selection?.location.kind === "question" && selection.location.wordIndex === wordIndex;
                const marked = markedResultForQuestionLocation(question.id, location);
                const correctnessClass =
                  marked === "correct" ? "wordWrapCorrect" : marked === "incorrect" ? "wordWrapIncorrect" : "";

                wordIndex++;

                return (
                  <span key={`q-word-${segIndex}`}>
                    <span
                      className={[
                        "wordWrap",
                        wordWrapClickableClass,
                        selected ? "wordWrapSelected" : "",
                        correctnessClass,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <button
                        type="button"
                        className={["word", defaultBold ? "wordBold" : ""].filter(Boolean).join(" ")}
                        disabled={disabled}
                        onClick={(e) =>
                          setAttemptSelection(question, { token: tokenText, isEnd: false, location }, e.currentTarget)
                        }
                      >
                        {seg.chunks.length === 1 ? tokenText : (
                          seg.chunks.map((chunk, chunkIndex) => {
                            const needsStyle = chunk.bold !== defaultBold;
                            return (
                              <span
                                key={`${chunkIndex}-${chunk.bold ? "b" : "n"}`}
                                style={needsStyle ? { fontWeight: chunk.bold ? 700 : 400 } : undefined}
                              >
                                {chunk.text}
                              </span>
                            );
                          })
                        )}
                      </button>
                    </span>
                  </span>
                );
              });

              if (!hasOptions) nodes.push(...renderEndToken("q-end"));

              return nodes;
            })()
          )}
        </div>

        {hasOptions && (
          <ol className="options">
            {question.options.map((opt, optionIndex) => {
              const optRichParts = splitRichParts(opt);
              const label =
                question.question_style === "MULTIPLE_CHOICE"
                  ? ["W", "X", "Y", "Z"][optionIndex] ?? String(optionIndex + 1)
                  : String(optionIndex + 1);

              if (isBonus) {
                return (
                  <li key={optionIndex} className="readText">
                    <span className="optionLabel">{label})</span>
                    {needsLeadingSpaceBeforeRichParts(optRichParts) ? " " : null}
                    {renderRichParts(optRichParts)}
                  </li>
                );
              }

              const labelLocation: AttemptLocation = { kind: "option", optionIndex, wordIndex: -1 };
              const labelSelected =
                selection?.location.kind === "option" &&
                selection.location.optionIndex === optionIndex &&
                selection.location.wordIndex === -1;
              const labelMarked = markedResultForQuestionLocation(question.id, labelLocation);
              const labelCorrectnessClass =
                labelMarked === "correct"
                  ? "wordWrapCorrect"
                  : labelMarked === "incorrect"
                    ? "wordWrapIncorrect"
                    : "";

              return (
                <li key={optionIndex} className="readText">
                  <span
                    className={[
                      "wordWrap",
                      "wordWrapLabel",
                      wordWrapClickableClass,
                      labelSelected ? "wordWrapSelected" : "",
                      labelCorrectnessClass,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button
                      type="button"
                      className={["word", "wordLabel"].join(" ")}
                      disabled={disabled}
                      onClick={(e) =>
                        setAttemptSelection(
                          question,
                          { token: label, isEnd: false, location: labelLocation },
                          e.currentTarget
                        )
                      }
                    >
                      {label})
                    </button>
                  </span>
                  {needsLeadingSpaceBeforeRichParts(optRichParts) ? " " : null}

                  {(() => {
                    let wordIndex = 0;
                    return tokenizeRichPartsForWordSelection(optRichParts).map((seg, segIndex) => {
                      if (seg.kind === "math") {
                        const html = katex.renderToString(seg.latex, { throwOnError: false, displayMode: false });
                        return (
                          <span
                            key={`o-${optionIndex}-math-${seg.partIndex}-${segIndex}`}
                            className="mathInline"
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
                        );
                      }

                      if (seg.kind === "sep") {
                        return (
                          <span key={`o-${optionIndex}-sep-${segIndex}`} aria-hidden="true">
                            {seg.text}
                          </span>
                        );
                      }

                      const tokenText = seg.chunks.map((c) => c.text).join("");
                      const defaultBold = seg.chunks[0]?.bold ?? false;

                      const location: AttemptLocation = { kind: "option", optionIndex, wordIndex };
                      const selected =
                        selection?.location.kind === "option" &&
                        selection.location.optionIndex === optionIndex &&
                        selection.location.wordIndex === wordIndex;
                      const marked = markedResultForQuestionLocation(question.id, location);
                      const correctnessClass =
                        marked === "correct" ? "wordWrapCorrect" : marked === "incorrect" ? "wordWrapIncorrect" : "";

                      wordIndex++;

                      return (
                        <span key={`o-${optionIndex}-word-${segIndex}`}>
                          <span
                            className={[
                              "wordWrap",
                              wordWrapClickableClass,
                              selected ? "wordWrapSelected" : "",
                              correctnessClass,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <button
                              type="button"
                              className={["word", defaultBold ? "wordBold" : ""].filter(Boolean).join(" ")}
                              disabled={disabled}
                              onClick={(e) =>
                                setAttemptSelection(
                                  question,
                                  { token: tokenText, isEnd: false, location },
                                  e.currentTarget
                                )
                              }
                            >
                              {seg.chunks.length === 1 ? tokenText : (
                                seg.chunks.map((chunk, chunkIndex) => {
                                  const needsStyle = chunk.bold !== defaultBold;
                                  return (
                                    <span
                                      key={`${chunkIndex}-${chunk.bold ? "b" : "n"}`}
                                      style={needsStyle ? { fontWeight: chunk.bold ? 700 : 400 } : undefined}
                                    >
                                      {chunk.text}
                                    </span>
                                  );
                                })
                              )}
                            </button>
                          </span>
                        </span>
                      );
                    });
                  })()}
                  {optionIndex === question.options.length - 1 ? renderEndToken(`o-end-${optionIndex}`) : null}
                </li>
              );
            })}
          </ol>
        )}

        <div className="answerInline">
          <div className="answerLine">
            <span className="answerTitle">ANSWER:</span>{" "}
            <span className="answerBody">{renderRichParts(splitRichParts(formatCorrectAnswer(question)))}</span>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!attemptEditor) return;

    function onMouseDown(e: MouseEvent) {
      const el = attemptPopupRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setAttemptEditor(null);
    }

    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [attemptEditor]);

  if (!game) {
    return (
      <div className="sbAppFrame">
        <MossTopNav />
        <div className="page">
          <div className="shell">
            <div className="card mossHeroCard">
              <h1 className="sbTitle">MoSS</h1>
              <p className="sbMuted">Moderator Scoring System</p>

              <div className="mossHeroActions">
                <button type="button" className="mossHeroAction" onClick={openNewGame}>
                  <span className="mossHeroActionText">
                    <span className="mossHeroActionTitle">New Game</span>
                    <span className="mossHeroActionSubtext">Start a new match</span>
                  </span>
                  <span className="mossHeroActionArrow" aria-hidden="true">
                    →
                  </span>
                </button>
                <button type="button" className="mossHeroAction" onClick={openLoadGame}>
                  <span className="mossHeroActionText">
                    <span className="mossHeroActionTitle">Load Game</span>
                    <span className="mossHeroActionSubtext">
                      Load match from existing game file
                    </span>
                  </span>
                  <span className="mossHeroActionArrow" aria-hidden="true">
                    →
                  </span>
                </button>
              </div>
            </div>
          </div>

          {isNewGameOpen && (
            <div className="modalOverlay" role="dialog" aria-label="New Game" onClick={closeNewGame}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <h2 className="modalTitle">New Game</h2>
                    <button
                      type="button"
                      className="secondary qaClearButton"
                      onClick={resetRostersToBlankCustom}
                      aria-label="Reset rosters"
                      title="Reset rosters"
                    >
                      <svg className="refreshIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M20 12a8 8 0 1 1-2.34-5.66"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M20 4v6h-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="modalBody">
                  <div className="packetRow" style={{ marginBottom: 14 }}>
                    <div className="packetMeta">
                      <div className="fieldLabel">Rosters</div>
                      <div className="packetBox">
                        <div className="packetBoxText">
                          <div className="packetName">{draftRosterChoice.label}</div>
                          {(() => {
                            const teamsCount = fieldRoster?.teams.length ?? 0;
                            if (rosterLoadError) return <div className="packetSubtext">{rosterLoadError}</div>;

                            if (draftRosterChoice.kind === "custom") {
                              return <div className="packetSubtext">Manually enter team and player names</div>;
                            }

                            if (draftRosterChoice.kind === "previous") {
                              return <div className="packetSubtext">Previously used roster from browser cache</div>;
                            }

                            if (draftRosterChoice.kind === "upload") {
                              return <div className="packetSubtext">{draftRosterChoice.fileName} ({teamsCount} teams)</div>;
                            }

                            const tournamentName = fieldRoster?.tournament?.name ?? draftRosterChoice.tournamentSlug;
                            return <div className="packetSubtext">{tournamentName} ({teamsCount} teams)</div>;
                          })()}
                        </div>
                        <div className="packetBoxButtons">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setIsRosterChooserOpen(true)}
                          >
                            Change…
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={downloadCurrentRosters}
                            disabled={!canDownloadRosters}
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="teamGridScroll">
                    <DndContext
                      sensors={draftTeamDndSensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToParentElement]}
                      onDragEnd={handleDraftTeamDragEnd}
                    >
                      <div className="teamGrid">
                        <SortableContext items={draftTeams.map((t) => t.id)} strategy={rectSortingStrategy}>
                          {draftTeams.map((team, teamIndex) => (
                            <SortableDraftTeamCol
                              key={team.id}
                              team={team}
                              teamIndex={teamIndex}
                              canRemoveTeam={draftTeams.length > 1}
                              fieldRoster={fieldRoster}
                              selectedRosterTeamByDraftTeamId={selectedRosterTeamByDraftTeamId}
                              onApplyRosterTeam={applyFieldRosterTeamToDraftTeam}
                              onUpdateTeamName={updateTeamName}
                              onRemoveTeam={removeTeam}
                              onAddPlayer={addPlayer}
                              onUpdatePlayerName={updatePlayerName}
                              onTogglePlayerIn={toggleDraftPlayerIn}
                              onRemovePlayer={removePlayer}
                              onReorderPlayers={reorderDraftPlayers}
                            />
                          ))}
                        </SortableContext>

                        <div className="addTeamCol">
                          <button
                            type="button"
                            className="addTeamButton"
                            onClick={addTeam}
                            title="Add team"
                            aria-label="Add team"
                          >
                            <span className="addIcon">+</span>
                          </button>
                        </div>
                      </div>
                    </DndContext>
                  </div>

                  <div className="modalFooter">
                    <div className="packetRow">
                      <div className="packetMeta">
                        <div className="fieldLabel">
                          Packet <span className="required">*</span>
                        </div>
                        <div className="packetBox">
                          <div className="packetBoxText">
                            {draftPacketChoice ? (
                              <>
                                <div className="packetName">{draftPacketChoice.label}</div>
                                <div className="packetSubtext">{draftPacketChoice.subtext}</div>
                              </>
                            ) : (
                              <>
                                <div className="packetName">Select Packet</div>
                                <div className="packetSubtext">No packet selected</div>
                              </>
                            )}
                            {packetLoadError && <div className="packetError">{packetLoadError}</div>}
                          </div>
                          <div className="packetBoxButtons">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setIsPacketChooserOpen(true)}
                            >
                              {draftPacketChoice ? "Change…" : "Load…"}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="spacer" />
                      <div className="packetActions">
                        <button type="button" onClick={startNewGame} disabled={!canStartNewGame}>
                          Start
                        </button>
                        <button type="button" className="secondary" onClick={closeNewGame}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isNewGameOpen && (
            <input
              ref={packetFileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onPacketFilePicked(file);
              }}
            />
          )}

          {isNewGameOpen && (
            <input
              ref={rosterFileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onRosterFilePicked(file);
              }}
            />
          )}

          {isNewGameOpen && isRosterChooserOpen && (
            <div
              className="modalOverlay"
              role="dialog"
              aria-label="Choose rosters"
              onClick={(e) => {
                e.stopPropagation();
                setIsRosterChooserOpen(false);
              }}
            >
              <div className="modal chooserModal" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                  <h2 className="modalTitle">Choose Rosters</h2>
                </div>
                <div className="modalBody">
                  <div className="chooserGrid">
                    <button type="button" className="chooserOption" onClick={chooseCustomRoster}>
                      <div className="chooserOptionTitle">Enter Custom Roster</div>
                      <div className="chooserOptionSubtext">Manually enter team and player names</div>
                    </button>
                    <button type="button" className="chooserOption" onClick={openTournamentRosterChooser}>
                      <div className="chooserOptionTitle">Select Tournament Roster</div>
                      <div className="chooserOptionSubtext">Scorekeep for a tournament team</div>
                    </button>
                    <button type="button" className="chooserOption" onClick={requestUploadRoster}>
                      <div className="chooserOptionTitle">Upload Roster File</div>
                      <div className="chooserOptionSubtext">Select a local roster file</div>
                    </button>
                    <button
                      type="button"
                      className="chooserOption"
                      onClick={choosePreviousRoster}
                      disabled={!hasCachedRoster()}
                    >
                      <div className="chooserOptionTitle">Load Previous Roster</div>
                      <div className="chooserOptionSubtext">
                        {hasCachedRoster()
                          ? "Previously used roster from browser cache"
                          : "No cached roster found yet"}
                      </div>
                    </button>
                  </div>
                  <div className="chooserFooter">
                    <button type="button" className="secondary" onClick={() => setIsRosterChooserOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isNewGameOpen && isTournamentRosterChooserOpen && (
            <div
              className="modalOverlay"
              role="dialog"
              aria-label="Select Tournament Roster"
              onClick={(e) => {
                e.stopPropagation();
                setIsTournamentRosterChooserOpen(false);
              }}
            >
              <div className="modal chooserModal" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                  <h2 className="modalTitle">Select Tournament Roster</h2>
                </div>
                <div className="modalBody">
                  <div className="packetBox" style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={showAllTournaments}
                        onChange={(e) => setShowAllTournaments(e.target.checked)}
                      />
                      Show all tournaments
                    </label>
                    <div className="packetSubtext">
                      Default shows upcoming tournaments with rosters, sorted from closest to today to furthest.
                    </div>
                    {rosterIndexLoading && <div className="packetSubtext">Loading roster list…</div>}
                    <div style={{ minHeight: 18 }}>
                      {(tournamentRosterError || rosterIndexError) && (
                        <div className="packetError">{tournamentRosterError ?? rosterIndexError}</div>
                      )}
                    </div>
                  </div>

                  <input
                    className="textInput"
                    value={tournamentSearchQuery}
                    onChange={(e) => setTournamentSearchQuery(e.target.value)}
                    placeholder="Search tournaments…"
                    aria-label="Search tournaments"
                    style={{ marginBottom: 12 }}
                  />

                  <div
                    aria-label="Tournament search results"
                    style={{
                      height: 380,
                      overflowY: "auto",
                      paddingRight: 6,
                    }}
                  >
                    <div className="chooserList">
                      {(() => {
                        const now = new Date();
                        const tournaments = Array.isArray(tournamentIndex.tournaments) ? tournamentIndex.tournaments : [];

                        const canCheckRosterAvailability = !!rosterIndexSlugs && !rosterIndexError;

                        const getRosterStatus = (slug: string) => {
                          if (!canCheckRosterAvailability) return "UNKNOWN";
                          return rosterIndexSlugs.has(slug) ? "HAS" : "NO";
                        };

                        const isUpcoming = (t: MossTournament) => {
                          const ymd = getDateYmdInTimeZone(now, t.timezone);
                          if (!ymd) return false;
                          return ymd <= t.dates.end;
                        };

                        const getSortKey = (t: MossTournament) => {
                          if (showAllTournaments) return t.dates.start;
                          const ymd = getDateYmdInTimeZone(now, t.timezone);
                          if (!ymd) return t.dates.start;
                          if (ymd < t.dates.start) return t.dates.start;
                          return ymd;
                        };

                        const base = showAllTournaments
                          ? [...tournaments]
                          : canCheckRosterAvailability
                            ? tournaments.filter((t) => isUpcoming(t) && getRosterStatus(t.slug) === "HAS")
                            : [];

                        const q = tournamentSearchQuery.trim().toLowerCase();
                        const filtered = q
                          ? base.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
                          : base;

                        filtered.sort((a, b) => {
                          if (showAllTournaments && canCheckRosterAvailability) {
                            const aHasRoster = getRosterStatus(a.slug) === "HAS";
                            const bHasRoster = getRosterStatus(b.slug) === "HAS";
                            if (aHasRoster !== bHasRoster) return aHasRoster ? -1 : 1;
                          }

                          const aKey = getSortKey(a);
                          const bKey = getSortKey(b);
                          const keyCmp = aKey.localeCompare(bKey);
                          if (keyCmp !== 0) return keyCmp;

                          const startCmp = a.dates.start.localeCompare(b.dates.start);
                          if (startCmp !== 0) return startCmp;

                          return a.name.localeCompare(b.name);
                        });

                        if (!filtered.length) {
                          if (!showAllTournaments && !canCheckRosterAvailability) {
                            return <div className="packetSubtext">Loading roster list…</div>;
                          }
                          return <div className="packetSubtext">No results.</div>;
                        }

                        return filtered.map((tournament) => {
                          const rosterStatus = getRosterStatus(tournament.slug);
                          const hasRoster = rosterStatus === "HAS" || rosterStatus === "UNKNOWN";
                          const disabled =
                            tournamentRosterLoading ||
                            rosterIndexLoading ||
                            (canCheckRosterAvailability && rosterStatus !== "HAS");
                          const title = canCheckRosterAvailability && !hasRoster
                            ? `${tournament.name} (No roster file found)`
                            : tournament.name;
                          const dateLabel =
                            tournament.dates.start === tournament.dates.end
                              ? tournament.dates.start
                              : `${tournament.dates.start} \u2013 ${tournament.dates.end}`;
                          return (
                            <button
                              key={tournament.slug}
                              type="button"
                              className="chooserOption"
                              disabled={disabled}
                              onClick={() => void chooseTournamentRoster(tournament)}
                            >
                              <div className="chooserOptionRow">
                                <div className="chooserOptionTitle chooserOptionTitleTruncate">{title}</div>
                                <div className="chooserOptionDate">{dateLabel}</div>
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="chooserFooter">
                    <button type="button" className="secondary" onClick={() => setIsTournamentRosterChooserOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isNewGameOpen && isPacketChooserOpen && (
            <div
              className="modalOverlay"
              role="dialog"
              aria-label="Choose packet"
              onClick={(e) => {
                e.stopPropagation();
                setIsPacketChooserOpen(false);
              }}
            >
              <div className="modal chooserModal" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                  <h2 className="modalTitle">Choose Packet</h2>
                </div>
                <div className="modalBody">
                  <div className="chooserGrid">
                    <button type="button" className="chooserOption" onClick={requestUploadPacket}>
                      <div className="chooserOptionTitle">Upload Packet from Computer</div>
                      <div className="chooserOptionSubtext">Select a local packet file</div>
                    </button>
                    <button type="button" className="chooserOption" disabled>
                      <div className="chooserOptionTitle">Select Tournament Packet</div>
                      <div className="chooserOptionSubtext">Coming soon!</div>
                    </button>
                    <button type="button" className="chooserOption" onClick={chooseSamplePacket}>
                      <div className="chooserOptionTitle">Use Sample Packet</div>
                      <div className="chooserOptionSubtext">Built-in demo packet for testing</div>
                    </button>
                    <button type="button" className="chooserOption" disabled>
                      <div className="chooserOptionTitle">Select from Archive</div>
                      <div className="chooserOptionSubtext">Coming soon!</div>
                    </button>
                  </div>
                  <div className="chooserFooter">
                    <button type="button" className="secondary" onClick={() => setIsPacketChooserOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoadGameOpen && (
            <div className="modalOverlay" role="dialog" aria-label="Load Game" onClick={closeLoadGame}>
              <div className="modal smallModal" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                  <h2 className="modalTitle">Load Game</h2>
                </div>
                <div className="modalBody">
                  <div className="packetBox">
                    {!loadGameFile ? (
                      <div className="packetSubtext">Select a local game file</div>
                    ) : (
                      <div className="packetSubtext">Selected file {loadGameFile.name}</div>
                    )}
                    {loadGameError && <div className="packetError">{loadGameError}</div>}
                  </div>
                  <div className="packetActions" style={{ marginTop: 14 }}>
                    <button type="button" className="secondary" onClick={requestUploadGame}>
                      {loadGameFile ? "Change" : "Load"}
                    </button>
                    <button
                      type="button"
                      disabled={!loadGameFile || isLoadingGame}
                      onClick={() => void openSelectedGameFile()}
                    >
                      {isLoadingGame ? "Opening..." : "Open Game File"}
                    </button>
                    <button type="button" className="secondary" onClick={closeLoadGame}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoadGameOpen && (
            <input
              ref={gameFileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                setLoadGameError(null);
                setLoadGameFile(file);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="sbAppFrame">
        <MossTopNav />
        <div className="page">
          <div className="shell">
            <div className="card">
              <h1 className="title">No questions found</h1>
              <p className="muted">
                Make sure your packet JSON is valid and includes a non-empty <code>questions</code> array.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sbAppFrame">
      <MossTopNav />
      <div className="page">
        <div
          ref={mainLayoutRef}
          className={["layout", isMainLayoutResizing ? "layoutResizing" : ""].filter(Boolean).join(" ")}
          style={mainLayoutStyle}
        >
          <div className="questionPane">
            <div className="card">
              <div className="header">
                <div>
                  <h1 className="title">
                    {data.packet} ({data.year})
                  </h1>
                </div>
              </div>

              <div className="questionBlurWrap">
                <div className={["questionBlock", isQuestionBlurred ? "questionBlockBlurred" : ""].filter(Boolean).join(" ")}>
                  {tossupQ && renderQuestionSection(tossupQ, "TOSSUP", false)}
                  {bonusQ && (
                    <>
                      <div className="qaDivider" />
                      {renderQuestionSection(bonusQ, "BONUS", !bonusEnabled)}
                    </>
                  )}
                </div>
                {isQuestionBlurred && (
                  <div className="questionBlurOverlay" role="dialog" aria-label="Question text hidden">
                    <div className="questionBlurOverlayInner">
                      <div className="questionBlurTitle">Ensure no players can see this screen.</div>
                      <div className="questionBlurSubtitle">Hold to reveal questions when ready to begin.</div>
                      <HoldToConfirmButton holdMs={1000} onConfirm={() => setIsQuestionBlurred(false)}>
                        Open Packet
                      </HoldToConfirmButton>
                    </div>
                  </div>
                )}
              </div>

              <div className="controls">
                <button onClick={prev} disabled={pairIdx === 0} aria-label="Previous pair">
                  {"\u2190"}
                </button>

                <button
                  onClick={next}
                  disabled={pairIdx === pairRows.length - 1}
                  aria-label="Next pair"
                >
                  {"\u2192"}
                </button>
              </div>
            </div>

            {pairIdx === pairRows.length - 1 && (
              <>
                <div className="endOfRoundSeparator" aria-hidden="true" />
                <div className="endOfRoundNotice" aria-label="End of round notice">
                  <div className="endOfRoundTitle">END OF ROUND</div>
                  <div>Export the scoresheet and save it to your computer.</div>
                  <div className="endOfRoundWarning">Unsaved scoresheets will be lost!</div>
                </div>
              </>
            )}
          </div>

          <div className="layoutResizer" {...mainLayoutResizerProps} aria-label="Resize panels" />

          <div className="card scoresheetCard" aria-label="Scoresheet">
            <div className="header">
              <div>
                <h2 className="title">Scoresheet</h2>
                <p className="muted" style={{ display: "none" }}>
                  {scoredPairs.totals.map((t, i) => {
                    const teamName = teams.find((x) => x.id === t.teamId)?.name ?? "Team";
                    return (
                      <span key={t.teamId}>
                        {teamName}: {t.total}
                        {i < scoredPairs.totals.length - 1 ? " · " : ""}
                      </span>
                    );
                  })}
                </p>
              </div>
              <div>
                <div className="scoresheetExportRow" aria-label="Export scoresheet controls">
                  {lastExport && (
                    <div className="scoresheetExportMeta" aria-label="Last exported">
                      Last exported {formatRelativeTime(lastExport.exportedAtIso, nowMs)}
                    </div>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={exportScoresheet}
                    disabled={!game || isExporting}
                    aria-label="Export scoresheet"
                  >
                    {isExporting ? "Exporting..." : "Export"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={openScoreboardDisplay}
                    disabled={!game}
                    aria-label="Open scoreboard display in a new window"
                  >
                    Display
                  </button>
                </div>
              </div>
            </div>

            <div ref={moderatorScoresheetWrapRef} className="scoresheetTableWrap" style={moderatorScoresheetWrapStyle}>
              <div className="scoresheetStickyHeaderBackplate" aria-hidden="true" />
              <table className="scoresheetTable">
                <thead>
                  <tr>
                    <th className="scoresheetPairHeader" aria-hidden="true" />
                    {teams.map((team, teamIndex) => (
                      <th
                        key={`role_${team.id}`}
                        colSpan={3}
                        className={[
                          "scoresheetTeamHeader",
                          "scoresheetTeamRoleHeader",
                          teamIndex < teams.length - 1 ? "scoresheetGroupEnd" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <div className="scoresheetTeamHeaderInner">
                          <span className={["scoresheetTeamName", "scoresheetTeamRole"].join(" ")}>
                            {teamRoleLabelForIndex(teamIndex)}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="scoresheetPairHeader" aria-label="Pair number" />
                    {teams.map((team, teamIndex) => (
                      <th
                        key={team.id}
                        colSpan={3}
                        className={[
                          "scoresheetTeamHeader",
                          teamIndex < teams.length - 1 ? "scoresheetGroupEnd" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <div className="scoresheetTeamHeaderInner">
                          <span className="scoresheetTeamName">{team.name}</span>
                          <span className="pill scoresheetScorePill">
                            {scoredPairs.totals.find((t) => t.teamId === team.id)?.total ?? 0}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="scoresheetPairHeader" aria-hidden="true" />
                    {teams.flatMap((team, teamIndex) => [
                      <th key={`${team.id}_t`}>T</th>,
                      <th key={`${team.id}_b`}>B</th>,
                      <th
                        key={`${team.id}_r`}
                        className={teamIndex < teams.length - 1 ? "scoresheetGroupEnd" : ""}
                      >
                        Total
                      </th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const colSpan = 1 + teams.length * 3;
                    const nodes: ReactNode[] = [];

                    for (let i = 0; i < scoredPairs.rows.length; i++) {
                      const row = scoredPairs.rows[i];
                      const boundaryBeforeQuestion = row.pairId;
                      const isStartBoundary = i === 0;
                      const markerKind: ScoresheetMarkerKind | undefined = scoresheetMarkers[boundaryBeforeQuestion];
                      const isSpacedMarker = markerKind !== undefined;

                      nodes.push(
                        <tr
                          key={`boundary_${boundaryBeforeQuestion}`}
                          className={[
                            "scoresheetBoundaryRow",
                            isStartBoundary ? "scoresheetBoundaryRowStart" : "",
                            isSpacedMarker ? "scoresheetBoundaryRowMarked" : "",
                          ].filter(Boolean).join(" ")}
                        >
                          <td colSpan={colSpan}>
                            <button
                              type="button"
                              className={["scoresheetBoundaryButton", isSpacedMarker ? "scoresheetBoundaryButtonMarked" : ""].filter(Boolean).join(" ")}
                              onClick={(e) => {
                                if (isStartBoundary) {
                                  openLineupChangeModal("START", boundaryBeforeQuestion, false);
                                  return;
                                }
                                openScoresheetBoundaryPopup(boundaryBeforeQuestion, e.currentTarget);
                              }}
                              aria-label={
                                isStartBoundary
                                  ? "Edit starting lineup"
                                  : markerKind
                                    ? `Edit marker before question ${boundaryBeforeQuestion}`
                                    : `Add marker before question ${boundaryBeforeQuestion}`
                              }
                            >
                              {isStartBoundary ? (
                                <span className="scoresheetBoundaryAffordance scoresheetBoundaryAffordanceTab">
                                  Change starting lineup
                                </span>
                              ) : markerKind ? (
                                <span className="scoresheetBoundaryLabel">{markerKind}</span>
                              ) : (
                                <span className="scoresheetBoundaryAffordance">+ Add break</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );

                      const isActivePair = row.pairId === q.pair_id;
                      nodes.push(
                        <tr
                          key={row.pairId}
                          className={isActivePair ? "scoresheetRowActive" : undefined}
                        >
                          <td className="scoresheetPairCell">
                            <button
                              type="button"
                              className="pairLink"
                              onClick={() => goToPair(row.pairId)}
                            >
                              {row.pairId}
                            </button>
                          </td>
                          {row.perTeam.flatMap((teamRow, teamIndex) => {
                            const isGroupEnd = teamIndex < row.perTeam.length - 1;
                            const tossupResult = teamRow.tossupAttempt?.result;
                            const bonusResult = teamRow.bonusAttempt?.result;

                            const tossupCellClass = [
                              "scoresheetAttemptCell",
                              tossupResult === "correct"
                                ? "scoresheetCellCorrect"
                                : tossupResult === "incorrect"
                                  ? "scoresheetCellIncorrect"
                                  : "",
                            ]
                              .filter(Boolean)
                              .join(" ");

                            const bonusCellClass = [
                              "scoresheetAttemptCell",
                              bonusResult === "correct"
                                ? "scoresheetCellCorrect"
                                : bonusResult === "incorrect"
                                  ? "scoresheetCellIncorrect"
                                  : "",
                            ]
                              .filter(Boolean)
                              .join(" ");

                            return [
                              <td key={`${teamRow.teamId}_t`} className={tossupCellClass || undefined}>
                                <button
                                  type="button"
                                  className="scoresheetAttemptCellButton"
                                  disabled={!row.tossup || !teamRow.tossupAttempt?.result}
                                  onClick={(e) => {
                                    if (!row.tossup) return;
                                    openScoresheetAttemptEditModal(row.tossup, teamRow.teamId, e.currentTarget);
                                  }}
                                  aria-label={`Edit tossup for ${teams.find((t) => t.id === teamRow.teamId)?.name ?? teamRow.teamId} in question ${row.pairId}`}
                                >
                                  {formatAttemptCellText(teamRow.tossupAttempt, row.tossup?.question_type, playersById)}
                                </button>
                              </td>,
                              <td key={`${teamRow.teamId}_b`} className={bonusCellClass || undefined}>
                                <button
                                  type="button"
                                  className="scoresheetAttemptCellButton"
                                  disabled={!row.bonus || !teamRow.bonusAttempt?.result}
                                  onClick={(e) => {
                                    if (!row.bonus) return;
                                    openScoresheetBonusEditModal(row.bonus, teamRow.teamId, e.currentTarget);
                                  }}
                                  aria-label={`Edit bonus for ${teams.find((t) => t.id === teamRow.teamId)?.name ?? teamRow.teamId} in question ${row.pairId}`}
                                >
                                  {formatAttemptCellText(teamRow.bonusAttempt, row.bonus?.question_type, playersById)}
                                </button>
                              </td>,
                              <td
                                key={`${teamRow.teamId}_r`}
                                className={["scoresheetNumberCell", isGroupEnd ? "scoresheetGroupEnd" : ""].filter(Boolean).join(" ")}
                              >
                                {teamRow.runningTotal}
                              </td>,
                            ];
                          })}
                        </tr>
                      );
                    }

                    return nodes;
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {(() => {
          if (!scoresheetBoundaryPopup) return null;
          const boundary = scoresheetBoundaryPopup.boundaryBeforeQuestion;
          const existing = scoresheetMarkers[boundary];

          return (
            <div
              ref={scoresheetBoundaryPopupRef}
              className="attemptPopup scoresheetBoundaryPopup"
              role="dialog"
              aria-label={existing ? "Edit marker" : "Add marker"}
              style={{ left: scoresheetBoundaryPopup.left, top: scoresheetBoundaryPopup.top }}
            >
              <div className="attemptPopupButtons">
                {!existing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        openLineupChangeModal("HALFTIME", boundary, true);
                        setScoresheetBoundaryPopup(null);
                      }}
                    >
                      Add Halftime
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        openLineupChangeModal("BREAK", boundary, true);
                        setScoresheetBoundaryPopup(null);
                      }}
                    >
                      Add Break
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        openLineupChangeModal(existing, boundary, false);
                        setScoresheetBoundaryPopup(null);
                      }}
                    >
                      Lineup Change
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setScoresheetMarker(boundary, existing === "HALFTIME" ? "BREAK" : "HALFTIME");
                        setScoresheetBoundaryPopup(null);
                      }}
                    >
                      {existing === "HALFTIME" ? "Change to Break" : "Change to Halftime"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        removeScoresheetMarker(boundary);
                        setScoresheetBoundaryPopup(null);
                      }}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {(() => {
          if (!lineupChangeModal) return null;
          const boundary = lineupChangeModal.boundaryBeforeQuestion;
          const phaseLabel =
            lineupChangeModal.phase === "START"
              ? "Start"
              : lineupChangeModal.phase === "HALFTIME"
                ? "Halftime"
                : "Break";
          const canSave = teams.every((t) => t.players.some((p) => !!lineupChangeModal.draftInByTeamId[t.id]?.[p.id]));

          return (
            <div
              className="modalOverlay"
              role="dialog"
              aria-label="Lineup Change"
              onClick={() => setLineupChangeModal(null)}
            >
              <div className="modal lineupModal" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                  <h2 className="modalTitle">Lineup Change: {phaseLabel}</h2>
                  <p className="muted">Effective starting Question {boundary}</p>
                </div>

                <div className="modalBody">
                  <div className="lineupTeamGrid">
                    {teams.map((team) => (
                      <div key={team.id} className="lineupTeamCol">
                        <div className="fieldGroup">
                          <div className="fieldLabel">Team</div>
                          <input className="textInput" value={team.name} readOnly />
                        </div>

                        <div className="fieldGroup">
                          <div className="fieldLabel">Players</div>
                          <div className="playerList">
                            {team.players.map((player, playerIndex) => {
                              const isIn = !!lineupChangeModal.draftInByTeamId[team.id]?.[player.id];
                              return (
                                <div key={player.id} className="playerRowWithToggle noRemove">
                                  <input
                                    className="textInput"
                                    value={player.name}
                                    readOnly
                                    placeholder={`Player ${playerIndex + 1}`}
                                  />
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isIn}
                                    className={["inOutToggle", isIn ? "active" : "bench"].join(" ")}
                                    onClick={() => toggleLineupDraft(team.id, player.id)}
                                    aria-label={`${isIn ? "Set Bench" : "Set Active"}: ${player.name || `Player ${playerIndex + 1}`}`}
                                  >
                                    {isIn ? "Active" : "Bench"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="modalFooter">
                    <div className="modalActionsRight">
                      <button type="button" className="secondary" onClick={() => setLineupChangeModal(null)}>
                        Cancel
                      </button>
                      <button type="button" disabled={!canSave} onClick={saveLineupChangeModal}>
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          if (!scoresheetAttemptEditModal) return null;
          const question = questionsById.get(scoresheetAttemptEditModal.questionId);
          if (!question) return null;
          const team = teams.find((t) => t.id === scoresheetAttemptEditModal.teamId);
          if (!team) return null;

          const activeIds = activePlayerIdsForTeamAtTossup(team, question.pair_id);
          const activePlayers = team.players.filter((p) => activeIds.has(p.id));
          const selectedPlayerActive = activeIds.has(scoresheetAttemptEditModal.playerId);
          const canSave = selectedPlayerActive && activePlayers.length > 0;
          const usePlayerPanel = selectedPlayerActive && activePlayers.length > 0 && activePlayers.length <= 6;

          const title = `Edit: Tossup ${question.pair_id} (${team.name})`;

          return (
            <div
              ref={scoresheetAttemptEditPopupRef}
              className="attemptPopup scoresheetEditPopup"
              role="dialog"
              aria-label={title}
              style={{ left: scoresheetAttemptEditModal.left, top: scoresheetAttemptEditModal.top }}
            >
              <div className="attemptPopupTitle">{title}</div>

              <div className="scoresheetEditPopupBody">
                <div className="fieldGroup">
                  <div className="fieldLabelRow">
                    <div className="fieldLabel">Player</div>
                  </div>
                  {usePlayerPanel ? (
                    <div className="playerPickPanel" role="listbox" aria-label="Player">
                      {activePlayers.map((p, idx) => {
                        const active = p.id === scoresheetAttemptEditModal.playerId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={["playerPickRow", active ? "active" : ""].filter(Boolean).join(" ")}
                            onClick={() => {
                              const playerId = p.id;
                              setScoresheetAttemptEditModal((prev) => (prev ? { ...prev, playerId } : prev));
                            }}
                            role="option"
                            aria-selected={active}
                          >
                            {p.name || `Player ${idx + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <select
                      className="selectInput"
                      value={scoresheetAttemptEditModal.playerId}
                      onChange={(e) => {
                        const playerId = e.target.value;
                        setScoresheetAttemptEditModal((prev) => (prev ? { ...prev, playerId } : prev));
                      }}
                      aria-label="Select player"
                    >
                      {!selectedPlayerActive && (
                        <option value={scoresheetAttemptEditModal.playerId} disabled>
                          {(playersById.get(scoresheetAttemptEditModal.playerId) ?? scoresheetAttemptEditModal.playerId) + " (not in lineup)"}
                        </option>
                      )}
                      {activePlayers.map((p, idx) => (
                        <option key={p.id} value={p.id}>
                          {p.name || `Player ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="scoresheetEditPopupActions">
                  <button type="button" className="secondary" onClick={() => setScoresheetAttemptEditModal(null)}>
                    Cancel
                  </button>
                  <button type="button" disabled={!canSave} onClick={saveScoresheetAttemptEditModal}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          if (!scoresheetBonusEditModal) return null;
          const question = questionsById.get(scoresheetBonusEditModal.questionId);
          if (!question || question.question_type !== "BONUS") return null;
          const team = teams.find((t) => t.id === scoresheetBonusEditModal.teamId);
          if (!team) return null;

          const title = `Edit: Bonus ${question.pair_id} (${team.name})`;

          return (
            <div
              ref={scoresheetBonusEditPopupRef}
              className="attemptPopup scoresheetEditPopup"
              role="dialog"
              aria-label={title}
              style={{ left: scoresheetBonusEditModal.left, top: scoresheetBonusEditModal.top }}
            >
              <div className="attemptPopupTitle">{title}</div>

              <div className="scoresheetEditPopupBody">
                <div className="fieldGroup">
                  <div className="fieldLabelRow">
                    <div className="fieldLabel">Score</div>
                  </div>
                  <div className="scoreToggle" role="group" aria-label="Bonus score">
                    <button
                      type="button"
                      className={scoresheetBonusEditModal.score === "plus" ? "active" : ""}
                      onClick={() => setScoresheetBonusEditModal((prev) => (prev ? { ...prev, score: "plus" } : prev))}
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      className={scoresheetBonusEditModal.score === "zero" ? "active" : ""}
                      onClick={() => setScoresheetBonusEditModal((prev) => (prev ? { ...prev, score: "zero" } : prev))}
                    >
                      0
                    </button>
                  </div>
                </div>

                <div className="scoresheetEditPopupActions">
                  <button type="button" className="secondary" onClick={() => setScoresheetBonusEditModal(null)}>
                    Cancel
                  </button>
                  <button type="button" onClick={saveScoresheetBonusEditModal}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          const popupQuestion = attemptEditor ? questionsById.get(attemptEditor.questionId) : undefined;
          if (!attemptEditor || !popupQuestion) return null;
          const currentAttemptEditor = attemptEditor;

          const editingAttempts = attempts[popupQuestion.id] ?? [];

          return (
            <div
              ref={attemptPopupRef}
              className="attemptPopup"
              role="dialog"
              aria-label="Mark attempt"
              style={{ left: currentAttemptEditor.left, top: currentAttemptEditor.top }}
            >
              {popupQuestion.question_type !== "BONUS" && (() => {
                const attemptedTeamIds = new Set(editingAttempts.map((a) => a.teamId));
                const attemptedPlayerIds = new Set(
                  editingAttempts.flatMap((a) => (a.playerId ? [a.playerId] : []))
                );
                const tossupNumber = popupQuestion.pair_id;
                const selectedTeam = teams.find((t) => t.id === currentAttemptEditor.selection.teamId);
                const activeSet = selectedTeam ? activePlayerIdsForTeamAtTossup(selectedTeam, tossupNumber) : new Set<string>();
                const activePlayers = (selectedTeam?.players ?? []).filter((p) => activeSet.has(p.id));
                const useTeamToggle = teams.length === 2;
                const usePlayerPanel = activePlayers.length > 0 && activePlayers.length <= 6;

                function pickPlayerIdForTeam(teamId: string): string | undefined {
                  const team = teams.find((t) => t.id === teamId);
                  if (!team) return currentAttemptEditor.selection.playerId;
                  const currentPlayerId = currentAttemptEditor.selection.playerId;
                  const active = activePlayerIdsForTeamAtTossup(team, tossupNumber);
                  const available =
                    team.players.find(
                      (p) => active.has(p.id) && (!attemptedPlayerIds.has(p.id) || p.id === currentPlayerId)
                    ) ?? team.players.find((p) => active.has(p.id));
                  return available?.id ?? currentPlayerId;
                }

                return (
                  <div className="attemptPopupSelectors">
                    {useTeamToggle ? (
                      <div className="scoreToggle" role="group" aria-label="Team">
                        {teams.slice(0, 2).map((t, idx) => {
                          const disabled = attemptedTeamIds.has(t.id) && t.id !== currentAttemptEditor.selection.teamId;
                          const active = t.id === currentAttemptEditor.selection.teamId;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              className={active ? "active" : ""}
                              disabled={disabled}
                              onClick={() => {
                                if (t.id === currentAttemptEditor.selection.teamId) return;
                                const teamId = t.id;
                                const playerId = pickPlayerIdForTeam(teamId);
                                setAttemptEditor((prev) =>
                                  prev ? { ...prev, selection: { ...prev.selection, teamId, playerId } } : prev
                                );
                              }}
                              aria-label={`Select ${teamRoleLabelForIndex(idx)}`}
                            >
                              {teamRoleLabelForIndex(idx)}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <select
                        className="selectInput"
                        value={currentAttemptEditor.selection.teamId}
                        onChange={(e) => {
                          const teamId = e.target.value;
                          const playerId = pickPlayerIdForTeam(teamId);
                          setAttemptEditor((prev) =>
                            prev ? { ...prev, selection: { ...prev.selection, teamId, playerId } } : prev
                          );
                        }}
                        aria-label="Select team"
                      >
                        {teams.map((t) => (
                          <option
                            key={t.id}
                            value={t.id}
                            disabled={attemptedTeamIds.has(t.id) && t.id !== currentAttemptEditor.selection.teamId}
                          >
                            {t.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {usePlayerPanel ? (
                      <div className="playerPickPanel" role="listbox" aria-label="Player">
                        {activePlayers.map((p, idx) => {
                          const disabled = attemptedPlayerIds.has(p.id) && p.id !== currentAttemptEditor.selection.playerId;
                          const active = p.id === currentAttemptEditor.selection.playerId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={["playerPickRow", active ? "active" : ""].filter(Boolean).join(" ")}
                              disabled={disabled}
                              onClick={() => {
                                const playerId = p.id;
                                setAttemptEditor((prev) =>
                                  prev ? { ...prev, selection: { ...prev.selection, playerId } } : prev
                                );
                              }}
                              role="option"
                              aria-selected={active}
                            >
                              {p.name || `Player ${idx + 1}`}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <select
                        className="selectInput"
                        value={currentAttemptEditor.selection.playerId ?? ""}
                        onChange={(e) => {
                          const playerId = e.target.value;
                          setAttemptEditor((prev) =>
                            prev ? { ...prev, selection: { ...prev.selection, playerId } } : prev
                          );
                        }}
                        aria-label="Select player"
                      >
                        {activePlayers.map((p, idx) => (
                          <option
                            key={p.id}
                            value={p.id}
                            disabled={attemptedPlayerIds.has(p.id) && p.id !== currentAttemptEditor.selection.playerId}
                          >
                            {p.name || `Player ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })()}

              <div className="attemptPopupButtons">
                <button
                  type="button"
                  onClick={() => {
                    setAttemptResult(popupQuestion.id, "correct");
                    setAttemptEditor(null);
                  }}
                >
                  {popupQuestion.question_type === "BONUS" ? "Correct (+10)" : "Correct"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setAttemptResult(popupQuestion.id, "incorrect");
                    setAttemptEditor(null);
                  }}
                >
                  {popupQuestion.question_type === "BONUS" ? "Incorrect (0)" : "Incorrect"}
                </button>
              </div>
            </div>
          );
        })()}

        {(() => {
          if (!bonusResultEditor) return null;
          const bonusQuestion = questionsById.get(bonusResultEditor.questionId);
          if (!bonusQuestion || bonusQuestion.question_type !== "BONUS") return null;
          const disabled = !bonusEnabled;

          return (
            <div
              ref={bonusPopupRef}
              className="attemptPopup"
              role="dialog"
              aria-label="Mark bonus"
              style={{ left: bonusResultEditor.left, top: bonusResultEditor.top }}
            >
              <div className="attemptPopupButtons">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setBonusResult(bonusQuestion, "correct");
                    setBonusResultEditor(null);
                  }}
                >
                  Correct (+10)
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled}
                  onClick={() => {
                    setBonusResult(bonusQuestion, "incorrect");
                    setBonusResultEditor(null);
                  }}
                >
                  Incorrect (0)
                </button>
              </div>
            </div>
          );
        })()}
        <Analytics />      </div>
    </div>
  );
}

export default function App() {
  const displayMode = getDisplayModeFromLocation();
  if (displayMode === "scoreboard") return <ScoreboardDisplayApp />;
  return <ModeratorApp />;
}
