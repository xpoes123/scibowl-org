import { useState } from "react";
import type { TournamentPacketSummary } from "../domain/tournamentPacketsClient";

type Props = {
  tournamentName: string;
  packets: TournamentPacketSummary[] | null;
  listLoading: boolean;
  listError: string | null;
  // Non-blocking notice, e.g. when the roster comes from a different tournament.
  warning: string | null;
  // Resolves to an error message to show, or null once the packet is loaded.
  onUnlock: (packetId: string, password: string) => Promise<string | null>;
  onBack: () => void;
  onClose: () => void;
};

export default function TournamentPacketChooserModal({
  tournamentName,
  packets,
  listLoading,
  listError,
  warning,
  onUnlock,
  onBack,
  onClose,
}: Props) {
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  function selectPacket(packetId: string) {
    if (isUnlocking) return;
    setSelectedPacketId(packetId);
    setPassword("");
    setUnlockError(null);
  }

  async function submitPassword() {
    if (!selectedPacketId || !password.trim() || isUnlocking) return;
    setIsUnlocking(true);
    setUnlockError(null);
    try {
      const error = await onUnlock(selectedPacketId, password);
      if (error) setUnlockError(error);
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-label="Select Tournament Packet"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="modal chooserModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2 className="modalTitle">Select Tournament Packet</h2>
        </div>
        <div className="modalBody">
          <div className="packetBox" style={{ marginBottom: 12 }}>
            <div className="packetBoxText">
              <div className="packetName">{tournamentName}</div>
              <div className="packetSubtext">Select a packet, then enter the password from the tournament director.</div>
              {listLoading && <div className="packetSubtext">Loading packet list…</div>}
              {listError && <div className="packetError">{listError}</div>}
              {warning && <div className="packetWarning">{warning}</div>}
            </div>
          </div>

          <div aria-label="Tournament packets" style={{ height: 380, overflowY: "auto", paddingRight: 6 }}>
            <div className="chooserList">
              {packets && packets.length === 0 && <div className="packetSubtext">No packets found.</div>}
              {packets?.map((packet) => {
                const isSelected = packet.id === selectedPacketId;
                return (
                  <div key={packet.id}>
                    <button
                      type="button"
                      className="chooserOption"
                      aria-expanded={isSelected}
                      disabled={isUnlocking && !isSelected}
                      onClick={() => selectPacket(packet.id)}
                    >
                      <div className="chooserOptionTitle">{packet.name}</div>
                    </button>
                    {isSelected && (
                      <form
                        className="packetPasswordRow"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitPassword();
                        }}
                      >
                        <input
                          className="textInput"
                          type="password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setUnlockError(null);
                          }}
                          placeholder="Packet password"
                          aria-label={`Password for ${packet.name}`}
                          autoComplete="off"
                          autoFocus
                          disabled={isUnlocking}
                        />
                        <button type="submit" disabled={!password.trim() || isUnlocking}>
                          {isUnlocking ? "Unlocking…" : "Unlock"}
                        </button>
                      </form>
                    )}
                    {isSelected && unlockError && <div className="packetError">{unlockError}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="chooserFooter" style={{ gap: 10 }}>
            <button type="button" className="secondary" onClick={onBack} disabled={isUnlocking}>
              Back
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
