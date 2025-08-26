import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const athleteId = url.searchParams.get("athleteId");

  if (!athleteId) {
    return NextResponse.json({ authenticated: false, error: "missing athleteId" }, { status: 400 });
  }

  try {
    //Check if the user exists
    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("athlete_id", athleteId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ authenticated: false });
    }

    //Check if there is a valid token
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("strava_tokens")
      .select("expires_at")
      .eq("user_id", userRow.id)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json({ authenticated: false });
    }

    //Check if the token has not expired (with 1 minute margin)
    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);
    const isValid = expiresAt.getTime() - now.getTime() > 60000; // 1 minute margin

    return NextResponse.json({
      authenticated: isValid,
      athleteId,
      expires_at: tokenRow.expires_at,
    });
  } catch (error) {
    console.error("Error checking auth status:", error);
    return NextResponse.json({ authenticated: false, error: "internal error" }, { status: 500 });
  }
}
