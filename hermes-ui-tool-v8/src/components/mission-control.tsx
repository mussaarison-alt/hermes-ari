import AriLogo from "./ari-logo";
import {
  Globe2,
  Database,
  ShieldCheck,
  Activity,
  RefreshCw,
} from "lucide-react";

export default function MissionControl() {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d0730]">

      {/* HEADER */}

      <div className="flex items-start justify-between px-6 pt-6">

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#fff000]">
            Mission Control
          </p>

          <h2 className="mt-2 text-lg font-bold text-white">
            Agent Operations
          </h2>

          <p className="mt-1 text-xs text-[#6f688f]">
            Real-time visualization of Hermes activity
          </p>
        </div>

        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-[#6f688f] transition hover:border-[#00e5ff]/30 hover:text-[#00e5ff]">
          <RefreshCw size={15} />
        </button>

      </div>


      {/* CONTROL AREA */}

      <div className="relative mx-6 mb-6 mt-4 overflow-hidden rounded-xl border border-[#00e5ff]/20 bg-[#07031f]">

        {/* TECHNICAL GRID */}

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,229,255,0.35) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,229,255,0.35) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
        />

        {/* GLOW */}

        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00e5ff]/[0.04] blur-3xl" />


        <div className="relative flex min-h-[300px] items-center gap-8 p-8">

          {/* ARI CORE */}

          <div className="flex w-[220px] shrink-0 flex-col items-center">

            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-[#00e5ff]/50">

              <div className="absolute inset-2 rounded-full border border-[#a0025c]/50" />

              <div className="absolute inset-5 rounded-full border border-[#00e5ff]/20" />

              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#110545] shadow-[0_0_35px_rgba(0,229,255,0.15)]">

                <AriLogo
                  variant="symbol"
                  size={64}
                />

              </div>

            </div>

            <div className="mt-4 flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-[#00e5b0] shadow-[0_0_10px_#00e5b0]" />

              <span className="text-xs font-bold uppercase tracking-wider text-[#00e5b0]">
                ARI Online
              </span>

            </div>

            <p className="mt-2 text-[10px] text-[#6f688f]">
              Listening · Analyzing · Executing
            </p>

          </div>


          {/* METRICS */}

          <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">

            {/* GLOBAL OPERATIONS */}

            <div className="rounded-xl border border-white/[0.1] bg-[#0d0730]/80 p-5">

              <Globe2
                size={18}
                className="text-[#00e5ff]"
              />

              <p className="mt-4 text-xs uppercase tracking-wider text-[#777099]">
                Global Operations
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                12
              </p>

              <p className="mt-1 text-xs text-[#6f688f]">
                Active Regions
              </p>

            </div>


            {/* DATA STREAMS */}

            <div className="rounded-xl border border-white/[0.1] bg-[#0d0730]/80 p-5">

              <Database
                size={18}
                className="text-[#a0025c]"
              />

              <p className="mt-4 text-xs uppercase tracking-wider text-[#777099]">
                Data Streams
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                8
              </p>

              <p className="mt-1 text-xs text-[#6f688f]">
                Live Feeds
              </p>

            </div>


            {/* SECURITY */}

            <div className="rounded-xl border border-white/[0.1] bg-[#0d0730]/80 p-5">

              <ShieldCheck
                size={18}
                className="text-[#00e5b0]"
              />

              <p className="mt-4 text-xs uppercase tracking-wider text-[#777099]">
                Security
              </p>

              <div className="mt-2 flex items-center gap-2">

                <Activity
                  size={15}
                  className="text-[#00e5b0]"
                />

                <p className="text-sm font-bold text-[#00e5b0]">
                  SECURE
                </p>

              </div>

              <p className="mt-1 text-xs text-[#6f688f]">
                All systems safe
              </p>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}