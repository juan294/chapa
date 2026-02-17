// ---------------------------------------------------------------------------
// AdminStatsCards — summary tier cards for the admin dashboard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  detail,
  delay,
}: {
  label: string;
  value: string | number;
  detail?: string;
  delay: number;
}) {
  return (
    <div
      className="rounded-xl border border-stroke bg-card p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="font-heading text-xs text-text-secondary tracking-wider uppercase">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl text-text-primary tabular-nums">
        {value}
      </p>
      {detail && (
        <p className="mt-0.5 text-xs text-text-secondary">{detail}</p>
      )}
    </div>
  );
}

interface AdminStatsCardsProps {
  totalUsers: number;
  tierCounts: Record<string, number>;
}

export function AdminStatsCards({ totalUsers, tierCounts }: AdminStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Total Users" value={totalUsers} delay={0} />
      <StatCard
        label="Elite"
        value={tierCounts.Elite ?? 0}
        detail={totalUsers > 0 ? `${((tierCounts.Elite ?? 0) / totalUsers * 100).toFixed(0)}%` : undefined}
        delay={50}
      />
      <StatCard
        label="High"
        value={tierCounts.High ?? 0}
        detail={totalUsers > 0 ? `${((tierCounts.High ?? 0) / totalUsers * 100).toFixed(0)}%` : undefined}
        delay={100}
      />
      <StatCard
        label="Solid"
        value={tierCounts.Solid ?? 0}
        detail={totalUsers > 0 ? `${((tierCounts.Solid ?? 0) / totalUsers * 100).toFixed(0)}%` : undefined}
        delay={150}
      />
      <StatCard
        label="Emerging"
        value={tierCounts.Emerging ?? 0}
        detail={totalUsers > 0 ? `${((tierCounts.Emerging ?? 0) / totalUsers * 100).toFixed(0)}%` : undefined}
        delay={200}
      />
    </div>
  );
}
