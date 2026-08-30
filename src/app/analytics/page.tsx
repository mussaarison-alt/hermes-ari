"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Layers3,
  ListChecks,
  XCircle,
  Zap,
} from "lucide-react";

import Sidebar from "../../components/sidebar";
import Topbar from "../../components/topbar";

type MissionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

type SavedMission = {
  id: string;
  objective: string;
  status: MissionStatus;
  response: string;
  createdAt: string;
  completedAt?: string;
  tools: string[];
};

const STORAGE_KEY =
  "hermes-ari-missions";

type DayActivity = {
  label: string;
  dateKey: string;
  value: number;
};

type ToolUsage = {
  name: string;
  count: number;
  percentage: number;
};

export default function AnalyticsPage() {
  const [missions, setMissions] =
    useState<SavedMission[]>([]);

  const [loaded, setLoaded] =
    useState(false);

  useEffect(() => {
    loadMissions();

    const handleStorage = () => {
      loadMissions();
    };

    window.addEventListener(
      "storage",
      handleStorage,
    );

    const interval =
      window.setInterval(
        loadMissions,
        2000,
      );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage,
      );

      window.clearInterval(
        interval,
      );
    };
  }, []);

  function loadMissions() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY,
        );

      if (!raw) {
        setMissions([]);
        setLoaded(true);
        return;
      }

      const parsed =
        JSON.parse(
          raw,
        ) as SavedMission[];

      setMissions(
        Array.isArray(parsed)
          ? parsed
          : [],
      );
    } catch {
      setMissions([]);
    } finally {
      setLoaded(true);
    }
  }

  const completedCount =
    useMemo(
      () =>
        missions.filter(
          (mission) =>
            mission.status ===
            "completed",
        ).length,
      [missions],
    );

  const failedCount =
    useMemo(
      () =>
        missions.filter(
          (mission) =>
            mission.status ===
            "failed",
        ).length,
      [missions],
    );

  const activeCount =
    useMemo(
      () =>
        missions.filter(
          (mission) =>
            mission.status ===
              "queued" ||
            mission.status ===
              "running",
        ).length,
      [missions],
    );

  const finishedCount =
    completedCount +
    failedCount;

  const successRate =
    finishedCount > 0
      ? (
          (completedCount /
            finishedCount) *
          100
        ).toFixed(1)
      : "—";

  const averageResponseTime =
    useMemo(() => {
      const durations =
        missions
          .filter(
            (mission) =>
              mission.status ===
                "completed" &&
              mission.completedAt,
          )
          .map((mission) => {
            const start =
              new Date(
                mission.createdAt,
              ).getTime();

            const end =
              new Date(
                mission.completedAt!,
              ).getTime();

            return end - start;
          })
          .filter(
            (duration) =>
              duration >= 0,
          );

      if (
        durations.length ===
        0
      ) {
        return "—";
      }

      const average =
        durations.reduce(
          (
            sum,
            duration,
          ) =>
            sum + duration,
          0,
        ) /
        durations.length;

      if (
        average <
        1000
      ) {
        return `${Math.round(
          average,
        )}ms`;
      }

      return `${(
        average / 1000
      ).toFixed(2)}s`;
    }, [missions]);

  const activityData =
    useMemo(
      () =>
        buildLastSevenDays(
          missions,
        ),
      [missions],
    );

  const maxActivity =
    Math.max(
      ...activityData.map(
        (item) =>
          item.value,
      ),
      1,
    );

  const toolUsage =
    useMemo(
      () =>
        buildToolUsage(
          missions,
        ),
      [missions],
    );

  const totalToolCalls =
    useMemo(
      () =>
        missions.reduce(
          (sum, mission) =>
            sum +
            mission.tools
              .length,
          0,
        ),
      [missions],
    );

  const averageToolsPerMission =
    missions.length > 0
      ? (
          totalToolCalls /
          missions.length
        ).toFixed(1)
      : "0";

  const recentActivity =
    useMemo(
      () =>
        [...missions]
          .sort(
            (a, b) =>
              new Date(
                b.createdAt,
              ).getTime() -
              new Date(
                a.createdAt,
              ).getTime(),
          )
          .slice(0, 6),
      [missions],
    );

  const latestMission =
    recentActivity[0];

  const latestMissionTime =
    latestMission
      ? formatRelativeTime(
          latestMission.createdAt,
        )
      : "No activity";

  return (
    <main className="flex h-screen overflow-hidden bg-[#07031f] text-white">

      <Sidebar />

      <section className="flex min-w-0 flex-1 flex-col">

        <Topbar />

        <div className="flex-1 overflow-y-auto">

          <div className="mx-auto w-full max-w-[1280px] px-8 py-8">

            {/* HEADER */}

            <div className="flex items-end justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#00e5ff]">
                  Intelligence
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  Analytics
                </h1>

                <p className="mt-2 text-sm text-[#6f688f]">
                  Live performance data from ARI missions.
                </p>

              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#0d0730] px-4 py-2.5 text-xs text-[#777099]">
                Last 7 days
              </div>

            </div>


            {/* SUMMARY */}

            <div className="mt-7 grid grid-cols-4 gap-4">

              <AnalyticsCard
                icon={Activity}
                label="Success Rate"
                value={
                  loaded
                    ? `${successRate}${
                        successRate !==
                        "—"
                          ? "%"
                          : ""
                      }`
                    : "—"
                }
                change={
                  finishedCount > 0
                    ? `${completedCount} of ${finishedCount} finished`
                    : "No completed missions"
                }
                direction="up"
                accent="teal"
              />

              <AnalyticsCard
                icon={Clock3}
                label="Avg Response"
                value={
                  loaded
                    ? averageResponseTime
                    : "—"
                }
                change={
                  averageResponseTime ===
                  "—"
                    ? "No completed timings"
                    : "Mission execution time"
                }
                direction="up"
                accent="cyan"
              />

              <AnalyticsCard
                icon={Zap}
                label="Tasks Executed"
                value={
                  loaded
                    ? String(
                        missions.length,
                      )
                    : "—"
                }
                change={
                  activeCount > 0
                    ? `${activeCount} active`
                    : "No active missions"
                }
                direction="up"
                accent="yellow"
              />

              <AnalyticsCard
                icon={Gauge}
                label="Failure Rate"
                value={
                  finishedCount >
                  0
                    ? `${(
                        (failedCount /
                          finishedCount) *
                        100
                      ).toFixed(
                        1,
                      )}%`
                    : "—"
                }
                change={
                  failedCount > 0
                    ? `${failedCount} failed`
                    : "No failures recorded"
                }
                direction="down"
                accent="raspberry"
              />

            </div>


            {/* ACTIVITY + STATUS */}

            <div className="mt-6 grid grid-cols-[2fr_1fr] gap-4">

              {/* ACTIVITY */}

              <section className="rounded-2xl border border-white/[0.1] bg-[#0d0730] p-6">

                <div className="flex items-start justify-between">

                  <div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#fff000]">
                      Activity
                    </p>

                    <h2 className="mt-2 text-lg font-bold">
                      Mission workload
                    </h2>

                    <p className="mt-1 text-xs text-[#6f688f]">
                      Real missions created each day.
                    </p>

                  </div>

                  <BarChart3
                    size={18}
                    className="text-[#00e5ff]"
                  />

                </div>


                {missions.length ===
                0 ? (

                  <EmptyState
                    icon={BarChart3}
                    title="No mission data yet"
                    detail="Execute missions to populate analytics."
                  />

                ) : (

                  <div className="mt-8 flex h-[250px] items-end gap-4">

                    {activityData.map(
                      (item) => {
                        const height =
                          item.value ===
                          0
                            ? "4%"
                            : `${Math.max(
                                (item.value /
                                  maxActivity) *
                                  100,
                                8,
                              )}%`;

                        return (
                          <div
                            key={
                              item.dateKey
                            }
                            className="flex h-full flex-1 flex-col items-center justify-end"
                          >

                            <div className="flex w-full flex-1 items-end">

                              <div
                                className="w-full rounded-t-lg bg-gradient-to-t from-[#110545] to-[#00e5ff]/70 transition hover:opacity-80"
                                style={{
                                  height,
                                }}
                                title={`${item.value} missions`}
                              />

                            </div>

                            <span className="mt-3 text-[10px] text-[#6f688f]">
                              {item.label}
                            </span>

                          </div>
                        );
                      },
                    )}

                  </div>

                )}

              </section>


              {/* MISSION STATUS */}

              <section className="rounded-2xl border border-white/[0.1] bg-[#0d0730] p-6">

                <div className="flex items-start justify-between">

                  <div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00e5b0]">
                      Missions
                    </p>

                    <h2 className="mt-2 text-lg font-bold">
                      Mission Status
                    </h2>

                  </div>

                  <Activity
                    size={18}
                    className="text-[#00e5b0]"
                  />

                </div>


                <div className="mt-7 space-y-5">

                  <StatusRow
                    icon={
                      CheckCircle2
                    }
                    label="Completed"
                    value={
                      completedCount
                    }
                    total={
                      missions.length
                    }
                    color="#00e5b0"
                  />

                  <StatusRow
                    icon={
                      XCircle
                    }
                    label="Failed"
                    value={
                      failedCount
                    }
                    total={
                      missions.length
                    }
                    color="#ff69b7"
                  />

                  <StatusRow
                    icon={
                      Activity
                    }
                    label="Active"
                    value={
                      activeCount
                    }
                    total={
                      missions.length
                    }
                    color="#fff000"
                  />

                </div>


                <div className="mt-7 rounded-xl border border-[#00e5b0]/10 bg-[#07031f] p-4">

                  <div className="flex items-center gap-2">

                    <span className="h-2 w-2 rounded-full bg-[#00e5b0] shadow-[0_0_10px_#00e5b0]" />

                    <span className="text-xs font-semibold text-[#00e5b0]">
                      {activeCount >
                      0
                        ? "Missions currently active"
                        : "No active missions"}
                    </span>

                  </div>

                  <p className="mt-2 text-[10px] text-[#6f688f]">
                    {latestMission
                      ? `Latest mission ${latestMissionTime}.`
                      : "Mission activity will appear here."}
                  </p>

                </div>

              </section>

            </div>


            {/* TOOLS + RECENT */}

            <div className="mt-6 grid grid-cols-2 gap-4">

              {/* TOOL USAGE */}

              <section className="rounded-2xl border border-white/[0.1] bg-[#0d0730] p-6">

                <div className="flex items-start justify-between">

                  <div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#a0025c]">
                      Operations
                    </p>

                    <h2 className="mt-2 text-lg font-bold">
                      Tool Usage
                    </h2>

                    <p className="mt-1 text-xs text-[#6f688f]">
                      Tools recorded by completed mission history.
                    </p>

                  </div>

                  <Layers3
                    size={18}
                    className="text-[#ff69b7]"
                  />

                </div>


                {toolUsage.length ===
                0 ? (

                  <EmptyState
                    icon={Layers3}
                    title="No tool usage recorded"
                    detail="Missions with recorded tools will appear here."
                  />

                ) : (

                  <div className="mt-7 space-y-5">

                    {toolUsage.map(
                      (tool) => (
                        <div
                          key={
                            tool.name
                          }
                        >

                          <div className="flex items-center justify-between">

                            <div>

                              <p className="text-sm font-semibold text-white">
                                {tool.name}
                              </p>

                              <p className="mt-1 text-[10px] text-[#6f688f]">
                                {tool.count} calls
                              </p>

                            </div>

                            <p className="text-sm font-bold text-white">
                              {tool.percentage.toFixed(
                                0,
                              )}%
                            </p>

                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#07031f]">

                            <div
                              className="h-full rounded-full bg-[#ff69b7]"
                              style={{
                                width: `${tool.percentage}%`,
                              }}
                            />

                          </div>

                        </div>
                      ),
                    )}

                  </div>

                )}

              </section>


              {/* RECENT */}

              <section className="rounded-2xl border border-white/[0.1] bg-[#0d0730] p-6">

                <div className="flex items-start justify-between">

                  <div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00e5ff]">
                      Activity Feed
                    </p>

                    <h2 className="mt-2 text-lg font-bold">
                      Recent Missions
                    </h2>

                  </div>

                  <Database
                    size={18}
                    className="text-[#00e5ff]"
                  />

                </div>


                {recentActivity.length ===
                0 ? (

                  <EmptyState
                    icon={ListChecks}
                    title="No recent missions"
                    detail="Your latest missions will appear here."
                  />

                ) : (

                  <div className="mt-5">

                    {recentActivity.map(
                      (
                        mission,
                      ) => (

                        <div
                          key={
                            mission.id
                          }
                          className="flex items-center justify-between border-b border-white/[0.06] py-4 last:border-0"
                        >

                          <div className="flex min-w-0 items-center gap-3">

                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                mission.status ===
                                "running"
                                  ? "bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"
                                  : mission.status ===
                                    "queued"
                                  ? "bg-[#fff000] shadow-[0_0_8px_#fff000]"
                                  : mission.status ===
                                    "failed"
                                  ? "bg-[#ff69b7] shadow-[0_0_8px_#ff69b7]"
                                  : "bg-[#00e5b0] shadow-[0_0_8px_#00e5b0]"
                              }`}
                            />

                            <div className="min-w-0">

                              <p className="truncate text-sm font-semibold text-white">
                                {mission.objective ||
                                  "Untitled mission"}
                              </p>

                              <p className="mt-1 truncate text-[10px] capitalize text-[#6f688f]">
                                {mission.status}
                                {" · "}
                                {formatRelativeTime(
                                  mission.createdAt,
                                )}
                              </p>

                            </div>

                          </div>

                          <span
                            className={`ml-4 shrink-0 text-[10px] font-semibold ${
                              mission.status ===
                              "completed"
                                ? "text-[#00e5b0]"
                                : mission.status ===
                                  "failed"
                                ? "text-[#ff69b7]"
                                : mission.status ===
                                  "running"
                                ? "text-[#00e5ff]"
                                : "text-[#fff000]"
                            }`}
                          >
                            {capitalize(
                              mission.status,
                            )}
                          </span>

                        </div>

                      ),
                    )}

                  </div>

                )}

              </section>

            </div>


            {/* OPERATIONAL METRICS */}

            <div className="mt-6 grid grid-cols-3 gap-4">

              <MiniMetric
                icon={Database}
                label="Missions Stored"
                value={
                  loaded
                    ? String(
                        missions.length,
                      )
                    : "—"
                }
                detail="Local mission history"
                accent="#00e5ff"
              />

              <MiniMetric
                icon={Layers3}
                label="Tool Calls"
                value={
                  loaded
                    ? String(
                        totalToolCalls,
                      )
                    : "—"
                }
                detail={
                  missions.length >
                  0
                    ? `${averageToolsPerMission} per mission`
                    : "No mission data"
                }
                accent="#fff000"
              />

              <MiniMetric
                icon={Gauge}
                label="Availability"
                value={
                  activeCount >
                  0
                    ? "ACTIVE"
                    : missions.length >
                      0
                    ? "IDLE"
                    : "—"
                }
                detail="Based on current mission state"
                accent="#00e5b0"
              />

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}


function AnalyticsCard({
  icon: Icon,
  label,
  value,
  change,
  direction,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  change: string;
  direction: "up" | "down";
  accent:
    | "yellow"
    | "cyan"
    | "teal"
    | "raspberry";
}) {
  const color = {
    yellow: "#fff000",
    cyan: "#00e5ff",
    teal: "#00e5b0",
    raspberry: "#ff69b7",
  }[accent];

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-[#0d0730] p-5">

      <div className="flex items-center justify-between">

        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6f688f]">
          {label}
        </p>

        <Icon
          size={17}
          style={{ color }}
        />

      </div>

      <div className="mt-5 flex items-end justify-between gap-3">

        <p className="text-3xl font-bold text-white">
          {value}
        </p>

        <span
          className={`flex items-center gap-1 text-right text-[10px] font-semibold ${
            accent ===
            "raspberry"
              ? "text-[#ff69b7]"
              : "text-[#00e5b0]"
          }`}
        >

          {direction ===
          "up" ? (
            <ArrowUpRight
              size={13}
            />
          ) : (
            <ArrowDownRight
              size={13}
            />
          )}

          {change}

        </span>

      </div>

    </div>
  );
}


function StatusRow({
  icon: Icon,
  label,
  value,
  total,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage =
    total > 0
      ? (value / total) *
        100
      : 0;

  return (
    <div>

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">

          <Icon
            size={14}
            style={{
              color,
            }}
          />

          <span className="text-xs text-[#a9a3c4]">
            {label}
          </span>

        </div>

        <span className="text-xs font-semibold text-white">
          {value}
        </span>

      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#07031f]">

        <div
          className="h-full rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor:
              color,
          }}
        />

      </div>

    </div>
  );
}


function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ElementType;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-[180px] items-center justify-center text-center">

      <div>

        <Icon
          size={26}
          className="mx-auto text-[#4f496d]"
        />

        <p className="mt-3 text-sm font-semibold text-white">
          {title}
        </p>

        <p className="mt-2 text-xs text-[#6f688f]">
          {detail}
        </p>

      </div>

    </div>
  );
}


function MiniMetric({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.1] bg-[#0d0730] p-5">

      <div className="flex items-center gap-3">

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#07031f]">

          <Icon
            size={17}
            style={{
              color: accent,
            }}
          />

        </div>

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6f688f]">
            {label}
          </p>

          <p className="mt-1 text-lg font-bold text-white">
            {value}
          </p>

        </div>

      </div>

      <p className="mt-3 text-[10px] text-[#6f688f]">
        {detail}
      </p>

    </div>
  );
}


function buildLastSevenDays(
  missions: SavedMission[],
): DayActivity[] {
  const result: DayActivity[] =
    [];

  for (
    let offset = 6;
    offset >= 0;
    offset -= 1
  ) {
    const date = new Date();

    date.setHours(
      0,
      0,
      0,
      0,
    );

    date.setDate(
      date.getDate() -
        offset,
    );

    const dateKey =
      toDateKey(date);

    const value =
      missions.filter(
        (mission) =>
          toDateKey(
            new Date(
              mission.createdAt,
            ),
          ) === dateKey,
      ).length;

    result.push({
      label:
        date.toLocaleDateString(
          undefined,
          {
            weekday: "short",
          },
        ),
      dateKey,
      value,
    });
  }

  return result;
}


function buildToolUsage(
  missions: SavedMission[],
): ToolUsage[] {
  const counts =
    new Map<string, number>();

  for (const mission of missions) {
    for (const tool of mission.tools ||
      []) {
      const name =
        tool.trim();

      if (!name) {
        continue;
      }

      counts.set(
        name,
        (counts.get(
          name,
        ) || 0) + 1,
      );
    }
  }

  const total =
    Array.from(
      counts.values(),
    ).reduce(
      (sum, count) =>
        sum + count,
      0,
    );

  if (total === 0) {
    return [];
  }

  return Array.from(
    counts.entries(),
  )
    .map(
      ([name, count]) => ({
        name,
        count,
        percentage:
          (count / total) *
          100,
      }),
    )
    .sort(
      (a, b) =>
        b.count -
        a.count,
    )
    .slice(0, 6);
}


function toDateKey(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatRelativeTime(
  value: string,
) {
  const timestamp =
    new Date(
      value,
    ).getTime();

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return "Unknown";
  }

  const difference =
    Date.now() -
    timestamp;

  const minutes =
    Math.floor(
      difference / 60000,
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  if (days === 1) {
    return "Yesterday";
  }

  return `${days}d ago`;
}


function capitalize(
  value: string,
) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}