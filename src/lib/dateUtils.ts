export type DateStatus = "completed" | "upcoming" | "today";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseLocalDate(dateValue: string): Date {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid local date: ${dateValue}`);
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid local date: ${dateValue}`);
  }

  return date;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatMonthDayYear(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTotalDaysTogether(startDate: string | Date, today = new Date()): number {
  const start = normalizeDateInput(startDate);
  const current = startOfLocalDay(today);
  const diff = Math.floor((current.getTime() - start.getTime()) / MS_PER_DAY);

  return Math.max(0, diff);
}

export function getTotalMonthsTogether(startDate: string | Date, today = new Date()): number {
  const start = normalizeDateInput(startDate);
  const current = startOfLocalDay(today);

  if (current < start) {
    return 0;
  }

  let months =
    (current.getFullYear() - start.getFullYear()) * 12 +
    (current.getMonth() - start.getMonth());

  if (current.getDate() < start.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

export function getNextMonthlyAnniversary(today = new Date(), anniversaryDay: number): Date {
  const current = startOfLocalDay(today);
  const currentMonthAnniversary = buildMonthlyDate(
    current.getFullYear(),
    current.getMonth(),
    anniversaryDay
  );

  if (current.getDate() <= anniversaryDay) {
    return currentMonthAnniversary;
  }

  return buildMonthlyDate(current.getFullYear(), current.getMonth() + 1, anniversaryDay);
}

export function getDaysUntil(date: Date, today = new Date()): number {
  const target = startOfLocalDay(date);
  const current = startOfLocalDay(today);
  const diff = Math.floor((target.getTime() - current.getTime()) / MS_PER_DAY);

  return Math.max(0, diff);
}

export function getDateStatus(date: string | Date, today = new Date()): DateStatus {
  const target = normalizeDateInput(date);
  const current = startOfLocalDay(today);

  if (target.getTime() === current.getTime()) {
    return "today";
  }

  return target < current ? "completed" : "upcoming";
}

export function getMonthversaryDate(
  startDate: string | Date,
  monthNumber: number,
  anniversaryDay: number
): Date {
  const start = normalizeDateInput(startDate);
  const firstMonthOffset = start.getDate() <= anniversaryDay ? 0 : 1;
  const monthOffset = firstMonthOffset + Math.max(0, monthNumber);

  return buildMonthlyDate(start.getFullYear(), start.getMonth() + monthOffset, anniversaryDay);
}

export function getMonthNumberForDate(
  memoryDate: string | Date,
  startDate: string | Date
): number {
  const memory = normalizeDateInput(memoryDate);
  const start = normalizeDateInput(startDate);

  return (
    (memory.getFullYear() - start.getFullYear()) * 12 +
    (memory.getMonth() - start.getMonth())
  );
}

export function isSameLocalDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function normalizeDateInput(date: string | Date): Date {
  return typeof date === "string" ? parseLocalDate(date) : startOfLocalDay(date);
}

function buildMonthlyDate(year: number, month: number, day: number): Date {
  const target = new Date(year, month, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();

  target.setDate(Math.min(day, lastDay));
  return startOfLocalDay(target);
}
