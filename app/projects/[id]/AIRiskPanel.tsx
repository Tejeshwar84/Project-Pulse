'use client'
import { useState } from 'react'

type Project = {
  id: string
  name: string
  riskScore: number
  riskReason: string | null
  budget: number
  spent: number
  deadline: string
  tasks: { status: string; priority: string }[]
}

export default function AIRiskPanel({ project }: { project: Project }) {
  const [analysis, setAnalysis] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [riskScore, setRiskScore] = useState<number | null>(null)
  const [factors, setFactors] = useState<{ deadline: number; budget: number; workload: number; completion: number } | null>(null)
  const [metrics, setMetrics] = useState<{ completionPct: number; budgetUsed: number; daysLeft: number; blockedTasks: number } | null>(null)

  const displayScore = riskScore !== null ? riskScore : project.riskScore
  const scoreColor = displayScore > 70 ? 'text-rose' : displayScore >= 40 ? 'text-amber' : 'text-jade'
  const scoreBg = displayScore > 70 ? 'border-rose/20 bg-rose/5' : displayScore >= 40 ? 'border-amber/20 bg-amber/5' : 'border-jade/20 bg-jade/5'
  const panelBg = project.riskScore >= 70 ? 'border-rose/20 bg-rose/5' : project.riskScore >= 40 ? 'border-amber/20 bg-amber/5' : 'border-jade/20 bg-jade/5'

  const formatFactorLabel = (key: string) => {
    switch (key) {
      case 'deadline':
        return 'Deadline'
      case 'budget':
        return 'Budget'
      case 'workload':
        return 'Workload'
      case 'completion':
        return 'Completion'
      default:
        return key
    }
  }

  async function runAnalysis() {
    setLoading(true)
    setAnalysis('')
    setDone(false)
    const res = await fetch('/api/ai-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })
    const data = await res.json()
    setAnalysis(data.analysis || data.error || 'Analysis complete.')
    setRiskScore(typeof data.riskScore === 'number' ? data.riskScore : null)
    setFactors(data.factors ?? null)
    setMetrics(data.metrics ?? null)
    setDone(true)
    setLoading(false)
  }

  const tasks = project.tasks
  const todo = tasks.filter(t => t.status === 'todo').length
  const inProg = tasks.filter(t => t.status === 'in-progress').length
  const blocked = tasks.filter(t => t.status === 'blocked').length
  const done2 = tasks.filter(t => t.status === 'done').length
  const budgetPct = Math.round(project.spent / project.budget * 100)
  const daysLeft = Math.ceil((new Date(project.deadline).getTime() - Date.now()) / 86400000)

  return (
    <div className={`glass rounded-xl border ${panelBg}`}>
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">◎</span>
          <h2 className="font-display font-semibold text-white">AI Risk Analysis</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-2xl border px-4 py-2 text-right ${scoreBg}`}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">Risk Score</p>
            <p className={`font-display text-2xl font-bold ${scoreColor}`}>{displayScore}<span className="text-xs text-white/30">/100</span></p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent-light text-xs rounded-lg border border-accent/20 transition-all disabled:opacity-50"
          >
            {loading ? '⟳ Analyzing...' : done ? '↺ Re-analyze' : '▶ Run Analysis'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {factors && (
          <div className="mb-5">
            <p className="text-xs font-medium text-white/40 uppercase tracking-[0.2em] mb-3">Risk Factors</p>
            <div className="space-y-3">
              {Object.entries(factors).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                    <span>{formatFactorLabel(key)}</span>
                    <span>{value}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {metrics && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: 'Completion', value: `${metrics.completionPct}%`, accent: 'text-jade' },
              { label: 'Budget Used', value: `${metrics.budgetUsed}%`, accent: 'text-amber' },
              { label: 'Days Left', value: `${metrics.daysLeft}d`, accent: 'text-white' },
              { label: 'Blocked Tasks', value: metrics.blockedTasks, accent: 'text-rose' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/5 p-4 border border-white/5">
                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                <p className={`text-lg font-semibold ${stat.accent}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Stored risk reason */}
        {project.riskReason && !analysis && (
          <div className="text-sm text-white/60 bg-white/3 rounded-lg p-4 leading-relaxed border border-white/5">
            <p className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">Last Assessment</p>
            {project.riskReason}
          </div>
        )}

        {/* AI analysis */}
        {loading && (
          <div className="flex items-center gap-3 text-white/40 py-4">
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="text-sm">Claude is analyzing your project...</span>
          </div>
        )}

        {analysis && (
          <div className="text-sm text-white/70 bg-white/3 rounded-lg p-4 leading-relaxed border border-accent/10 animate-slide-up">
            <p className="text-xs font-medium text-accent-light mb-2 uppercase tracking-wider">✦ AI Insights</p>
            {analysis}
          </div>
        )}

        {!loading && !analysis && !project.riskReason && (
          <div className="text-center py-4 text-white/25 text-sm">
            Click "Run Analysis" for AI-powered risk insights
          </div>
        )}
      </div>
    </div>
  )
}
