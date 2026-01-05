import { memo, useMemo } from "react";
import type { TournamentLevel } from "../types";

type LevelPillsProps = {
  levels: TournamentLevel[];
  className?: string;
};

const levelOrder: Record<TournamentLevel, number> = { MS: 0, HS: 1 };

export const LevelPills = memo(function LevelPills({ levels, className }: LevelPillsProps) {
  const normalized = useMemo(() => {
    const unique = Array.from(new Set(levels));
    unique.sort((a, b) => levelOrder[a] - levelOrder[b]);
    return unique;
  }, [levels]);

  return (
    <div className={className ? `sbLevelPills ${className}` : "sbLevelPills"} aria-label="Tournament levels">
      {normalized.map((level) => (
        <span key={level} className="sbLevelPill">
          {level}
        </span>
      ))}
    </div>
  );
});

