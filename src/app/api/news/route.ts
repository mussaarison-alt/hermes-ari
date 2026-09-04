import { NextResponse } from "next/server";

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const ARI_MODEL = "qwen3:1.7b";

type NewsItem = {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  description: string;
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function stripCdata(input: string): string {
  return input
    .replace(/^\s*<!\[CDATA\[/i, "")
    .replace(/\]\]>\s*$/i, "")
    .trim();
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(
    stripCdata(input)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " "),
  );
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(
    new RegExp(
      `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
      "i",
    ),
  );

  return match ? stripHtml(match[1]) : "";
}

async function searchLatestNews(query: string, signal: AbortSignal): Promise<NewsItem[]> {
  const rssUrl =
    `https://www.bing.com/news/search?` +
    `q=${encodeURIComponent(query)}&format=rss&setlang=en-US`;

  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.8",
    },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Bing News returned HTTP ${response.status}.`);
  }

  const xml = await response.text();
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  return blocks
    .map((block): NewsItem | null => {
      const title = xmlTag(block, "title");
      const url = xmlTag(block, "link");
      const publishedAt = xmlTag(block, "pubDate");
      const source = xmlTag(block, "source");
      const description = xmlTag(block, "description");

      if (!title || !url) return null;

      return {
        title,
        url,
        publishedAt,
        source: source || "Unknown source",
        description,
      };
    })
    .filter((item): item is NewsItem => item !== null)
    .slice(0, 8);
}

function cleanTopic(input: string): string {
  return input
    .replace(/\b(what('s| is)?|tell me|give me|show me|read me)\b/gi, " ")
    .replace(/\b(the )?latest\b/gi, " ")
    .replace(/\b(today'?s?|today)\b/gi, " ")
    .replace(/\b(news|headlines|updates|stories)\b/gi, " ")
    .replace(/\bplease\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildQuery(userText: string): string {
  const topic = cleanTopic(userText);
  return topic || "top world news";
}

function formatSourceMaterial(items: NewsItem[]): string {
  return items
    .map(
      (item, index) =>
        `[${index + 1}] ${item.title}\n` +
        `Source: ${item.source}\n` +
        `Published: ${item.publishedAt || "unknown"}\n` +
        `Summary: ${item.description || "No summary supplied."}\n` +
        `URL: ${item.url}`,
    )
    .join("\n\n");
}

async function summarizeNews(
  userText: string,
  items: NewsItem[],
  signal: AbortSignal,
): Promise<string> {
  const sourceMaterial = formatSourceMaterial(items);

  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({
      model: ARI_MODEL,
      stream: false,
      think: false,
      messages: [
        {
          role: "system",
          content:
            "You are ARI's news briefing voice. " +
            "Use ONLY the supplied news items. Do not add facts from memory. " +
            "Prefer the newest published items. Give a concise spoken briefing " +
            "with at most 5 numbered headlines, one short sentence each. " +
            "Mention the source when useful. If dates are available, distinguish " +
            "older from newer items. Do not invent details.",
        },
        {
          role: "user",
          content:
            `User request: ${userText}\n\nLatest news retrieved now:\n${sourceMaterial}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Ollama returned HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as OllamaResponse;
  const answer = data.message?.content?.trim();

  if (!answer) {
    throw new Error("Ollama returned no news briefing.");
  }

  return answer;
}

function sse(answer: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            choices: [{ delta: { content: answer } }],
          })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = typeof body.query === "string" ? buildQuery(body.query) : "top world news";

    const items = await searchLatestNews(query, request.signal);

    if (items.length === 0) {
      throw new Error("No current news results were found.");
    }

    const answer = await summarizeNews(
      typeof body.query === "string" ? body.query : query,
      items,
      request.signal,
    );

    return sse(answer);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
