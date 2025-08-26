"use client";

import { useEffect, useState } from "react";
import ActivitiesList from "@/components/ActivitiesList";

interface AuthStatus {
  authenticated: boolean;
  athleteId?: string;
  expires_at?: string;
  error?: string;
}

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuthStatus() {
      try {
        //Search athleteId in URL (from callback) or in localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const athleteIdFromUrl = urlParams.get("athleteId");
        const athleteIdFromStorage = localStorage.getItem("strava_athlete_id");

        const athleteId = athleteIdFromUrl || athleteIdFromStorage;

        if (!athleteId) {
          setAuthStatus({ authenticated: false });
          setLoading(false);
          return;
        }

        //If comes from URL, save it in localStorage and clear URL
        if (athleteIdFromUrl) {
          localStorage.setItem("strava_athlete_id", athleteIdFromUrl);
          window.history.replaceState({}, "", "/");
        }

        //Check authentication status
        const response = await fetch(`/api/strava/auth-status?athleteId=${athleteId}`);
        const status: AuthStatus = await response.json();

        if (!status.authenticated) {
          localStorage.removeItem("strava_athlete_id");
        }

        setAuthStatus(status);
      } catch (error) {
        console.error("Error checking auth status:", error);
        setAuthStatus({ authenticated: false, error: "Error checking authentication" });
      } finally {
        setLoading(false);
      }
    }

    checkAuthStatus();
  }, []);

  const handleDisconnect = () => {
    localStorage.removeItem("strava_athlete_id");
    setAuthStatus({ authenticated: false });
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking authentication...</p>
        </div>
      </main>
    );
  }

  if (!authStatus?.authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold">My Garmin (via Strava)</h1>
          <p className="text-gray-600">
            Connect your Strava account to start viewing your activities.
          </p>
          {authStatus?.error && <p className="text-red-600 text-sm">{authStatus.error}</p>}
          <a
            href="/api/strava/connect"
            className="inline-block rounded-xl px-6 py-3 bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
          >
            Connect with Strava
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Garmin (via Strava)</h1>
            <p className="text-gray-600 mt-1">Connected as athlete {authStatus.athleteId}</p>
          </div>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 text-red-600 hover:text-red-700 border border-red-300 hover:border-red-400 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>

        <ActivitiesList athleteId={authStatus.athleteId!} />
      </div>
    </main>
  );
}
