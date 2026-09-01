"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  Terminal,
  XCircle,
} from "lucide-react";

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

export default function OperationsPanel() {
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

      setMissions(JSON.parse(raw) as SavedMission[]);
    } catch {
      setMissions([]);
    }
  }

  const visibleMissions = missions.slice(0, 4);

  return (
    <div className="grid grid-cols-2 gap-4">

      {/* TASK QUEUE */}

      <Panel
        eyebrow="Operations"
        title="Task Queue"
      >
        {visibleMissions.length === 0 ? (
          <EmptyState />
        ) : (
          visibleMissions.map((mission) => (
            <TaskRow
              key={mission.id}
              mission={mission}
            />
          ))
        )}
      </Panel>


      {/* MISSION STATUS */}

      <Panel
        eyebrow="Operations"
        title="Mission Status"
      >
        <div className="space-y-4">

          <StatusRow
            label="Completed"
            value={
              missions.filter(
                (mission) => mission.status === "completed"
              ).length
            }
            icon={CheckCircle2}
            textClass="text-[#00e5b0]"
          />

          <StatusRow
            label="Running"
            value={
              missions.filter(
                (mission) => mission.status === "running"
              ).length
            }
            icon={Loader2}
            textClass="text-[#fff000]"
          />

          <StatusRow
            label="Queued"
            value={
              missions.filter(
                (mission) => mission.status === "queued"
              ).length
            }
            icon={Clock3}
            textClass="text-[#00e5ff]"
          />

          <StatusRow
            label="Failed"
            value={
              missions.filter(
                (mission) => mission.status === "failed"
              ).length
            }
            icon={XCircle}
            textClass="text-[#ff69b7]"
          />

        </div>
      </Panel>

    </div>
  );
}


function Panel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.1] bg-white/70 p-5">

      <div className="mb-5 flex items-center justify-between">

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#fff000]">
            {eyebrow}
          </p>

          <h2 className="mt-2 text-lg font-bold text-white">
            {title}
          </h2>
        </div>

        <span className="text-xs text-black/45">
          Live
        </span>

      </div>

      <div>
        {children}
      </div>

    </section>
  );
}


function TaskRow({
  mission,
}: {
  mission: SavedMission;
}) {
  const status = getStatusInfo(mission.status);

  return (
    <div className="border-b border-white/[0.06] py-4 last:border-0">

      <div className="flex items-center justify-between gap-4">

        <div className="flex min-w-0 items-center gap-3">

          <span className={status.iconClass}>
            {status.icon}
          </span>

          <div className="min-w-0">

            <p className="truncate text-sm font-semibold text-white">
              {mission.objective}
            </p>

            <div className="mt-1 flex items-center gap-2">

              <span
                className={`text-[10px] font-semibold uppercase ${status.textClass}`}
              >
                {status.label}
              </span>

              {mission.tools.length > 0 && (
                <>
                  <span className="text-[#4f496d]">
                    •
                  </span>

                  <span className="text-[10px] text-black/45">
                    {mission.tools.length} tool
                    {mission.tools.length === 1 ? "" : "s"}
                  </span>
                </>
              )}

            </div>

          </div>

        </div>

        {mission.status === "running" && (
          <Loader2
            size={15}
            className="shrink-0 animate-spin text-[#fff000]"
          />
        )}

      </div>

    </div>
  );
}


function StatusRow({
  label,
  value,
  icon: Icon,
  textClass,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  textClass: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white px-4 py-3">

      <div className="flex items-center gap-3">

        <Icon
          size={16}
          className={textClass}
        />

        <span className="text-sm text-[#a9a3c4]">
          {label}
        </span>

      </div>

      <span className={`text-sm font-bold ${textClass}`}>
        {value}
      </span>

    </div>
  );
}


function EmptyState() {
  return (
    <div className="flex min-h-[180px] items-center justify-center">

      <div className="text-center">

        <Terminal
          size={24}
          className="mx-auto text-[#4f496d]"
        />

        <p className="mt-3 text-sm font-semibold text-white">
          No missions yet
        </p>

        <p className="mt-1 text-xs text-black/45">
          Run a mission from ARI Mission Console.
        </p>

      </div>

    </div>
  );
}


function getStatusInfo(
  status: SavedMission["status"]
) {
  if (status === "completed") {
    return {
      icon: <CheckCircle2 size={16} />,
      label: "Completed",
      textClass: "text-[#00e5b0]",
      iconClass: "text-[#00e5b0]",
    };
  }

  if (status === "running") {
    return {
      icon: <Loader2 size={16} />,
      label: "Running",
      textClass: "text-[#fff000]",
      iconClass: "text-[#fff000]",
    };
  }

  if (status === "failed") {
    return {
      icon: <XCircle size={16} />,
      label: "Failed",
      textClass: "text-[#ff69b7]",
      iconClass: "text-[#ff69b7]",
    };
  }

  return {
    icon: <Clock3 size={16} />,
    label: "Queued",
    textClass: "text-[#00e5ff]",
    iconClass: "text-[#00e5ff]",
  };
}