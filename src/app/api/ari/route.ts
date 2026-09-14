import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const ARI_MODEL = "qwen3:1.7b";

const HIMALAYA_EXE = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "Himalaya",
  "himalaya.exe",
);

const DEFAULT_WORKSPACE = path.join(
  os.homedir(),
  "Desktop",
  "ARI-workspace",
);

const PENDING_EMAIL = path.join(
  os.tmpdir(),
  "hermes-ari-pending-email.json",
);

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type EmailEnvelope = {
  id?: string;
  subject?: string;
  date?: string;
  from?: Array<{
    name?: string | null;
    email?: string | null;
  }>;
};

type ReceiptRecord = {
  id: string;
  envelopeDate: string;
  receiptDate: string;
  amountCents: number;
  currency: string;
  method: string;
  subject: string;
  sender: string;
};

type ReceiptParseFailure = {
  id: string;
  subject: string;
  reason: string;
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

async function askQwen(
  messages: Message[],
  signal?: AbortSignal,
): Promise<string> {
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
    throw new Error(
      `Ollama returned HTTP ${response.status}: ${(await response.text()).slice(
        0,
        300,
      )}`,
    );
  }

  const data = (await response.json()) as {
    message?: { content?: string };
  };

  const answer = visible(data.message?.content || "");

  if (!answer) {
    throw new Error("Ollama returned no visible answer.");
  }

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
      maxBuffer: 12 * 1024 * 1024,
    } as Parameters<typeof execFileAsync>[2]);

    return String(result.stdout).trim();
  } catch (error: unknown) {
    const err = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    throw new Error(
      `Himalaya email operation failed: ${String(
        err.stderr || err.stdout || err.message || "Unknown error",
      ).trim()}`,
    );
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Himalaya returned invalid JSON: ${text.slice(0, 500)}`,
    );
  }
}

function envelopes(value: unknown): EmailEnvelope[] {
  if (Array.isArray(value)) {
    return value as EmailEnvelope[];
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (Array.isArray(obj.envelopes)) {
      return obj.envelopes as EmailEnvelope[];
    }

    if (Array.isArray(obj.messages)) {
      return obj.messages as EmailEnvelope[];
    }
  }

  return [];
}

async function getInbox(limit = 5): Promise<EmailEnvelope[]> {
  const raw = await runHimalaya([
    "envelope",
    "list",
    "--json",
  ]);

  return envelopes(parseJson(raw)).slice(0, limit);
}

async function searchEmails(
  queryParts: string[],
): Promise<EmailEnvelope[]> {
  const pageSize = 100;
  const results: EmailEnvelope[] = [];

  for (let page = 1; page <= 10; page++) {
    const raw = await runHimalaya([
      "envelope",
      "search",
      "--json",
      "--page",
      String(page),
      "--page-size",
      String(pageSize),
      ...queryParts,
      "order",
      "by",
      "date",
      "desc",
    ]);

    const batch = envelopes(parseJson(raw));
    results.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return results;
}

function inferSender(email: EmailEnvelope): string {
  const sender = email.from?.[0];

  return (
    sender?.name ||
    sender?.email ||
    "Unknown sender"
  );
}

function stripTechnicalText(input: string): string {
  return cleanText(
    input
      .replace(
        /(?:^|\s)(?:Return-Path|Received|Received-SPF|Authentication-Results|DKIM-Signature|ARC-Seal|ARC-Message-Signature|ARC-Authentication-Results|Message-ID|MIME-Version|Content-Type|Content-Transfer-Encoding|X-[A-Za-z0-9-]+):[\s\S]*?(?=\s[A-Za-z][A-Za-z0-9-]+:|$)/gi,
        " ",
      )
      .replace(
        /--[A-Za-z0-9_=+\-/]+--?/g,
        " ",
      ),
  );
}

function getPlainTextFromParts(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const root = value as Record<string, unknown>;

  const parts = Array.isArray(root.parts)
    ? (root.parts as unknown[])
    : [];

  const preferredIds = Array.isArray(root.text_body)
    ? root.text_body.filter(
        (item): item is number =>
          typeof item === "number",
      )
    : [];

  for (const id of preferredIds) {
    const zeroBased = parts[id];
    const oneBased = parts[id - 1];

    for (const candidate of [zeroBased, oneBased]) {
      const extracted = extractPlainPart(candidate);

      if (extracted) {
        return extracted;
      }
    }
  }

  for (const part of parts) {
    const extracted = extractPlainPart(part);

    if (extracted) {
      return extracted;
    }
  }

  return "";
}

function extractPlainPart(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const obj = value as Record<string, unknown>;

  const body =
    obj.body && typeof obj.body === "object"
      ? (obj.body as Record<string, unknown>)
      : null;

  if (body && typeof body.Text === "string") {
    return body.Text;
  }

  return "";
}

async function readEmailStructured(
  id: string,
): Promise<string> {
  const raw = await runHimalaya([
    "message",
    "read",
    "--json",
    id,
  ]);

  const parsed = parseJson(raw);
  const plain = getPlainTextFromParts(parsed);

  return plain ? stripTechnicalText(plain) : "";
}

function parseMoneyToCents(
  integerPart: string,
  decimalPart: string,
): number {
  const integer = Number(integerPart);

  if (!Number.isFinite(integer)) {
    return NaN;
  }

  const decimals = (decimalPart || "00")
    .padEnd(2, "0")
    .slice(0, 2);

  const cents = Number(decimals);

  if (!Number.isFinite(cents)) {
    return NaN;
  }

  return integer * 100 + cents;
}

function extractAmountCents(
  text: string,
): number | null {
  const amountMatch = text.match(
    /\bAmount\s*:\s*(?:DKK|kr\.?)\s*([0-9]+)(?:[.,]([0-9]{1,2}))?\b/i,
  );

  if (amountMatch) {
    const cents = parseMoneyToCents(
      amountMatch[1],
      amountMatch[2] || "00",
    );

    if (Number.isFinite(cents)) {
      return cents;
    }
  }

  const paymentMatch = text.match(
    /\bMobilePay\s*:\s*(?:DKK|kr\.?)\s*([0-9]+)(?:[.,]([0-9]{1,2}))?\b/i,
  );

  if (paymentMatch) {
    const cents = parseMoneyToCents(
      paymentMatch[1],
      paymentMatch[2] || "00",
    );

    if (Number.isFinite(cents)) {
      return cents;
    }
  }

  const dkkMatch = text.match(
    /\bDKK\s*([0-9]+)(?:[.,]([0-9]{1,2}))?\b/i,
  );

  if (dkkMatch) {
    const cents = parseMoneyToCents(
      dkkMatch[1],
      dkkMatch[2] || "00",
    );

    if (Number.isFinite(cents)) {
      return cents;
    }
  }

  const krMatch = text.match(
    /\b([0-9]+)(?:[.,]([0-9]{1,2}))?\s*kr\.?\b/i,
  );

  if (krMatch) {
    const cents = parseMoneyToCents(
      krMatch[1],
      krMatch[2] || "00",
    );

    if (Number.isFinite(cents)) {
      return cents;
    }
  }

  return null;
}

function monthNumber(month: string): number | null {
  const normalized = month
    .toLowerCase()
    .replace(".", "");

  const months: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  return months[normalized] || null;
}

/*
 * Supports:
 *
 *   August 17, 2026
 *   August 17 2026
 *   August 17th, 2026
 *   17 August 2026
 *   17th August 2026
 */
function parseNaturalDate(
  input: string,
): string | null {
  const normalized = input
    .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let match = normalized.match(
    /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/,
  );

  if (match) {
    const month = monthNumber(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);

    if (
      month &&
      Number.isFinite(day) &&
      Number.isFinite(year) &&
      day >= 1 &&
      day <= 31
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(
        day,
      ).padStart(2, "0")}`;
    }
  }

  match = normalized.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/,
  );

  if (match) {
    const day = Number(match[1]);
    const month = monthNumber(match[2]);
    const year = Number(match[3]);

    if (
      month &&
      Number.isFinite(day) &&
      Number.isFinite(year) &&
      day >= 1 &&
      day <= 31
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(
        day,
      ).padStart(2, "0")}`;
    }
  }

  return null;
}

function extractReceiptDate(
  text: string,
): string | null {
  const patterns = [
    /\b([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/i,
    /\b(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const parsed = parseNaturalDate(match[1]);

      if (parsed) {
        return parsed;
      }
    }
  }

  const iso = text.match(
    /\b(20\d{2})-(\d{2})-(\d{2})\b/,
  );

  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  return null;
}

function extractPaymentMethod(
  text: string,
): string {
  const methodMatch = text.match(
    /\bMethod\s*:\s*([A-Za-z][A-Za-z ]+)/i,
  );

  if (methodMatch) {
    return cleanText(methodMatch[1]);
  }

  if (/\bMobilePay\b/i.test(text)) {
    return "MobilePay";
  }

  return "Unknown";
}

function parseDateOnly(
  value: string,
): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function dateInRange(
  value: string,
  start: string,
  end: string,
): boolean {
  const date = parseDateOnly(value);
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);

  if (!date || !startDate || !endDate) {
    return false;
  }

  return (
    date.getTime() >= startDate.getTime() &&
    date.getTime() <= endDate.getTime()
  );
}

/*
 * Handles both:
 *
 *   from August 17, 2026 through September 9, 2026
 *   from 17 August 2026 through 9 September 2026
 *   between August 17, 2026 and September 9, 2026
 *   between 17 August 2026 and 9 September 2026
 */
function extractDateRange(
  userText: string,
): {
  start: string;
  end: string;
} | null {
  const normalized = userText
    .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const monthFirst =
    /(?:from|between)\s+([A-Za-z]+\s+\d{1,2}\s+\d{4})\s+(?:through|to|and|-)\s+([A-Za-z]+\s+\d{1,2}\s+\d{4})/i.exec(
      normalized,
    );

  if (monthFirst) {
    const start = parseNaturalDate(
      monthFirst[1],
    );
    const end = parseNaturalDate(
      monthFirst[2],
    );

    if (start && end) {
      return { start, end };
    }
  }

  const dayFirst =
    /(?:from|between)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s+(?:through|to|and|-)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(
      normalized,
    );

  if (dayFirst) {
    const start = parseNaturalDate(
      dayFirst[1],
    );
    const end = parseNaturalDate(
      dayFirst[2],
    );

    if (start && end) {
      return { start, end };
    }
  }

  return null;
}

function looksLikeDateRangeRequest(
  text: string,
): boolean {
  return (
    /\b(from|between)\b/i.test(text) &&
    /\b(?:through|to|and|-)\b/i.test(text) &&
    /\b(?:20\d{2}|this month|last month)\b/i.test(
      text,
    )
  );
}

function isTargetedEmailSearch(
  text: string,
): boolean {
  const lower = text.toLowerCase();

  const hasEmailContext =
    /\b(email|emails|gmail|inbox|receipt|invoice|bill|confirmation|order)\b/.test(
      lower,
    );

  const hasSearchIntent =
    /\b(check|find|search|look for|look up|locate|latest|most recent|all)\b/.test(
      lower,
    );

  const hasKnownTarget =
    /\brejsekort\b/.test(lower) ||
    /\b(receipt|invoice|bill|confirmation|order)\b/.test(
      lower,
    );

  return (
    hasEmailContext &&
    hasSearchIntent &&
    hasKnownTarget
  );
}

function formatCents(
  cents: number,
): string {
  return `${(cents / 100).toFixed(2)} DKK`;
}

async function searchAndReadLatestEmail(
  userText: string,
): Promise<string> {
  const results = await searchEmails([
    "subject",
    "Rejsekort",
  ]);

  if (results.length === 0) {
    return "I couldn't find a Rejsekort receipt.";
  }

  const latest = results[0];

  if (!latest.id) {
    return "I found a Rejsekort receipt, but I couldn't open it.";
  }

  console.log(
    `[ARI router] EMAIL MATCH: ${latest.id} | ${
      latest.subject || "(no subject)"
    }`,
  );

  const text = await readEmailStructured(
    String(latest.id),
  );

  if (!text) {
    return "I found the receipt, but I couldn't extract its readable payment details.";
  }

  const amount = extractAmountCents(text);
  const receiptDate =
    extractReceiptDate(text) ||
    latest.date ||
    "";

  const method = extractPaymentMethod(text);

  return askQwen([
    {
      role: "system",
      content:
        "You are ARI's conversational voice. " +
        "Use ONLY the verified facts supplied by the deterministic email system. " +
        "Do not calculate, infer, reinterpret, or invent values. " +
        "Do not mention MIME, HTML, PDF internals, headers, message IDs, JSON, Himalaya, encoding, or internal tools. " +
        "Answer the user's request directly and naturally. Keep it concise.",
    },
    {
      role: "user",
      content:
        `User request: ${userText}\n\nVerified receipt facts:\n${JSON.stringify(
          {
            sender: inferSender(latest),
            subject: cleanText(
              latest.subject || "(No subject)",
            ),
            receiptDate,
            amount:
              amount === null
                ? null
                : formatCents(amount),
            method,
          },
        )}`,
    },
  ]);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(
        items[index],
      );
    }
  }

  const workers = Array.from(
    {
      length: Math.min(
        concurrency,
        items.length,
      ),
    },
    () => runWorker(),
  );

  await Promise.all(workers);

  return results;
}

async function parseReceiptCandidate(
  email: EmailEnvelope,
  range: {
    start: string;
    end: string;
  },
): Promise<
  | {
      kind: "receipt";
      value: ReceiptRecord;
    }
  | {
      kind: "failure";
      value: ReceiptParseFailure;
    }
> {
  const id = String(email.id || "");

  if (!id) {
    return {
      kind: "failure",
      value: {
        id: "(missing)",
        subject: cleanText(
          email.subject || "(No subject)",
        ),
        reason: "Message had no id.",
      },
    };
  }

  try {
    const text =
      await readEmailStructured(id);

    if (!text) {
      return {
        kind: "failure",
        value: {
          id,
          subject: cleanText(
            email.subject || "(No subject)",
          ),
          reason:
            "No readable text/plain receipt body.",
        },
      };
    }

    const amountCents =
      extractAmountCents(text);

    if (amountCents === null) {
      return {
        kind: "failure",
        value: {
          id,
          subject: cleanText(
            email.subject || "(No subject)",
          ),
          reason:
            "No receipt amount could be extracted.",
        },
      };
    }

    const receiptDate =
      extractReceiptDate(text);

    if (!receiptDate) {
      return {
        kind: "failure",
        value: {
          id,
          subject: cleanText(
            email.subject || "(No subject)",
          ),
          reason:
            "No receipt date could be extracted.",
        },
      };
    }

    if (
      !dateInRange(
        receiptDate,
        range.start,
        range.end,
      )
    ) {
      return {
        kind: "failure",
        value: {
          id,
          subject: cleanText(
            email.subject || "(No subject)",
          ),
          reason:
            `Receipt date ${receiptDate} is outside requested range ${range.start} through ${range.end}.`,
        },
      };
    }

    return {
      kind: "receipt",
      value: {
        id,
        envelopeDate: email.date || "",
        receiptDate,
        amountCents,
        currency: "DKK",
        method:
          extractPaymentMethod(text),
        subject: cleanText(
          email.subject || "(No subject)",
        ),
        sender: inferSender(email),
      },
    };
  } catch (error) {
    return {
      kind: "failure",
      value: {
        id,
        subject: cleanText(
          email.subject || "(No subject)",
        ),
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      },
    };
  }
}

function buildDeterministicReceiptAnswer(
  receipts: ReceiptRecord[],
  failures: ReceiptParseFailure[],
  range: {
    start: string;
    end: string;
  },
): string {
  const totalCents = receipts.reduce(
    (sum, receipt) =>
      sum + receipt.amountCents,
    0,
  );

  const lines: string[] = [];

  lines.push(
    `I found ${receipts.length} readable Rejsekort receipts from ${range.start} through ${range.end}.`,
  );

  for (const receipt of receipts) {
    lines.push(
      `${receipt.receiptDate}: ${formatCents(
        receipt.amountCents,
      )}`,
    );
  }

  lines.push(
    `Total: ${formatCents(totalCents)}.`,
  );

  if (failures.length > 0) {
    lines.push(
      `${failures.length} matching email${
        failures.length === 1 ? "" : "s"
      } could not be turned into a valid receipt.`,
    );
  }

  return lines.join("\n");
}

function responsePreservesFacts(
  response: string,
  receipts: ReceiptRecord[],
  totalCents: number,
): boolean {
  const lower = response.toLowerCase();

  if (
    /\b(no receipts|did not find|couldn't find|could not find|none found|no rejsekort)\b/i.test(
      lower,
    )
  ) {
    return false;
  }

  if (!lower.includes(String(receipts.length))) {
    return false;
  }

  if (
    !lower.includes(
      (totalCents / 100).toFixed(2),
    )
  ) {
    return false;
  }

  return receipts.every((receipt) =>
    response.includes(
      (receipt.amountCents / 100).toFixed(2),
    ),
  );
}

async function safeNaturalReceiptAnswer(
  userText: string,
  receipts: ReceiptRecord[],
  failures: ReceiptParseFailure[],
  range: {
    start: string;
    end: string;
  },
): Promise<string> {
  const totalCents = receipts.reduce(
    (sum, receipt) =>
      sum + receipt.amountCents,
    0,
  );

  const deterministicAnswer =
    buildDeterministicReceiptAnswer(
      receipts,
      failures,
      range,
    );

  try {
    const qwenAnswer = await askQwen([
      {
        role: "system",
        content:
          "You are ARI's voice only. " +
          "The receipt results below were already searched, read, parsed, validated, and calculated by deterministic code. " +
          "Your only job is to phrase the supplied facts naturally. " +
          "You MUST preserve the exact receipt count, every amount, and exact total. " +
          "You MUST NOT say that receipts were missing when readable receipts are supplied. " +
          "You MUST NOT recalculate the total. " +
          "Do not mention JSON, MIME, HTML, PDFs, headers, message IDs, Himalaya, encoding, or internal tools. " +
          "Be concise.",
      },
      {
        role: "user",
        content:
          `User request: ${userText}\n\n` +
          `Verified receipt count: ${receipts.length}\n` +
          `Verified total: ${formatCents(
            totalCents,
          )}\n` +
          `Verified receipts:\n${receipts
            .map(
              (receipt) =>
                `${receipt.receiptDate} — ${formatCents(
                  receipt.amountCents,
                )}`,
            )
            .join("\n")}\n\n` +
          `Unreadable matches: ${failures.length}`,
      },
    ]);

    if (
      responsePreservesFacts(
        qwenAnswer,
        receipts,
        totalCents,
      )
    ) {
      return qwenAnswer;
    }

    console.warn(
      "[ARI router] Qwen contradicted verified receipt facts; using deterministic fallback.",
    );

    return deterministicAnswer;
  } catch (error) {
    console.warn(
      "[ARI router] Qwen receipt response failed; using deterministic fallback.",
      error,
    );

    return deterministicAnswer;
  }
}

async function findAllRejsekortReceipts(
  userText: string,
): Promise<string> {
  const range = extractDateRange(userText);

  /*
   * Critical safety rule:
   * A date-range request must have a successfully parsed range.
   * Never silently run an unrestricted accounting search.
   */
  if (
    looksLikeDateRangeRequest(userText) &&
    !range
  ) {
    return "I understood that you want a date range, but I couldn't parse the start and end dates reliably. Please give me the dates explicitly, for example: August 17, 2026 through September 9, 2026.";
  }

  if (!range) {
    return "I need the start and end dates before I can calculate a Rejsekort total.";
  }

  const startDate = parseDateOnly(
    range.start,
  );

  if (!startDate) {
    return "I couldn't parse the start date.";
  }

  /*
   * Himalaya 2.1.0 supports `after`, but not `before`.
   * Search from one day before the requested start and apply
   * the complete upper and lower bounds locally.
   */
  startDate.setDate(
    startDate.getDate() - 1,
  );

  const startForSearch =
    `${startDate.getFullYear()}-${String(
      startDate.getMonth() + 1,
    ).padStart(2, "0")}-${String(
      startDate.getDate(),
    ).padStart(2, "0")}`;

  console.log(
    `[ARI router] DATE RANGE: ${range.start} through ${range.end}`,
  );

  const results = await searchEmails([
    "subject",
    "Rejsekort",
    "and",
    "after",
    startForSearch,
  ]);

  console.log(
    `[ARI router] REJSEKORT CANDIDATES: ${results.length}`,
  );

  if (results.length === 0) {
    return `I couldn't find any Rejsekort emails from ${range.start} through ${range.end}.`;
  }

  /*
   * Four concurrent message reads.
   */
  const parsed =
    await mapWithConcurrency(
      results,
      4,
      (email) =>
        parseReceiptCandidate(
          email,
          range,
        ),
    );

  const receipts: ReceiptRecord[] = [];
  const failures: ReceiptParseFailure[] = [];

  for (const result of parsed) {
    if (result.kind === "receipt") {
      receipts.push(result.value);
    } else {
      failures.push(result.value);

      console.warn(
        `[ARI router] Receipt failure ${result.value.id}: ${result.value.reason}`,
      );
    }
  }

  receipts.sort(
    (a, b) =>
      a.receiptDate.localeCompare(
        b.receiptDate,
      ),
  );

  console.log(
    `[ARI router] REJSEKORT RECEIPTS: ${receipts.length}`,
  );

  const totalCents = receipts.reduce(
    (sum, receipt) =>
      sum + receipt.amountCents,
    0,
  );

  console.log(
    `[ARI router] REJSEKORT TOTAL: ${formatCents(
      totalCents,
    )}`,
  );

  console.log(
    `[ARI router] REJSEKORT FAILURES: ${failures.length}`,
  );

  if (receipts.length === 0) {
    return buildDeterministicReceiptAnswer(
      receipts,
      failures,
      range,
    );
  }

  return safeNaturalReceiptAnswer(
    userText,
    receipts,
    failures,
    range,
  );
}

async function emailBrief(
  userText: string,
): Promise<string> {
  const items = await getInbox(5);

  if (items.length === 0) {
    return "Your inbox is empty.";
  }

  const enriched = [];

  for (const email of items) {
    let body = "";

    if (email.id) {
      try {
        body =
          await readEmailStructured(
            String(email.id),
          );
      } catch {
        body = "";
      }
    }

    enriched.push({
      sender: inferSender(email),
      subject: cleanText(
        email.subject || "(No subject)",
      ),
      date: email.date || "",
      preview: body.slice(0, 900),
    });
  }

  return askQwen([
    {
      role: "system",
      content:
        "You are ARI's conversational voice. Brief the user's email inbox naturally. " +
        "Use only the supplied email facts. " +
        "Do not mention JSON, HTML, URLs, message IDs, MIME, headers, markdown, or internal tools. " +
        "For a latest-email request, lead with the newest email and keep the answer under 4 sentences.",
    },
    {
      role: "user",
      content:
        `User request: ${userText}\n\nEmail facts:\n${JSON.stringify(
          enriched,
        )}`,
    },
  ]);
}

async function emailFullRead(): Promise<string> {
  const items = await getInbox(1);

  if (!items[0]?.id) {
    return "I couldn't find a recent email to read.";
  }

  const raw =
    await readEmailStructured(
      String(items[0].id),
    );

  if (!raw) {
    return "I found the email, but I couldn't extract its readable content.";
  }

  return askQwen([
    {
      role: "system",
      content:
        "You are ARI's conversational voice. Read the supplied email naturally and concisely. " +
        "Preserve meaningful content. Remove technical formatting and metadata. " +
        "Do not mention JSON, MIME, HTML, message IDs, headers, or internal tools. " +
        "Do not invent missing details.",
    },
    {
      role: "user",
      content: raw.slice(0, 12000),
    },
  ]);
}

async function currentWeb(
  query: string,
): Promise<string> {
  const response = await fetch(
    `https://www.bing.com/search?q=${encodeURIComponent(
      query,
    )}&count=5&setlang=en`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Bing returned HTTP ${response.status}.`,
    );
  }

  const html = await response.text();

  const results: Array<{
    title: string;
    snippet: string;
  }> = [];

  const regex =
    /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

  let match: RegExpExecArray | null;

  while (
    results.length < 5 &&
    (match = regex.exec(html))
  ) {
    const titleMatch =
      match[1].match(
        /<h2[^>]*>\s*<a[^>]+href="[^"]+"[^>]*>([\s\S]*?)<\/a>/i,
      );

    const snippetMatch =
      match[1].match(
        /<p[^>]*>([\s\S]*?)<\/p>/i,
      );

    if (titleMatch) {
      results.push({
        title: cleanText(
          titleMatch[1],
        ),
        snippet: cleanText(
          snippetMatch?.[1] || "",
        ),
      });
    }
  }

  if (!results.length) {
    return "No current web results were found.";
  }

  return askQwen([
    {
      role: "system",
      content:
        "You are ARI's conversational voice. Answer using only the supplied current web results. " +
        "Be concise and natural. Do not mention HTML, URLs, search engines, or internal tools. " +
        "Do not invent facts.",
    },
    {
      role: "user",
      content:
        `Question: ${query}\n\nResults:\n${JSON.stringify(
          results,
        )}`,
    },
  ]);
}

async function workspaceAnswer(
  text: string,
): Promise<string> {
  const root = path.resolve(
    process.env.ARI_WORKSPACE?.trim() ||
      DEFAULT_WORKSPACE,
  );

  if (
    /list|show|files|folder|directory/i.test(
      text,
    )
  ) {
    await fs.mkdir(root, {
      recursive: true,
    });

    const entries =
      await fs.readdir(root, {
        withFileTypes: true,
      });

    return askQwen([
      {
        role: "system",
        content:
          "You are ARI's conversational voice. Brief the supplied workspace listing naturally. Do not mention internal JSON.",
      },
      {
        role: "user",
        content: JSON.stringify(
          entries.map((e) => ({
            name: e.name,
            type: e.isDirectory()
              ? "folder"
              : "file",
          })),
        ),
      },
    ]);
  }

  const fileMatch = text.match(
    /(?:read|open)\s+(?:the\s+)?(?:file\s+)?["']?([^"']+?)(?:["']?\s*)$/i,
  );

  if (!fileMatch) {
    return "Tell me which workspace file you want me to read.";
  }

  const candidate = path.resolve(
    root,
    fileMatch[1].trim(),
  );

  const relative = path.relative(
    root,
    candidate,
  );

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "That file is outside the ARI workspace.",
    );
  }

  const content =
    await fs.readFile(
      candidate,
      "utf8",
    );

  return askQwen([
    {
      role: "system",
      content:
        "You are ARI's conversational voice. Summarize the supplied file naturally and concisely. Do not mention internal tools or formatting.",
    },
    {
      role: "user",
      content: content.slice(0, 10000),
    },
  ]);
}

function isConfirm(
  text: string,
): boolean {
  return /^(confirm|confirmed|yes|yes send|send it|do it|go ahead)$/i.test(
    text.trim(),
  );
}

function isEmailBrief(
  text: string,
): boolean {
  return (
    /\b(email|emails|gmail|inbox)\b/i.test(
      text,
    ) &&
    !/\b(send|write|compose|reply|forward|read)\b/i.test(
      text,
    )
  );
}

function isEmailRead(
  text: string,
): boolean {
  return (
    /\b(read|open|show me the full|full email)\b/i.test(
      text,
    ) &&
    /\b(email|inbox|gmail)\b/i.test(
      text,
    )
  );
}

function isEmailSend(
  text: string,
): boolean {
  return (
    /\b(send|email|mail|compose)\b/i.test(
      text,
    ) &&
    /\b(email|mail)\b/i.test(
      text,
    )
  );
}

function parseRecipient(
  text: string,
  ownEmail: string,
): string {
  if (
    /\b(myself|my own|my account|me)\b/i.test(
      text,
    )
  ) {
    return ownEmail;
  }

  const match = text.match(
    /\b(?:to|at)\s+([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})\b/i,
  );

  return match?.[1] || "";
}

function parseEmailBody(
  text: string,
): {
  to: string;
  subject: string;
  body: string;
} {
  const to =
    text.match(
      /\b(?:to|at)\s+([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})\b/i,
    )?.[1] || "";

  const subjectMatch = text.match(
    /\bsubject\s*[:=-]\s*(.+?)(?:\s+body\s*[:=-]|$)/i,
  );

  const bodyMatch = text.match(
    /\bbody\s*[:=-]\s*([\s\S]+)$/i,
  );

  return {
    to,
    subject: cleanText(
      subjectMatch?.[1] ||
        "ARI test email",
    ),
    body: cleanText(
      bodyMatch?.[1] ||
        "This is a test email sent by ARI.",
    ),
  };
}

async function getOwnEmail(): Promise<string> {
  try {
    const config =
      await fs.readFile(
        path.join(
          process.env.APPDATA ||
            path.join(
              os.homedir(),
              "AppData",
              "Roaming",
            ),
          "himalaya",
          "config.toml",
        ),
        "utf8",
      );

    const match = config.match(
      /(?:^|\n)email\s*=\s*["']([^"']+)["']/i,
    );

    return (
      match?.[1] ||
      process.env.ARI_EMAIL_ADDRESS ||
      ""
    );
  } catch {
    return (
      process.env.ARI_EMAIL_ADDRESS ||
      ""
    );
  }
}

async function stageEmailSend(
  text: string,
): Promise<string> {
  const ownEmail =
    await getOwnEmail();

  const to = parseRecipient(
    text,
    ownEmail,
  );

  const parsed =
    parseEmailBody(text);

  if (!to) {
    return "Who should I send it to? Give me an email address or say 'myself'.";
  }

  const pending = {
    to,
    subject: parsed.subject,
    body: parsed.body,
  };

  await fs.writeFile(
    PENDING_EMAIL,
    JSON.stringify(pending),
    "utf8",
  );

  return `I can send a test email to ${to} with the subject ${parsed.subject}. Say confirm to send it.`;
}

async function confirmEmailSend(): Promise<string> {
  let pending: {
    to?: string;
    subject?: string;
    body?: string;
  };

  try {
    pending =
      JSON.parse(
        await fs.readFile(
          PENDING_EMAIL,
          "utf8",
        ),
      );
  } catch {
    return "There is no pending email to send.";
  }

  if (
    !pending.to ||
    !pending.subject ||
    !pending.body
  ) {
    return "The pending email is incomplete.";
  }

  await runHimalaya([
    "message",
    "compose",
    "--to",
    pending.to,
    "--subject",
    pending.subject,
    "--body",
    pending.body,
    "--send",
  ]);

  await fs.rm(
    PENDING_EMAIL,
    { force: true },
  );

  return `Done. The email was sent to ${pending.to}.`;
}

function intent(
  text: string,
):
  | "confirm"
  | "email-multi-search"
  | "email-targeted-search"
  | "email-read"
  | "email-brief"
  | "email-send"
  | "workspace"
  | "web"
  | "chat" {
  const lower = text.toLowerCase();

  if (isConfirm(text)) {
    return "confirm";
  }

  if (
    isTargetedEmailSearch(text) &&
    looksLikeDateRangeRequest(text)
  ) {
    return "email-multi-search";
  }

  if (
    isTargetedEmailSearch(text) &&
    /\b(all|every|each|total|sum)\b/i.test(
      text,
    )
  ) {
    return "email-multi-search";
  }

  if (isTargetedEmailSearch(text)) {
    return "email-targeted-search";
  }

  if (
    /\b(send|compose|write)\b/.test(
      lower,
    ) &&
    /\b(email|mail)\b/.test(
      lower,
    )
  ) {
    return "email-send";
  }

  if (isEmailRead(text)) {
    return "email-read";
  }

  if (isEmailBrief(text)) {
    return "email-brief";
  }

  if (
    /\b(workspace|file|folder|directory)\b/i.test(
      text,
    )
  ) {
    return "workspace";
  }

  if (
    /\b(search|look up|find online|current|latest|today|what happened)\b/i.test(
      text,
    )
  ) {
    return "web";
  }

  return "chat";
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        messages?: Message[];
      };

    const incoming =
      Array.isArray(body.messages)
        ? body.messages
        : [];

    const lastUser =
      [...incoming]
        .reverse()
        .find(
          (m) => m.role === "user",
        );

    const text =
      lastUser?.content?.trim() || "";

    if (!text) {
      throw new Error(
        "No user message was provided.",
      );
    }

    const selected =
      intent(text);

    console.log(
      `[ARI router] intent=${selected} text="${text}"`,
    );

    let answer: string;

    switch (selected) {
      case "confirm":
        answer =
          await confirmEmailSend();
        break;

      case "email-multi-search":
        console.log(
          "[ARI router] MULTI EMAIL PATH ACTIVATED",
        );

        answer =
          await findAllRejsekortReceipts(
            text,
          );
        break;

      case "email-targeted-search":
        console.log(
          "[ARI router] EMAIL PATH ACTIVATED",
        );

        answer =
          await searchAndReadLatestEmail(
            text,
          );
        break;

      case "email-send":
        answer =
          await stageEmailSend(
            text,
          );
        break;

      case "email-read":
        answer =
          await emailFullRead();
        break;

      case "email-brief":
        answer =
          await emailBrief(text);
        break;

      case "workspace":
        answer =
          await workspaceAnswer(
            text,
          );
        break;

      case "web":
        answer =
          await currentWeb(text);
        break;

      default:
        answer = await askQwen([
          {
            role: "system",
            content:
              "You are ARI, a concise, practical conversational assistant. " +
              "You are only responsible for natural conversation. " +
              "Do not claim to have performed external actions.",
          },
          ...incoming.slice(-12),
        ]);
    }

    return sse(answer);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "[ARI route error]",
      message,
    );

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}