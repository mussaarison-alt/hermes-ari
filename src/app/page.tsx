"use client";

import { useEffect, useMemo, useState } from "react";

import AriCore from "../components/ari-core";
import NewMission from "../components/new-mission";
import Sidebar from "../components/sidebar";
import StatCard from "../components/stat-card";
import Topbar from "../components/topbar";

type SavedMission = {
  id: string;
  objective: string;
  status: "queued" | "running" | "completed" | "failed";
  response: string;
  createdAt: string;
  completedAt?: string;
  tools: string[];
};

const STORAGE_KEY = "hermes-ari-missions";

export default function Home() {
  const [missions, setMissions] = useState<SavedMission[]>([]);

  useEffect(() => {
    loadMissions();

    const handleStorage = () => {
      loadMissions();
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function loadMissions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        setMissions([]);
        return;
      }

      const parsed = JSON.parse(raw) as SavedMission[];
      setMissions(parsed);
    } catch {
      setMissions([]);
    }
  }

  function createDashboardMission(mission: {
    title: string;
    priority: string;
  }) {
    const newMission: SavedMission = {
      id: crypto.randomUUID(),
      objective: mission.title,
      status: "queued",
      response: "",
      createdAt: new Date().toISOString(),
      tools: [],
    };

    const updated = [newMission, ...missions];

    setMissions(updated);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated),
    );
  }

  const completedCount = useMemo(
    () =>
      missions.filter(
        (mission) => mission.status === "completed",
      ).length,
    [missions],
  );

  const failedCount = useMemo(
    () =>
      missions.filter(
        (mission) => mission.status === "failed",
      ).length,
    [missions],
  );

  const activeCount = useMemo(
    () =>
      missions.filter(
        (mission) =>
          mission.status === "running" ||
          mission.status === "queued",
      ).length,
    [missions],
  );

  const finishedCount = completedCount + failedCount;

  const successRate =
    finishedCount > 0
      ? `${((completedCount / finishedCount) * 100).toFixed(1)}%`
      : "—";

  const averageResponseTime = useMemo(() => {
    const completed = missions.filter(
      (mission) =>
        mission.status === "completed" &&
        mission.completedAt,
    );

    if (completed.length === 0) {
      return "—";
    }

    const durations = completed
      .map((mission) => {
        const start = new Date(
          mission.createdAt,
        ).getTime();

        const end = new Date(
          mission.completedAt!,
        ).getTime();

        return end - start;
      })
      .filter((duration) => duration >= 0);

    if (durations.length === 0) {
      return "—";
    }

    const average =
      durations.reduce(
        (sum, duration) => sum + duration,
        0,
      ) / durations.length;

    return `${(average / 1000).toFixed(2)}s`;
  }, [missions]);

  return (
    <main className="flex h-screen overflow-hidden bg-white">
      <Sidebar />

      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1280px] px-8 py-8">
            {/* PAGE HEADER */}

            <div className="mb-7 flex items-end justify-between">
              <div>
                <p className="text-sm text-[#777099]">
                  Welcome back, Mussa.
                </p>

                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-700">
                  Here's what's happening with{" "}
                  <span className="text-[#169fd5]">
                    ARI
                  </span>{" "}
                  today.
                </h1>
              </div>

              <NewMission
                onCreate={createDashboardMission}
              />
            </div>

            {/* LIVE STAT CARDS */}

            <div className="grid grid-cols-4 gap-4">
              <StatCard
                label="Tasks Completed"
                value={String(completedCount)}
                change={
                  missions.length > 0
                    ? `${missions.length} total`
                    : "NO DATA"
                }
                accent="cyan"
              />

              <StatCard
                label="Success Rate"
                value={successRate}
                change={
                  finishedCount > 0
                    ? `${finishedCount} finished`
                    : "NO DATA"
                }
                accent="cyan"
              />

              <StatCard
                label="Active Missions"
                value={String(activeCount)}
                change={
                  activeCount > 0
                    ? "ACTIVE"
                    : "IDLE"
                }
                accent="cyan"
              />

              <StatCard
                label="Avg Response"
                value={averageResponseTime}
                change={
                  completedCount > 0
                    ? `${completedCount} measured`
                    : "NO DATA"
                }
                accent="cyan"
              />
            </div>

            {/* SINGLE ARI INTERFACE */}

            <AriCore />
          </div>
        </div>
      </section>
    </main>
  );
}