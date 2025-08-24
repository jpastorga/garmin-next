
import { supabaseAdmin } from "@/lib/supabase";

/**
 * This module uses Supabase as the source of truth:
 * - users(athlete_id -> id)
 * - strava_tokens(user_id -> access/refresh/expires_at)
 */

const STRAVA = {
  auth: "https://www.strava.com/oauth/authorize",
  token: "https://www.strava.com/oauth/token",
  api: "https://www.strava.com/api/v3",
};

type TokenRow = {
  access_token: string;
  refresh_token: string;
  /** timestamptz en DB, lo manejamos como ISO string */
  expires_at: string;
  updated_at?: string;
};

/** Get the internal UUID of users from the athlete_id of Strava */
export async function getUserIdByAthleteId(athleteId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("athlete_id", athleteId)
    .single();

  if (error || !data) throw new Error("No existe user para ese athleteId");
  return data.id as string;
}

/** Get the token row by athlete_id (via user_id) */
async function getTokenRowByAthleteId(
  athleteId: string
): Promise<{ userId: string; token: TokenRow }> {
  const userId = await getUserIdByAthleteId(athleteId);
  const { data, error } = await supabaseAdmin
    .from("strava_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) throw new Error("Falta token en strava_tokens");
  return { userId, token: data as TokenRow };
}

/**
 * Ensures a valid access_token for the athlete_id.
 * If it expired, it refreshes against Strava and persists the new token in Supabase.
 */
export async function ensureAccessTokenForAthlete(athleteId: string): Promise<{
  userId: string;
  access: string;
}> {
  const { userId, token } = await getTokenRowByAthleteId(athleteId);

  const now = Math.floor(Date.now() / 1000);
  const exp = token.expires_at ? Math.floor(new Date(token.expires_at).getTime() / 1000) : 0;

  if (exp - 60 > now) {
    return { userId, access: token.access_token };
  }

  // Refresh token in Strava
  const body = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    client_secret: process.env.STRAVA_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });

  const r = await fetch(STRAVA.token, { method: "POST", body });
  if (!r.ok) throw new Error(`Refresh token failed: ${r.status}`);
  const data = await r.json();

  const access_token = data.access_token as string;
  const refresh_token = (data.refresh_token as string) || token.refresh_token;
  const expires_at = new Date((data.expires_at as number) * 1000).toISOString();

  const { error: terr } = await supabaseAdmin
    .from("strava_tokens")
    .update({
      access_token,
      refresh_token,
      expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (terr) throw terr;

  return { userId, access: access_token };
}

/**
 * Compatibility: save tokens in Supabase if your callback still calls saveTokens(userId, token).
 * - `userId` here is the athlete_id (as you were using).
 * - Converts expires_at epoch (number) to timestamptz ISO.
 */
export async function saveTokens(athleteId: string, t: { access_token: string; refresh_token: string; expires_at: number }) {
  // upsert user (in case it comes from an old callback)
  const { data: u } = await supabaseAdmin
    .from("users")
    .upsert({ athlete_id: String(athleteId) }, { onConflict: "athlete_id" })
    .select("id")
    .single();

  const userId = u?.id || (await getUserIdByAthleteId(String(athleteId)));
  const expiresISO = new Date(t.expires_at * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from("strava_tokens")
    .upsert(
      {
        user_id: userId,
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: expiresISO,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}

/** Read 1 activity by ID using athleteId (handles refresh automatically) */
export async function fetchActivity(athleteId: string, id: string | number) {
  const { access } = await ensureAccessTokenForAthlete(athleteId);
  const r = await fetch(`${STRAVA.api}/activities/${id}?include_all_efforts=true`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!r.ok) throw new Error(`Strava /activities/${id} => ${r.status}`);
  return r.json();
}

/** List recent activities (max 200 per_page) using athleteId */
export async function fetchActivitiesByAthlete(athleteId: string, perPage = 20) {
  const { access } = await ensureAccessTokenForAthlete(athleteId);
  const qs = new URLSearchParams({ per_page: String(perPage) });
  const r = await fetch(`${STRAVA.api}/athlete/activities?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!r.ok) throw new Error(`Strava /athlete/activities => ${r.status}`);
  return r.json();
}

/**
 * Page of activities with filters after/before (epoch seconds) and page/per_page.
 * Useful for backfill.
 */
export async function fetchActivitiesPage(
  athleteId: string,
  {
    page = 1,
    perPage = 100,
    sinceEpoch,
    untilEpoch,
  }: { page?: number; perPage?: number; sinceEpoch?: number; untilEpoch?: number }
) {
  const { access } = await ensureAccessTokenForAthlete(athleteId);
  const qs = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (sinceEpoch) qs.set("after", String(sinceEpoch));
  if (untilEpoch) qs.set("before", String(untilEpoch));

  type StravaActivity = {
    id: number;
    name?: string;
    start_date?: string;
    distance?: number;
    moving_time?: number;
    type?: string;
    [key: string]: unknown;
  };

  const url = `${STRAVA.api}/athlete/activities?${qs.toString()}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  if (!r.ok) throw new Error(`Strava /athlete/activities (page) => ${r.status}`);
  return (await r.json()) as StravaActivity[];
}

/** List athlete_ids registered (for debug) reading from Supabase */
export async function listUserIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("athlete_id");

  if (error) throw error;
  return (data ?? []).map((u: { athlete_id: string | number }) => String(u.athlete_id));
}

export const fetchActivities = fetchActivitiesByAthlete;

export function getTokens() {
  throw new Error("getTokens() is no longer used. Read tokens from Supabase (ensureAccessTokenForAthlete).");
}
