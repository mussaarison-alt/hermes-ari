"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  Bot,
  CheckCircle2,
  Cloud,
  Code2,
  Database,
  Globe,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Zap,
} from "lucide-react";

import Sidebar from "../../components/sidebar";
import Topbar from "../../components/topbar";

type IntegrationStatus =
  | "Connected"
  | "Available"
  | "Not Connected"
  | "Checking";

type Integration = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  detail: string;
};

type IntegrationResponse = {
  integrations: Integration[];
  connected: number;
  available: number;
  total: number;
  checkedAt: string;
};

type Filter =
  | "All"
  | "Connected"
  | "AI"
  | "Communication"
  | "Development";

const iconMap: Record<
  string,
  React.ElementType
> = {
  "hermes-agent": Bot,
  "hermes-api": Zap,
  ollama: Cloud,
  knowledge: Globe,
  missions: Database,
  github: Code2,
  email: Mail,
  discord: MessageSquare,
  gateway: Activity,
};

const accentMap = {
  yellow: {
    icon: "#fff000",
    border:
      "border-[#fff000]/15",
  },
  cyan: {
    icon: "#00e5ff",
    border:
      "border-[#00e5ff]/15",
  },
  teal: {
    icon: "#00e5b0",
    border:
      "border-[#00e5b0]/15",
  },
  raspberry: {
    icon: "#ff69b7",
    border:
      "border-[#a0025c]/20",
  },
};

export default function IntegrationsPage() {
  const [
    data,
    setData,
  ] =
    useState<IntegrationResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] =
    useState<Filter>("All");

  useEffect(() => {
    void loadIntegrations();

    const timer =
      window.setInterval(
        () => {
          void loadIntegrations();
        },
        5000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, []);

  async function loadIntegrations() {
    try {
      const response =
        await fetch(
          "/api/integrations",
          {
            cache:
              "no-store",
          },
        );

      const text =
        await response.text();

      let result:
        | IntegrationResponse
        | {
            error?: string;
          };

      try {
        result =
          JSON.parse(text);
      } catch {
        throw new Error(
          text ||
            `Integrations API returned HTTP ${response.status}.`,
        );
      }

      if (!response.ok) {
        throw new Error(
          "error" in result &&
            result.error
            ? result.error
            : "Unable to load integrations.",
        );
      }

      setData(
        result as IntegrationResponse,
      );
      setError("");
    } catch (err) {
      console.error(
        "Integrations page error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to inspect integrations.",
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredIntegrations =
    useMemo(() => {
      const items =
        data?.integrations ||
        [];

      const query =
        search
          .trim()
          .toLowerCase();

      return items.filter(
        (item) => {
          const matchesSearch =
            !query ||
            item.name
              .toLowerCase()
              .includes(query) ||
            item.description
              .toLowerCase()
              .includes(
                query,
              ) ||
            item.category
              .toLowerCase()
              .includes(query);

          if (
            !matchesSearch
          ) {
            return false;
          }

          if (
            filter ===
            "Connected"
          ) {
            return (
              item.status ===
              "Connected"
            );
          }

          if (
            filter ===
            "AI"
          ) {
            return (
              item.category ===
              "AI"
            );
          }

          if (
            filter ===
            "Communication"
          ) {
            return (
              item.category ===
              "Communication"
            );
          }

          if (
            filter ===
            "Development"
          ) {
            return (
              item.category ===
              "Development"
            );
          }

          return true;
        },
      );
    }, [
      data,
      filter,
      search,
    ]);

  const securePercent =
    data
      ? Math.round(
          (data.connected /
            data.total) *
            100,
        )
      : 0;

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

                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#00e5b0]">
                  Connectivity
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  Integrations
                </h1>

                <p className="mt-2 text-sm text-[#6f688f]">
                  Live status of the services ARI can access.
                </p>

              </div>

              <button
                onClick={() =>
                  void loadIntegrations()
                }
                className="flex items-center gap-2 rounded-xl border border-[#fff000]/60 bg-[#fff000]/[0.06] px-5 py-2.5 text-sm font-semibold text-[#fff000] transition hover:bg-[#fff000]/[0.12]"
              >
                <Plus size={16} />
                Refresh
              </button>

            </div>


            {/* SUMMARY */}

            <div className="mt-7 grid grid-cols-4 gap-4">

              <IntegrationCard
                icon={CheckCircle2}
                label="Connected"
                value={
                  loading
                    ? "—"
                    : String(
                        data?.connected ??
                          0,
                      )
                }
                detail="Live integrations"
                accent="teal"
              />

              <IntegrationCard
                icon={Activity}
                label="Available"
                value={
                  loading
                    ? "—"
                    : String(
                        data?.available ??
                          0,
                      )
                }
                detail="Configured but inactive"
                accent="cyan"
              />

              <IntegrationCard
                icon={ShieldCheck}
                label="Health"
                value={
                  loading
                    ? "—"
                    : `${securePercent}%`
                }
                detail="Connected services"
                accent="yellow"
              />

              <IntegrationCard
                icon={Settings2}
                label="Detected"
                value={
                  loading
                    ? "—"
                    : String(
                        data?.total ??
                          0,
                      )
                }
                detail="Services inspected"
                accent="raspberry"
              />

            </div>


            {/* ERROR */}

            {error && (
              <div className="mt-6 rounded-2xl border border-[#ff69b7]/20 bg-[#0d0730] p-5">

                <p className="text-sm font-semibold text-[#ff69b7]">
                  Integration inspection failed
                </p>

                <p className="mt-2 text-xs text-[#6f688f]">
                  {error}
                </p>

              </div>
            )}


            {/* FILTER */}

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/[0.1] bg-[#0d0730] p-4">

              <div className="flex items-center gap-2">

                {(
                  [
                    "All",
                    "Connected",
                    "AI",
                    "Communication",
                    "Development",
                  ] as Filter[]
                ).map(
                  (item) => (
                    <button
                      key={item}
                      onClick={() =>
                        setFilter(
                          item,
                        )
                      }
                      className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                        filter ===
                        item
                          ? "bg-[#00e5b0]/[0.08] text-[#00e5b0]"
                          : "text-[#777099] hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}

              </div>

              <div className="flex h-9 w-[280px] items-center gap-2 rounded-lg border border-white/[0.08] bg-[#07031f] px-3">

                <Search
                  size={15}
                  className="text-[#6f688f]"
                />

                <input
                  value={search}
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search integrations..."
                  className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[#4f496d]"
                />

              </div>

            </div>


            {/* GRID */}

            <div className="mt-5 grid grid-cols-2 gap-4">

              {loading ? (

                <div className="col-span-2 flex min-h-[300px] items-center justify-center rounded-2xl border border-white/[0.1] bg-[#0d0730]">

                  <div className="text-center">

                    <Activity
                      size={28}
                      className="mx-auto animate-pulse text-[#00e5b0]"
                    />

                    <p className="mt-3 text-sm text-[#6f688f]">
                      Inspecting local services...
                    </p>

                  </div>

                </div>

              ) : filteredIntegrations.length ===
                0 ? (

                <div className="col-span-2 flex min-h-[300px] items-center justify-center rounded-2xl border border-white/[0.1] bg-[#0d0730]">

                  <div className="text-center">

                    <Search
                      size={28}
                      className="mx-auto text-[#4f496d]"
                    />

                    <p className="mt-3 text-sm font-semibold">
                      No matching integrations
                    </p>

                    <p className="mt-2 text-xs text-[#6f688f]">
                      Try another filter or search term.
                    </p>

                  </div>

                </div>

              ) : (

                filteredIntegrations.map(
                  (integration) => (
                    <IntegrationItem
                      key={
                        integration.id
                      }
                      integration={
                        integration
                      }
                    />
                  ),
                )

              )}

            </div>


            {/* SECURITY */}

            <div className="mt-5 rounded-2xl border border-[#00e5b0]/10 bg-[#0d0730] p-5">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-4">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#00e5b0]/20 bg-[#07031f]">

                    <ShieldCheck
                      size={20}
                      className="text-[#00e5b0]"
                    />

                  </div>

                  <div>

                    <p className="text-sm font-semibold text-white">
                      Integration security
                    </p>

                    <p className="mt-1 text-xs text-[#6f688f]">
                      Status is inspected server-side. Secrets and API keys are not sent to the browser.
                    </p>

                  </div>

                </div>

                <div className="flex items-center gap-2">

                  <span
                    className={`h-2 w-2 rounded-full ${
                      data &&
                      data.connected >
                        0
                        ? "bg-[#00e5b0] shadow-[0_0_10px_#00e5b0]"
                        : "bg-[#6f688f]"
                    }`}
                  />

                  <span
                    className={`text-xs font-semibold ${
                      data &&
                      data.connected >
                        0
                        ? "text-[#00e5b0]"
                        : "text-[#777099]"
                    }`}
                  >
                    {data &&
                    data.connected >
                      0
                      ? "HEALTHY"
                      : "NO CONNECTIONS"}
                  </span>

                </div>

              </div>

            </div>


            {data && (
              <p className="mt-4 text-right text-[10px] text-[#4f496d]">
                Last checked{" "}
                {formatTime(
                  data.checkedAt,
                )}
              </p>
            )}

          </div>

        </div>

      </section>

    </main>
  );
}


function IntegrationItem({
  integration,
}: {
  integration: Integration;
}) {
  const Icon =
    iconMap[
      integration.id
    ] || Bot;

  const accentKey =
    getAccentKey(
      integration.id,
    );

  const accent =
    accentMap[
      accentKey
    ];

  const connected =
    integration.status ===
    "Connected";

  const available =
    integration.status ===
    "Available";

  return (
    <div
      className={`rounded-2xl border bg-[#0d0730] p-5 transition hover:bg-[#11083a] ${accent.border}`}
    >

      <div className="flex items-start justify-between">

        <div className="flex items-center gap-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#07031f]">

            <Icon
              size={21}
              style={{
                color:
                  accent.icon,
              }}
            />

          </div>

          <div>

            <p className="text-sm font-semibold text-white">
              {integration.name}
            </p>

            <p className="mt-1 text-xs text-[#6f688f]">
              {integration.category}
            </p>

          </div>

        </div>

        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6f688f] transition hover:bg-white/[0.04] hover:text-white"
          aria-label={`More options for ${integration.name}`}
        >
          <MoreHorizontal
            size={16}
          />
        </button>

      </div>


      <p className="mt-5 text-sm leading-relaxed text-[#a9a3c4]">
        {integration.description}
      </p>


      <p className="mt-3 text-[11px] leading-5 text-[#6f688f]">
        {integration.detail}
      </p>


      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">

        <div className="flex items-center gap-2">

          <span
            className={`h-2 w-2 rounded-full ${
              connected
                ? "bg-[#00e5b0] shadow-[0_0_10px_#00e5b0]"
                : available
                ? "bg-[#fff000] shadow-[0_0_8px_#fff000]"
                : "bg-[#6f688f]"
            }`}
          />

          <span
            className={`text-xs font-semibold ${
              connected
                ? "text-[#00e5b0]"
                : available
                ? "text-[#fff000]"
                : "text-[#777099]"
            }`}
          >
            {integration.status}
          </span>

        </div>


        <button
          disabled
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            connected
              ? "border-white/[0.08] text-[#777099]"
              : available
              ? "border-[#fff000]/30 bg-[#fff000]/[0.05] text-[#fff000]"
              : "border-white/[0.08] text-[#6f688f]"
          }`}
        >
          {connected
            ? "Manage"
            : available
            ? "Configure"
            : "Unavailable"}
        </button>

      </div>

    </div>
  );
}


function IntegrationCard({
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
          style={{
            color,
          }}
        />

      </div>

      <p className="mt-5 text-3xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-[11px] text-[#6f688f]">
        {detail}
      </p>

    </div>
  );
}


function getAccentKey(
  id: string,
): "yellow" | "cyan" | "teal" | "raspberry" {
  switch (id) {
    case "hermes-agent":
    case "missions":
    case "gateway":
      return "yellow";

    case "hermes-api":
    case "ollama":
    case "discord":
      return "cyan";

    case "knowledge":
    case "github":
      return "teal";

    case "email":
      return "raspberry";

    default:
      return "cyan";
  }
}


function formatTime(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleTimeString(
    undefined,
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}