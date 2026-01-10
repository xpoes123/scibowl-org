import { FunnelIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTournaments } from "../hooks/useTournaments";
import type { TournamentDivision, TournamentStatus, TournamentStatusParam } from "../types";
import { getStatusLabel, parseStatusQueryParam } from "../utils/status";
import { TournamentRow } from "../components/TournamentRow";

function compareWithinStatus(status: TournamentStatus, aKey: { dates: { start: string; end: string }; updated_at?: string; name: string }, bKey: { dates: { start: string; end: string }; updated_at?: string; name: string }): number {
  if (status === "LIVE") {
    const aSort = aKey.updated_at ?? aKey.dates.start;
    const bSort = bKey.updated_at ?? bKey.dates.start;
    if (aSort !== bSort) return bSort.localeCompare(aSort);
    return aKey.name.localeCompare(bKey.name);
  }

  if (status === "UPCOMING") {
    if (aKey.dates.start !== bKey.dates.start) return aKey.dates.start.localeCompare(bKey.dates.start);
    return aKey.name.localeCompare(bKey.name);
  }

  const aSort = aKey.dates.end;
  const bSort = bKey.dates.end;
  if (aSort !== bSort) return bSort.localeCompare(aSort);
  return aKey.name.localeCompare(bKey.name);
}

function statusParamToStatus(param: TournamentStatusParam): TournamentStatus {
  switch (param) {
    case "live":
      return "LIVE";
    case "upcoming":
      return "UPCOMING";
    case "finished":
      return "FINISHED";
    default:
      return "UPCOMING";
  }
}

const ALL_STATUSES: TournamentStatus[] = ["LIVE", "UPCOMING", "FINISHED"];
const statusOrder: Record<TournamentStatus, number> = { LIVE: 0, UPCOMING: 1, FINISHED: 2 };
const DIVISION_OPTIONS: Array<{ key: TournamentDivision; label: string }> = [
  { key: "MS", label: "Middle School" },
  { key: "HS", label: "High School" },
  { key: "UG", label: "Undergraduate" },
];

type LocationModeFilter = "ONLINE" | "IN_PERSON";
const MODE_OPTIONS: Array<{ key: LocationModeFilter; label: string }> = [
  { key: "ONLINE", label: "Online" },
  { key: "IN_PERSON", label: "In-person" },
];

export function TournamentsPage() {
  const { tournaments } = useTournaments();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = parseStatusQueryParam(searchParams.get("status"));
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<TournamentStatus>>(() => {
    if (statusParam === "all") return new Set(ALL_STATUSES);
    return new Set([statusParamToStatus(statusParam)]);
  });
  const [selectedDivisions, setSelectedDivisions] = useState<Set<TournamentDivision>>(() => new Set());
  const [selectedModes, setSelectedModes] = useState<Set<LocationModeFilter>>(() => new Set());
  const [selectedYears, setSelectedYears] = useState<Set<number>>(() => new Set());

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    tournaments.forEach((t) => {
      const year = Number(t.dates.start.slice(0, 4));
      if (Number.isFinite(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [tournaments]);

  const pageSize = 20;
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  useEffect(() => {
    if (statusParam === "all") setSelectedStatuses(new Set(ALL_STATUSES));
    else setSelectedStatuses(new Set([statusParamToStatus(statusParam)]));
  }, [statusParam]);

  useEffect(() => {
    if (!filtersOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    // Determine lifecycle status from dates in tournament's timezone
    const now = new Date();
    const listWithStatus = tournaments.map(t => {
      const startDateStr = `${t.dates.start}T00:00:00`;
      const endDateStr = `${t.dates.end}T23:59:59`;

      // Get current time in tournament's timezone
      const nowInTournamentTZStr = now.toLocaleString('en-US', {
        timeZone: t.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      // Parse to ISO format for comparison
      const [datePart, timePart] = nowInTournamentTZStr.split(', ');
      const [month, day, year] = datePart.split('/');
      const nowInTournamentTZISOStr = `${year}-${month}-${day}T${timePart}`;

      const isFinished = nowInTournamentTZISOStr > endDateStr;
      const isUpcoming = nowInTournamentTZISOStr < startDateStr;
      const lifecycleStatus: TournamentStatus = isFinished ? "FINISHED" : isUpcoming ? "UPCOMING" : "LIVE";
      return { ...t, lifecycleStatus };
    });

    let list = listWithStatus;
    if (selectedStatuses.size > 0 && selectedStatuses.size !== ALL_STATUSES.length) {
      list = list.filter((t) => selectedStatuses.has(t.lifecycleStatus));
    }

    if (selectedDivisions.size > 0) {
      list = list.filter((t) => t.divisions.some((div) => selectedDivisions.has(div)));
    }

    if (selectedModes.size > 0) {
      list = list.filter((t) => {
        const mode: LocationModeFilter = t.location ? "IN_PERSON" : "ONLINE";
        return selectedModes.has(mode);
      });
    }

    if (selectedYears.size > 0) {
      list = list.filter((t) => selectedYears.has(Number(t.dates.start.slice(0, 4))));
    }

    if (normalizedQuery) {
      list = list.filter((t) => {
        const location = t.location ? `${t.location.city}, ${t.location.state}`.toLowerCase() : "online";
        return t.name.toLowerCase().includes(normalizedQuery) || location.includes(normalizedQuery);
      });
    }

    return list.slice().sort((a, b) => {
      if (selectedStatuses.size !== 1) {
        if (a.lifecycleStatus !== b.lifecycleStatus) return statusOrder[a.lifecycleStatus] - statusOrder[b.lifecycleStatus];
        return compareWithinStatus(a.lifecycleStatus, a, b);
      }

      const onlyStatus = Array.from(selectedStatuses)[0] ?? "UPCOMING";
      return compareWithinStatus(onlyStatus, a, b);

    });
  }, [query, selectedDivisions, selectedModes, selectedStatuses, selectedYears, tournaments]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  const resetToPageOne = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    setSearchParams(next);
  };

  const setAllStatuses = () => {
    setSelectedStatuses(new Set(ALL_STATUSES));
    resetToPageOne();
  };

  const toggleStatus = (status: TournamentStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next.size === 0 ? new Set(ALL_STATUSES) : next;
    });
    resetToPageOne();
  };

  const setAllDivisions = () => {
    setSelectedDivisions(new Set());
    resetToPageOne();
  };

  const toggleDivision = (division: TournamentDivision) => {
    setSelectedDivisions((prev) => {
      const universe = DIVISION_OPTIONS.map((opt) => opt.key);
      const next = prev.size === 0 ? new Set(universe) : new Set(prev);
      if (next.has(division)) next.delete(division);
      else next.add(division);
      if (next.size === 0 || next.size === universe.length) return new Set();
      return next;
    });
    resetToPageOne();
  };

  const setAllModes = () => {
    setSelectedModes(new Set());
    resetToPageOne();
  };

  const toggleMode = (mode: LocationModeFilter) => {
    setSelectedModes((prev) => {
      const universe = MODE_OPTIONS.map((opt) => opt.key);
      const next = prev.size === 0 ? new Set(universe) : new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      if (next.size === 0 || next.size === universe.length) return new Set();
      return next;
    });
    resetToPageOne();
  };

  const setAllYears = () => {
    setSelectedYears(new Set());
    resetToPageOne();
  };

  const toggleYear = (year: number) => {
    setSelectedYears((prev) => {
      if (yearOptions.length === 0) return new Set();
      const universe = yearOptions;
      const next = prev.size === 0 ? new Set(universe) : new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      if (next.size === 0 || next.size === universe.length) return new Set();
      return next;
    });
    resetToPageOne();
  };

  const clearFilters = () => {
    setAllStatuses();
    setAllDivisions();
    setAllModes();
    setAllYears();
  };

  const allStatusesSelected = selectedStatuses.size === ALL_STATUSES.length;
  const allDivisionsSelected = selectedDivisions.size === 0;
  const allModesSelected = selectedModes.size === 0;
  const allYearsSelected = selectedYears.size === 0;

  return (
    <div className="sbStack">
      <div className="card sbTournamentCard sbHeroCard">
        <h1 className="sbTitle">Tournaments</h1>

        <div className="sbListingControls sbTopSpace">
          <div className="sbField">
            <div className="sbInputWithIcon">
              <button
                type="button"
                className="sbInputIconButton"
                aria-label="Search tournaments"
                onClick={() => {
                  resetToPageOne();
                  searchInputRef.current?.focus();
                }}
              >
                <MagnifyingGlassIcon className="sbIcon" aria-hidden="true" />
              </button>
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetToPageOne();
                }}
                className="sbInput sbInputPadded"
                placeholder={"Search by name or location\u2026"}
                aria-label="Search by name or location"
              />
            </div>
          </div>

          <button
            type="button"
            className={filtersOpen ? "sbSquareButton sbSquareButtonActive" : "sbSquareButton"}
            onClick={() => setFiltersOpen((prev) => !prev)}
            aria-label="Open filters"
            title="Filters"
          >
            <FunnelIcon className="sbIcon" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section className="card sbAccordion sbListingCard" aria-label="Tournament list">
        <div className="sbRows">
          {pageItems.length === 0 ? (
            <div className="sbEmptyState">
              <p className="sbMuted">No tournaments found.</p>
            </div>
          ) : (
            pageItems.map((tournament) => <TournamentRow key={tournament.slug} tournament={tournament} />)
          )}
        </div>

        {filtered.length > pageSize && (
          <div className="sbPagination">
            <button
              type="button"
              className="sbPageButton"
              onClick={() => setPage(Math.max(1, clampedPage - 1))}
              disabled={clampedPage === 1}
            >
              Prev
            </button>
            <div className="sbMuted sbSmall">
              Page <span className="sbStrong">{clampedPage}</span> of <span className="sbStrong">{pageCount}</span>
            </div>
            <button
              type="button"
              className="sbPageButton"
              onClick={() => setPage(Math.min(pageCount, clampedPage + 1))}
              disabled={clampedPage === pageCount}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {filtersOpen && (
        <div
          className="sbModalOverlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFiltersOpen(false);
          }}
        >
          <div
            className="sbModal"
            role="dialog"
            aria-modal="true"
            aria-label="Tournament filters"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="sbModalHeader">
              <h2 className="sbModalTitle">Filters</h2>
              <button type="button" className="sbIconButton" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                <XMarkIcon className="sbIcon" aria-hidden="true" />
              </button>
            </div>

            <div className="sbFiltersGrid">
              <div>
                <div className="sbModalSection">
                  <h3 className="sbModalSectionTitle">Location</h3>
                  <div className="sbCheckboxList">
                    <label className="sbCheckboxRow">
                      <input type="checkbox" checked={allModesSelected} onChange={setAllModes} />
                      All
                    </label>
                    <div className="sbCheckboxChildren sbCheckboxList">
                      {MODE_OPTIONS.map((opt) => (
                        <label key={opt.key} className="sbCheckboxRow">
                          <input
                            type="checkbox"
                            checked={allModesSelected ? true : selectedModes.has(opt.key)}
                            onChange={() => toggleMode(opt.key)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sbModalSection">
                  <h3 className="sbModalSectionTitle">Year</h3>
                  <div className="sbCheckboxList">
                    <label className="sbCheckboxRow">
                      <input type="checkbox" checked={allYearsSelected} onChange={setAllYears} />
                      All
                    </label>
                    <div className="sbCheckboxChildren sbCheckboxList">
                      {yearOptions.map((year) => (
                        <label key={year} className="sbCheckboxRow">
                          <input
                            type="checkbox"
                            checked={allYearsSelected ? true : selectedYears.has(year)}
                            onChange={() => toggleYear(year)}
                          />
                          {year}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="sbModalSection">
                  <h3 className="sbModalSectionTitle">Divisions</h3>
                  <div className="sbCheckboxList">
                    <label className="sbCheckboxRow">
                      <input type="checkbox" checked={allDivisionsSelected} onChange={setAllDivisions} />
                      All
                    </label>
                    <div className="sbCheckboxChildren sbCheckboxList">
                      {DIVISION_OPTIONS.map((div) => (
                        <label key={div.key} className="sbCheckboxRow">
                          <input
                            type="checkbox"
                            checked={allDivisionsSelected ? true : selectedDivisions.has(div.key)}
                            onChange={() => toggleDivision(div.key)}
                          />
                          {div.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sbModalSection">
                  <h3 className="sbModalSectionTitle">Status</h3>
                  <div className="sbCheckboxList">
                    <label className="sbCheckboxRow">
                      <input type="checkbox" checked={allStatusesSelected} onChange={setAllStatuses} />
                      All
                    </label>
                    <div className="sbCheckboxChildren sbCheckboxList">
                      {ALL_STATUSES.map((status) => (
                        <label key={status} className="sbCheckboxRow">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.has(status)}
                            onChange={() => toggleStatus(status)}
                          />
                          {getStatusLabel(status)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sbModalFooter">
              <button type="button" className="sbPageButton" onClick={clearFilters}>
                Clear
              </button>
              <button type="button" className="sbPageButton" onClick={() => setFiltersOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
