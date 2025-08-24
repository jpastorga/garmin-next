import { NextResponse } from "next/server";
import { listUserIds } from "@/lib/strava";

export async function GET() {
  return NextResponse.json({ users: listUserIds() });
}
