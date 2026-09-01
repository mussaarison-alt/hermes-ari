"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import {
  CheckCircle2,
  Clock3,
  ListTodo,
  MoreHorizontal,
  Play,
  Plus,
  Search,
} from "lucide-react";

import Sidebar from "../../components/sidebar";
import { getMissions, type Mission } from "../../lib/missions";
import Topbar from "../../components/topbar";

export default function TasksPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "queued">("all");
  const [query, setQuery] = useState("");

  function loadMissions() {
    setMissions(getMissions());
  }

  useEffect(() => {
    loadMissions();
    const handleStorage = () => loadMissions();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return missions.filter((mission) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" &&
          (mission.status === "running" || mission.status === "queued")) ||
        (filter === "completed" && mission.status === "completed") ||
        (filter === "queued" && mission.status === "queued");

      const matchesQuery =
        !normalized ||
        mission.objective.toLowerCase().includes(normalized) ||
        mission.response.toLowerCase().includes(normalized);

      return matchesFilter && matchesQuery;
    });
  }, [missions, filter, query]);

  const total = missions.length;
  const active = missions.filter((m) => m.status === "running").length;
  const completed = missions.filter((m) => m.status === "completed").length;
  const queued = missions.filter((m) => m.status === "queued").length;

  return (
    <main className="flex h-screen overflow-hidden bg-white text-white">
      <Sidebar />

      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1280px] px-8 py-8">

            {/* HEADER */}

            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#fff000]">
                  Operations
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  Task Center
                </h1>

                <p className="mt-2 text-sm text-black/45">
                  Monitor, organize, and manage ARI tasks.
                </p>
              </div>

              <Link
                href="/missions"
                className="flex items-center gap-2 rounded-xl border border-[#fff000]/60 bg-[#fff000]/[0.06] px-5 py-2.5 text-sm font-semibold text-[#fff000] transition hover:bg-[#fff000]/[0.12]"
              >
                <Plus size={16} />
                New Task
              </Link>
            </div>

            {/* SUMMARY */}

            <div className="mt-7 grid grid-cols-4 gap-4">
              <SummaryCard
                icon={ListTodo}
                label="Total Tasks"
                value={String(total)}
                accent="yellow"
              />

              <SummaryCard
                icon={Play}
                label="In Progress"
                value={String(active)}
                accent="cyan"
              />

              <SummaryCard
                icon={CheckCircle2}
                label="Completed"
                value={String(completed)}
                accent="teal"
              />

              <SummaryCard
                icon={Clock3}
                label="Queued"
                value={String(queued)}
                accent="yellow"
              />
            </div>

            {/* FILTER BAR */}

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/[0.1] bg-white/70 p-4">

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                    filter === "all"
                      ? "bg-[#fff000]/[0.08] text-[#fff000]"
                      : "text-[#777099] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  All
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("active")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                    filter === "active"
                      ? "bg-[#fff000]/[0.08] text-[#fff000]"
                      : "text-[#777099] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  Active
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("completed")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                    filter === "completed"
                      ? "bg-[#fff000]/[0.08] text-[#fff000]"
                      : "text-[#777099] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  Completed
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("queued")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                    filter === "queued"
                      ? "bg-[#fff000]/[0.08] text-[#fff000]"
                      : "text-[#777099] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  Queued
                </button>
              </div>

              <div className="flex h-9 w-[250px] items-center gap-2 rounded-lg border border-white/[0.08] bg-white px-3">
                <Search
                  size={15}
                  className="text-black/45"
                />

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tasks..."
                  className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[#4f496d]"
                />
              </div>
            </div>

            {/* TASK LIST */}

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/70">

              <div className="grid grid-cols-[1fr_120px_120px_100px_50px] border-b border-white/[0.08] px-5 py-4 text-[10px] font-semibold uppercase tracking-wider text-black/45">
                <span>Task</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Updated</span>
                <span />
              </div>

              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="grid grid-cols-[1fr_120px_120px_100px_50px] items-center border-b border-white/[0.06] px-5 py-5 last:border-0"
                >
                  <div className="min-w-0 pr-5">
                    <p className="truncate text-sm font-semibold text-white">
                      {task.objective}
                    </p>

                    <p className="mt-1 truncate text-xs text-black/45">
                      {task.response || "No response recorded yet."}
                    </p>
                  </div>

                  <div>
                    <TaskStatus status={task.status} />
                  </div>

                  <div>
                    <Priority priority={task.status === "failed" ? "High" : "Normal"} />
                  </div>

                  <span className="text-xs text-[#777099]">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>

                  <button className="flex h-8 w-8 items-center justify-center rounded-lg text-black/45 transition hover:bg-white/[0.04] hover:text-white">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: "yellow" | "cyan" | "teal";
}) {
  const color = {
    yellow: "#fff000",
    cyan: "#00e5ff",
    teal: "#00e5b0",
  }[accent];

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-white/70 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-black/45">
          {label}
        </p>

        <Icon
          size={17}
          style={{ color }}
        />
      </div>

      <p className="mt-5 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

function TaskStatus({
  status,
}: {
  status: Mission["status"];
}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#00e5b0]">
        <CheckCircle2 size={14} />
        Completed
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#fff000]">
        <Play size={14} />
        In Progress
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#ff69b7]">
        <Clock3 size={14} />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#00e5ff]">
      <Clock3 size={14} />
      Queued
    </span>
  );
}

function Priority({
  priority,
}: {
  priority: string;
}) {
  const color =
    priority === "High"
      ? "text-[#ff69b7] bg-[#a0025c]/10 border-[#a0025c]/30"
      : priority === "Normal"
        ? "text-[#fff000] bg-[#fff000]/[0.05] border-[#fff000]/20"
        : "text-black/45 bg-white/[0.03] border-white/[0.08]";

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold ${color}`}
    >
      {priority}
    </span>
  );
}