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
  process.env.LOCALAPPDATA ||
    path.join(os.homedir(), "AppData", "Local"),
  "Himalaya",
  "himalaya.exe",
);

const MAX_MEMORY_CHARS = 3000;
const MAX_EMAIL_CHARS = 12000;

const DEFAULT_WORKSPACE = path.join(
  os.homedir(),
  "Desktop",
  "ARI-workspace",
);

const ARI_SYSTEM_PROMPT = `
You are ARI, the user-facing AI assistant inside the Hermes application.

IDENTITY
- Your name is ARI.
- Be direct, concise, practical and honest.
- Never claim an action succeeded unless there is evidence.
- Never expose internal reasoning.
- Never expose credentials.

CURRENT INFORMATION
- Use web_search for current or time-sensitive information.

WORKSPACE
- Use list_directory and read_file for workspace tasks.

EMAIL
- Gmail access is available through email tools.
- Never claim to have accessed Gmail unless the tool result proves it.
- Never expose passwords or credentials.
`;

type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

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
  thinking?: string;
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
      description:
        "List files and directories inside ARI's allowed workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Optional relative workspace path.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a UTF-8 text file inside ARI's allowed workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative workspace file path.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "email_inbox",
      description:
        "List or search messages in the configured Gmail account.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
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
      description:
        "Read a specific email by Himalaya message id.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: ["string", "integer"],
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "email_send",
      description:
        "Send an email through the configured Gmail account.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
          },
          subject: {
            type: "string",
          },
          body: {
            type: "string",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
];

function getWorkspaceRoot(): string {
  return path.resolve(
    process.env.ARI_WORKSPACE?.trim() ||
      DEFAULT_WORKSPACE,
  );
}

function normalizeToolArguments(
  raw: unknown,
): Record<string, unknown> {
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw)
  ) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore invalid arguments.
    }
  }

  return {};
}

function resolveWorkspacePath(
  relativePath: unknown,
): string {
  const root = getWorkspaceRoot();

  const candidate =
    typeof relativePath === "string" &&
    relativePath.trim()
      ? relativePath.trim()
      : ".";

  const absolute = path.resolve(
    root,
    candidate,
  );

  const relative = path.relative(
    root,
    absolute,
  );

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Workspace path is outside the allowed ARI workspace.",
    );
  }

  return absolute;
}

async function listDirectory(
  relativePath: unknown,
) {
  const root = getWorkspaceRoot();

  await fs.mkdir(root, {
    recursive: true,
  });

  const absolute =
    resolveWorkspacePath(relativePath);

  const entries =
    await fs.readdir(
      absolute,
      {
        withFileTypes: true,
      },
    );

  return {
    success: true,
    path:
      path.relative(root, absolute) ||
      ".",
    entries: entries
      .sort((a, b) =>
        a.name.localeCompare(b.name),
      )
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory()
          ? "directory"
          : "file",
      })),
  };
}

async function readFile(
  relativePath: unknown,
) {
  const relative =
    typeof relativePath === "string"
      ? relativePath.trim()
      : "";

  if (!relative) {
    throw new Error(
      "A relative file path is required.",
    );
  }

  const absolute =
    resolveWorkspacePath(relative);

  const stat =
    await fs.stat(absolute);

  if (!stat.isFile()) {
    throw new Error(
      "The requested path is not a file.",
    );
  }

  return {
    success: true,
    path: path.relative(
      getWorkspaceRoot(),
      absolute,
    ),
    content:
      await fs.readFile(
        absolute,
        "utf8",
      ),
  };
}

function decodeHtmlEntities(
  input: string,
): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function stripHtml(
  input: string,
): string {
  return decodeHtmlEntities(
    input
      .replace(
        /<br\s*\/?>/gi,
        " ",
      )
      .replace(
        /<[^>]*>/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim(),
  );
}

function decodeBingUrl(
  rawUrl: string,
): string {
  const decoded =
    decodeHtmlEntities(rawUrl);

  try {
    const url = new URL(
      decoded,
      "https://www.bing.com",
    );

    const target =
      url.searchParams.get("u");

    if (!target) {
      return decoded;
    }

    if (target.startsWith("a1")) {
      let encoded =
        target
          .slice(2)
          .replace(/-/g, "+")
          .replace(/_/g, "/");

      while (
        encoded.length % 4 !== 0
      ) {
        encoded += "=";
      }

      try {
        return atob(encoded);
      } catch {
        return decoded;
      }
    }

    try {
      return decodeURIComponent(
        target,
      );
    } catch {
      return target;
    }
  } catch {
    return decoded;
  }
}

async function webSearch(
  query: unknown,
) {
  const clean =
    typeof query === "string"
      ? query.trim()
      : "";

  if (!clean) {
    throw new Error(
      "A search query is required.",
    );
  }

  const response = await fetch(
    `https://www.bing.com/search?q=${encodeURIComponent(
      clean,
    )}&count=5&setlang=en`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Bing returned HTTP ${response.status}.`,
    );
  }

  const html =
    await response.text();

  const results: SearchResult[] =
    [];

  const regex =
    /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

  let match:
    RegExpExecArray | null;

  while (
    results.length < 5 &&
    (match = regex.exec(html))
  ) {
    const block = match[1];

    const titleMatch =
      block.match(
        /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
      );

    if (!titleMatch) {
      continue;
    }

    const snippetMatch =
      block.match(
        /<p[^>]*>([\s\S]*?)<\/p>/i,
      );

    const title =
      stripHtml(
        titleMatch[2],
      );

    const snippet =
      stripHtml(
        snippetMatch?.[1] || "",
      );

    const url =
      decodeBingUrl(
        titleMatch[1],
      );

    if (
      title &&
      url.startsWith("http")
    ) {
      results.push({
        title,
        snippet,
        url,
      });
    }
  }

  return {
    success:
      results.length > 0,
    query: clean,
    results,
  };
}

function limitText(
  value: unknown,
  maxChars = MAX_EMAIL_CHARS,
): string {
  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(
          value ?? "",
        );

  if (text.length <= maxChars) {
    return text;
  }

  return (
    text.slice(0, maxChars) +
    "\n...[truncated]"
  );
}

async function runHimalaya(
  args: string[],
) {
  if (!(await fileExists(
    HIMALAYA_EXE,
  ))) {
    throw new Error(
      `Himalaya executable not found at ${HIMALAYA_EXE}`,
    );
  }

  try {
    const result =
      await execFileAsync(
        HIMALAYA_EXE,
        args,
        {
          windowsHide: true,
          timeout: 60000,
          maxBuffer:
            4 * 1024 * 1024,
        } as Parameters<
          typeof execFileAsync
        >[2],
      );

    return {
      stdout:
        String(result.stdout).trim(),
      stderr:
        String(result.stderr).trim(),
    };
  } catch (error: unknown) {
    const err =
      error as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };

    const detail =
      String(
        err.stderr ||
          err.stdout ||
          err.message ||
          "Unknown Himalaya error",
      ).trim();

    throw new Error(
      `Himalaya email operation failed: ${detail}`,
    );
  }
}

async function fileExists(
  filePath: string,
): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseJson(
  text: string,
): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Himalaya returned invalid JSON: ${text.slice(
        0,
        500,
      )}`,
    );
  }
}

function normalizeEmailMessages(
  parsed: unknown,
): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (
    parsed &&
    typeof parsed === "object"
  ) {
    const object =
      parsed as Record<
        string,
        unknown
      >;

    if (
      Array.isArray(
        object.envelopes,
      )
    ) {
      return object.envelopes;
    }

    if (
      Array.isArray(
        object.messages,
      )
    ) {
      return object.messages;
    }
  }

  return [];
}

async function emailInbox(
  args: Record<string, unknown> = {},
) {
  const limit = Math.max(
    1,
    Math.min(
      25,
      Number(args.limit) || 10,
    ),
  );

  const query =
    typeof args.query === "string"
      ? args.query.trim()
      : "";

  const commandArgs = query
    ? [
        "envelope",
        "search",
        "--json",
        query,
      ]
    : [
        "envelope",
        "list",
        "--json",
      ];

  const result =
    await runHimalaya(
      commandArgs,
    );

  const parsed =
    parseJson(result.stdout);

  const messages =
    normalizeEmailMessages(
      parsed,
    ).slice(0, limit);

  return {
    success: true,
    count: messages.length,
    query: query || null,
    messages,
  };
}

async function emailRead(
  args: Record<string, unknown>,
) {
  const id =
    args.id == null
      ? ""
      : String(args.id).trim();

  if (!id) {
    throw new Error(
      "An email id is required.",
    );
  }

  const result =
    await runHimalaya([
      "message",
      "read",
      "--json",
      id,
    ]);

  return {
    success: true,
    id,
    message:
      limitText(
        parseJson(
          result.stdout,
        ),
      ),
  };
}

async function emailSend(
  args: Record<string, unknown>,
) {
  const to =
    typeof args.to === "string"
      ? args.to.trim()
      : "";

  const subject =
    typeof args.subject ===
    "string"
      ? args.subject.trim()
      : "";

  const body =
    typeof args.body === "string"
      ? args.body
      : "";

  if (
    !to ||
    !subject ||
    !body.trim()
  ) {
    throw new Error(
      "Recipient, subject, and body are required.",
    );
  }

  const result =
    await runHimalaya([
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

  return {
    success: true,
    to,
    subject,
    output:
      result.stdout ||
      "Email sent.",
  };
}

async function loadMemory() {
  try {
    const directory =
      getHermesMemoryDirectory();

    const entries =
      await fs.readdir(
        directory,
        {
          withFileTypes: true,
        },
      );

    let output = "";

    for (
      const entry of entries
        .filter(
          (entry) =>
            entry.isFile() &&
            /\.(md|txt|json)$/i.test(
              entry.name,
            ),
        )
        .slice(0, 5)
    ) {
      const content =
        await fs.readFile(
          path.join(
            directory,
            entry.name,
          ),
          "utf8",
        );

      const room =
        MAX_MEMORY_CHARS -
        output.length;

      if (room <= 0) {
        break;
      }

      output +=
        `\n[${entry.name}]\n` +
        content.slice(
          0,
          room,
        );
    }

    return output.trim();
  } catch {
    return "";
  }
}

async function callOllama(
  messages: IncomingMessage[],
): Promise<OllamaResponse> {
  let response: Response;

  try {
    response =
      await fetch(
        OLLAMA_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model: ARI_MODEL,
            messages,
            tools: TOOLS,
            stream: false,
            think: false,
          }),
          cache: "no-store",
        },
      );
  } catch {
    throw new Error(
      "Ollama is not reachable at 127.0.0.1:11434.",
    );
  }

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `Ollama returned HTTP ${response.status}: ${body.slice(
        0,
        500,
      )}`,
    );
  }

  return (
    (await response.json()) as OllamaResponse
  );
}

function visibleContent(
  message?: OllamaMessage,
): string {
  return (
    message?.content
      ?.replace(
        /<think>[\s\S]*?<\/think>/gi,
        "",
      )
      .trim() || ""
  );
}

function isInboxRequest(
  text: string,
): boolean {
  const normalized =
    text
      .toLowerCase()
      .replace(/[!?.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return [
    "check my email",
    "check my emails",
    "check my gmail",
    "check gmail",
    "show my email",
    "show my emails",
    "show my gmail",
    "show my inbox",
    "open my inbox",
    "read my inbox",
    "latest emails",
    "latest email",
    "recent emails",
    "recent email",
    "new emails",
    "new email",
    "what emails did i get",
    "what email did i get",
    "what did i get in my email",
  ].some(
    (phrase) =>
      normalized === phrase ||
      normalized.includes(
        phrase,
      ),
  );
}

function formatInbox(
  messages: unknown[],
): string {
  if (messages.length === 0) {
    return "Your inbox is empty.";
  }

  const lines: string[] = [
    `You have ${messages.length} recent emails:`,
    "",
  ];

  for (
    let index = 0;
    index < messages.length;
    index++
  ) {
    const item =
      messages[index];

    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }

    const email =
      item as Record<
        string,
        unknown
      >;

    const from =
      Array.isArray(
        email.from,
      )
        ? (
            email.from[0] as Record<
              string,
              unknown
            >
          )
        : null;

    const sender =
      from?.name ||
      from?.email ||
      "Unknown sender";

    const subject =
      typeof email.subject ===
      "string"
        ? email.subject
        : "(No subject)";

    const date =
      typeof email.date ===
      "string"
        ? email.date
        : "";

    lines.push(
      `${index + 1}. ${subject}`,
    );
    lines.push(
      `   From: ${sender}`,
    );

    if (date) {
      lines.push(
        `   Date: ${date}`,
      );
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
) {
  switch (name) {
    case "list_directory":
      return listDirectory(
        args.path,
      );

    case "read_file":
      return readFile(
        args.path,
      );

    case "web_search":
      return webSearch(
        args.query,
      );

    case "email_inbox":
      return emailInbox(args);

    case "email_read":
      return emailRead(args);

    case "email_send":
      return emailSend(args);

    default:
      throw new Error(
        `Unknown ARI tool: ${name}`,
      );
  }
}

function makeSseResponse(
  answer: string,
): Response {
  const encoder =
    new TextEncoder();

  const stream =
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    content: answer,
                  },
                },
              ],
            })}\n\n`,
          ),
        );

        controller.enqueue(
          encoder.encode(
            "data: [DONE]\n\n",
          ),
        );

        controller.close();
      },
    });

  return new Response(
    stream,
    {
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",
        "Cache-Control":
          "no-cache, no-transform",
        Connection:
          "keep-alive",
      },
    },
  );
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        messages?: IncomingMessage[];
      };

    const incoming =
      Array.isArray(body.messages)
        ? body.messages
        : [];

    const lastUser =
      [...incoming]
        .reverse()
        .find(
          (message) =>
            message.role ===
            "user",
        );

    const userText =
      lastUser?.content || "";

    /*
     * DETERMINISTIC GMAIL PATH
     *
     * Do not ask the 1.7B model whether
     * "check my email" means Gmail.
     * Call Himalaya directly.
     */
    if (
      isInboxRequest(userText)
    ) {
      const inbox =
        await emailInbox({
          limit: 10,
        });

      return makeSseResponse(
        formatInbox(
          inbox.messages,
        ),
      );
    }

    const memory =
      await loadMemory();

    const messages: IncomingMessage[] =
      [
        {
          role: "system",
          content:
            ARI_SYSTEM_PROMPT,
        },

        ...(memory
          ? [
              {
                role: "system",
                content:
                  `Persistent Hermes memory:\n${memory}`,
              } as IncomingMessage,
            ]
          : []),

        ...incoming,
      ];

    const ollama =
      await callOllama(
        messages,
      );

    let assistant =
      ollama.message;

    const toolCalls =
      assistant?.tool_calls || [];

    if (toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content:
          visibleContent(
            assistant,
          ),
        tool_calls:
          toolCalls,
      });

      for (
        const call of toolCalls
      ) {
        const name =
          call.function?.name ||
          "";

        const args =
          normalizeToolArguments(
            call.function?.arguments,
          );

        try {
          const result =
            await executeTool(
              name,
              args,
            );

          messages.push({
            role: "tool",
            tool_call_id:
              call.id || name,
            content:
              JSON.stringify({
                success: true,
                result:
                  limitText(
                    result,
                  ),
              }),
          });
        } catch (error: unknown) {
          const detail =
            error instanceof Error
              ? error.message
              : String(error);

          messages.push({
            role: "tool",
            tool_call_id:
              call.id || name,
            content:
              JSON.stringify({
                success: false,
                error: detail,
              }),
          });
        }
      }

      const final =
        await callOllama(
          messages,
        );

      assistant =
        final.message;
    }

    const answer =
      visibleContent(
        assistant,
      );

    if (!answer) {
      throw new Error(
        "Ollama returned no visible answer.",
      );
    }

    return makeSseResponse(
      answer,
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}