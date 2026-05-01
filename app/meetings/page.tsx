"use client";
import { useState, useEffect } from "react";

interface Meeting {
  id: string;
  title: string;
  description?: string;
  dateTime: string;
  notes?: string;
  actionItems?: string;
  creator: { name: string };
  participants: { user: { name: string; id: string } }[];
}

interface User {
  id: string;
  name: string;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dateTime: "",
    participantIds: [] as string[],
  });

  useEffect(() => {
    fetchMeetings();
    fetchUsers();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await fetch("/api/meetings");
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // For simplicity, we'll fetch from teams API or assume we have users
      // In a real app, you'd have a users API
      const res = await fetch("/api/teams");
      if (res.ok) {
        const teams = await res.json();
        const allUsers = teams.flatMap((team: any) =>
          team.members.map((m: any) => m.user),
        );
        const uniqueUsers = allUsers.filter(
          (user: User, index: number, self: User[]) =>
            index === self.findIndex((u) => u.id === user.id),
        );
        setUsers(uniqueUsers);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({
          title: "",
          description: "",
          dateTime: "",
          participantIds: [],
        });
        setShowCreateForm(false);
        fetchMeetings();
      } else {
        alert("Failed to create meeting");
      }
    } catch (error) {
      console.error("Failed to create meeting:", error);
    }
  };

  const toggleParticipant = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(userId)
        ? prev.participantIds.filter((id) => id !== userId)
        : [...prev.participantIds, userId],
    }));
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Meetings</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80"
        >
          Create Meeting
        </button>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-1 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">
              Create Meeting
            </h2>
            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.dateTime}
                  onChange={(e) =>
                    setFormData({ ...formData, dateTime: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Participants
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.participantIds.includes(user.id)}
                        onChange={() => toggleParticipant(user.id)}
                        className="rounded"
                      />
                      <span className="text-white/80">{user.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-surface-2 text-white rounded-lg hover:bg-surface-3"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {meetings.length === 0 ? (
          <p className="text-white/60">No meetings found.</p>
        ) : (
          meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="bg-surface-2 p-4 rounded-lg border border-white/10"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-white">
                  {meeting.title}
                </h3>
                <span className="text-sm text-white/60">
                  {new Date(meeting.dateTime).toLocaleString()}
                </span>
              </div>
              {meeting.description && (
                <p className="text-white/80 mb-2">{meeting.description}</p>
              )}
              <div className="text-sm text-white/60 mb-2">
                Created by {meeting.creator.name}
              </div>
              <div className="mb-2">
                <span className="text-sm font-medium text-white/80">
                  Participants:
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {meeting.participants.map((p) => (
                    <span
                      key={p.user.id}
                      className="px-2 py-1 bg-accent/20 text-accent-light rounded text-xs"
                    >
                      {p.user.name}
                    </span>
                  ))}
                </div>
              </div>
              {meeting.notes && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-white/80">
                    Notes:
                  </span>
                  <p className="text-white/60 mt-1">{meeting.notes}</p>
                </div>
              )}
              {meeting.actionItems && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-white/80">
                    Action Items:
                  </span>
                  <p className="text-white/60 mt-1">{meeting.actionItems}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
