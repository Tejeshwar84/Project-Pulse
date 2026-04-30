"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

type RoleOption = "admin" | "manager" | "employee";

interface Company {
  id: string;
  name: string;
  description?: string | null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee" as RoleOption,
    companyId: "",
  });
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDesc, setNewCompanyDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data: Company[]) => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => setCompanies([]))
      .finally(() => setCompaniesLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (form.role === "admin") {
      if (!newCompanyName.trim()) {
        setError("Please enter a company name for your admin account.");
        return;
      }
    } else {
      if (!form.companyId) {
        setError("Please select the company you are joining.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        companyId: form.role !== "admin" ? form.companyId : undefined,
        companyName: form.role === "admin" ? newCompanyName.trim() : undefined,
        companyDescription:
          form.role === "admin" ? newCompanyDesc.trim() : undefined,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push(`/login?registered=1`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const roles: {
    value: RoleOption;
    label: string;
    desc: string;
    icon: string;
  }[] = [
    {
      value: "admin",
      label: "Admin",
      desc: "Full control & approvals",
      icon: "🛡️",
    },
    {
      value: "manager",
      label: "Manager",
      desc: "Manage team & tasks",
      icon: "👔",
    },
    {
      value: "employee",
      label: "Employee",
      desc: "Work on assigned tasks",
      icon: "👤",
    },
  ];

  const roleStyle: Record<RoleOption, { active: string }> = {
    admin: { active: "border-accent bg-accent/10 text-accent-light" },
    manager: { active: "border-amber bg-amber/10 text-amber" },
    employee: { active: "border-jade bg-jade/10 text-jade" },
  };

  return (
    <div className="glass rounded-2xl p-8 w-full max-w-md glow">
      <h1 className="font-display text-2xl font-bold text-white mb-1">
        Create your account
      </h1>
      <p className="text-sm text-white/50 mb-8">
        Start managing projects smarter.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            required
            placeholder="Jane Doe"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-surface-3 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full bg-surface-3 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            placeholder="Min. 6 characters"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            className="w-full bg-surface-3 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">
            I am joining as
          </label>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, role: r.value, companyId: "" }));
                  setNewCompanyName("");
                  setNewCompanyDesc("");
                }}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  form.role === r.value
                    ? roleStyle[r.value].active
                    : "border-white/8 hover:border-white/20 text-white/50"
                }`}
              >
                <div className="text-lg mb-1">{r.icon}</div>
                <p className="text-xs font-semibold">{r.label}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {(form.role === "manager" || form.role === "employee") && (
          <div>
            <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
              Select Company
            </label>
            {companiesLoading ? (
              <div className="w-full bg-surface-3 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white/30">
                Loading companies…
              </div>
            ) : companies.length === 0 ? (
              <div className="w-full bg-surface-3 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white/30">
                No companies registered yet. Ask an admin to create one first.
              </div>
            ) : (
              <select
                required
                aria-label="Select company"
                value={form.companyId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, companyId: e.target.value }))
                }
                className="w-full bg-surface-3 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors appearance-none cursor-pointer"
              >
                <option value="" disabled className="bg-surface-3">
                  Select your company…
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-surface-3">
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {form.role === "admin" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
                Create Company
              </label>
              <input
                type="text"
                required
                placeholder="Company name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="w-full bg-surface-3 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
                Company Description
              </label>
              <input
                type="text"
                placeholder="Optional description"
                value={newCompanyDesc}
                onChange={(e) => setNewCompanyDesc(e.target.value)}
                className="w-full bg-surface-3 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-rose text-sm bg-rose/10 border border-rose/20 rounded-lg px-4 py-2.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent hover:bg-accent-light disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm mt-2"
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="text-center text-sm text-white/40 mt-6">
        Already have an account?{" "}
        <a href="/login" className="text-accent-light hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
