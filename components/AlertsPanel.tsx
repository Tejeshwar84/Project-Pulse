"use client";
import { useState, useEffect } from "react";

interface Alert {
  upcomingMeetings: {
    id: string;
    title: string;
    dateTime: string;
  }[];
  upcomingTasks: {
    id: string;
    title: string;
    dueDate: string;
    project: { name: string };
  }[];
  overdueTasks: {
    id: string;
    title: string;
    dueDate: string;
    project: { name: string };
  }[];
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  if (
    !alerts ||
    (alerts.upcomingMeetings.length === 0 &&
      alerts.upcomingTasks.length === 0 &&
      alerts.overdueTasks.length === 0)
  ) {
    return null;
  }

  return (
    <div className="mb-6 bg-amber/10 border border-amber/20 rounded-xl px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-amber text-lg mt-0.5">🔔</span>
        <div className="flex-1">
          <p className="text-amber font-medium text-sm font-display mb-2">
            Alerts
          </p>
          <div className="space-y-2">
            {alerts.upcomingMeetings.length > 0 && (
              <div>
                <p className="text-white/80 text-xs font-medium">
                  Upcoming Meetings:
                </p>
                <ul className="text-xs text-white/60 mt-1 space-y-1">
                  {alerts.upcomingMeetings.slice(0, 3).map((meeting) => (
                    <li key={meeting.id}>
                      {meeting.title} -{" "}
                      {new Date(meeting.dateTime).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alerts.upcomingTasks.length > 0 && (
              <div>
                <p className="text-white/80 text-xs font-medium">
                  Upcoming Deadlines:
                </p>
                <ul className="text-xs text-white/60 mt-1 space-y-1">
                  {alerts.upcomingTasks.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      {task.title} ({task.project.name}) -{" "}
                      {new Date(task.dueDate).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alerts.overdueTasks.length > 0 && (
              <div>
                <p className="text-rose text-xs font-medium">Overdue Tasks:</p>
                <ul className="text-xs text-rose/80 mt-1 space-y-1">
                  {alerts.overdueTasks.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      {task.title} ({task.project.name}) - Due{" "}
                      {new Date(task.dueDate).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
