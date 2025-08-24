import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserIdByAthleteId, fetchActivitiesPage } from "@/lib/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export async function POST(req: NextRequest) {
  const { athleteId, limitTotal, perPage, since, until } = await req.json();
  if (!athleteId) return NextResponse.json({ error: "missing athleteId" }, { status: 400 });

  const pageSize = clamp(perPage ?? 100, 1, 200);
  const maxTotal = limitTotal ? Math.max(1, Number(limitTotal)) : Infinity;

  // Strava usa epoch seconds para filtros
  const sinceEpoch = since ? Math.floor(new Date(since).getTime() / 1000) : undefined;
  const untilEpoch = until ? Math.floor(new Date(until).getTime() / 1000) : undefined;

  try {
    const userId = await getUserIdByAthleteId(String(athleteId));

    let page = 1;
    let total = 0;
    let imported = 0;

    while (total < maxTotal) {
      const batch = await fetchActivitiesPage(String(athleteId), { page, perPage: pageSize, sinceEpoch, untilEpoch });
      if (!batch.length) break;

      type StravaActivity = {
        id: number;
        name?: string;
        start_date?: string;
        distance?: number;
        moving_time?: number;
        type?: string;
        [key: string]: unknown;
      };

      const rows = batch.slice(0, maxTotal - total).map((act: StravaActivity) => ({
        id: act.id as number,
        user_id: userId as string,
        name: act.name ?? null,
        start_date: act.start_date ? new Date(act.start_date).toISOString() : null,
        distance_m: act.distance ?? null,
        moving_time_s: act.moving_time ?? null,
        type: act.type ?? null,
        raw: act as Record<string, unknown>,
      }));

      const { error } = await supabaseAdmin.from("activities").upsert(rows, { onConflict: "id" });
      if (error) throw error;

      total += batch.length;
      imported += rows.length;
      page += 1;

      // pequeña pausa por rate limits
      await sleep(250);
    }

    return NextResponse.json({ ok: true, imported, pages: page - 1 });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || String(e) }, { status: 500 });
  }
}
