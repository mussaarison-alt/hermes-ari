import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OSIRIS_BASE = "https://osirisai.live/api";

const ALLOWED_FEEDS = new Set([
  "earthquakes",
  "flights",
  "satellites",
  "maritime",
  "cctv",
  "conflicts",
  "frontlines",
  "gdelt",
  "news",
  "live-news",
  "weather",
  "fires",
  "infrastructure",
  "cyber-attacks",
  "cyber-threats",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ feed: string }> },
) {
  const { feed } = await params;

  if (!ALLOWED_FEEDS.has(feed)) {
    return NextResponse.json({ error: "Unsupported intelligence feed" }, { status: 404 });
  }

  try {
    const response = await fetch(`${OSIRIS_BASE}/${feed}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "application/json";

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=30, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error(`OSIRIS ${feed} feed error:`, error);
    return NextResponse.json(
      { error: `OSIRIS ${feed} feed unavailable` },
      { status: 502 },
    );
  }
}
