"use client";

import { useEffect, useState } from "react";
import ActivityEmoji from "./ActivityEmoji";

interface Activity {
  id: number;
  name: string | null;
  start_date: string | null;
  distance_km: number | null;
  pace_min_km: string | null;
  type: string | null;
  sport_type?: string | null;
  moving_time_s: number | null;
}

interface ActivitiesResponse {
  data: Activity[];
  meta: {
    athleteId: string;
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

interface ActivitiesListProps {
  athleteId: string;
}

export default function ActivitiesList({ athleteId }: ActivitiesListProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivities() {
      try {
        setLoading(true);
        const res = await fetch(`/api/strava/activities?athleteId=${athleteId}&limit=10`);
        if (!res.ok) throw new Error("Error loading activities");
        const json: ActivitiesResponse = await res.json();
        setActivities(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    if (athleteId) fetchActivities();
  }, [athleteId]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Date not available";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds && seconds !== 0) return "N/A";
    const s = seconds ?? 0;
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return hours > 0 ? `${hours}h ${minutes}m ${secs}s` : `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-2 text-gray-600">Loading activities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No activities found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">Latest Activities</h2>
      <div className="space-y-3">
        {activities.map((activity) => {
          const typeLabel = (activity.sport_type || activity.type || "Unknown type").toString();
          return (
            <div
              key={activity.id}
              className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ActivityEmoji activity={activity} size="1.2em" />
                    <h3 className="font-medium text-gray-900">
                      {activity.name || "Activity without name"}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{formatDate(activity.start_date)}</p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded">{typeLabel}</span>
                    {activity.distance_km != null && (
                      <span>{activity.distance_km.toFixed(2)} km</span>
                    )}
                    {activity.pace_min_km && <span>Pace: {activity.pace_min_km}</span>}
                    <span>Duration: {formatDuration(activity.moving_time_s)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
