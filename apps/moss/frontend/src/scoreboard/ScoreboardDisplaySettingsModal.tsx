import type { ReactNode } from "react";
import type { ScoreboardRowAdvanceMode } from "./displaySettings";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  mode: ScoreboardRowAdvanceMode;
  onModeChange: (mode: ScoreboardRowAdvanceMode) => void;
};

function SettingsOption({
  value,
  label,
  description,
  checked,
  onChange,
}: {
  value: ScoreboardRowAdvanceMode;
  label: ReactNode;
  description: ReactNode;
  checked: boolean;
  onChange: (value: ScoreboardRowAdvanceMode) => void;
}) {
  return (
    <label className="scoreboardDisplaySettingsOption">
      <input
        type="radio"
        name="scoreboardRowAdvanceMode"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      <span className="scoreboardDisplaySettingsOptionText">
        <span className="scoreboardDisplaySettingsOptionLabel">{label}</span>
        <span className="scoreboardDisplaySettingsOptionDescription">{description}</span>
      </span>
    </label>
  );
}

export default function ScoreboardDisplaySettingsModal({ isOpen, onClose, mode, onModeChange }: Props) {
  if (!isOpen) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-label="Scoreboard display settings" onClick={onClose}>
      <div className="modal smallModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2 className="modalTitle">Display Settings</h2>
        </div>
        <div className="modalBody">
          <div className="scoreboardDisplaySettingsSectionTitle">Row advancing</div>
          <div className="scoreboardDisplaySettingsList" role="radiogroup" aria-label="Row advancing mode">
            <SettingsOption
              value="follow_moderator"
              label="Follow moderator"
              description="Automatically scroll to the current question."
              checked={mode === "follow_moderator"}
              onChange={onModeChange}
            />
            <SettingsOption
              value="frozen"
              label="Frozen"
              description="Never auto-scroll."
              checked={mode === "frozen"}
              onChange={onModeChange}
            />
            <SettingsOption
              value="most_recent"
              label="Most recent"
              description="Automatically scroll to the most recently played question."
              checked={mode === "most_recent"}
              onChange={onModeChange}
            />
          </div>
        </div>
        <div className="modalFooter">
          <div className="modalActionsRight">
            <button type="button" className="secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
