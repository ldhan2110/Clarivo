/** "2h ago" / "Yesterday" / "Sep 30, 2026" — relative only while it reads better. */
export function relativeTime(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.round((Date.now() - then.getTime()) / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 60 * 48) return "Yesterday";
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** A `date` column is 'YYYY-MM-DD'; parsing it as a Date would shift timezone. */
export function formatDay(day: string | null): string {
  if (!day) return "—";
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
