export type AttemptResult = "correct" | "incorrect";

export type AttemptLocation =
  | { kind: "question"; wordIndex: number }
  | { kind: "option"; optionIndex: number; wordIndex: number }
  | { kind: "end" };

export type Attempt = {
  token: string;
  isEnd: boolean;
  result?: AttemptResult;
  location: AttemptLocation;
  teamId: string;
  playerId?: string;
};

export type ScoresheetMarkerKind = "HALFTIME" | "BREAK";
