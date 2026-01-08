import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PacketSetRow } from "../components/PacketSetRow";
import { usePacketSets } from "../hooks/usePacketSets";

export function PacketsPage() {
  const { packetSets } = usePacketSets();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const pageSize = 20;
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = packetSets.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!normalized) return sorted;
    return sorted.filter((set) => set.name.toLowerCase().includes(normalized));
  }, [packetSets, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  return (
    <div className="sbStack">
      <div className="card sbTournamentCard sbHeroCard">
        <h1 className="sbTitle">Question Packets</h1>
        <p className="sbMuted sbTopSpace">Search and filter invitational question sets.</p>

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
              placeholder={"Search by name\u2026"}
            />
          </label>
        </div>
      </div>

      <section className="card sbAccordion sbListingCard" aria-label="Packet set list">
        <div className="sbRows">
          {pageItems.length === 0 ? (
            <div className="sbEmptyState">
              <p className="sbMuted">No packet sets found.</p>
            </div>
          ) : (
            pageItems.map((packetSet) => <PacketSetRow key={packetSet.slug} packetSet={packetSet} />)
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
