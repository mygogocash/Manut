import { NextResponse } from "next/server";

/** Lightweight health for the web deployment (Express `/health` is under the API bridge). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
