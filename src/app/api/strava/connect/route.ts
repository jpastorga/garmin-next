import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.STRAVA_REDIRECT_URI!,
    scope: "read,activity:read_all",
  });
  return NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params}`);
}
