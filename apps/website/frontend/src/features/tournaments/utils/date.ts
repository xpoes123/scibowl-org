function parseISODateToLocalDate(iso: string): Date | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Date(year, month - 1, day);
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

const tournamentDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatTournamentDate(iso: string): string {
  const date = parseISODateToLocalDate(iso);
  if (!date) return "";
  return tournamentDateFormatter.format(date);
}

