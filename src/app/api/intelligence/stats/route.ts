import { NextResponse } from "next/server";

const OSIRIS_STATS_URL = "https://osirisai.live/api/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(OSIRIS_STATS_URL, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "OSIRIS stats request failed",
          status: response.status,
        },
        {
          status: 502,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=45, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("OSIRIS stats error:", error);

    return NextResponse.json(
      {
        error: "Unable to reach OSIRIS stats endpoint",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
