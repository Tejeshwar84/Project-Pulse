"use client";
import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Project = {
  id: string;
  name: string;
  riskScore: number;
  riskReason: string | null;
  budget: number;
  spent: number;
  deadline: string;
  tasks: { status: string; priority: string }[];
};

type Factors = {
  deadline: number;
  budget: number;
  workload: number;
  completion: number;
};

type Metrics = {
  completionPct: number;
  budgetUsed: number;
  daysLeft: number;
  blockedTasks: number;
};

export default function AIRiskPanel({ project }: { project: Project }) {
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [factors, setFactors] = useState<Factors | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const displayScore = riskScore !== null ? riskScore : project.riskScore;
  const riskColor =
    displayScore > 70 ? "#fb7185" : displayScore >= 40 ? "#fbbf24" : "#34d399";
  const displayColorClass =
    displayScore > 70
      ? "text-rose"
      : displayScore >= 40
        ? "text-amber"
        : "text-jade";
  const panelBg =
    project.riskScore >= 70
      ? "border-rose/20 bg-rose/5"
      : project.riskScore >= 40
        ? "border-amber/20 bg-amber/5"
        : "border-jade/20 bg-jade/5";

  const factorChartData = useMemo(
    () => [
      { name: "Deadline", value: factors?.deadline ?? 0 },
      { name: "Budget", value: factors?.budget ?? 0 },
      { name: "Workload", value: factors?.workload ?? 0 },
      { name: "Completion", value: factors?.completion ?? 0 },
    ],
    [factors],
  );

  const metricsCards = useMemo(
    () => [
      {
        label: "Completion",
        value: metrics ? `${metrics.completionPct}%` : "—",
        accent: "text-jade",
      },
      {
        label: "Budget Used",
        value: metrics ? `${metrics.budgetUsed}%` : "—",
        accent: "text-amber",
      },
      {
        label: "Days Left",
        value: metrics ? `${metrics.daysLeft}d` : "—",
        accent: "text-white",
      },
      {
        label: "Blocked Tasks",
        value: metrics ? metrics.blockedTasks : "—",
        accent: "text-rose",
      },
    ],
    [metrics],
  );

  async function runAnalysis() {
    setLoading(true);
    setAnalysis("");
    setDone(false);

    const res = await fetch("/api/ai-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    const data = await res.json();

    setAnalysis(data.analysis || data.error || "Analysis complete.");
    setRiskScore(typeof data.riskScore === "number" ? data.riskScore : null);
    setFactors(data.factors ?? null);
    setMetrics(data.metrics ?? null);
    setDone(true);
    setLoading(false);
  }

  const donutData = [
    { name: "Risk", value: displayScore },
    { name: "Remaining", value: 100 - displayScore },
  ];

  return (
    <div className={`glass rounded-xl border ${panelBg}`}>
      <div className="px-6 py-4 border-b border-white/5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">◎</span>
          <h2 className="font-display text-lg font-semibold text-white">
            AI Risk Analytics
          </h2>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl border border-accent/20 bg-accent/20 px-4 py-2 text-xs font-semibold text-accent-light transition hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "⟳ Analyzing..."
            : done
              ? "↺ Re-analyze"
              : "▶ Run Analysis"}
        </button>
      </div>

      <div className="p-6 space-y-6">
        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                  Overall Risk
                </p>
                <p
                  className={`mt-2 text-3xl font-semibold ${displayColorClass}`}
                >
                  {displayScore}%
                </p>
              </div>
              <div className="rounded-3xl bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/50">
                {displayScore > 70
                  ? "High Risk"
                  : displayScore >= 40
                    ? "Medium Risk"
                    : "Low Risk"}
              </div>
            </div>

            <div className="mt-6 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={80}
                    outerRadius={110}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={4}
                    cornerRadius={20}
                  >
                    <Cell key="risk" fill={riskColor} />
                    <Cell key="remaining" fill="rgba(255,255,255,0.1)" />
                  </Pie>
                  <text
                    x="50%"
                    y="50%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="20"
                    fontWeight={700}
                  >
                    Risk {displayScore}%
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {metricsCards.map((card) => (
              <div
                key={card.label}
                className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)]"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                  {card.label}
                </p>
                <p className={`mt-3 text-2xl font-semibold ${card.accent}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                Risk Factor Breakdown
              </p>
              <p className="mt-1 text-sm text-white/70">
                Analyze the underlying drivers shaping your project risk score.
              </p>
            </div>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={factorChartData}
                margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.08)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(248,250,252,0.7)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(248,250,252,0.7)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.06)" }}
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                  }}
                  labelStyle={{ color: "#f8fafc" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="value" fill={riskColor} radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr]">
          {project.riskReason && !analysis && (
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                Last Assessment
              </p>
              <p className="mt-3 text-sm leading-7 text-white/70">
                {project.riskReason}
              </p>
            </div>
          )}

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                  AI Insights
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Qualitative recommendations from the latest risk assessment.
                </p>
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-3 text-white/40 py-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2.5 w-2.5 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-sm">
                  Claude is analyzing your project...
                </span>
              </div>
            )}

            {analysis && (
              <p className="text-sm leading-7 text-white/70">{analysis}</p>
            )}

            {!loading && !analysis && !project.riskReason && (
              <p className="text-sm leading-7 text-white/50">
                Click “Run Analysis” to power up this dashboard with AI-driven
                risk intelligence.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
