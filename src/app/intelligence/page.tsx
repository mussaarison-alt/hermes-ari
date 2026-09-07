"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Globe2,
  Layers3,
  MapPin,
  Radio,
  Satellite,
  Search,
  Ship,
  ShieldAlert,
  Sparkles,
  Waves,
  Plane,
} from "lucide-react";

import Sidebar from "../../components/sidebar";
import Topbar from "../../components/topbar";
import IntelligenceMap from "../../components/intelligence-map";

type OsirisStats = {
  flights?: number;
  sats?: number;
  cctv?: number;
  weather?: number;
  nuclear?: number;
  incidents?: number;
};

const layers = [
  { label: "Flights", icon: Plane, active: true },
  { label: "Satellites", icon: Satellite, active: true },
  { label: "Maritime", icon: Ship, active: true },
  { label: "CCTV", icon: Radio, active: true },
  { label: "CCTV Previews", icon: Radio, active: false },
  { label: "Live News", icon: Activity, active: true },
  { label: "Earthquakes", icon: Waves, active: true },
  { label: "Global Incidents", icon: AlertTriangle, active: true },
  { label: "Day / Night", icon: Globe2, active: true },
  { label: "Cables", icon: Layers3, active: false },
  { label: "SDK Sea", icon: Ship, active: true },
  { label: "SDK Air", icon: Plane, active: true },
  { label: "SDK Naval", icon: ShieldAlert, active: false },
];

function formatCount(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

export default function IntelligencePage() {
  const [activeLayers, setActiveLayers] = useState(
    Object.fromEntries(layers.map((layer) => [layer.label, layer.active])),
  );
  const [stats, setStats] = useState<OsirisStats | null>(null);
  const [statsTimestamp, setStatsTimestamp] = useState<string | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const response = await fetch("/api/intelligence/stats", { cache: "no-store" });
        if (!response.ok) throw new Error("OSIRIS stats unavailable");

        const data = (await response.json()) as {
          stats?: OsirisStats;
          timestamp?: string;
        };

        if (cancelled) return;
        setStats(data.stats ?? null);
        setStatsTimestamp(data.timestamp ?? null);
        setStatsError(false);
      } catch {
        if (!cancelled) setStatsError(true);
      }
    }

    loadStats();
    const interval = window.setInterval(loadStats, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  function toggleLayer(label: string) {
    setActiveLayers((current) => ({ ...current, [label]: !current[label] }));
  }

  const liveMetrics = [
    ["Flights", formatCount(stats?.flights), Plane],
    ["Satellites", formatCount(stats?.sats), Satellite],
    ["CCTV", formatCount(stats?.cctv), Radio],
    ["Incidents", formatCount(stats?.incidents), AlertTriangle],
  ] as const;

  return (
    <main className="flex h-screen overflow-hidden bg-[#eef6fb]">
      <Sidebar />

      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-6 py-6">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#268cad]">
                  ARI Intelligence Layer
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1b2e45]">
                  Global Intelligence
                </h1>
                <p className="mt-1 text-sm text-[#63809a]">
                  Live open-source intelligence, situational awareness and event correlation.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[#b9d8ea]/70 bg-white/70 px-3 py-2 text-xs text-[#52708a] shadow-sm">
                <span
                  className={`h-2 w-2 rounded-full ${statsError ? "bg-[#ff5d5d]" : "bg-[#32d47b]"} shadow-[0_0_8px_rgba(50,212,123,0.65)]`}
                />
                OSIRIS feed
                <span className="text-[#91a8bb]">
                  {statsError ? "unavailable" : stats ? "connected" : "connecting"}
                </span>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-4 gap-3">
              {liveMetrics.map(([label, value, Icon]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#b9d8ea]/70 bg-white/75 px-4 py-3 shadow-[0_8px_22px_rgba(74,122,164,0.07)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7892a6]">
                      {label}
                    </span>
                    <Icon size={15} className="text-[#268cad]" />
                  </div>
                  <p className="mt-1 text-xl font-semibold text-[#1b2e45]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mb-4 flex items-center justify-between px-1 text-[10px] text-[#7892a6]">
              <span>OSIRIS live feed layer</span>
              <span>
                {statsTimestamp
                  ? `Updated ${new Date(statsTimestamp).toLocaleTimeString()}`
                  : "Waiting for live data"}
              </span>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-5">
              <div className="overflow-hidden rounded-2xl border border-[#86b9d3]/45 bg-[#07131f] shadow-[0_18px_45px_rgba(24,73,110,0.18)]">
                <div className="flex items-center justify-between border-b border-white/10 bg-[#0a1825] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Globe2 size={18} className="text-[#62eaff]" />
                    <span className="text-sm font-semibold text-white">OSIRIS</span>
                    <span className="rounded-md border border-[#39d7ff]/25 bg-[#39d7ff]/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[#7cecff]">
                      Open Source Intelligence
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#87a9c0]">
                    <Activity size={13} />
                    Live map
                  </div>
                </div>

                <div className="relative h-[680px] overflow-hidden bg-[#06111c]">
                  <IntelligenceMap
                    showEarthquakes={Boolean(activeLayers["Earthquakes"])}
                    showFlights={Boolean(activeLayers["Flights"])}
                    showMaritime={Boolean(activeLayers["Maritime"])}
                    showSatellites={Boolean(activeLayers["Satellites"])}
                  />

                  <div className="pointer-events-none absolute bottom-5 left-5 z-10 flex items-end gap-3">
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#55e7ff]/70 bg-[#071827]/75 shadow-[0_0_35px_rgba(34,203,255,0.35)] backdrop-blur-md">
                      <div className="absolute inset-2 rounded-full border border-[#55e7ff]/30 animate-pulse" />
                      <Sparkles size={28} className="text-[#6deaff]" />
                    </div>
                    <div className="max-w-[310px] rounded-2xl border border-[#55e7ff]/35 bg-[#071827]/90 px-4 py-3 text-xs leading-5 text-[#d8f7ff] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6deaff]">
                        <Sparkles size={12} /> ARI
                      </div>
                      The OSIRIS feeds are now connected directly. ARI can work from the live intelligence data instead of relying on the OSIRIS website iframe.
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-[#b9d8ea]/70 bg-white/80 p-4 shadow-[0_12px_30px_rgba(74,122,164,0.08)] backdrop-blur-xl">
                  <div className="mb-3 flex items-center gap-2">
                    <Layers3 size={17} className="text-[#268cad]" />
                    <h2 className="text-sm font-semibold text-[#1b2e45]">Live Layers</h2>
                  </div>

                  <div className="space-y-1">
                    {layers.map((layer) => {
                      const Icon = layer.icon;
                      const active = Boolean(activeLayers[layer.label]);
                      const wired = ["Flights", "Satellites", "Maritime", "Earthquakes"].includes(layer.label);

                      return (
                        <button
                          key={layer.label}
                          type="button"
                          onClick={() => wired && toggleLayer(layer.label)}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition ${wired ? "hover:bg-[#edf7fc]" : "cursor-default opacity-80"}`}
                        >
                          <span className="flex items-center gap-2 text-xs text-[#496a87]">
                            <Icon size={14} className={active ? "text-[#168fba]" : "text-[#9ab0c1]"} />
                            {layer.label}
                          </span>
                          <span className={`relative h-4 w-7 rounded-full transition ${active ? "bg-[#35c9ef]" : "bg-[#b9cbd7]"}`}>
                            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition ${active ? "left-3.5" : "left-0.5"}`} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#b9d8ea]/70 bg-white/80 p-4 shadow-[0_12px_30px_rgba(74,122,164,0.08)] backdrop-blur-xl">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles size={17} className="text-[#268cad]" />
                    <h2 className="text-sm font-semibold text-[#1b2e45]">ARI Intelligence Tools</h2>
                  </div>

                  <div className="space-y-2">
                    {[
                      [MapPin, "Analyze Location"],
                      [Ship, "Track Vessel"],
                      [Plane, "Track Flight"],
                      [Search, "Search Intelligence"],
                      [Satellite, "Satellite View"],
                    ].map(([Icon, label]) => {
                      const ToolIcon = Icon as typeof MapPin;
                      return (
                        <button
                          key={label as string}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl border border-[#d4e4ee] bg-white/70 px-3 py-2.5 text-left text-xs font-medium text-[#38546d] transition hover:border-[#79dff5] hover:bg-[#effaff]"
                        >
                          <ToolIcon size={15} className="text-[#268cad]" />
                          {label as string}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#b9d8ea]/70 bg-white/80 p-4 shadow-[0_12px_30px_rgba(74,122,164,0.08)] backdrop-blur-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={17} className="text-[#268cad]" />
                      <h2 className="text-sm font-semibold text-[#1b2e45]">Recent Intelligence</h2>
                    </div>
                    <span className="text-[10px] text-[#7b97aa]">OSIRIS</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {[
                      ["Red Sea situation", "Maritime"],
                      ["Port of Aden activity", "Maritime"],
                      ["Recent seismic activity", "Earthquakes"],
                      ["Global news briefing", "Live News"],
                    ].map(([title, source], index) => (
                      <div key={title} className="flex gap-2">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${index === 0 ? "bg-[#ff5252]" : index === 1 ? "bg-[#3da9ff]" : index === 2 ? "bg-[#ffc44d]" : "bg-[#35cf78]"}`} />
                        <div>
                          <p className="font-medium text-[#405d75]">{title}</p>
                          <p className="mt-0.5 text-[10px] text-[#91a8b9]">{source}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
