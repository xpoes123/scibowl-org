import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import type { PacketSet } from "../types";

type PacketSetRowProps = {
  packetSet: PacketSet;
};

export const PacketSetRow = memo(function PacketSetRow({ packetSet }: PacketSetRowProps) {
  const count = packetSet.packets.length;
  const countLabel = useMemo(() => `${count} PDF${count === 1 ? "" : "s"}`, [count]);

  return (
    <Link to={`/packets/${packetSet.slug}`} className="sbTournamentRow">
      <div className="sbPacketRowContent">
        <div className="sbRowMain">
          <div className="sbMinW0">
            <div className="sbRowNameLine">
              <span className="sbRowName">{packetSet.name}</span>
            </div>
          </div>
        </div>

        <span className="sbBadge sbBadgeNeutral">{countLabel}</span>

        <div className="sbRowRight">
          <ChevronRightIcon className="sbRowChevron" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
});

