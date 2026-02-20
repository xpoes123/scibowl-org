import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { useTournamentField } from "../../hooks/useTournamentField";
import type { TournamentFieldTeam } from "../../types";

type FieldTabProps = {
  slug: string;
};

export function FieldTab({ slug }: FieldTabProps) {
  const { data, loading, error } = useTournamentField(slug);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const teams = data?.teams ?? [];
  const fieldLabel = `${teams.length} team${teams.length === 1 ? "" : "s"}`;

  const filteredTeams = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return teams;
    return teams.filter((team) => team.name.toLowerCase().includes(normalized));
  }, [query, teams]);

  const toggleExpanded = (teamKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(teamKey)) next.delete(teamKey);
      else next.add(teamKey);
      return next;
    });
  };

  if (loading) {
    return <p className="sbMuted">Loading field{"\u2026"}</p>;
  }

  if (error) {
    return <p className="sbMuted">Failed to load field: {error}</p>;
  }

  if (!data || teams.length === 0) {
    return <p className="sbMuted">No roster file posted for this tournament.</p>;
  }

  return (
    <div className="sbStack" aria-label="Tournament field">
      <div className="sbFieldTabHeader">
        <div className="sbMinW0">
          <div className="sbLabel">Field size</div>
          <div className="sbValue">{fieldLabel}</div>
        </div>
        <div className="sbMuted sbSmall">
          Showing <span className="sbStrong">{filteredTeams.length}</span> of{" "}
          <span className="sbStrong">{teams.length}</span> teams
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
              placeholder={"Team\u2026"}
            />
          </div>
        </label>
      </div>

      <div className="sbTeamList" aria-label="Tournament teams">
        <div className="sbRows">
          {filteredTeams.length === 0 ? (
            <div className="sbEmptyState">
              <p className="sbMuted">No teams match your search.</p>
              <button type="button" className="sbPageButton sbTopSpace" onClick={() => setQuery("")}>
                Clear search
              </button>
            </div>
          ) : (
            filteredTeams.map((team: TournamentFieldTeam, idx: number) => {
              const hasRoster = (team.players?.length ?? 0) > 0;
              const teamKey = `${idx}:${team.name}`;
              const isExpanded = expanded.has(teamKey);
              const panelId = `team-roster-${idx}`;

              return (
                <div
                  key={teamKey}
                  className="sbTournamentRow sbTeamRow"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.currentTarget !== e.target) return;
                    if (!hasRoster) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpanded(teamKey);
                    }
                  }}
                >
                  <div className="sbTournamentRowContent">
                    <div className="sbRowMain">
                      <div className="sbMinW0">
                        <div className="sbRowNameLine">
                          <span className="sbRowName">{team.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="sbRowLocation" />
                    <div className="sbRowDate" />
                    <div className="sbLevelPills" />

                    <div className="sbRowRight">
                      {hasRoster ? (
                        <button
                          type="button"
                          className="sbIconButton"
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          aria-label={isExpanded ? `Collapse ${team.name} roster` : `Expand ${team.name} roster`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(teamKey);
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
                        {team.players.map((name) => (
                          <div key={`${teamKey}:${name}`} className="sbRosterRow" role="listitem">
                            <div className="sbStrong sbMinW0 sbRosterName">{name}</div>
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
