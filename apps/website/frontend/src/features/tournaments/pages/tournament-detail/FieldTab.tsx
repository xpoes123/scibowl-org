import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import type { TournamentDetail, TournamentLevel, TournamentTeam } from "../../types";

type FieldTabProps = {
  tournament: TournamentDetail;
};

type TeamStatusFilter = "all" | "CONFIRMED" | "WAITLIST" | "DROPPED";
type TeamLevelFilter = "all" | TournamentLevel;

function getTeamStatusLabel(status: Exclude<TournamentTeam["status"], undefined>): string {
  switch (status) {
    case "CONFIRMED":
      return "Confirmed";
    case "WAITLIST":
      return "Waitlist";
    case "DROPPED":
      return "Dropped";
    default:
      return status;
  }
}

function getTeamStatusBadgeClass(status: TournamentTeam["status"]): string {
  switch (status) {
    case "CONFIRMED":
      return "sbBadge sbBadgeRegistration";
    case "WAITLIST":
      return "sbBadge sbBadgeUpcoming";
    case "DROPPED":
      return "sbBadge sbBadgeCancelled";
    default:
      return "sbBadge sbBadgeNeutral";
  }
}

function compareTeamStatus(a: TournamentTeam["status"], b: TournamentTeam["status"]): number {
  const order: Record<TeamStatusFilter, number> = { all: 99, CONFIRMED: 0, WAITLIST: 1, DROPPED: 2 };
  return (order[a ?? "CONFIRMED"] ?? 99) - (order[b ?? "CONFIRMED"] ?? 99);
}

export function FieldTab({ tournament }: FieldTabProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TeamStatusFilter>("all");
  const [level, setLevel] = useState<TeamLevelFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const teams = (tournament as any).teams || [];
  const fieldCap = tournament.format.rounds_guaranteed;
  const fieldLabel = fieldCap ? `${teams.length} teams / ${fieldCap} cap` : `${teams.length} teams`;

  const hasAnyStatus = useMemo(() => teams.some((team: any) => Boolean(team.status)), [teams]);
  const hasMixedLevels = useMemo(() => new Set(teams.map((team: any) => team.level)).size > 1, [teams]);

  const filteredTeams = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    let list = teams.slice();
    if (hasAnyStatus && status !== "all") {
      list = list.filter((team) => team.status === status);
    }

    if (hasMixedLevels && level !== "all") {
      list = list.filter((team) => team.level === level);
    }

    if (normalized) {
      list = list.filter((team) => {
        const location = `${team.city ?? ""} ${team.state ?? ""}`.trim().toLowerCase();
        return (
          team.team_name.toLowerCase().includes(normalized) ||
          (team.school_name ?? "").toLowerCase().includes(normalized) ||
          location.includes(normalized)
        );
      });
    }

    list.sort((a: any, b: any) => {
      const statusCmp = compareTeamStatus(a.status, b.status);
      if (statusCmp !== 0) return statusCmp;
      if (a.level !== b.level) return a.level.localeCompare(b.level);
      return a.team_name.localeCompare(b.team_name);
    });

    return list;
  }, [hasAnyStatus, hasMixedLevels, level, query, status, teams]);

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setLevel("all");
  };

  const toggleExpanded = (teamId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  return (
    <div className="sbStack">
      <div className="sbFieldTabHeader">
        <div className="sbMinW0">
          <div className="sbLabel">Field size</div>
          <div className="sbValue">{fieldLabel}</div>
        </div>
        <div className="sbMuted sbSmall">
          Showing <span className="sbStrong">{filteredTeams.length}</span> of <span className="sbStrong">{tournament.teams.length}</span> teams
        </div>
      </div>

      <div className="sbListingControls">
        <label className="sbField">
          <span className="sbFieldLabel">Search</span>
          <div className="sbInputWithIcon">
            <MagnifyingGlassIcon className="sbInputIcon" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sbInput sbInputPadded"
              placeholder={"Team, school, city/state\u2026"}
            />
          </div>
        </label>

        {hasAnyStatus && (
          <label className="sbField">
            <span className="sbFieldLabel">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as TeamStatusFilter)} className="sbSelect">
              <option value="all">All</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="WAITLIST">Waitlist</option>
              <option value="DROPPED">Dropped</option>
            </select>
          </label>
        )}

        {hasMixedLevels && (
          <label className="sbField">
            <span className="sbFieldLabel">Level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value as TeamLevelFilter)} className="sbSelect">
              <option value="all">All</option>
              <option value="MS">MS</option>
              <option value="HS">HS</option>
            </select>
          </label>
        )}
      </div>

      <div className="sbTeamList" aria-label="Tournament teams">
        <div className="sbRows">
          {filteredTeams.length === 0 ? (
            <div className="sbEmptyState">
              <p className="sbMuted">No teams match your search/filters.</p>
              <button type="button" className="sbPageButton sbTopSpace" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            filteredTeams.map((team) => {
              const locationLabel = team.city && team.state ? `${team.city}, ${team.state}` : null;
              const hasRoster = Boolean(team.roster && team.roster.length > 0);
              const isExpanded = expanded.has(team.id);
              const panelId = `team-roster-${team.id}`;

              return (
                <div
                  key={team.id}
                  className="sbTournamentRow sbTeamRow"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.currentTarget !== e.target) return;
                    if (!hasRoster) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpanded(team.id);
                    }
                  }}
                >
                  <div className="sbTournamentRowContent">
                    <div className="sbRowMain">
                      <div className="sbMinW0">
                        <div className="sbRowNameLine">
                          <span className="sbRowName">{team.team_name}</span>
                          {team.status && (
                            <span className={getTeamStatusBadgeClass(team.status)}>{getTeamStatusLabel(team.status)}</span>
                          )}
                        </div>
                        <div className="sbRowMetaMobile">
                          {team.school_name && <span className="sbRowMetaItem">{team.school_name}</span>}
                          {locationLabel && (
                            <>
                              <span className="sbRowMetaSep" aria-hidden="true">
                                {"\u2022"}
                              </span>
                              <span className="sbRowMetaItem">{locationLabel}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="sbRowLocation">{team.school_name ?? locationLabel ?? ""}</div>

                    <div className="sbRowDate">{locationLabel ?? ""}</div>

                    <div className="sbLevelPills" aria-label="Team level">
                      <span className="sbLevelPill">{team.level}</span>
                    </div>

                    <div className="sbRowRight">
                      {hasRoster ? (
                        <button
                          type="button"
                          className="sbIconButton"
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          aria-label={isExpanded ? `Collapse ${team.team_name} roster` : `Expand ${team.team_name} roster`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(team.id);
                          }}
                        >
                          <ChevronDownIcon className={isExpanded ? "sbRowChevron sbRowChevronOpen" : "sbRowChevron"} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="sbRowChevronSpacer" aria-hidden="true" />
                      )}
                    </div>
                  </div>

                  {hasRoster && isExpanded && (
                    <div id={panelId} className="sbTeamRoster">
                      <div className="sbRosterGrid" role="list">
                        {team.roster!.map((member: { name: string; grade?: number; role?: string }) => (
                          <div key={`${team.id}-${member.name}-${member.role ?? ""}-${member.grade ?? ""}`} className="sbRosterRow" role="listitem">
                            <div className="sbStrong sbMinW0 sbRosterName">{member.name}</div>
                            <div className="sbMuted sbSmall sbRosterMeta">
                              {member.role ? member.role : "Member"}
                              {typeof member.grade === "number" ? ` \u2022 Grade ${member.grade}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

