export type MossTournament = {
  slug: string;
  name: string;
  timezone: string;
  dates: { start: string; end: string };
  status?: string;
};

type Props = {
  title: string;
  tournaments: MossTournament[];
  // Slugs that have the resource being chosen (e.g. a roster file). null while still loading.
  availableSlugs: Set<string> | null;
  availabilityError: string | null;
  availabilityLoading: boolean;
  selectError: string | null;
  isSelecting: boolean;
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  defaultFilterHint: string;
  loadingText: string;
  unavailableSuffix: string;
  // Listed first (when available) regardless of date, e.g. the tournament of the selected roster.
  pinnedSlug?: string | null;
  onSelect: (tournament: MossTournament) => void;
  onClose: () => void;
};

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

export default function TournamentChooserModal({
  title,
  tournaments,
  availableSlugs,
  availabilityError,
  availabilityLoading,
  selectError,
  isSelecting,
  showAll,
  onShowAllChange,
  searchQuery,
  onSearchQueryChange,
  defaultFilterHint,
  loadingText,
  unavailableSuffix,
  pinnedSlug = null,
  onSelect,
  onClose,
}: Props) {
  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="modal chooserModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2 className="modalTitle">{title}</h2>
        </div>
        <div className="modalBody">
          <div className="packetBox" style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => onShowAllChange(e.target.checked)}
              />
              Show all tournaments
            </label>
            <div className="packetSubtext">{defaultFilterHint}</div>
            {availabilityLoading && <div className="packetSubtext">{loadingText}</div>}
            <div style={{ minHeight: 18 }}>
              {(selectError || availabilityError) && (
                <div className="packetError">{selectError ?? availabilityError}</div>
              )}
            </div>
          </div>

          <input
            className="textInput"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
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

                const canCheckAvailability = !!availableSlugs && !availabilityError;

                const getAvailability = (slug: string) => {
                  if (!canCheckAvailability) return "UNKNOWN";
                  return availableSlugs.has(slug) ? "HAS" : "NO";
                };

                const isUpcoming = (t: MossTournament) => {
                  const ymd = getDateYmdInTimeZone(now, t.timezone);
                  if (!ymd) return false;
                  return ymd <= t.dates.end;
                };

                const getSortKey = (t: MossTournament) => {
                  if (showAll) return t.dates.start;
                  const ymd = getDateYmdInTimeZone(now, t.timezone);
                  if (!ymd) return t.dates.start;
                  if (ymd < t.dates.start) return t.dates.start;
                  return ymd;
                };

                const base = showAll
                  ? [...tournaments]
                  : canCheckAvailability
                    ? tournaments.filter(
                        (t) => (isUpcoming(t) || t.slug === pinnedSlug) && getAvailability(t.slug) === "HAS"
                      )
                    : [];

                const q = searchQuery.trim().toLowerCase();
                const filtered = q
                  ? base.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
                  : base;

                filtered.sort((a, b) => {
                  if (pinnedSlug && (a.slug === pinnedSlug) !== (b.slug === pinnedSlug)) {
                    return a.slug === pinnedSlug ? -1 : 1;
                  }

                  if (showAll && canCheckAvailability) {
                    const aAvailable = getAvailability(a.slug) === "HAS";
                    const bAvailable = getAvailability(b.slug) === "HAS";
                    if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
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
                  if (!showAll && !canCheckAvailability && !availabilityError) {
                    return <div className="packetSubtext">{loadingText}</div>;
                  }
                  return <div className="packetSubtext">No results.</div>;
                }

                return filtered.map((tournament) => {
                  const availability = getAvailability(tournament.slug);
                  const isAvailable = availability === "HAS" || availability === "UNKNOWN";
                  const disabled =
                    isSelecting ||
                    availabilityLoading ||
                    (canCheckAvailability && availability !== "HAS");
                  const label = canCheckAvailability && !isAvailable
                    ? `${tournament.name} ${unavailableSuffix}`
                    : tournament.name;
                  const dateLabel =
                    tournament.dates.start === tournament.dates.end
                      ? tournament.dates.start
                      : `${tournament.dates.start} – ${tournament.dates.end}`;
                  return (
                    <button
                      key={tournament.slug}
                      type="button"
                      className="chooserOption"
                      disabled={disabled}
                      onClick={() => onSelect(tournament)}
                    >
                      <div className="chooserOptionRow">
                        <div className="chooserOptionTitle chooserOptionTitleTruncate">{label}</div>
                        <div className="chooserOptionDate">{dateLabel}</div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          <div className="chooserFooter">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
