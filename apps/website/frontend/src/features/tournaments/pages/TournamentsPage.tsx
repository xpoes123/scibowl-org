import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTournaments } from "../hooks/useTournaments";
import type { TournamentStatus, TournamentStatusParam } from "../types";
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

export function TournamentsPage() {
  const { tournaments } = useTournaments();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = parseStatusQueryParam(searchParams.get("status"));
  const [query, setQuery] = useState("");

  const pageSize = 20;
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

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
    if (statusParam !== "all") {
      const wanted = statusParamToStatus(statusParam);
      list = list.filter((t) => t.lifecycleStatus === wanted);
    }

    if (normalizedQuery) {
      list = list.filter((t) => {
        const location = t.location ? `${t.location.city}, ${t.location.state}`.toLowerCase() : "online";
        return t.name.toLowerCase().includes(normalizedQuery) || location.includes(normalizedQuery);
      });
    }

    return list.slice().sort((a, b) => {
      if (statusParam === "all") {
        const order: Record<TournamentStatus, number> = { LIVE: 0, UPCOMING: 1, FINISHED: 2 };
        if (a.lifecycleStatus !== b.lifecycleStatus) return order[a.lifecycleStatus] - order[b.lifecycleStatus];
        return compareWithinStatus(a.lifecycleStatus, a, b);
      }

      return compareWithinStatus(statusParamToStatus(statusParam), a, b);
    });
  }, [query, statusParam, tournaments]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const setStatus = (nextStatus: "all" | TournamentStatusParam) => {
    const next = new URLSearchParams(searchParams);
    if (nextStatus === "all") next.delete("status");
    else next.set("status", nextStatus);
    next.delete("page");
    setSearchParams(next);
  };

  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  return (
    <div className="sbStack">
      <div className="card sbPageHeader">
        <h1 className="sbTitle">All Tournaments</h1>
        <p className="sbMuted sbTopSpace">Search and filter tournaments.</p>

        <div className="sbListingControls sbTopSpace">
          <label className="sbField">
            <span className="sbFieldLabel">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                const next = new URLSearchParams(searchParams);
                next.delete("page");
                setSearchParams(next);
              }}
              className="sbInput"
              placeholder={"Search by name or location\u2026"}
            />
          </label>

          <label className="sbField">
            <span className="sbFieldLabel">Status</span>
            <select
              value={statusParam}
              onChange={(e) => setStatus(e.target.value as "all" | TournamentStatusParam)}
              className="sbSelect"
              aria-label="Filter tournaments by status"
            >
              <option value="all">All</option>
              <option value="live">Live</option>
              <option value="upcoming">Upcoming</option>
              <option value="finished">Finished</option>
            </select>
          </label>
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
    </div>
  );
}
