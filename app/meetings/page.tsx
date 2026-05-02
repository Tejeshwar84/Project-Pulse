"use client";
import { useState, useEffect } from "react";

interface Meeting {
  id: string;
  title: string;
  description?: string;
  dateTime: string;
  isCompleted: boolean;
  completedAt?: string;
  notes?: string;
  actionItems?: string;
  createdBy: string;
  canEdit: boolean;
  creator: { name: string; id: string };
  participants: { user: { name: string; id: string } }[];
}

interface User {
  id: string;
  name: string;
}

type MeetingStatus = "upcoming" | "delayed" | "completed";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [activeTab, setActiveTab] = useState<MeetingStatus>("upcoming");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dateTime: "",
    participantIds: [] as string[],
  });
  const [editData, setEditData] = useState({
    participantIds: [] as string[],
    notes: "",
    actionItems: "",
  });

  useEffect(() => {
    fetchMeetings();
    fetchUsers();
  }, []);

  // Helper function to compute meeting status
  const getMeetingStatus = (meeting: Meeting): MeetingStatus => {
    if (meeting.isCompleted) return "completed";

    const now = new Date();
    const meetingTime = new Date(meeting.dateTime);

    if (meetingTime > now) return "upcoming";
    return "delayed";
  };

  // Helper function to format delayed time
  const getDelayedTime = (dateTime: string): string => {
    const now = new Date();
    const meetingTime = new Date(dateTime);
    const diffMs = now.getTime() - meetingTime.getTime();

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Filter meetings by status
  const filteredMeetings = meetings.filter((meeting) => {
    return getMeetingStatus(meeting) === activeTab;
  });

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

  const openEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setEditData({
      participantIds: meeting.participants.map((p) => p.user.id),
      notes: meeting.notes ?? "",
      actionItems: meeting.actionItems ?? "",
    });
  };

  const closeEditMeeting = () => {
    setEditingMeeting(null);
  };

  const handleUpdateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;

    try {
      const res = await fetch(`/api/meetings/${editingMeeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        closeEditMeeting();
        fetchMeetings();
      } else {
        const error = await res.json();
        alert(error?.error || "Failed to update meeting");
      }
    } catch (error) {
      console.error("Failed to update meeting:", error);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm("Delete this meeting?")) return;
    try {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchMeetings();
      } else {
        const error = await res.json();
        alert(error?.error || "Failed to delete meeting");
      }
    } catch (error) {
      console.error("Failed to delete meeting:", error);
    }
  };

  const handleCompleteMeeting = async (id: string) => {
    if (!confirm("Mark this meeting as completed?")) return;
    try {
      const res = await fetch(`/api/meetings/${id}/complete`, {
        method: "PATCH",
      });
      if (res.ok) {
        fetchMeetings();
      } else {
        const error = await res.json();
        alert(error?.error || "Failed to complete meeting");
      }
    } catch (error) {
      console.error("Failed to complete meeting:", error);
    }
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

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-2 p-1 rounded-lg">
        {[
          { key: "upcoming", label: "Upcoming", color: "text-blue-400" },
          { key: "delayed", label: "Delayed", color: "text-red-400" },
          { key: "completed", label: "Completed", color: "text-green-400" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as MeetingStatus)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? `${tab.color} bg-surface-1`
                : "text-white/60 hover:text-white/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
                  placeholder="Enter meeting title"
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
                  placeholder="Optional description"
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
                  title="Choose meeting date and time"
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

      {editingMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-1 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Edit Meeting</h2>
            <form onSubmit={handleUpdateMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Participants
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editData.participantIds.includes(user.id)}
                        onChange={() => {
                          const next = editData.participantIds.includes(user.id)
                            ? editData.participantIds.filter(
                                (id) => id !== user.id,
                              )
                            : [...editData.participantIds, user.id];
                          setEditData((prev) => ({
                            ...prev,
                            participantIds: next,
                          }));
                        }}
                        className="rounded"
                      />
                      <span className="text-white/80">{user.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Notes
                </label>
                <textarea
                  placeholder="Add meeting notes"
                  value={editData.notes}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Action Items
                </label>
                <textarea
                  placeholder="Add action items"
                  value={editData.actionItems}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      actionItems: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={closeEditMeeting}
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
        {filteredMeetings.length === 0 ? (
          <p className="text-white/60">
            No {activeTab} meetings found.
          </p>
        ) : (
          filteredMeetings.map((meeting) => {
            const status = getMeetingStatus(meeting);
            const statusConfig = {
              upcoming: { color: "text-blue-400 bg-blue-400/10", label: "Upcoming" },
              delayed: { color: "text-red-400 bg-red-400/10", label: "Delayed" },
              completed: { color: "text-green-400 bg-green-400/10", label: "Completed" },
            }[status];

            return (
              <div
                key={meeting.id}
                className="bg-surface-2 p-4 rounded-lg border border-white/10"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-white">
                    {meeting.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                    <span className="text-sm text-white/60">
                      {new Date(meeting.dateTime).toLocaleString()}
                    </span>
                  </div>
                </div>

                {meeting.description && (
                  <p className="text-white/80 mb-2">{meeting.description}</p>
                )}

                {meeting.notes && status !== "completed" && (
                  <p className="text-sm text-white/60 mb-2">
                    {meeting.notes.length > 120
                      ? `${meeting.notes.slice(0, 120).trim()}...`
                      : meeting.notes}
                  </p>
                )}

                <div className="text-sm text-white/60 mb-2">
                  Created by {meeting.creator.name}
                </div>

                {status === "delayed" && (
                  <div className="text-sm text-red-400 mb-2">
                    Delayed by {getDelayedTime(meeting.dateTime)}
                  </div>
                )}

                {status === "completed" && meeting.completedAt && (
                  <div className="text-sm text-green-400 mb-2">
                    Completed on {new Date(meeting.completedAt).toLocaleString()}
                  </div>
                )}

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

                <div className="flex gap-2 mb-2">
                  {meeting.canEdit && status !== "completed" && (
                    <>
                      <button
                        onClick={() => openEditMeeting(meeting)}
                        className="px-3 py-1 text-sm bg-surface-3 text-white rounded-lg hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleCompleteMeeting(meeting.id)}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Mark as Completed
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        className="px-3 py-1 text-sm text-rose bg-rose/10 rounded-lg hover:bg-rose/20"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {status === "completed" && meeting.canEdit && (
                    <button
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      className="px-3 py-1 text-sm text-rose bg-rose/10 rounded-lg hover:bg-rose/20"
                    >
                      Delete
                    </button>
                  )}
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
            );
          })
        )}
      </div>
    </div>
  );
}
