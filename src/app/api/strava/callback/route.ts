import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return new Response(JSON.stringify({ error: "missing code" }), { status: 400 });

  const body = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    client_secret: process.env.STRAVA_CLIENT_SECRET!,
    code,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://www.strava.com/oauth/token", { method: "POST", body });
  const data = await tokenRes.json();

  const athleteId = String(data?.athlete?.id);
  const expiresAt = new Date(data.expires_at * 1000); // epoch -> timestamptz

  const { data: userRow, error: uerr } = await supabaseAdmin
    .from("users")
    .upsert({ athlete_id: athleteId }, { onConflict: "athlete_id" })
    .select("id")
    .single();
  if (uerr) throw uerr;

  const { error: terr } = await supabaseAdmin.from("strava_tokens").upsert(
    {
      user_id: userRow.id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date(),
    },
    { onConflict: "user_id" }
  );

  if (terr) throw terr;

  const base = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
  return Response.redirect(new URL(`/?athleteId=${athleteId}`, base), 302);
}
