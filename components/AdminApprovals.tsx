"use client";

import { useState, useEffect } from "react";

interface PendingUser {
  id: string;
  name: string;
  email: string;
  requestedRole: string;
  createdAt: string;
}

export default function AdminApprovals() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const res = await fetch("/api/users/approvals");
      if (res.ok) {
        const users = await res.json();
        setPendingUsers(users);
      }
    } catch (err) {
      console.error("Failed to fetch pending users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (
    userId: string,
    action: "approve" | "reject",
  ) => {
    try {
      const res = await fetch("/api/users/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });

      const data = await res.json();
      if (data.success) {
        // Remove the user from the pending list
        setPendingUsers((users) => users.filter((u) => u.id !== userId));
      } else {
        alert("Error: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Approval error:", err);
      alert("Failed to process approval");
    }
  };

  if (loading) {
    return (
      <div className="mb-6 bg-amber/10 border border-amber/20 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-amber">
            Pending Approvals
          </h3>
          <span className="text-xs text-amber/60">Loading...</span>
        </div>
      </div>
    );
  }

  if (pendingUsers.length === 0) return null;

  return (
    <div className="mb-6 bg-amber/10 border border-amber/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-amber">
          Pending Approvals
        </h3>
        <span className="text-xs text-amber/60">
          {pendingUsers.length} user{pendingUsers.length > 1 ? "s" : ""}{" "}
          awaiting approval
        </span>
      </div>
      <div className="space-y-3">
        {pendingUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
          >
            <div>
              <p className="font-medium text-white text-sm">{user.name}</p>
              <p className="text-white/60 text-xs">
                {user.email} • Requested {user.requestedRole}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 text-xs bg-jade/20 text-jade border border-jade/30 rounded hover:bg-jade/30 transition-colors"
                onClick={() => handleApproval(user.id, "approve")}
              >
                Approve
              </button>
              <button
                className="px-3 py-1 text-xs bg-rose/20 text-rose border border-rose/30 rounded hover:bg-rose/30 transition-colors"
                onClick={() => handleApproval(user.id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
