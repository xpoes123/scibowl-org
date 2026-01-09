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

function formatMonthDayParts(date: Date): { month: string; day: string } {
  const parts = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return { month, day };
}

export function formatTournamentDateRange(startIso: string, endIso: string): string {
  const start = parseISODateToLocalDate(startIso);
  if (!start) return "";

  const end = parseISODateToLocalDate(endIso);
  if (!end) return tournamentDateFormatter.format(start);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) return tournamentDateFormatter.format(start);

  const sameYear = start.getFullYear() === end.getFullYear();
  if (!sameYear) {
    const withYear = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
    return `${withYear.format(start)}–${withYear.format(end)}`;
  }

  const { month: startMonth, day: startDay } = formatMonthDayParts(start);
  const { month: endMonth, day: endDay } = formatMonthDayParts(end);
  const year = String(start.getFullYear());

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`;
  }

  return `${startMonth} ${startDay}–${endMonth} ${endDay}, ${year}`;
}
