"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type AlertType = "deadline" | "meeting" | "ai";
type AlertSeverity = "high" | "medium" | "low";

interface SmartAlert {
  type: AlertType;
  message: string;
  severity: AlertSeverity;
}

export default function AlertsPanel() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    const handleFocus = () => fetchAlerts();
    window.addEventListener("focus", handleFocus);

    const interval = window.setInterval(fetchAlerts, 60000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
    };
  }, [fetchAlerts]);

  if (loading) return null;
  if (!alerts || alerts.length === 0) return null;

  const severityClasses: Record<AlertSeverity, string> = {
    high: "bg-rose/10 text-rose",
    medium: "bg-amber/10 text-amber",
    low: "bg-emerald/10 text-emerald",
  };

  const sortedAlerts = [...alerts].sort((a, b) => {
    const order: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const topAlerts = sortedAlerts.slice(0, 5);
  const moreCount = alerts.length - topAlerts.length;

  const handleAlertClick = (alert: SmartAlert) => {
    if (alert.type === "deadline") {
      router.push("/projects");
    } else if (alert.type === "meeting") {
      router.push("/meetings");
    }
  };

  return (
    <div className="mb-6 bg-surface-3 border border-white/10 rounded-xl px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-white text-lg mt-0.5">🔔</span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-white font-semibold text-sm font-display">
                Alerts
              </p>
              <p className="text-[11px] text-white/40">
                Top alerts for your tasks and meetings.
              </p>
            </div>
            <span className="text-[10px] text-white/50">
              {alerts.length} total
            </span>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {topAlerts.map((alert, index) => {
              const clickable =
                alert.type === "deadline" || alert.type === "meeting";
              return (
                <button
                  key={`${alert.type}-${index}`}
                  type="button"
                  onClick={() => clickable && handleAlertClick(alert)}
                  className={`w-full text-left rounded-2xl border border-white/10 bg-white/5 p-3 ${clickable ? "cursor-pointer hover:bg-white/10" : "cursor-default"}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${severityClasses[alert.severity]}`}
                    >
                      {alert.type === "deadline"
                        ? "Deadline"
                        : alert.type === "meeting"
                          ? "Meeting"
                          : "AI"}
                    </span>
                    <span className="text-[10px] text-white/40 capitalize">
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 leading-snug">
                    {alert.message}
                  </p>
                </button>
              );
            })}
            {moreCount > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/50">
                Showing 5 of {alerts.length} alerts
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
