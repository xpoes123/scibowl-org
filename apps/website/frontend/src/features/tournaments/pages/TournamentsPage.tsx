import { FunnelIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTournaments } from "../hooks/useTournaments";
import type { TournamentDivision, TournamentStatus, TournamentStatusParam } from "../types";
import { parseStatusQueryParam } from "../utils/status";
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

  const availableDivisions = useMemo(() => {
    const unique = new Set<TournamentDivision>();
    tournaments.forEach((t) => {
      t.divisions.forEach((div) => unique.add(div));
    });
    const ordered: TournamentDivision[] = ["MS", "HS", "UG", "OPEN"];
    return ordered.filter((div) => unique.has(div));
  }, [tournaments]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    // Determine lifecycle status from dates
    const now = new Date();
    const listWithStatus = tournaments.map(t => {
      const startDate = new Date(t.dates.start);
      const endDate = new Date(t.dates.end);
      const isFinished = now > endDate;
      const isUpcoming = now < startDate;
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
  }, [query, selectedDivisions, selectedStatuses, tournaments]);

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

  const toggleStatus = (status: TournamentStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
    resetToPageOne();
  };

  const toggleDivision = (division: TournamentDivision) => {
    setSelectedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(division)) next.delete(division);
      else next.add(division);
      return next;
    });
    resetToPageOne();
  };

  const clearFilters = () => {
    setSelectedStatuses(new Set(ALL_STATUSES));
    setSelectedDivisions(new Set());
    resetToPageOne();
  };

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
                onClick={() => searchInputRef.current?.focus()}
              >
                <MagnifyingGlassIcon className="sbInputIcon" aria-hidden="true" />
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
            className="sbPageButton"
            onClick={() => setFiltersOpen(true)}
            aria-label="Open filters"
            title="Filters"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", flex: "0 0 auto" }}
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

            <div className="sbModalSection">
              <h3 className="sbModalSectionTitle">Status</h3>
              <div className="sbCheckboxList">
                {ALL_STATUSES.map((status) => (
                  <label key={status} className="sbCheckboxRow">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.has(status)}
                      onChange={() => toggleStatus(status)}
                    />
                    {status}
                  </label>
                ))}
              </div>
            </div>

            {availableDivisions.length > 0 && (
              <div className="sbModalSection">
                <h3 className="sbModalSectionTitle">Divisions</h3>
                <div className="sbCheckboxList">
                  {availableDivisions.map((div) => (
                    <label key={div} className="sbCheckboxRow">
                      <input
                        type="checkbox"
                        checked={selectedDivisions.has(div)}
                        onChange={() => toggleDivision(div)}
                      />
                      {div}
                    </label>
                  ))}
                </div>
              </div>
            )}

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
