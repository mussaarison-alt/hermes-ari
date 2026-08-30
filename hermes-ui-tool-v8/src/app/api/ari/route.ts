import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { getHermesMemoryDirectory } from "../../../lib/hermes-runtime";

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const ARI_MODEL = "qwen3:1.7b";
const MAX_MEMORY_CHARS = 3_000;

const DEFAULT_WORKSPACE = path.join(
  os.homedir(),
  "Desktop",
  "ARI-workspace",
);

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
- Use web_search for software versions, current events, current office holders, recent news, prices, releases, and other facts that can change.
- When current web results are supplied to you, treat them as the source of truth for the answer.
- Do not replace current search results with older information from model memory.

WORKSPACE TOOLS
- You can inspect the user's sandbox workspace with list_directory.
- You can read text files inside the sandbox workspace with read_file.
- Only use the provided workspace tools for filesystem inspection.
- When the user asks for file contents, you MUST use read_file before answering.
- Never claim to have read or modified a file unless a tool result proves it.
- Do not request or invent absolute filesystem paths outside the tool boundary.
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
  tool_calls?: ToolCall[];
};

type OllamaResponse = {
  message?: OllamaMessage;
  done?: boolean;
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
        "List files and directories inside ARI's allowed sandbox workspace. Use this when the user asks what is in their ARI workspace or asks you to inspect its directory contents.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Optional relative path inside the ARI workspace. Leave empty to list the workspace root.",
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
        "Read the UTF-8 text contents of a file inside ARI's allowed sandbox workspace. Use this whenever the user asks to read, quote, summarize, or explain a file by name or path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative file path inside the ARI workspace, such as notes.txt. Do not use absolute paths.",
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
        "Search the web for current information. Use when the user asks about recent events, latest versions, live data, current office holders, or anything that may be outside model knowledge.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query.",
          },
        },
        required: ["query"],
      },
    },
  },
];

function getWorkspaceRoot() {
  const configured =
    process.env.ARI_WORKSPACE?.trim();

  return path.resolve(
    configured || DEFAULT_WORKSPACE,
  );
}

function normalizeToolArguments(
  raw: unknown,
): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  if (
    typeof raw === "object" &&
    !Array.isArray(raw)
  ) {
    return raw as Record<
      string,
      unknown
    >;
  }

  if (typeof raw === "string") {
    try {
      const parsed =
        JSON.parse(raw) as unknown;

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<
          string,
          unknown
        >;
      }
    } catch {
      // Ignore malformed arguments.
    }
  }

  return {};
}

function resolveWorkspacePath(
  relativePath: unknown,
) {
  const root = getWorkspaceRoot();

  const candidate =
    typeof relativePath === "string" &&
    relativePath.trim()
      ? relativePath.trim()
      : ".";

  const absolute =
    path.resolve(
      root,
      candidate,
    );

  const relative =
    path.relative(
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
  const root =
    getWorkspaceRoot();

  await fs.mkdir(root, {
    recursive: true,
  });

  const absolute =
    resolveWorkspacePath(
      relativePath,
    );

  const entries =
    await fs.readdir(
      absolute,
      {
        withFileTypes: true,
      },
    );

  return {
    success: true,
    workspace: root,
    path:
      path.relative(
        root,
        absolute,
      ) || ".",
    entries: entries
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
        ),
      )
      .map((entry) => ({
        name: entry.name,
        type:
          entry.isDirectory()
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
    resolveWorkspacePath(
      relative,
    );

  const stat =
    await fs.stat(
      absolute,
    );

  if (!stat.isFile()) {
    throw new Error(
      "The requested workspace path is not a file.",
    );
  }

  const content =
    await fs.readFile(
      absolute,
      "utf8",
    );

  return {
    success: true,
    workspace:
      getWorkspaceRoot(),
    path:
      path.relative(
        getWorkspaceRoot(),
        absolute,
      ),
    content,
  };
}

function decodeHtmlEntities(
  input: string,
) {
  return input
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&#x27;/gi,
      "'",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    );
}

function stripHtml(
  input: string,
) {
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
) {
  const decodedUrl =
    decodeHtmlEntities(
      rawUrl,
    );

  try {
    const url = new URL(
      decodedUrl,
      "https://www.bing.com",
    );

    const redirectTarget =
      url.searchParams.get("u");

    if (!redirectTarget) {
      return decodedUrl;
    }

    if (
      redirectTarget.startsWith(
        "a1",
      )
    ) {
      let encoded =
        redirectTarget.slice(2);

      encoded =
        encoded.replace(
         (/-/g, "+"),
        ).replace(
          /_/g,
          "/",
        );

      while (
        encoded.length % 4 !==
        0
      ) {
        encoded += "=";
      }

      try {
        return atob(encoded);
      } catch {
        return decodedUrl;
      }
    }

    try {
      return decodeURIComponent(
        redirectTarget,
      );
    } catch {
      return redirectTarget;
    }
  } catch {
    return decodedUrl;
  }
}

async function webSearch(
  query: unknown,
) {
  const cleanQuery =
    typeof query === "string"
      ? query.trim()
      : "";

  if (!cleanQuery) {
    throw new Error(
      "A search query is required.",
    );
  }

  console.log(
    `[ARI tool] web_search query="${cleanQuery}"`,
  );

  const searchUrl =
    `https://www.bing.com/search?q=${encodeURIComponent(
      cleanQuery,
    )}&count=5&setlang=en`;

  const response =
    await fetch(
      searchUrl,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language":
            "en-US,en;q=0.9",
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

  const blockRegex =
    /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

  let blockMatch:
    RegExpExecArray | null;

  while (
    results.length < 5 &&
    (blockMatch =
      blockRegex.exec(html))
  ) {
    const block =
      blockMatch[1];

    const titleMatch =
      block.match(
        /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i,
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
        snippetMatch?.[1] ||
          "",
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

  console.log(
    `[ARI tool] web_search results=${results.length}`,
  );

  return {
    success:
      results.length > 0,
    query: cleanQuery,
    results,
    message:
      results.length > 0
        ? undefined
        : "Bing returned no parseable organic results.",
  };
}

function shouldForceWebSearch(
  text: string,
) {
  const query =
    text
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  if (!query) {
    return false;
  }

  const explicitCurrentPatterns = [
    /\blatest\b/,
    /\bcurrent\b/,
    /\bcurrently\b/,
    /\brecent\b/,
    /\brecently\b/,
    /\btoday\b/,
    /\btonight\b/,
    /\byesterday\b/,
    /\bthis week\b/,
    /\bthis month\b/,
    /\bthis year\b/,
    /\bnow\b/,
    /\blive\b/,
    /\bnewest\b/,
    /\bmost recent\b/,
    /\bwhat's new\b/,
    /\bwhat is new\b/,
    /\bwho is the current\b/,
    /\bwho's the current\b/,
  ];

  if (
    explicitCurrentPatterns.some(
      (pattern) =>
        pattern.test(query),
    )
  ) {
    return true;
  }

  const volatileTopics = [
    /\bpresident\b/,
    /\bprime minister\b/,
    /\belection\b/,
    /\belections\b/,
    /\bceo\b/,
    /\bweather\b/,
    /\bstock price\b/,
    /\bstock market\b/,
    /\bmarket price\b/,
    /\bbitcoin price\b/,
    /\bcrypto price\b/,
    /\bexchange rate\b/,
    /\bnext\.?js\b.*\brelease\b/,
    /\brelease\b.*\bnext\.?js\b/,
    /\bversion\b.*\bnext\.?js\b/,
    /\bnext\.?js\b.*\bversion\b/,
    /\bnews\b/,
    /\bwho won\b/,
    /\bscore\b/,
    /\bscores\b/,
    /\bstandings\b/,
  ];

  const asksForFreshFact =
    /\bwho is\b/.test(query) ||
    /\bwho's\b/.test(query) ||
    /\bwhat is\b/.test(query) ||
    /\bwhat's\b/.test(query);

  return (
    asksForFreshFact &&
    volatileTopics.some(
      (pattern) =>
        pattern.test(query),
    )
  );
}

function formatSearchContext(
  searchResult: Awaited<
    ReturnType<typeof webSearch>
  >,
) {
  if (
    !searchResult.success ||
    !searchResult.results.length
  ) {
    return `CURRENT WEB SEARCH
Query: ${searchResult.query}
No parseable web results were returned.

Do not invent a current answer. Tell the user that the web search did not return usable results.`;
  }

  const lines =
    searchResult.results.map(
      (result, index) =>
        `${index + 1}. ${result.title}\n${result.snippet}\nURL: ${result.url}`,
    );

  return `CURRENT WEB SEARCH RESULTS
Query: ${searchResult.query}

${lines.join("\n\n")}

Answer the user's question using these current results. Do not substitute older model knowledge for the supplied results.`;
}

async function executeTool(
  toolCall: ToolCall,
) {
  const name =
    toolCall.function?.name;

  const args =
    normalizeToolArguments(
      toolCall.function?.arguments,
    );

  console.log(
    `[ARI tool] ${name || "(missing)"} args=${JSON.stringify(
      args,
    )}`,
  );

  try {
    if (
      name === "list_directory"
    ) {
      return await listDirectory(
        args.path,
      );
    }

    if (
      name === "read_file"
    ) {
      return await readFile(
        args.path,
      );
    }

    if (
      name === "web_search"
    ) {
      return await webSearch(
        args.query,
      );
    }

    return {
      success: false,
      error:
        `Unknown tool: ${name || "(missing)"}`,
    };
  } catch (error) {
    console.error(
      `[ARI tool error] ${name || "(missing)"}`,
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tool execution failed.",
    };
  }
}

async function loadPersistentMemory(): Promise<string> {
  const directory =
    getHermesMemoryDirectory();

  const [
    memory,
    user,
  ] =
    await Promise.all(
      [
        "MEMORY.md",
        "USER.md",
      ].map(
        async (filename) => {
          try {
            return await fs.readFile(
              path.join(
                directory,
                filename,
              ),
              "utf8",
            );
          } catch {
            return "";
          }
        },
      ),
    );

  const sections = [
    memory.trim()
      ? `MEMORY.md\n${memory.trim()}`
      : "",
    user.trim()
      ? `USER.md\n${user.trim()}`
      : "",
  ].filter(Boolean);

  return sections
    .join("\n\n")
    .slice(
      0,
      MAX_MEMORY_CHARS,
    );
}

function sseResponse(
  content: string,
) {
  const encoder =
    new TextEncoder();

  const payload =
    `data: ${JSON.stringify({
      id: "chatcmpl-ari",
      object:
        "chat.completion.chunk",
      model: ARI_MODEL,
      choices: [
        {
          index: 0,
          delta: {
            content,
          },
          finish_reason:
            null,
        },
      ],
    })}\n\n` +
    `data: ${JSON.stringify({
      id: "chatcmpl-ari",
      object:
        "chat.completion.chunk",
      model: ARI_MODEL,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason:
            "stop",
        },
      ],
    })}\n\n` +
    `data: [DONE]\n\n`;

  return new Response(
    payload,
    {
      status: 200,
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",
        "Cache-Control":
          "no-cache, no-transform",
        Connection:
          "keep-alive",
        "X-Accel-Buffering":
          "no",
      },
    },
  );
}

async function askOllama(
  messages: IncomingMessage[],
  stream: boolean,
  voice: boolean,
) {
  return fetch(
    OLLAMA_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        model: ARI_MODEL,

        messages:
          messages.map(
            (message) => {
              if (
                voice &&
                message.role ===
                  "user" &&
                !message.content.endsWith(
                  "/no_think",
                )
              ) {
                return {
                  ...message,
                  content:
                    `${message.content} /no_think`,
                };
              }

              return message;
            },
          ),

        tools: TOOLS,
        stream,
        think: false,
        keep_alive: -1,

        options: {
          temperature:
            voice
              ? 0.2
              : 0.4,
          top_k: 20,
          top_p: 0.9,

          ...(voice
            ? {
                num_predict: 24,
                num_ctx: 4096,
              }
            : {}),
        },
      }),
      cache: "no-store",
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
        voice?: boolean;
      };

    const persistentMemory =
      await loadPersistentMemory();

    const incomingMessages =
      Array.isArray(body.messages)
        ? body.messages.filter(
            (message) =>
              message &&
              typeof message.role ===
                "string" &&
              typeof message.content ===
                "string",
          )
        : [];

    const isVoiceRequest =
      body.voice === true;

    const memoryContext =
      persistentMemory
        ? `\n\nPERSISTENT MEMORY\nUse the following user-approved Hermes memory as context. Do not invent memories and do not disclose the storage mechanism unless asked.\n\n${persistentMemory}`
        : "";

    const boundedMessages =
      isVoiceRequest
        ? incomingMessages
            .slice(-4)
            .map(
              (message) => ({
                ...message,
                content:
                  message.content.slice(
                    -700,
                  ),
              }),
            )
        : incomingMessages;

    const latestUserMessage =
      [...boundedMessages]
        .reverse()
        .find(
          (message) =>
            message.role === "user",
        );

    let messages:
      IncomingMessage[] = [
      {
        role: "system",
        content:
          isVoiceRequest
            ? `You are ARI. Reply naturally, directly, and briefly.
- No analysis or reasoning.
- Usually 1-2 short sentences.
- Answer the user's request immediately.
- Use web_search for current, latest, recent, live, or time-sensitive information.
- Use list_directory only when the user's request actually requires inspecting the ARI workspace.
${memoryContext}`
            : `${ARI_SYSTEM_PROMPT}${memoryContext}`,
      },
      ...boundedMessages,
    ];

    /*
     * Deterministic current-information routing.
     *
     * This is intentionally performed before the model's first pass.
     * A small local model should not be trusted to decide whether stale
     * training knowledge is acceptable for a time-sensitive question.
     */
    if (
      latestUserMessage &&
      shouldForceWebSearch(
        latestUserMessage.content,
      )
    ) {
      console.log(
        `[ARI router] forcing web_search for: "${latestUserMessage.content}"`,
      );

      try {
        const searchResult =
          await webSearch(
            latestUserMessage.content,
          );

        messages = [
          ...messages,
          {
            role: "system",
            content:
              formatSearchContext(
                searchResult,
              ),
          },
        ];
      } catch (error) {
        console.error(
          "[ARI router] forced web search failed",
          error,
        );

        messages = [
          ...messages,
          {
            role: "system",
            content:
              "CURRENT WEB SEARCH FAILED. Do not invent a current answer. Tell the user that live search failed.",
          },
        ];
      }
    }

    const planningResponse =
      await askOllama(
        messages,
        false,
        isVoiceRequest,
      );

    if (
      !planningResponse.ok
    ) {
      const errorText =
        await planningResponse.text();

      return NextResponse.json(
        {
          error:
            errorText ||
            `Ollama returned HTTP ${planningResponse.status}.`,
        },
        {
          status:
            planningResponse.status,
        },
      );
    }

    const planning =
      (await planningResponse.json()) as OllamaResponse;

    const plannedMessage =
      planning.message;

    const toolCalls =
      Array.isArray(
        plannedMessage?.tool_calls,
      )
        ? plannedMessage.tool_calls
        : [];

    if (
      !toolCalls.length
    ) {
      return sseResponse(
        plannedMessage?.content ||
          "",
      );
    }

    const toolMessages:
      IncomingMessage[] = [
      ...messages,
    ];

    if (plannedMessage) {
      toolMessages.push({
        role: "assistant",
        content:
          plannedMessage.content ||
          "",
        tool_calls:
          toolCalls,
      });
    }

    for (
      const toolCall of toolCalls
    ) {
      const result =
        await executeTool(
          toolCall,
        );

      toolMessages.push({
        role: "tool",
        tool_call_id:
          toolCall.id,
        content:
          JSON.stringify(
            result,
          ),
      });
    }

    const finalResponse =
      await askOllama(
        toolMessages,
        true,
        isVoiceRequest,
      );

    if (
      !finalResponse.ok ||
      !finalResponse.body
    ) {
      const errorText =
        await finalResponse.text();

      return NextResponse.json(
        {
          error:
            errorText ||
            `Ollama returned HTTP ${finalResponse.status}.`,
        },
        {
          status:
            finalResponse.ok
              ? 502
              : finalResponse.status,
        },
      );
    }

    const reader =
      finalResponse.body.getReader();

    const decoder =
      new TextDecoder();

    const encoder =
      new TextEncoder();

    const stream =
      new ReadableStream({
        async start(
          controller,
        ) {
          let buffer = "";

          try {
            while (true) {
              const {
                done,
                value,
              } =
                await reader.read();

              if (done) {
                break;
              }

              buffer +=
                decoder.decode(
                  value,
                  {
                    stream: true,
                  },
                );

              const lines =
                buffer.split(
                  /\r?\n/,
                );

              buffer =
                lines.pop() ??
                "";

              for (
                const raw of lines
              ) {
                if (
                  !raw.trim()
                ) {
                  continue;
                }

                try {
                  const chunk =
                    JSON.parse(
                      raw,
                    ) as OllamaResponse;

                  const content =
                    chunk.message
                      ?.content ??
                    "";

                  if (content) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          id: "chatcmpl-ari",
                          object:
                            "chat.completion.chunk",
                          model:
                            ARI_MODEL,
                          choices: [
                            {
                              index: 0,
                              delta: {
                                content,
                              },
                              finish_reason:
                                null,
                            },
                          ],
                        })}\n\n`,
                      ),
                    );
                  }

                  if (
                    chunk.done
                  ) {
                    controller.enqueue(
                      encoder.encode(
                        "data: [DONE]\n\n",
                      ),
                    );
                  }
                } catch {
                  // Ignore malformed JSONL fragments.
                }
              }
            }

            controller.close();
          } catch (error) {
            controller.error(
              error,
            );
          } finally {
            reader.releaseLock();
          }
        },
      });

    return new Response(
      stream,
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/event-stream; charset=utf-8",
          "Cache-Control":
            "no-cache, no-transform",
          Connection:
            "keep-alive",
          "X-Accel-Buffering":
            "no",
        },
      },
    );
  } catch (error) {
    console.error(
      "ARI API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to ARI.",
      },
      {
        status: 500,
      },
    );
  }
}