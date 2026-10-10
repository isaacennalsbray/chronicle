// The in-game calendar maps one-to-one onto real months: Firstmoon is January, etc.
const MOONS = [
  "firstmoon",
  "secondmoon",
  "thirdmoon",
  "fourthmoon",
  "fifthmoon",
  "sixthmoon",
  "seventhmoon",
  "eighthmoon",
  "ninthmoon",
  "tenthmoon",
  "eleventhmoon",
  "twelfthmoon",
];

/**
 * The real date of an in-game date in a given year, e.g. ("9th of Tenthmoon, 287.3.3", 2026)
 * → "2026-10-09". Null if the label isn't a recognisable in-game date or the day doesn't exist.
 */
export function realDateFromInGameDate(inGameDate: string, year: number): string | null {
  const m = /(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([a-z]+moon)/i.exec(inGameDate);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MOONS.indexOf(m[2].toLowerCase());
  if (month === -1) return null;

  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
