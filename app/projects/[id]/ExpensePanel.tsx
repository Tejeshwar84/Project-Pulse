"use client";

import { useState, useEffect } from "react";

interface Expense {
  id: string;
  amount: number;
  description: string;
  creator: { name: string; id: string };
  createdAt: string;
}

export default function ExpensePanel({
  projectId,
  projectBudget,
  projectSpent,
  onExpenseAdded,
}: {
  projectId: string;
  projectBudget: number;
  projectSpent: number;
  onExpenseAdded?: () => void;
}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchExpenses();
  }, [projectId]);

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/expenses`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.amount || !formData.description) {
      setError("Amount and description are required");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Amount must be a positive number");
      return;
    }

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description: formData.description,
          projectId,
        }),
      });

      if (res.ok) {
        setFormData({ amount: "", description: "" });
        setShowAddForm(false);
        fetchExpenses();
        onExpenseAdded?.();
      } else {
        const data = await res.json();
        setError(data?.error || "Failed to add expense");
      }
    } catch (err) {
      console.error("Failed to add expense:", err);
      setError("An error occurred");
    }
  };

  const remaining = projectBudget - projectSpent;
  const budgetPercent = projectBudget > 0 ? (projectSpent / projectBudget) * 100 : 0;

  if (loading) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-display font-semibold text-white">Expenses</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs text-accent-light hover:text-white transition-colors"
        >
          {showAddForm ? "Cancel" : "Add Expense →"}
        </button>
      </div>

      {/* Budget summary */}
      <div className="px-6 py-4 border-b border-white/5 bg-white/2">
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/60">Spent</span>
            <span
              className={`font-medium ${
                budgetPercent > 80
                  ? "text-rose"
                  : budgetPercent > 50
                    ? "text-amber"
                    : "text-white"
              }`}
            >
              ${projectSpent.toLocaleString()}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                budgetPercent > 80
                  ? "bg-rose"
                  : budgetPercent > 50
                    ? "bg-amber"
                    : "bg-jade"
              }`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40">
            <span>{Math.round(budgetPercent)}% used</span>
            <span>Remaining: ${Math.max(remaining, 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Add expense form */}
      {showAddForm && (
        <div className="px-6 py-4 border-b border-white/5 bg-surface-2/50">
          <form onSubmit={handleAddExpense} className="space-y-3">
            {error && (
              <div className="text-xs text-rose bg-rose/10 px-3 py-2 rounded-lg border border-rose/20">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="Amount"
                step="0.01"
                min="0"
                className="w-24 px-3 py-2 bg-surface-1 border border-white/10 rounded-lg text-white text-sm"
              />
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Description"
                className="flex-1 px-3 py-2 bg-surface-1 border border-white/10 rounded-lg text-white text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/80 transition-all"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses list */}
      <div className="divide-y divide-white/5">
        {expenses.length === 0 ? (
          <div className="px-6 py-4 text-xs text-white/40">
            No expenses recorded yet.
          </div>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="px-6 py-3 hover:bg-white/2 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">
                    {expense.description}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    by {expense.creator.name} •{" "}
                    {new Date(expense.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm font-medium text-white whitespace-nowrap">
                  ${expense.amount.toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
