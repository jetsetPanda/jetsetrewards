// The cycle engine: turns a benefit definition + a user card into the
// concrete date window that is currently in effect.
//
// All dates are handled as "YYYY-MM-DD" strings (UTC, date-only) to avoid
// timezone drift between local dev, Vercel, and Postgres `date` columns.

export type Cycle =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual_calendar"
  | "annual_cardmember"
  | "one_time";

export interface WindowSpan {
  start: string; // inclusive
  end: string; // inclusive
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function iso(y: number, m: number, d: number): string {
  // m is 1-12
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

function lastDayOfMonth(y: number, m: number): number {
  // m is 1-12; day 0 of next month = last day of this month
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addDays(isoDate: string, days: number): string {
  const dt = new Date(isoDate + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function clampDay(y: number, m: number, d: number): number {
  return Math.min(d, lastDayOfMonth(y, m));
}

export function currentWindow(
  cycle: Cycle,
  today: string,
  opts: {
    anniversaryMonth?: number | null;
    anniversaryDay?: number | null;
    openedOn?: string | null;
    cycleYears?: number | null;
  } = {}
): WindowSpan {
  const y = parseInt(today.slice(0, 4), 10);
  const m = parseInt(today.slice(5, 7), 10);

  switch (cycle) {
    case "monthly":
      return { start: iso(y, m, 1), end: iso(y, m, lastDayOfMonth(y, m)) };

    case "quarterly": {
      const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
      const qEndMonth = qStartMonth + 2;
      return {
        start: iso(y, qStartMonth, 1),
        end: iso(y, qEndMonth, lastDayOfMonth(y, qEndMonth)),
      };
    }

    case "semiannual":
      return m <= 6
        ? { start: iso(y, 1, 1), end: iso(y, 6, 30) }
        : { start: iso(y, 7, 1), end: iso(y, 12, 31) };

    case "annual_calendar":
      return { start: iso(y, 1, 1), end: iso(y, 12, 31) };

    case "annual_cardmember": {
      const am = opts.anniversaryMonth ?? 1;
      const ad = opts.anniversaryDay ?? 1;
      const thisYearAnniv = iso(y, am, clampDay(y, am, ad));
      if (today >= thisYearAnniv) {
        const nextAnniv = iso(y + 1, am, clampDay(y + 1, am, ad));
        return { start: thisYearAnniv, end: addDays(nextAnniv, -1) };
      }
      const lastAnniv = iso(y - 1, am, clampDay(y - 1, am, ad));
      return { start: lastAnniv, end: addDays(thisYearAnniv, -1) };
    }

    case "one_time": {
      const start = opts.openedOn ?? today;
      const years = opts.cycleYears ?? 100;
      const sy = parseInt(start.slice(0, 4), 10);
      const sm = parseInt(start.slice(5, 7), 10);
      const sd = parseInt(start.slice(8, 10), 10);
      const end = iso(sy + years, sm, clampDay(sy + years, sm, sd));
      return { start, end: addDays(end, -1) };
    }
  }
}

export function windowStatus(
  valueCents: number,
  usedCents: number,
  windowEnd: string,
  today: string
): "open" | "partially_used" | "used" | "expired" {
  if (usedCents >= valueCents) return "used";
  if (windowEnd < today) return "expired";
  if (usedCents > 0) return "partially_used";
  return "open";
}

export function daysUntil(isoDate: string, today: string): number {
  const a = new Date(today + "T00:00:00Z").getTime();
  const b = new Date(isoDate + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}
