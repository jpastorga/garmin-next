import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchActivity } from "@/lib/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verification of Strava subscription
 * Strava makes a GET request with ?hub.challenge=XYZ and we need to return {"hub.challenge":"XYZ"}
 */
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (challenge) return NextResponse.json({ "hub.challenge": challenge });
  return NextResponse.json({ ok: true });
}

/**
 * Webhook events:
 * Strava sends { object_type, aspect_type, owner_id, object_id, ... }
 * - object_type: "activity"
 * - aspect_type: "create" | "update" | "delete"
 *
 * Important: always respond 200 (in <2s). Log and continue on errors.
 */
export async function POST(req: NextRequest) {
  const event = await req.json();

  try {
    if (event.object_type !== "activity") {
      return NextResponse.json({ ok: true, ignored: "not an activity" });
    }

    //validate that the event is from your subscription:
    // if (process.env.STRAVA_SUBSCRIPTION_ID && String(event.subscription_id) !== process.env.STRAVA_SUBSCRIPTION_ID) {
    //   return NextResponse.json({ ok: true, ignored: "wrong subscription" });
    // }

    const athleteId = String(event.owner_id);
    const activityId = String(event.object_id);

    if (event.aspect_type === "create" || event.aspect_type === "update") {

      const { data: userRow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("athlete_id", athleteId)
        .single();

      if (uerr || !userRow) {
        console.warn("webhook: user not found for athlete_id", athleteId);
        return NextResponse.json({ ok: true, skipped: "no user" });
      }

      //read activity from Strava (your helper must handle refresh token)
      const act = await fetchActivity(athleteId, activityId);

      const row = {
        id: act.id as number,
        user_id: userRow.id as string,
        name: (act.name ?? null) as string | null,
        start_date: act.start_date ? new Date(act.start_date).toISOString() : null,
        distance_m: (act.distance ?? null) as number | null,
        moving_time_s: (act.moving_time ?? null) as number | null,
        type: (act.type ?? null) as string | null,
        raw: act as unknown as Record<string, unknown>,
      };

      const { error: aerr } = await supabaseAdmin
        .from("activities")
        .upsert(row, { onConflict: "id" });

      if (aerr) {
        console.error("upsert activities error:", aerr.message);
        return NextResponse.json({ ok: true, upsert_error: aerr.message });
      }

      return NextResponse.json({ ok: true, upserted: act.id });
    }

    return NextResponse.json({ ok: true, ignored: `aspect_type=${event.aspect_type}` });
  } catch (e: unknown) {
    console.error("webhook POST error:", (e as Error)?.message || e);
    return NextResponse.json({ ok: true, error: String(e) });
  }
}

/**
 * HEAD: healthcheck of webhook and DB.
 * - X-DB: ok|fail
 * - X-Activities-Count: number of activities (if DB ok)
 */
export async function HEAD() {
  try {
    const { count, error } = await supabaseAdmin
      .from("activities")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    return new Response(null, {
      status: 200,
      headers: {
        "X-DB": "ok",
        "X-Activities-Count": String(count ?? 0),
      },
    });
  } catch {
    return new Response(null, {
      status: 200,
      headers: { "X-DB": "fail" },
    });
  }
}
