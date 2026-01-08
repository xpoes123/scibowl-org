import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Link, useParams } from "react-router-dom";
import { usePacketSet } from "../hooks/usePacketSet";

export function PacketSetDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: packetSet, loading, error } = usePacketSet(slug);

  if (loading) {
    return (
      <div className="card sbCenter">
        <div className="sbSpinner" aria-label="Loading packet set" />
        <p className="sbMuted sbTopSpace">Loading packet set…</p>
      </div>
    );
  }

  if (!packetSet) {
    return (
      <div className="card sbCenter">
        <h1 className="sbTitle">Packet set not found</h1>
        <p className="sbMuted sbTopSpace">{error ? error : "The packet set you are looking for does not exist."}</p>
        <Link to="/packets" className="sbHeaderLink sbTopSpace">
          Back to packets
        </Link>
      </div>
    );
  }

  return (
    <div className="sbStack">
      <div className="card sbTournamentCard sbHeroCard" aria-label="Packet set summary">
        <div className="sbTournamentHeader">
          <div className="sbMinW0">
            <Link to="/packets" className="sbInlineLink">
              <ArrowLeftIcon className="sbIcon" aria-hidden="true" /> Back
            </Link>

            <h1 className="sbHeroTitle sbHeroTitleTight">{packetSet.name}</h1>

            <div className="sbHeroMetaRow sbHeroMetaRowSecondary" aria-label="Packet set metadata" />
          </div>
        </div>
      </div>

      <div className="card" aria-label="Packet PDFs">
        {packetSet.packets.length === 0 ? (
          <p className="sbMuted">No packets available yet.</p>
        ) : (
          <ul className="sbBulletList">
            {packetSet.packets.map((url, idx) => (
              <li key={url}>
                <a className="sbInlineLink" href={url} target="_blank" rel="noreferrer">
                  Packet {idx + 1}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

