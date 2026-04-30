"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Team {
  id: string;
  name: string;
  description: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  budget: number;
  spent: number;
  teamId: string | null;
  currency: string;
}

interface ProjectTeamSelectorProps {
  projectId: string;
  currentTeamId: string | null;
  onSuccess?: () => void;
}

export default function ProjectTeamSelector({
  projectId,
  currentTeamId,
  onSuccess,
}: ProjectTeamSelectorProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    currentTeamId,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    }
  };

  const handleAssignTeam = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          teamId: selectedTeamId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update project");
        return;
      }

      setSuccess("Team assigned successfully!");
      setTimeout(() => {
        onSuccess?.();
        router.refresh();
      }, 1500);
    } catch (err) {
      setError("An error occurred while updating the project");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <h3 className="font-display font-semibold text-white mb-4">
        Assign Team to Project
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-rose/20 text-rose text-sm rounded-lg border border-rose/30">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-jade/20 text-jade text-sm rounded-lg border border-jade/30">
          {success}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-white/70 mb-2">
          Select Team
        </label>
        <select
          value={selectedTeamId || ""}
          onChange={(e) => setSelectedTeamId(e.target.value || null)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-accent/50"
        >
          <option value="">No Team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-white/40 mt-1">
          {selectedTeamId
            ? "Change the assigned team"
            : "Select a team to assign to this project"}
        </p>
      </div>

      <button
        onClick={handleAssignTeam}
        disabled={loading || selectedTeamId === currentTeamId}
        className="w-full px-4 py-2 bg-accent hover:bg-accent/80 disabled:bg-white/10 disabled:text-white/40 text-white font-medium rounded-lg transition-colors"
      >
        {loading ? "Updating..." : "Assign Team"}
      </button>
    </div>
  );
}
