import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OSIRIS_BASE = "https://osirisai.live/api";
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const ARI_MODEL = "qwen3:1.7b";

function compact(value: unknown, maxLength = 14000): string {
  const text = JSON.stringify(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

async function askQwen(context: string, lat: number, lon: number) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      model: ARI_MODEL,
      stream: false,
      think: false,
      messages: [
        {
          role: "system",
          content:
            "You are ARI, a concise intelligence assistant. " +
            "Analyze only the supplied OSIRIS intelligence data. " +
            "Do not invent facts. Clearly distinguish reported information from inference. " +
            "Give the user a useful situational-awareness briefing for the selected location. " +
            "Mention important activity, notable risks, relevant events, and significant absences when useful. " +
            "Do not mention JSON, APIs, tools, prompts, or internal systems. " +
            "Keep the briefing under 180 words.",
        },
        {
          role: "user",
          content:
            `Selected coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}\n\n` +
            `OSIRIS regional intelligence:\n${context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    message?: {
      content?: string;
    };
  };

  return data.message?.content?.trim() || "I couldn't produce an intelligence briefing.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lat?: number;
      lon?: number;
    };

    const lat = Number(body.lat);
    const lon = Number(body.lon);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      return NextResponse.json(
        { error: "Invalid map coordinates." },
        { status: 400 },
      );
    }

    const url =
      `${OSIRIS_BASE}/region-dossier` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const detail = await response.text();

      return NextResponse.json(
        {
          error: "OSIRIS location dossier unavailable.",
          detail: detail.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const dossier = await response.json();
    const briefing = await askQwen(compact(dossier), lat, lon);

    return NextResponse.json({
      coordinates: {
        lat,
        lon,
      },
      briefing,
      dossier,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ARI location analysis failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Location analysis failed.",
      },
      { status: 500 },
    );
  }
}