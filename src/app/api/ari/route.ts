import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getHermesMemoryDirectory } from "../../../lib/hermes-runtime";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const ARI_MODEL = "qwen3:1.7b";
const MAX_MEMORY_CHARS = 3_000;
const MAX_EMAIL_CHARS = 12_000;
const DEFAULT_WORKSPACE = path.join(os.homedir(), "Desktop", "ARI-workspace");

const ARI_SYSTEM_PROMPT = `
You are ARI, the user-facing AI assistant inside the Hermes application.

IDENTITY
- Your name is ARI.
- Hermes is the underlying runtime/platform.
- Do not call yourself Hermes Agent unless the user explicitly asks about the underlying system.
- Do not volunteer the model or provider name.

PERSONALITY
- Direct.
- Calm.
- Intelligent.
- Precise.
- Concise by default.
- Practical and proactive.
- Honest about uncertainty.
- Willing to correct incorrect assumptions.
- Never fabricate actions, results, connections, or facts.
- Never claim something succeeded without evidence.

COMMUNICATION
- Lead with the answer.
- Use clear structure when useful.
- Avoid filler and unnecessary enthusiasm.
- When debugging, identify the likely cause first and give the next action.
- When a decision is needed, make a clear recommendation.
- Match the user's level of technical detail.

CURRENT INFORMATION
- Current information must come from web search, not model memory.
- Use web_search for current, latest, recent, today's, this week's, this month's, this year's, live, or otherwise time-sensitive information.
- When current web results are supplied to you, treat them as the source of truth.

WORKSPACE
- Use list_directory and read_file for files in ARI's workspace.
- Never claim to have read or modified a file unless a tool result proves it.

EMAIL
- You can read/search the user's configured Gmail account through the email tools.
- You can send email through the configured Gmail account with email_send.
- Reading and searching mail require no confirmation.
- Sending mail is an external side effect: only send when the user explicitly asks you to send, reply, or compose an email.
- Before sending, make sure the recipient, subject, and body are clear from the user's request. If a required send detail is missing, ask for it instead of guessing.
- Never claim an email was sent unless email_send returns success.
- Do not expose passwords, app passwords, or raw credential configuration.
`;

type MessageRole = "system" | "user" | "assistant" | "tool";

type IncomingMessage = {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
};

type OllamaMessage = {
  role?: MessageRole;
  content?: string;
  tool_calls?: ToolCall[];
};

type OllamaResponse = {
  message?: OllamaMessage;
  done?: boolean;
  error?: string;
};

type SearchResult = {
  title: string;
  snippet: string;
  url: string;
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files and directories inside ARI's allowed workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Optional relative path inside the ARI workspace." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file inside ARI's allowed workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path inside the ARI workspace." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "email_inbox",
      description: "List or search messages in the user's configured Gmail account. Use this for requests like check my email, recent mail, unread mail, or find an email.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional Himalaya envelope-search expression, e.g. 'from boss@example.com', 'subject invoice', 'after 2026-08-01', or 'from boss@example.com and after 2026-08-01'.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            description: "Maximum number of messages to return. Defaults to 10.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "email_read",
      description: "Read the full contents of one email by its Himalaya message id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: ["string", "integer"], description: "The Himalaya message id." },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "email_send",
      description: "Send an email through the user's configured Gmail account. Only use when the user explicitly asks you to send/reply/compose mail.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address." },
          subject: { type: "string", description: "Email subject." },
          body: { type: "string", description: "Plain-text email body." },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
];

function getWorkspaceRoot() {
  return path.resolve(process.env.ARI_WORKSPACE?.trim() || DEFAULT_WORKSPACE);
}

function normalizeToolArguments(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore malformed arguments.
    }
  }
  return {};
}

function resolveWorkspacePath(relativePath: unknown) {
  const root = getWorkspaceRoot();
  const candidate = typeof relativePath === "string" && relativePath.trim() ? relativePath.trim() : ".";
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Workspace path is outside the allowed ARI workspace.");
  }
  return absolute;
}

async function listDirectory(relativePath: unknown) {
  const root = getWorkspaceRoot();
  await fs.mkdir(root, { recursive: true });
  const absolute = resolveWorkspacePath(relativePath);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  return {
    success: true,
    path: path.relative(root, absolute) || ".",
    entries: entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "directory" : "file" })),
  };
}

async function readFile(relativePath: unknown) {
  const relative = typeof relativePath === "string" ? relativePath.trim() : "";
  if (!relative) throw new Error("A relative file path is required.");
  const absolute = resolveWorkspacePath(relative);
  const stat = await fs.stat(absolute);
  if (!stat.isFile()) throw new Error("The requested workspace path is not a file.");
  return {
    success: true,
    path: path.relative(getWorkspaceRoot(), absolute),
    content: await fs.readFile(absolute, "utf8"),
  };
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function stripHtml(input: string) {
  return decodeHtmlEntities(
    input.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  );
}

function decodeBingUrl(rawUrl: string) {
  const decodedUrl = decodeHtmlEntities(rawUrl);
  try {
    const url = new URL(decodedUrl, "https://www.bing.com");
    const redirectTarget = url.searchParams.get("u");
    if (!redirectTarget) return decodedUrl;
    if (redirectTarget.startsWith("a1")) {
      let encoded = redirectTarget.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      while (encoded.length % 4 !== 0) encoded += "=";
      try {
        return atob(encoded);
      } catch {
        return decodedUrl;
      }
    }
    try {
      return decodeURIComponent(redirectTarget);
    } catch {
      return redirectTarget;
    }
  } catch {
    return decodedUrl;
  }
}

async function webSearch(query: unknown) {
  const cleanQuery = typeof query === "string" ? query.trim() : "";
  if (!cleanQuery) throw new Error("A search query is required.");
  const response = await fetch(
    `https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}&count=5&setlang=en`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Bing returned HTTP ${response.status}.`);
  const html = await response.text();
  const results: SearchResult[] = [];
  const blockRegex = /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let blockMatch: RegExpExecArray | null;
  while (results.length < 5 && (blockMatch = blockRegex.exec(html))) {
    const block = blockMatch[1];
    const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
    if (!titleMatch) continue;
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const title = stripHtml(titleMatch[2]);
    const snippet = stripHtml(snippetMatch?.[1] || "");
    const url = decodeBingUrl(titleMatch[1]);
    if (title && url.startsWith("http")) results.push({ title, snippet, url });
  }
  return { success: results.length > 0, query: cleanQuery, results };
}

function limitText(value: unknown, maxChars = MAX_EMAIL_CHARS) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n...[truncated]` : text;
}

async function runHimalaya(args: string[], input?: string) {
  try {
    const result = await execFileAsync("himalaya", args, {
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
      input,
    } as Parameters<typeof execFileAsync>[2]);
    return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const detail = (err.stderr || err.stdout || err.message || "Unknown Himalaya error").trim();
    throw new Error(`Himalaya email operation failed: ${detail}`);
  }
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Himalaya returned non-JSON output: ${text.slice(0, 500)}`);
  }
}

async function emailInbox(args: Record<string, unknown>) {
  const limit = Math.max(1, Math.min(25, Number(args.limit) || 10));
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const commandArgs = query
    ? ["envelope", "search", "--json", query]
    : ["envelope", "list", "--json"];
  const result = await runHimalaya(commandArgs);
  const parsed = parseJson(result.stdout);
  const messages = Array.isArray(parsed) ? parsed.slice(0, limit) : parsed;
  return {
    success: true,
    query: query || null,
    count: Array.isArray(messages) ? messages.length : undefined,
    messages,
  };
}

async function emailRead(args: Record<string, unknown>) {
  const rawId = args.id;
  if (rawId === undefined || rawId === null || String(rawId).trim() === "") {
    throw new Error("An email id is required.");
  }
  const id = String(rawId).trim();
  const result = await runHimalaya(["message", "read", "--json", id]);
  return { success: true, id, message: limitText(parseJson(result.stdout)) };
}

async function emailSend(args: Record<string, unknown>) {
  const to = typeof args.to === "string" ? args.to.trim() : "";
  const subject = typeof args.subject === "string" ? args.subject.trim() : "";
  const body = typeof args.body === "string" ? args.body : "";
  if (!to || !subject || !body.trim()) throw new Error("Recipient, subject, and body are required to send an email.");
  const result = await runHimalaya([
    "message",
    "compose",
    "--to",
    to,
    "--subject",
    subject,
    "--body",
    body,
    "--send",
  ]);
  return { success: true, to, subject, output: result.stdout || "Email sent." };
}

async function loadMemory() {
  try {
    const directory = getHermesMemoryDirectory();
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const candidates = entries.filter(
      (entry) => entry.isFile() && /\.(md|txt|json)$/i.test(entry.name),
    );
    let output = "";
    for (const entry of candidates.slice(0, 5)) {
      const content = await fs.readFile(path.join(directory, entry.name), "utf8");
      const room = MAX_MEMORY_CHARS - output.length;
      if (room <= 0) break;
      output += `\n[${entry.name}]\n${content.slice(0, room)}`;
    }
    return output.trim();
  } catch {
    return "";
  }
}

async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_directory":
      return listDirectory(args.path);
    case "read_file":
      return readFile(args.path);
    case "web_search":
      return webSearch(args.query);
    case "email_inbox":
      return emailInbox(args);
    case "email_read":
      return emailRead(args);
    case "email_send":
      return emailSend(args);
    default:
      throw new Error(`Unknown ARI tool: ${name}`);
  }
}

async function askOllama(messages: IncomingMessage[], stream: boolean) {
  let response: Response;
  try {
    response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ARI_MODEL, messages, tools: TOOLS, stream }),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      `ARI inference is unavailable because Ollama is not reachable at 127.0.0.1:11434. Start Ollama and make sure ${ARI_MODEL} is installed.`,
    );
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  return response;
}

function shouldForceWebSearch(text: string) {
  const query = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!query) return false;
  return [
    /\blatest\b/, /\bcurrent\b/, /\bcurrently\b/, /\brecent\b/, /\brecently\b/, /\btoday\b/, /\btonight\b/, /\byesterday\b/, /\bthis week\b/, /\bthis month\b/, /\bthis year\b/, /\bnow\b/, /\blive\b/, /\bnewest\b/, /\bmost recent\b/, /\bwhat's new\b/, /\bwhat is new\b/, /\bpresident\b/, /\bprime minister\b/, /\belection\b/, /\belections\b/, /\bceo\b/, /\bweather\b/, /\bstock price\b/, /\bstock market\b/, /\bbitcoin price\b/, /\bcrypto price\b/,
  ].some((pattern) => pattern.test(query));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: IncomingMessage[]; voice?: boolean };
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const lastUserMessage = [...incoming].reverse().find((message) => message.role === "user");
    const lastUserText = lastUserMessage?.content || "";
    const memory = await loadMemory();

    const messages: IncomingMessage[] = [
      { role: "system", content: ARI_SYSTEM_PROMPT },
      ...(memory ? [{ role: "system", content: `Persistent Hermes memory:\n${memory}` } as IncomingMessage] : []),
      ...incoming,
    ];

    const currentSearch = shouldForceWebSearch(lastUserText);
    if (currentSearch) {
      try {
        const searchResult = await webSearch(lastUserText);
        messages.push({
          role: "tool",
          content: JSON.stringify({ name: "web_search", result: searchResult }),
          tool_call_id: "forced-web-search",
        });
      } catch {
        // Let the model answer without a forced result if search is unavailable.
      }
    }

    const planningResponse = await askOllama(messages, false);
    const planningJson = (await planningResponse.json()) as OllamaResponse;
    const assistantMessage = planningJson.message;
    const toolCalls = assistantMessage?.tool_calls || [];

    if (toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: assistantMessage?.content || "",
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const name = call.function?.name || "";
        const args = normalizeToolArguments(call.function?.arguments);
        try {
          const result = await executeTool(name, args);
          messages.push({
            role: "tool",
            tool_call_id: call.id || name,
            content: JSON.stringify({ success: true, result: limitText(result, MAX_EMAIL_CHARS) }),
          });
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : String(error);
          messages.push({
            role: "tool",
            tool_call_id: call.id || name,
            content: JSON.stringify({ success: false, error: detail }),
          });
        }
      }
    } else if (assistantMessage?.content) {
      messages.push({ role: "assistant", content: assistantMessage.content });
    }

    const finalResponse = await askOllama(messages, true);
    const reader = finalResponse.body?.getReader();
    if (!reader) throw new Error("Ollama returned no response stream.");

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              let chunk: OllamaResponse;
              try {
                chunk = JSON.parse(trimmed) as OllamaResponse;
              } catch {
                continue;
              }
              if (chunk.error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: chunk.error })}\n\n`));
                continue;
              }
              const content = chunk.message?.content || "";
              if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              if (chunk.done) controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            }
          }
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : String(error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: detail })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
