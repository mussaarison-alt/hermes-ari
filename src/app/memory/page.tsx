"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  FileText,
  FolderOpen,
  RefreshCw,
  User,
} from "lucide-react";

import Sidebar from "../../components/sidebar";
import Topbar from "../../components/topbar";

type MemoryData = {
  memory: {
    exists: boolean;
    content: string;
  };
  user: {
    exists: boolean;
    content: string;
  };
  directory: string;
};

export default function MemoryPage() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMemory() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/memory", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Unable to load Hermes memory."
        );
      }

      setData({
  memory: result?.memory ?? {
    exists: false,
    content: "",
  },
  user: result?.user ?? {
    exists: false,
    content: "",
  },
  directory:
    result?.directory ??
    "Hermes memory directory",
});
    } catch (err) {
      console.error("Memory page error:", err);
      setError(
        "The Memory API is unavailable, but the Memory page itself is working."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMemory();
  }, []);

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
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#a0025c]">
                  Cognitive System
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  ARI Memory
                </h1>

                <p className="mt-2 text-sm text-black/45">
                  Live view of Hermes persistent memory.
                </p>
              </div>

              <button
                onClick={loadMemory}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[#a9a3c4] transition hover:border-[#00e5ff]/30 hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>

            {/* SUMMARY */}

            <div className="mt-7 grid grid-cols-4 gap-4">

              <MemoryCard
                icon={Brain}
                label="Memory Files"
                value={
                  data
                    ? String(
                        [
                          data?.memory?.exists,
                          data?.user?.exists,
                        ].filter(Boolean).length
                      )
                    : "—"
                }
                detail="Hermes built-in memory"
                color="#ff69b7"
              />

              <MemoryCard
                icon={User}
                label="User Profile"
                value={
                  data?.user.exists
                    ? "ACTIVE"
                    : "EMPTY"
                }
                detail="USER.md"
                color="#00e5ff"
              />

              <MemoryCard
                icon={Brain}
                label="Agent Memory"
                value={
                  data?.memory.exists
                    ? "ACTIVE"
                    : "EMPTY"
                }
                detail="MEMORY.md"
                color="#fff000"
              />

              <MemoryCard
                icon={FileText}
                label="Stored Text"
                value={
                  data
                    ? (
                        data.memory.content.length +
                        data.user.content.length
                      ).toLocaleString()
                    : "—"
                }
                detail="Characters"
                color="#00e5b0"
              />

            </div>

            {/* STATUS */}

            {error && (
              <div className="mt-6 rounded-2xl border border-[#ff69b7]/20 bg-white/70 p-5">
                <p className="text-sm font-semibold text-[#ff69b7]">
                  Memory connection unavailable
                </p>

                <p className="mt-2 text-xs text-black/45">
                  {error}
                </p>
              </div>
            )}

            {/* DIRECTORY */}

            {data && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/70 px-5 py-4">

                <FolderOpen
                  size={17}
                  className="text-[#00e5ff]"
                />

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-black/45">
                    Hermes Memory Directory
                  </p>

                  <p className="mt-1 font-mono text-xs text-[#a9a3c4]">
                    {data.directory}
                  </p>
                </div>

              </div>
            )}

            {/* CONTENT */}

            <div className="mt-6 space-y-4">

              {loading && (
                <div className="rounded-2xl border border-white/[0.1] bg-white/70 p-10 text-center">

                  <RefreshCw
                    size={24}
                    className="mx-auto animate-spin text-[#00e5ff]"
                  />

                  <p className="mt-4 text-sm font-semibold">
                    Loading Hermes memory...
                  </p>

                </div>
              )}

              {!loading &&
                data?.memory.exists && (
                  <MemorySection
                    title="Agent Memory"
                    file="MEMORY.md"
                    content={data.memory.content}
                    icon={Brain}
                    accent="#ff69b7"
                  />
                )}

              {!loading &&
                data?.user.exists && (
                  <MemorySection
                    title="User Profile"
                    file="USER.md"
                    content={data.user.content}
                    icon={User}
                    accent="#00e5ff"
                  />
                )}

              {!loading &&
                data &&
                !data?.memory?.exists &&
                !data?.user?.exists && (
                  <div className="rounded-2xl border border-white/[0.1] bg-white/70 p-10 text-center">

                    <Brain
                      size={28}
                      className="mx-auto text-[#4f496d]"
                    />

                    <p className="mt-4 text-sm font-semibold">
                      No memory content found
                    </p>

                    <p className="mt-2 text-xs text-black/45">
                      Hermes memory is enabled, but no persistent memory file has been populated yet.
                    </p>

                  </div>
                )}

            </div>

            {/* FOOTER */}

            <div className="mt-5 rounded-2xl border border-[#00e5b0]/10 bg-white/70 p-5">

              <div className="flex items-center gap-3">

                <span className="h-2 w-2 rounded-full bg-[#00e5b0] shadow-[0_0_10px_#00e5b0]" />

                <p className="text-xs font-semibold text-[#00e5b0]">
                  Hermes memory system
                </p>

              </div>

            </div>

          </div>
        </div>
      </section>
    </main>
  );
}

function MemorySection({
  title,
  file,
  content,
  icon: Icon,
  accent,
}: {
  title: string;
  file: string;
  content: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <section
      className="rounded-2xl border bg-white/70 p-6"
      style={{
        borderColor: `${accent}26`,
      }}
    >
      <div className="flex items-start gap-4">

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white"
          style={{
            borderColor: `${accent}33`,
          }}
        >
          <Icon
            size={20}
            style={{ color: accent }}
          />
        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-center justify-between">

            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.3em]"
                style={{ color: accent }}
              >
                {title}
              </p>

              <h2 className="mt-2 text-lg font-bold">
                {file}
              </h2>
            </div>

          </div>

          <pre className="mt-5 whitespace-pre-wrap font-sans text-sm leading-7 text-[#d9d5e8]">
            {content}
          </pre>

        </div>
      </div>
    </section>
  );
}

function MemoryCard({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
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

      <p className="mt-5 text-2xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-[11px] text-black/45">
        {detail}
      </p>

    </div>
  );
}