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
const HIMALAYA_EXE = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "Himalaya",
  "himalaya.exe",
);
const DEFAULT_WORKSPACE = path.join(os.homedir(), "Desktop", "ARI-workspace");
const PENDING_EMAIL = path.join(os.tmpdir(), "hermes-ari-pending-email.json");

type Message = { role: "system" | "user" | "assistant"; content: string };

type EmailEnvelope = {
  id?: string;
  subject?: string;
  date?: string;
  from?: Array<{ name?: string | null; email?: string | null }>;
};

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function cleanText(input: string): string {
  return decodeHtml(
    input
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function visible(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function sse(answer: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: answer } }] })}\n\n`),
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

async function askQwen(messages: Message[], signal?: AbortSignal): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({
      model: ARI_MODEL,
      stream: false,
      think: false,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const answer = visible(data.message?.content || "");
  if (!answer) throw new Error("Ollama returned no visible answer.");
  return answer;
}

async function runHimalaya(args: string[]): Promise<string> {
  try {
    await fs.access(HIMALAYA_EXE);
  } catch {
    throw new Error(`Himalaya executable not found at ${HIMALAYA_EXE}`);
  }

  try {
    const result = await execFileAsync(HIMALAYA_EXE, args, {
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    } as Parameters<typeof execFileAsync>[2]);
    return String(result.stdout).trim();
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `Himalaya email operation failed: ${String(err.stderr || err.stdout || err.message || "Unknown error").trim()}`,
    );
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Himalaya returned invalid JSON: ${text.slice(0, 300)}`);
  }
}

function envelopes(value: unknown): EmailEnvelope[] {
  if (Array.isArray(value)) return value as EmailEnvelope[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.envelopes)) return obj.envelopes as EmailEnvelope[];
    if (Array.isArray(obj.messages)) return obj.messages as EmailEnvelope[];
  }
  return [];
}

async function getInbox(limit = 5): Promise<EmailEnvelope[]> {
  const raw = await runHimalaya(["envelope", "list", "--json"]);
  return envelopes(parseJson(raw)).slice(0, limit);
}

async function readEmail(id: string): Promise<string> {
  return runHimalaya(["message", "read", "--json", id]);
}

async function getOwnEmail(): Promise<string> {
  try {
    const config = await fs.readFile(
      path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "himalaya", "config.toml"),
      "utf8",
    );
    const match = config.match(/(?:^|\n)email\s*=\s*["']([^"']+)["']/i);
    return match?.[1] || process.env.ARI_EMAIL_ADDRESS || "";
  } catch {
    return process.env.ARI_EMAIL_ADDRESS || "";
  }
}

function inferSender(email: EmailEnvelope): string {
  const sender = email.from?.[0];
  return sender?.name || sender?.email || "Unknown sender";
}

async function emailBrief(userText: string): Promise<string> {
  const items = await getInbox(5);
  if (items.length === 0) return "Your inbox is empty.";

  const enriched = [];
  for (const email of items) {
    let body = "";
    if (email.id) {
      try {
        body = cleanText(await readEmail(String(email.id)));
      } catch {
        body = "";
      }
    }
    enriched.push({
      sender: inferSender(email),
      subject: cleanText(email.subject || "(No subject)"),
      date: email.date || "",
      preview: body.slice(0, 900),
    });
  }

  return askQwen([
    {
      role: "system",
      content:
        "You are ARI's conversational voice. Brief the user's email inbox naturally. " +
        "Use only the supplied email facts. For each email give sender, subject, and a short plain-English description. " +
        "Do not mention JSON, HTML, URLs, message IDs, MIME, headers, markdown, or internal tools. " +
        "For a latest-email request, lead with the newest email and keep the answer under 4 sentences. " +
        "Do not read the entire body unless the user explicitly asks to read the email.",
    },
    { role: "user", content: `User request: ${userText}\n\nEmail facts:\n${JSON.stringify(enriched)}` },
  ]);
}

async function emailFullRead(): Promise<string> {
  const items = await getInbox(1);
  if (!items[0]?.id) return "I couldn't find a recent email to read.";
  const raw = cleanText(await readEmail(String(items[0].id)));
  return askQwen([
    {
      role: "system",
      content:
        "You are ARI's conversational voice. Read the supplied email in a natural, concise way. " +
        "Remove HTML, URLs, tracking text, metadata, message IDs and technical formatting. " +
        "Preserve the meaningful content. Do not invent missing details.",
    },
    { role: "user", content: raw.slice(0, 7000) },
  ]);
}

async function currentWeb(query: string): Promise<string> {
  const response = await fetch(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=5&setlang=en`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Bing returned HTTP ${response.status}.`);
  const html = await response.text();
  const results: Array<{ title: string; snippet: string }> = [];
  const regex = /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while (results.length < 5 && (match = regex.exec(html))) {
    const titleMatch = match[1].match(/<h2[^>]*>\s*<a[^>]+href="[^"]+"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = match[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (titleMatch) results.push({ title: cleanText(titleMatch[1]), snippet: cleanText(snippetMatch?.[1] || "") });
  }
  if (!results.length) return "No current web results were found.";
  return askQwen([
    { role: "system", content: "You are ARI's conversational voice. Answer using only the supplied current web results. Be concise and natural. Do not mention HTML, URLs, search engines, or internal tools. Do not invent facts." },
    { role: "user", content: `Question: ${query}\n\nResults:\n${JSON.stringify(results)}` },
  ]);
}

async function workspaceAnswer(text: string): Promise<string> {
  const root = path.resolve(process.env.ARI_WORKSPACE?.trim() || DEFAULT_WORKSPACE);
  if (/list|show|files|folder|directory/i.test(text)) {
    await fs.mkdir(root, { recursive: true });
    const entries = await fs.readdir(root, { withFileTypes: true });
    return askQwen([
      { role: "system", content: "You are ARI's conversational voice. Brief the supplied workspace listing naturally. Do not mention internal JSON." },
      { role: "user", content: JSON.stringify(entries.map((e) => ({ name: e.name, type: e.isDirectory() ? "folder" : "file" }))) },
    ]);
  }
  const fileMatch = text.match(/(?:read|open)\s+(?:the\s+)?(?:file\s+)?["']?([^"']+?)(?:["']?\s*)$/i);
  if (!fileMatch) return "Tell me which workspace file you want me to read.";
  const candidate = path.resolve(root, fileMatch[1].trim());
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("That file is outside the ARI workspace.");
  const content = await fs.readFile(candidate, "utf8");
  return askQwen([
    { role: "system", content: "You are ARI's conversational voice. Summarize the supplied file naturally and concisely. Do not mention internal tools or formatting." },
    { role: "user", content: content.slice(0, 10000) },
  ]);
}

function isConfirm(text: string): boolean {
  return /^(confirm|confirmed|yes|yes send|send it|do it|go ahead)$/i.test(text.trim());
}

function isEmailBrief(text: string): boolean {
  return /\b(email|emails|gmail|inbox)\b/i.test(text) && !/\b(send|write|compose|reply|forward|read)\b/i.test(text);
}

function isEmailRead(text: string): boolean {
  return /\b(read|open|show me the full|full email)\b/i.test(text) && /\b(email|inbox|gmail)\b/i.test(text);
}

function isEmailSend(text: string): boolean {
  return /\b(send|email|mail|compose)\b/i.test(text) && /\bemail|mail\b/i.test(text);
}

function parseRecipient(text: string, ownEmail: string): string {
  if (/\b(myself|my own|my account|me)\b/i.test(text)) return ownEmail;
  const match = text.match(/\b(?:to|at)\s+([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})\b/i);
  return match?.[1] || "";
}

function parseEmailBody(text: string): { to: string; subject: string; body: string } {
  const to = text.match(/\b(?:to|at)\s+([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})\b/i)?.[1] || "";
  const subjectMatch = text.match(/\bsubject\s*[:=-]\s*(.+?)(?:\s+body\s*[:=-]|$)/i);
  const bodyMatch = text.match(/\bbody\s*[:=-]\s*([\s\S]+)$/i);
  return {
    to,
    subject: cleanText(subjectMatch?.[1] || "ARI test email"),
    body: cleanText(bodyMatch?.[1] || "This is a test email sent by ARI."),
  };
}

async function stageEmailSend(text: string): Promise<string> {
  const ownEmail = await getOwnEmail();
  const to = parseRecipient(text, ownEmail);
  const parsed = parseEmailBody(text);
  if (!to) return "Who should I send it to? Give me an email address or say 'myself'.";
  const pending = { to, subject: parsed.subject, body: parsed.body };
  await fs.writeFile(PENDING_EMAIL, JSON.stringify(pending), "utf8");
  return `I can send a test email to ${to} with the subject ${parsed.subject}. Say confirm to send it.`;
}

async function confirmEmailSend(): Promise<string> {
  let pending: { to?: string; subject?: string; body?: string };
  try {
    pending = JSON.parse(await fs.readFile(PENDING_EMAIL, "utf8"));
  } catch {
    return "There is no pending email to send.";
  }
  if (!pending.to || !pending.subject || !pending.body) return "The pending email is incomplete.";
  const output = await runHimalaya([
    "message", "compose", "--to", pending.to, "--subject", pending.subject, "--body", pending.body, "--send",
  ]);
  await fs.rm(PENDING_EMAIL, { force: true });
  return output ? `Done. The email was sent to ${pending.to}.` : `Done. The email was sent to ${pending.to}.`;
}

function intent(text: string): "confirm" | "email-read" | "email-brief" | "email-send" | "workspace" | "web" | "chat" {
  const lower = text.toLowerCase();
  if (isConfirm(text)) return "confirm";
  if (/\b(send|compose|write)\b/.test(lower) && /\b(email|mail)\b/.test(lower)) return "email-send";
  if (isEmailRead(text)) return "email-read";
  if (isEmailBrief(text)) return "email-brief";
  if (/\b(workspace|file|folder|directory)\b/i.test(text)) return "workspace";
  if (/\b(search|look up|find online|current|latest|today|what happened)\b/i.test(text)) return "web";
  return "chat";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: Message[] };
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const lastUser = [...incoming].reverse().find((m) => m.role === "user");
    const text = lastUser?.content?.trim() || "";
    if (!text) throw new Error("No user message was provided.");

    const selected = intent(text);
    let answer: string;

    switch (selected) {
      case "confirm":
        answer = await confirmEmailSend();
        break;
      case "email-send":
        answer = await stageEmailSend(text);
        break;
      case "email-read":
        answer = await emailFullRead();
        break;
      case "email-brief":
        answer = await emailBrief(text);
        break;
      case "workspace":
        answer = await workspaceAnswer(text);
        break;
      case "web":
        answer = await currentWeb(text);
        break;
      default:
        answer = await askQwen([
          { role: "system", content: "You are ARI, a concise, practical conversational assistant. You are only responsible for natural conversation. Do not claim to have performed external actions." },
          ...incoming.slice(-12),
        ]);
    }

    return sse(answer);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
