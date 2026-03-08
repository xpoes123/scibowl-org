function titleCaseWordPreservingAcronyms(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) return "";

  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "");
  const isAcronym = lettersOnly.length > 1 && lettersOnly === lettersOnly.toUpperCase();
  if (isAcronym) return trimmed;

  return trimmed.slice(0, 1).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function toTitleCasePreservingAcronyms(text: string): string {
  return text
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => titleCaseWordPreservingAcronyms(word))
    .filter(Boolean)
    .join(" ");
}

export function formatPacketOrRoundLabel(roundNumber: number, roundName: string, packetName: string): string {
  const raw = (packetName || roundName || "").trim();
  if (!raw) return `Round ${roundNumber}`;
  return toTitleCasePreservingAcronyms(raw);
}

