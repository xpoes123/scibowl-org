import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { memo, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { TournamentStatus, TournamentSummary } from "../types";
import { getStatusDotClass } from "../utils/status";
import { TournamentRow } from "./TournamentRow";

type TournamentSectionProps = {
  status: TournamentStatus;
  title: string;
  count: number;
  countLabel: string;
  tournaments: TournamentSummary[];
  defaultOpen: boolean;
  viewAllTo: string;
  viewAllLabel: string;
};

export const TournamentSection = memo(function TournamentSection({
  status,
  title,
  count,
  countLabel,
  tournaments,
  defaultOpen,
  viewAllTo,
  viewAllLabel,
}: TournamentSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  const visibleTournaments = useMemo(() => tournaments.slice(0, 10), [tournaments]);
  const showViewAll = count > 10;

  return (
    <section className="card sbAccordion">
      <button
        type="button"
        className="sbAccordionHeader"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className={getStatusDotClass(status)} aria-hidden="true" />
        <span className="sbAccordionTitle">
          {title} <span className="sbMuted">({countLabel})</span>
        </span>
        <ChevronDownIcon className={open ? "sbAccordionChevron sbAccordionChevronOpen" : "sbAccordionChevron"} aria-hidden="true" />
      </button>

      {open && (
        <div id={contentId} className="sbAccordionBody">
          <div className="sbRows">
            {visibleTournaments.map((tournament) => (
              <TournamentRow key={tournament.id} tournament={tournament} />
            ))}
          </div>

          {showViewAll && (
            <div className="sbSectionFooter">
              <Link to={viewAllTo} className="sbViewAllLink">
                {viewAllLabel} <span aria-hidden="true">{"\u2192"}</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
});
