type StatCardProps = {
  label: string;
  value: string;
  change: string;
  accent?: "yellow" | "cyan" | "teal";
};

export default function StatCard({
  label,
  value,
  change,
  accent = "teal",
}: StatCardProps) {
  const accentColor = {
    yellow: "#fff000",
    cyan: "#00e5ff",
    teal: "#00e5b0",
  }[accent];

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-[#0d0730] p-5 transition hover:border-white/[0.18]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#777099]">
          {label}
        </p>

        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
          }}
        />
      </div>

      <div className="mt-5 flex items-end justify-between">
        <p className="text-3xl font-bold text-white">
          {value}
        </p>

        <span className="text-xs font-semibold text-[#00e5b0]">
          {change}
        </span>
      </div>
    </div>
  );
}