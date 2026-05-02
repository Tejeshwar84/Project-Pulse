'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Task = {
  id: string
  title: string
  status: string
  priority: string
  assigneeId: string | null
  assignee: { id: string; name: string } | null
  dueDate: string | null
}

type TeamMember = { id: string; name: string; role: string }

type Role = 'admin' | 'manager' | 'employee'

type DelayRiskData = {
  taskId: string
  riskScore: number
  reason: string
}

type PrioritizedTask = {
  taskId: string
  priorityScore: number
  reason: string
}

type WorkloadUser = {
  userId: string
  userName: string
  taskCount: number
  highPriorityCount: number
  status: 'overloaded' | 'balanced' | 'underutilized'
}

type WorkloadSuggestion = {
  taskId: string
  fromUserId: string
  toUserId: string
  reason: string
}

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'text-white/60', headerBg: 'bg-white/5' },
  { id: 'in-progress', label: 'In Progress', color: 'text-sky', headerBg: 'bg-sky/10' },
  { id: 'pending-review', label: 'Pending Review', color: 'text-amber', headerBg: 'bg-amber/10' },
  { id: 'blocked', label: 'Blocked', color: 'text-rose', headerBg: 'bg-rose/10' },
  { id: 'done', label: 'Done', color: 'text-jade', headerBg: 'bg-jade/10' },
]

const PRIORITY_COLOR: Record<string, string> = {
  high: 'border-l-rose',
  medium: 'border-l-amber',
  low: 'border-l-white/20',
}

// Allowed status transitions for employees
const EMPLOYEE_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'todo': ['in-progress'],
  'in-progress': ['todo', 'pending-review'],
  'pending-review': ['in-progress'], // can pull back from pending if rejected
  'blocked': [],
  'done': [],
}

interface Props {
  tasks: Task[]
  projectId: string
  role: Role
  userName: string
  userId: string
  teamMembers: TeamMember[]
}

export default function KanbanBoard({ tasks: initialTasks, projectId, role, userName, userId, teamMembers }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [newDueDate, setNewDueDate] = useState('')
  const [error, setError] = useState('')
  const [delayRiskData, setDelayRiskData] = useState<DelayRiskData[]>([])
  const [analyzingRisk, setAnalyzingRisk] = useState(false)
  const [prioritizationData, setPrioritizationData] = useState<PrioritizedTask[]>([])
  const [analyzingPriority, setAnalyzingPriority] = useState(false)
  const [sortByPriority, setSortByPriority] = useState(false)
  const [workloadData, setWorkloadData] = useState<{ users: WorkloadUser[]; suggestions: WorkloadSuggestion[] } | null>(null)
  const [optimizingWorkload, setOptimizingWorkload] = useState(false)
  const router = useRouter()
  const isAdmin = role === 'admin' || role === 'manager'

  // Employees only see tasks assigned to them
  const visibleTasks = isAdmin
    ? tasks
    : tasks.filter(t => t.assigneeId === userId)

  async function moveTask(taskId: string, newStatus: string) {
    setError('')
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Action not permitted.')
      setTasks(initialTasks)
    } else {
      router.refresh()
    }
  }

  async function addTask() {
    if (!newTitle.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        projectId,
        status: 'todo',
        priority: newPriority,
        assigneeId: newAssigneeId || null,
        dueDate: newDueDate || null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to create task.')
      return
    }
    const task = await res.json()
    setTasks(prev => [...prev, task])
    setNewTitle('')
    setNewAssigneeId('')
    setNewPriority('medium')
    setNewDueDate('')
    setAdding(false)
    router.refresh()
  }

  async function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function analyzeDelayRisk() {
    setAnalyzingRisk(true)
    setError('')

    try {
      const res = await fetch('/api/ai-delay-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to analyze delay risk')
      }

      const data = await res.json()
      setDelayRiskData(data.tasks || [])
    } catch (err) {
      console.error('Delay risk analysis failed:', err)
      setError('Failed to analyze delay risk. Using basic assessment.')
    } finally {
      setAnalyzingRisk(false)
    }
  }

  async function optimizeWorkload() {
    setOptimizingWorkload(true)
    setError('')

    try {
      const res = await fetch('/api/ai-workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to optimize workload')
      }

      const data = await res.json()
      setWorkloadData({
        users: data.users || [],
        suggestions: data.suggestions || [],
      })
    } catch (err) {
      console.error('Workload optimization failed:', err)
      setError('Failed to optimize workload. Try again.')
    } finally {
      setOptimizingWorkload(false)
    }
  }

  async function applySuggestion(suggestion: WorkloadSuggestion) {
    setError('')
    try {
      const res = await fetch(`/api/tasks/${suggestion.taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: suggestion.toUserId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to apply suggestion')
      }

      const updatedTask = await res.json()
      setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task))
      router.refresh()
    } catch (err) {
      console.error('Apply suggestion failed:', err)
      setError('Failed to apply suggestion. Check permissions.')
    }
  }

  function getTaskRisk(taskId: string): DelayRiskData | null {
    return delayRiskData.find(risk => risk.taskId === taskId) || null
  }

  function getRiskColor(riskScore: number): string {
    if (riskScore > 70) return 'text-red-400'
    if (riskScore >= 40) return 'text-yellow-400'
    return 'text-green-400'
  }

  function formatDeadline(dueDate: string | null): { text: string; isOverdue: boolean } {
    if (!dueDate) return { text: '', isOverdue: false }

    const due = new Date(dueDate)
    const now = new Date()
    const isOverdue = due < now

    const formatted = due.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    return { text: `Due: ${formatted}`, isOverdue }
  }

  function getAvailableMoves(task: Task, currentColId: string): typeof COLUMNS {
    if (isAdmin) {
      // Admins/managers can move to any column except the current one
      return COLUMNS.filter(c => c.id !== currentColId)
    }
    // Employees: restricted transitions for their own tasks only
    const allowed = EMPLOYEE_ALLOWED_TRANSITIONS[currentColId] ?? []
    return COLUMNS.filter(c => allowed.includes(c.id))
  }

  async function analyzePriority() {
    setAnalyzingPriority(true)
    setError('')

    try {
      const res = await fetch('/api/ai-prioritization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to analyze priority')
      }

      const data = await res.json()
      setPrioritizationData(data.prioritizedTasks || [])
    } catch (err) {
      console.error('Priority analysis failed:', err)
      setError('Failed to analyze priority. Try again.')
    } finally {
      setAnalyzingPriority(false)
    }
  }

  function getTaskPriority(taskId: string): PrioritizedTask | null {
    return prioritizationData.find(p => p.taskId === taskId) || null
  }

  function getPriorityColor(score: number): string {
    if (score > 70) return 'text-red-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-green-400'
  }

  function getPriorityBadge(score: number): string {
    if (score > 70) return '🔥 High'
    if (score >= 40) return '⚠️ Medium'
    return '🟢 Low'
  }

  function isTopPriority(taskId: string): boolean {
    const priority = getTaskPriority(taskId)
    if (!priority) return false
    const topThree = prioritizationData.slice(0, 3)
    return topThree.some(p => p.taskId === taskId)
  }

  // Get sorted tasks if priority sorting is enabled
  const sortedVisibleTasks = sortByPriority && prioritizationData.length > 0
    ? [...visibleTasks].sort((a, b) => {
        const aPriority = getTaskPriority(a.id)?.priorityScore ?? 0
        const bPriority = getTaskPriority(b.id)?.priorityScore ?? 0
        return bPriority - aPriority
      })
    : visibleTasks

  const topPriorityTasks = prioritizationData.slice(0, 5)

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-white">Tasks</h2>
          {!isAdmin && (
            <p className="text-[10px] text-white/30 mt-0.5">Showing your assigned tasks</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <button
                onClick={analyzeDelayRisk}
                disabled={analyzingRisk}
                className="text-xs text-accent-light hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzingRisk ? '⟳ Analyzing...' : '🔍 Analyze Risk'}
              </button>
              <button
                onClick={analyzePriority}
                disabled={analyzingPriority}
                className="text-xs text-amber hover:text-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzingPriority ? '⟳ Analyzing...' : '🔥 Analyze Priority'}
              </button>
              <button
                onClick={optimizeWorkload}
                disabled={optimizingWorkload}
                className="text-xs text-jade hover:text-jade-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {optimizingWorkload ? '⟳ Optimizing...' : '⚖️ Optimize Workload'}
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={() => setAdding(true)}
              className="text-xs text-accent-light hover:text-white transition-colors"
            >
              + Add task
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-6 py-2 bg-rose/10 border-b border-rose/20 text-rose text-xs flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {error}
        </div>
      )}

      {/* Priority Section */}
      {prioritizationData.length > 0 && (
        <div className="px-6 py-4 border-b border-white/5 space-y-3 bg-gradient-to-r from-amber/5 to-rose/5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber flex items-center gap-2">
              🔥 Priority Tasks
              <span className="text-[10px] text-white/40 font-normal">({topPriorityTasks.length})</span>
            </h3>
            {prioritizationData.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={sortByPriority}
                  onChange={e => setSortByPriority(e.target.checked)}
                  className="w-3 h-3 rounded cursor-pointer"
                />
                <span className="text-white/60 hover:text-white/80">Sort by priority</span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {topPriorityTasks.map((item, idx) => {
              const task = visibleTasks.find(t => t.id === item.taskId)
              if (!task) return null

              const taskRisk = getTaskRisk(task.id)
              const isFirst = idx === 0
              const hasBothHighs = taskRisk && taskRisk.riskScore > 70 && item.priorityScore > 70

              return (
                <div
                  key={task.id}
                  className={`rounded-lg p-3 border transition-all ${
                    isFirst
                      ? 'border-amber bg-amber/10 ring-1 ring-amber/50'
                      : 'border-white/10 bg-surface-3 hover:border-white/20'
                  } ${hasBothHighs ? 'ring-1 ring-red-400/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className={`text-[11px] font-medium flex-1 leading-snug ${isFirst ? 'text-amber' : 'text-white/80'}`}>
                      {task.title}
                    </p>
                    {isFirst && <span className="text-xs">⭐</span>}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-semibold ${getPriorityColor(item.priorityScore)}`}>
                      {getPriorityBadge(item.priorityScore)} • {item.priorityScore}
                    </span>
                  </div>

                  <p className="text-[9px] text-white/40 mt-1.5 leading-tight">
                    {item.reason}
                  </p>

                  {hasBothHighs && (
                    <div className="mt-2 text-[8px] text-red-400 font-medium bg-red-400/10 px-2 py-1 rounded">
                      ⚠️ High priority + High risk
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {workloadData && (
        <div className="px-6 py-4 border-b border-white/5 space-y-4 bg-surface-2/50 animate-in fade-in">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-jade flex items-center gap-2">⚖️ Workload Optimization</h3>
              <p className="text-[10px] text-white/40">Team capacity and suggested task reassignments.</p>
            </div>
            <span className="text-[10px] text-white/50">{workloadData.users.length} team members</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">Team status</h4>
              <div className="space-y-2">
                {workloadData.users.map(user => (
                  <div key={user.userId} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-surface-3 p-3">
                    <div>
                      <p className="text-[11px] font-semibold text-white">{user.userName}</p>
                      <p className="text-[9px] text-white/40">Tasks: {user.taskCount} • High: {user.highPriorityCount}</p>
                    </div>
                    <span className={`text-[10px] font-semibold ${user.status === 'overloaded' ? 'text-red-400' : user.status === 'underutilized' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {user.status === 'overloaded' ? '🔴 overloaded' : user.status === 'underutilized' ? '🟢 underutilized' : '🟡 balanced'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">Suggestions</h4>
              <div className="space-y-2">
                {workloadData.suggestions.length > 0 ? workloadData.suggestions.map(suggestion => {
                  const task = tasks.find(t => t.id === suggestion.taskId)
                  const fromUser = workloadData.users.find(user => user.userId === suggestion.fromUserId)
                  const toUser = workloadData.users.find(user => user.userId === suggestion.toUserId)
                  return (
                    <div key={`${suggestion.taskId}-${suggestion.toUserId}`} className="rounded-lg border border-white/10 bg-surface-3 p-3">
                      <p className="text-[11px] font-semibold text-white">Task: {task?.title || suggestion.taskId}</p>
                      <p className="text-[9px] text-white/40">From: {fromUser?.userName || suggestion.fromUserId}</p>
                      <p className="text-[9px] text-white/40">To: {toUser?.userName || suggestion.toUserId}</p>
                      <p className="text-[9px] text-white/40 mt-1">Reason: {suggestion.reason}</p>
                      {isAdmin && (
                        <button
                          onClick={() => applySuggestion(suggestion)}
                          className="mt-2 inline-flex items-center rounded-full bg-white/5 px-3 py-1.5 text-[9px] font-semibold text-white/80 hover:bg-white/10 transition-colors"
                        >
                          Apply Suggestion
                        </button>
                      )}
                    </div>
                  )
                }) : (
                  <p className="text-[10px] text-white/40">No reassignment suggestions available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add task form — managers/admins only */}
      {adding && isAdmin && (
        <div className="px-6 py-4 border-b border-white/5 space-y-3 bg-surface-2/50">
          <div className="flex gap-2">
            <input
              autoFocus value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Task title..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Assign to employee */}
            {teamMembers.length > 0 && (
              <select
                value={newAssigneeId}
                onChange={e => setNewAssigneeId(e.target.value)}
                title="Assign task to team member"
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent/50 cursor-pointer flex-1"
              >
                <option value="">Assign to… (optional)</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}

            {/* Priority selector */}
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value as 'low' | 'medium' | 'high')}
              title="Set task priority"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent/50 cursor-pointer"
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>

            {/* Deadline selector */}
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-[10px] text-white/60">Deadline (optional)</label>
              <input
                type="datetime-local"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                title="Set task deadline"
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent/50"
              />
            </div>

            <button onClick={addTask} className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent/80 transition-colors">Add</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-white/40 text-xs hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 divide-x divide-white/5 overflow-x-auto">
        {COLUMNS.map(col => {
          const colTasks = sortByPriority && prioritizationData.length > 0
            ? sortedVisibleTasks.filter(t => t.status === col.id)
            : visibleTasks.filter(t => t.status === col.id)
          return (
            <div key={col.id} className="p-3 min-w-[160px]">
              <div className={`flex items-center justify-between mb-3 px-2 py-1.5 rounded-lg ${col.headerBg}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                <span className="text-[10px] text-white/30 bg-white/5 rounded-full px-1.5 py-0.5">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map(task => {
                  const moves = getAvailableMoves(task, col.id)
                  const isMyTask = task.assigneeId === userId
                  const isPendingReview = col.id === 'pending-review'
                  const assigneeName = task.assignee?.name ?? null
                  const taskRisk = getTaskRisk(task.id)
                  const deadlineInfo = formatDeadline(task.dueDate)
                  const taskPriority = getTaskPriority(task.id)
                  const isTopPrio = isTopPriority(task.id)
                  const hasBothHighs = taskRisk && taskRisk.riskScore > 70 && taskPriority && taskPriority.priorityScore > 70

                  return (
                    <div key={task.id} className={`bg-surface-3 rounded-lg p-3 border-l-2 ${PRIORITY_COLOR[task.priority]} group transition-all ${
                      isTopPrio ? 'ring-1 ring-amber/50 shadow-lg shadow-amber/20' : ''
                    } ${hasBothHighs ? 'ring-1 ring-red-400/50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-white/80 group-hover:text-white mb-2 leading-snug flex-1">{task.title}</p>
                        {isTopPrio && <span className="text-xs flex-shrink-0">⭐</span>}
                      </div>

                      {assigneeName && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${isMyTask ? 'bg-jade/30 text-jade' : 'bg-accent/30 text-accent-light'}`}>
                            {assigneeName.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <span className="text-[10px] text-white/30">{assigneeName}</span>
                        </div>
                      )}

                      {deadlineInfo.text && (
                        <div className={`text-[9px] mb-2 ${deadlineInfo.isOverdue ? 'text-red-400 font-medium' : 'text-white/40'}`}>
                          {deadlineInfo.text}
                        </div>
                      )}

                      {/* Priority Badge */}
                      {taskPriority && (
                        <div className="mb-2">
                          <div className={`text-[9px] font-medium ${getPriorityColor(taskPriority.priorityScore)}`}>
                            {getPriorityBadge(taskPriority.priorityScore)} • {taskPriority.priorityScore}
                          </div>
                        </div>
                      )}

                      {/* Delay Risk Display */}
                      {taskRisk && (
                        <div className="mb-2">
                          <div className={`text-[9px] font-medium ${getRiskColor(taskRisk.riskScore)}`}>
                            Risk: {taskRisk.riskScore}%
                          </div>
                          <div className="text-[8px] text-white/40 leading-tight mt-0.5">
                            {taskRisk.reason}
                          </div>
                        </div>
                      )}

                      {hasBothHighs && (
                        <div className="mb-2 text-[8px] text-red-400 font-medium bg-red-400/10 px-2 py-1 rounded">
                          ⚠️ Critical
                        </div>
                      )}

                      {/* Move buttons */}
                      <div className="flex gap-1 flex-wrap">
                        {/* Admin: Approve/Reject for pending-review */}
                        {isAdmin && isPendingReview && (
                          <>
                            <button
                              onClick={() => moveTask(task.id, 'done')}
                              className="text-[9px] font-medium text-jade hover:text-white bg-jade/15 hover:bg-jade/30 border border-jade/20 rounded px-1.5 py-0.5 transition-colors"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => moveTask(task.id, 'in-progress')}
                              className="text-[9px] font-medium text-rose hover:text-white bg-rose/15 hover:bg-rose/30 border border-rose/20 rounded px-1.5 py-0.5 transition-colors"
                            >
                              ✗ Reject
                            </button>
                          </>
                        )}

                        {/* Other move buttons */}
                        {!(isAdmin && isPendingReview) && moves.map(c => (
                          <button
                            key={c.id}
                            onClick={() => moveTask(task.id, c.id)}
                            className={`text-[9px] transition-colors border rounded px-1 py-0.5 ${c.id === 'pending-review'
                              ? 'text-amber/70 hover:text-amber border-amber/20 hover:border-amber/40 bg-amber/5'
                              : 'text-white/25 hover:text-white/60 border-white/5 hover:border-white/20'
                              }`}
                          >
                            {c.id === 'pending-review' ? '⬆ Submit for Review' : `→ ${c.label}`}
                          </button>
                        ))}

                        {/* Admin: delete button */}
                        {isAdmin && (
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-[9px] text-white/15 hover:text-rose transition-colors ml-auto"
                            title="Delete task"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {colTasks.length === 0 && (
                  <div className="h-12 border border-dashed border-white/5 rounded-lg flex items-center justify-center">
                    <span className="text-[10px] text-white/15">empty</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
