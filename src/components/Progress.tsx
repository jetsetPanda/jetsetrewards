export default function Progress({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-accent" : "bg-gold"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
