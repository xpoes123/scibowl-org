import type { TournamentDetail } from "../../types";

type SetTabProps = {
  tournament: TournamentDetail;
};

export function SetTab({ tournament }: SetTabProps) {
  const difficulty = tournament.set?.difficulty ?? tournament.difficulty;
  const writers = tournament.set?.writers ?? tournament.writing_team;

  return (
    <div className="sbTabStack" aria-label="Tournament set">
      <section className="sbTabSection" aria-label="Set details">
        <header className="sbSectionHeader">
          <h2 className="sbSectionTitle">Details</h2>
        </header>

        <div className="sbTabSectionBody">
          <div className="sbDetailRows" aria-label="Set details">
            <div className="sbDetailRow">
              <span className="sbLabel">Difficulty</span>
              <span className="sbDetailValue">{difficulty ? difficulty : "TBD"}</span>
            </div>
            <div className="sbDetailRow">
              <span className="sbLabel">Writers</span>
              <span className="sbDetailValue">{writers ? writers : "TBD"}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
