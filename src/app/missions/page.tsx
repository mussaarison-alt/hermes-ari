"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Terminal,
  XCircle,
} from "lucide-react";

import Sidebar from "../../components/sidebar";
import Topbar from "../../components/topbar";
import {
  createMission,
  getMissions,
  saveMissions,
  type Mission,
} from "../../lib/missions";

type Message = {
  role: "user" | "ari";
  content: string;
};

type ToolActivity = {
  id: string;
  tool: string;
  label?: string;
  status: "running" | "completed" | "error";
};

export default function MissionsPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ari",
      content:
        "Mission console initialized. Give me an objective and I'll determine the next action.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<ToolActivity[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    setMissions(getMissions());
  }, []);

  async function executeMission() {
    const text = input.trim();

    if (!text || loading) {
      return;
    }

    const history = [
      ...messages.map((message) => ({
        role: message.role === "ari" ? "assistant" : "user",
        content: message.content,
      })),
      {
        role: "user",
        content: text,
      },
    ];

    const mission = createMission(text);
    mission.status = "running";

    const existingMissions = getMissions();
    const startingMissions = [
      mission,
      ...existingMissions,
    ];

    setMissions(startingMissions);
    saveMissions(startingMissions);

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: text,
      },
    ]);

    setInput("");
    setLoading(true);
    setActivities([]);

    const toolNames: string[] = [];

    try {
      const response = await fetch("/api/ari", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: history,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      if (!response.body) {
        throw new Error("Hermes returned an empty stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let assistantText = "";

      setMessages((current) => [
        ...current,
        {
          role: "ari",
          content: "",
        },
      ]);

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();

          if (!line || !line.startsWith("data:")) {
            continue;
          }

          const jsonText = line.slice(5).trim();

          if (!jsonText || jsonText === "[DONE]") {
            continue;
          }

          try {
            const event = JSON.parse(jsonText);

            if (
              event.tool &&
              event.toolCallId &&
              event.status
            ) {
              const activity: ToolActivity = {
                id: event.toolCallId,
                tool: event.tool,
                label: event.label,
                status:
                  event.status === "completed"
                    ? "completed"
                    : event.status === "error"
                      ? "error"
                      : "running",
              };

              if (!toolNames.includes(event.tool)) {
                toolNames.push(event.tool);
              }

              setActivities((current) => {
                const existingIndex = current.findIndex(
                  (item) => item.id === activity.id
                );

                if (existingIndex === -1) {
                  return [...current, activity];
                }

                const updated = [...current];
                updated[existingIndex] = activity;

                return updated;
              });

              continue;
            }

            const delta =
              event?.choices?.[0]?.delta?.content;

            if (typeof delta === "string") {
              assistantText += delta;

              setMessages((current) => {
                const updated = [...current];
                const lastIndex = updated.length - 1;

                if (updated[lastIndex]?.role === "ari") {
                  updated[lastIndex] = {
                    role: "ari",
                    content: assistantText,
                  };
                }

                return updated;
              });
            }
          } catch {
            // Ignore malformed SSE chunks.
          }
        }
      }

      // Mission finished successfully.
      const completedMissions = getMissions().map(
        (savedMission) =>
          savedMission.id === mission.id
            ? {
                ...savedMission,
                status: "completed" as const,
                response: assistantText,
                completedAt: new Date().toISOString(),
                tools: toolNames,
              }
            : savedMission
      );

      setMissions(completedMissions);
      saveMissions(completedMissions);
    } catch (error) {
      console.error("ARI mission error:", error);

      // Mission failed.
      const failedMissions = getMissions().map(
        (savedMission) =>
          savedMission.id === mission.id
            ? {
                ...savedMission,
                status: "failed" as const,
                response:
                  "I couldn't complete the mission. Check that the Hermes gateway is running.",
                completedAt: new Date().toISOString(),
                tools: toolNames,
              }
            : savedMission
      );

      setMissions(failedMissions);
      saveMissions(failedMissions);

      setMessages((current) => [
        ...current,
        {
          role: "ari",
          content:
            "I couldn't complete the mission. Check that the Hermes gateway is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#07031f] text-white">
      <Sidebar />

      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <div className="flex flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-8 py-8">

            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#fff000]">
                Mission Control
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                ARI Mission Console
              </h1>

              <p className="mt-2 text-sm text-[#6f688f]">
                Give ARI instructions, monitor execution, and review results.
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d0730]">

              {/* STATUS */}

              <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
                <div className="flex items-center gap-3">

                  <span
                    className={`h-2 w-2 rounded-full ${
                      loading
                        ? "animate-pulse bg-[#fff000] shadow-[0_0_10px_#fff000]"
                        : "bg-[#00e5b0] shadow-[0_0_10px_#00e5b0]"
                    }`}
                  />

                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      loading
                        ? "text-[#fff000]"
                        : "text-[#00e5b0]"
                    }`}
                  >
                    {loading ? "ARI Processing" : "ARI Online"}
                  </span>

                </div>

                <span className="text-xs text-[#6f688f]">
                  Hermes Agent
                </span>
              </div>

              {/* CONTENT */}

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">

                  {/* TOOL ACTIVITY */}

                  {activities.length > 0 && (
                    <div className="rounded-2xl border border-[#00e5ff]/15 bg-[#07031f] p-4">

                      <div className="mb-3 flex items-center gap-2">

                        <Terminal
                          size={14}
                          className="text-[#00e5ff]"
                        />

                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                          ARI Activity
                        </p>

                      </div>

                      <div className="space-y-2">

                        {activities.map((activity) => {
                          const toolInfo = getToolInfo(
                            activity.tool,
                            activity.label
                          );

                          return (
                            <div
                              key={activity.id}
                              className="rounded-lg border border-white/[0.06] bg-[#0d0730] px-3 py-3"
                            >
                              <div className="flex items-center justify-between gap-4">

                                <div className="flex min-w-0 items-center gap-3">

                                  <span className="text-base">
                                    {toolInfo.icon}
                                  </span>

                                  <div className="min-w-0">

                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f688f]">
                                      {toolInfo.name}
                                    </p>

                                    <p className="mt-1 truncate text-xs text-[#d9d5e8]">
                                      {activity.label || activity.tool}
                                    </p>

                                  </div>

                                </div>

                                <div className="flex shrink-0 items-center gap-2">

                                  {activity.status === "running" && (
                                    <Loader2
                                      size={14}
                                      className="animate-spin text-[#fff000]"
                                    />
                                  )}

                                  {activity.status === "completed" && (
                                    <CheckCircle2
                                      size={14}
                                      className="text-[#00e5b0]"
                                    />
                                  )}

                                  {activity.status === "error" && (
                                    <XCircle
                                      size={14}
                                      className="text-[#ff69b7]"
                                    />
                                  )}

                                  <span
                                    className={`text-[9px] font-bold uppercase ${
                                      activity.status === "running"
                                        ? "text-[#fff000]"
                                        : activity.status === "completed"
                                          ? "text-[#00e5b0]"
                                          : "text-[#ff69b7]"
                                    }`}
                                  >
                                    {activity.status}
                                  </span>

                                </div>

                              </div>
                            </div>
                          );
                        })}

                      </div>
                    </div>
                  )}

                  {/* MESSAGES */}

                  {messages.map((message, index) => {
                    const isUser = message.role === "user";

                    return (
                      <div
                        key={`${message.role}-${index}`}
                        className={`max-w-3xl ${
                          isUser ? "ml-auto" : ""
                        }`}
                      >

                        <p
                          className={`mb-2 text-[10px] font-bold uppercase tracking-[0.2em] ${
                            isUser
                              ? "text-right text-[#fff000]"
                              : "text-[#00e5ff]"
                          }`}
                        >
                          {isUser ? "You" : "ARI"}
                        </p>

                        <div
                          className={`rounded-2xl border p-4 ${
                            isUser
                              ? "rounded-tr-sm border-[#fff000]/15 bg-[#110545]"
                              : "rounded-tl-sm border-[#00e5ff]/15 bg-[#07031f]"
                          }`}
                        >

                          {message.content ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#d9d5e8]">
                              {message.content}
                            </p>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e5ff]" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e5ff] [animation-delay:150ms]" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e5ff] [animation-delay:300ms]" />
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>

              {/* INPUT */}

              <div className="border-t border-white/[0.08] p-5">

                <div className="flex items-end gap-3 rounded-xl border border-white/[0.1] bg-[#07031f] p-3 focus-within:border-[#00e5ff]/30">

                  <textarea
                    rows={2}
                    value={input}
                    onChange={(event) =>
                      setInput(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        executeMission();
                      }
                    }}
                    placeholder="Give ARI a mission..."
                    disabled={loading}
                    className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-[#4f496d] disabled:opacity-50"
                  />

                  <button
                    onClick={executeMission}
                    disabled={loading || !input.trim()}
                    className="rounded-lg bg-[#fff000] px-5 py-3 text-xs font-bold text-[#110545] transition hover:bg-[#fff000]/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? "RUNNING..." : "EXECUTE →"}
                  </button>

                </div>

                <p className="mt-2 text-[10px] text-[#6f688f]">
                  Connected to Hermes Agent · Live tool activity
                </p>

              </div>

            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function getToolInfo(
  tool: string,
  label?: string
) {
  const normalized = tool.toLowerCase();

  if (
    normalized.includes("browser") ||
    normalized.includes("web")
  ) {
    return {
      icon: "🌐",
      name: "BROWSER",
    };
  }

  if (
    normalized.includes("file") ||
    normalized.includes("document")
  ) {
    return {
      icon: "📁",
      name: "FILES",
    };
  }

  if (
    normalized.includes("terminal") ||
    normalized.includes("shell") ||
    normalized.includes("command")
  ) {
    return {
      icon: "💻",
      name: "TERMINAL",
    };
  }

  if (
    normalized.includes("search") ||
    normalized.includes("research")
  ) {
    return {
      icon: "🔎",
      name: "RESEARCH",
    };
  }

  if (
    normalized.includes("code") ||
    normalized.includes("python")
  ) {
    return {
      icon: "⌘",
      name: "CODE",
    };
  }

  return {
    icon: "⚙️",
    name: label || tool.toUpperCase(),
  };
}