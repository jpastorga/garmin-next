export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-2xl font-bold">MCP Garmin (vía Strava)</h1>
        <p>Connect your Strava account to start receiving your activities.</p>
        <a
          href="/api/strava/connect"
          className="inline-block rounded-xl px-4 py-2 border"
        >
          Connect with Strava
        </a>
      </div>
    </main>
  );
}