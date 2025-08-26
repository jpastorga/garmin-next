import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// util: clamp simple
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// util: pace en "mm:ss/km"
function formatPace(minPerKm: number) {
  const mm = Math.floor(minPerKm);
  const ss = Math.round((minPerKm - mm) * 60);
  const ss2 = ss === 60 ? 0 : ss;
  const mm2 = ss === 60 ? mm + 1 : mm;
  return `${String(mm2).padStart(2, "0")}:${String(ss2).padStart(2, "0")}/km`;
}

function computePace(distance_m: number | null, moving_time_s: number | null): string | null {
  if (!distance_m || !moving_time_s) return null;
  const km = Number(distance_m) / 1000;
  if (!isFinite(km) || km <= 0) return null;
  const minPerKm = moving_time_s / 60 / km;
  if (!isFinite(minPerKm) || minPerKm <= 0) return null;
  return formatPace(minPerKm);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const athleteId = url.searchParams.get("athleteId");
  const limit = clamp(parseInt(url.searchParams.get("limit") ?? "10", 10), 1, 100);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const type = url.searchParams.get("type") || undefined;
  const since = url.searchParams.get("since") || undefined; // ISO string
  const until = url.searchParams.get("until") || undefined; // ISO string

  if (!athleteId) {
    return NextResponse.json({ error: "missing athleteId" }, { status: 400 });
  }

  // mapear athleteId -> user_id interno
  const { data: userRow, error: uerr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("athlete_id", athleteId)
    .single();

  if (uerr || !userRow) {
    return NextResponse.json({
      data: [],
      meta: { athleteId, page, pageSize: limit, total: 0, hasMore: false },
    });
  }

  let query = supabaseAdmin
    .from("activities")
    .select("id, name, start_date, distance_m, moving_time_s, type", { count: "exact" })
    .eq("user_id", userRow.id);

  if (type) query = query.eq("type", type);
  if (since) query = query.gte("start_date", since);
  if (until) query = query.lte("start_date", until);

  query = query.order("start_date", { ascending: false });

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type ActivityRow = {
    id: number;
    name: string | null;
    start_date: string | null;
    distance_m: number | null;
    moving_time_s: number | null;
    type: string | null;
  };

  const items = (data ?? []).map((a: ActivityRow) => {
    const distance_km = a.distance_m != null ? Number(a.distance_m) / 1000 : null;
    const pace_min_km = computePace(a.distance_m, a.moving_time_s);
    return { ...a, distance_km, pace_min_km };
  });

  return NextResponse.json({
    data: items,
    meta: {
      athleteId,
      page,
      pageSize: limit,
      total: count ?? items.length,
      hasMore: count != null ? to + 1 < count : items.length === limit,
    },
  });
}
