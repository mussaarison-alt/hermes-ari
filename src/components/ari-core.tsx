"use client";

import { useEffect, useState } from "react";

type AriCoreProps = {
  status?:
    | "ready"
    | "recording"
    | "transcribing"
    | "thinking"
    | "speaking"
    | "error";
};

export default function AriCore({
  status = "ready",
}: AriCoreProps) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPulse((value) => value + 1);
    }, 1600);

    return () => window.clearInterval(interval);
  }, []);

  const active =
    status === "recording" ||
    status === "thinking" ||
    status === "speaking";

  const speaking = status === "speaking";
  const thinking = status === "thinking";
  const recording = status === "recording";
  const error = status === "error";

  const statusLabel =
    status === "recording"
      ? "LISTENING..."
      : status === "thinking"
        ? "PROCESSING..."
        : status === "speaking"
          ? "SPEAKING..."
          : status === "error"
            ? "SIGNAL ERROR"
            : "READY TO ASSIST";

  return (
    <section className="relative mt-6 h-[520px] w-full overflow-hidden rounded-[28px] border border-white/70 bg-[#f4f5f3] shadow-[0_25px_80px_rgba(30,70,50,0.10)]">
      {/* HEADER */}

      <div className="absolute left-6 top-5 z-20">
        <div className="text-[10px] font-medium uppercase tracking-[0.35em] text-black/45">
          ARI
        </div>

        <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-black/35">
          Advanced Reasoning Intelligence
        </div>
      </div>

      <div className="absolute right-6 top-5 z-20 flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-4 py-2 backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-[#58e39b] shadow-[0_0_10px_rgba(88,227,155,0.8)]" />

        <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-black/45">
          Online
        </span>
      </div>

      {/* LEFT CONTEXT PANEL */}

      <div className="absolute left-5 top-[84px] z-20 w-[155px] rounded-[20px] border border-white/90 bg-white/65 p-5 shadow-[0_15px_40px_rgba(40,80,60,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-black/55">
            Context
          </span>

          <span className="text-black/40">•••</span>
        </div>

        <div className="mt-7 space-y-5">
          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-black/30">
              Current Task
            </div>

            <div className="mt-1 text-[11px] text-[#4b9b72]">
              Project Hermes
            </div>
          </div>

          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-black/30">
              Mode
            </div>

            <div className="mt-1 text-[11px] text-[#4b9b72]">
              Reasoning
            </div>
          </div>

          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-black/30">
              Memory
            </div>

            <div className="mt-1 text-[11px] text-[#4b9b72]">
              Active
            </div>
          </div>

          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-black/30">
              Knowledge Base
            </div>

            <div className="mt-1 text-[11px] text-[#4b9b72]">
              Connected
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT OUTPUT PANEL */}

      <div className="absolute right-5 top-[84px] z-20 w-[170px] rounded-[20px] border border-white/90 bg-white/65 p-5 shadow-[0_15px_40px_rgba(40,80,60,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-black/55">
            Output
          </span>

          <span className="text-black/40">•••</span>
        </div>

        <div className="mt-6">
          <div className="text-[11px] font-semibold text-[#4b9b72]">
            Analysis Complete
          </div>

          <div className="mt-3 text-[9px] leading-5 text-black/45">
            ARI is ready to process the next operation.
          </div>

          <div className="mt-4 space-y-2 text-[9px] text-black/50">
            <div className="flex items-center gap-2">
              <span className="text-[#4b9b72]">✓</span>
              Data processed
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#4b9b72]">✓</span>
              Patterns identified
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#4b9b72]">✓</span>
              Context applied
            </div>
          </div>
        </div>
      </div>

      {/* CENTRAL ATMOSPHERIC FIELD */}

      <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2">
        <div
          className={`absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-1000 ${
            active ? "scale-110 opacity-70" : "scale-100 opacity-45"
          }`}
          style={{
            background:
              "radial-gradient(circle, rgba(220,225,225,0.75) 0%, rgba(240,242,240,0.35) 38%, transparent 72%)",
          }}
        />

        {/* OUTER RINGS */}

        <div
          className={`absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.07] ${
            thinking
              ? "animate-[spin_7s_linear_infinite]"
              : "animate-[spin_28s_linear_infinite]"
          }`}
        />

        <div
          className={`absolute left-1/2 top-1/2 h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.09] ${
            recording
              ? "animate-[spin_6s_linear_infinite_reverse]"
              : "animate-[spin_22s_linear_infinite_reverse]"
          }`}
        />

        <div
          className={`absolute left-1/2 top-1/2 h-[285px] w-[285px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.13] ${
            speaking
              ? "animate-[spin_5s_linear_infinite]"
              : "animate-[spin_32s_linear_infinite]"
          }`}
        />

        {/* RING HIGHLIGHTS */}

        <div className="absolute left-1/2 top-1/2 h-[285px] w-[285px] -translate-x-1/2 -translate-y-1/2">
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(0,0,0,0.25)]" />

          <span className="absolute bottom-8 right-5 h-1.5 w-1.5 rounded-full bg-black/40" />
        </div>

        {/* CENTRAL SERAPHIM MARK */}

        <div
          className={`relative flex h-[190px] w-[190px] items-center justify-center transition-all duration-700 ${
            error
              ? "scale-95"
              : speaking
                ? "scale-110"
                : recording
                  ? "scale-105"
                  : "scale-100"
          }`}
        >
          {/* Metallic circular frame */}

          <div className="absolute inset-0 rounded-full border border-black/[0.14] bg-gradient-to-br from-white via-[#e5e7e5] to-[#c7cbca] shadow-[inset_0_0_35px_rgba(255,255,255,0.95),0_20px_55px_rgba(0,0,0,0.12)]" />

          {/* Glass interior */}

          <div className="absolute inset-[14px] rounded-full border border-white/90 bg-gradient-to-br from-white via-[#eef0ee] to-[#d2d6d4] shadow-[inset_0_0_30px_rgba(255,255,255,0.95),inset_0_-15px_28px_rgba(0,0,0,0.10)]" />

          {/* SERAPHIM / NUCLEUS MARK */}

          <div
            className={`relative z-10 transition-all duration-700 ${
              active ? "scale-110" : pulse % 2 === 0 ? "scale-100" : "scale-[1.02]"
            }`}
          >
            <svg
              width="170"
              height="170"
              viewBox="0 0 170 170"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="overflow-visible drop-shadow-[0_14px_28px_rgba(35,85,110,0.20)]"
              aria-label="ARI Seraphim nucleus"
              role="img"
            >
              <defs>
                <radialGradient id="ariOrb" cx="58" cy="48" r="70" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.22" stopColor="#f4fbff" />
                  <stop offset="0.48" stopColor="#d2edf5" />
                  <stop offset="0.72" stopColor="#91b9c5" />
                  <stop offset="0.9" stopColor="#62767e" />
                  <stop offset="1" stopColor="#48565c" />
                </radialGradient>

                <radialGradient id="ariOrbGlow" cx="0" cy="0" r="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="0.34" stopColor="#dff8ff" stopOpacity="0.92" />
                  <stop offset="0.68" stopColor="#8eddf7" stopOpacity="0.42" />
                  <stop offset="1" stopColor="#62c8eb" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="ariChrome" x1="18" y1="18" x2="152" y2="152" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.16" stopColor="#dce3e5" />
                  <stop offset="0.34" stopColor="#7d8b90" />
                  <stop offset="0.5" stopColor="#ffffff" />
                  <stop offset="0.66" stopColor="#9aa7ab" />
                  <stop offset="0.84" stopColor="#edf2f4" />
                  <stop offset="1" stopColor="#68767b" />
                </linearGradient>

                <linearGradient id="ariChromeDark" x1="20" y1="20" x2="150" y2="150" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#8c9a9f" />
                  <stop offset="0.5" stopColor="#4c5a60" />
                  <stop offset="1" stopColor="#b7c1c4" />
                </linearGradient>

                <filter id="ariGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="9" />
                </filter>

                <filter id="ariSoftGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3.5" />
                </filter>
              </defs>

              {/* Luminous field */}
              <circle cx="85" cy="85" r="48" fill="url(#ariOrbGlow)" filter="url(#ariGlow)" opacity={active ? "0.9" : "0.68"} />

              {/* Back orbital planes */}
              <g className={speaking ? "ari-orbit-fast" : thinking ? "ari-orbit-medium-reverse" : "ari-orbit-slow-reverse"}>
                <ellipse
                  cx="85"
                  cy="85"
                  rx="67"
                  ry="24"
                  transform="rotate(-28 85 85)"
                  stroke="url(#ariChromeDark)"
                  strokeWidth="2.8"
                  opacity="0.82"
                />
                <ellipse
                  cx="85"
                  cy="85"
                  rx="67"
                  ry="24"
                  transform="rotate(-28 85 85)"
                  stroke="url(#ariChrome)"
                  strokeWidth="1"
                  opacity="0.96"
                />
                <ellipse
                  cx="30"
                  cy="56"
                  rx="2.4"
                  ry="1.7"
                  transform="rotate(-28 30 56)"
                  fill="#ffffff"
                  opacity="0.9"
                />
              </g>

              <g className={speaking ? "ari-orbit-fast-reverse" : thinking ? "ari-orbit-medium" : "ari-orbit-slow"}>
                <ellipse
                  cx="85"
                  cy="85"
                  rx="71"
                  ry="28"
                  transform="rotate(22 85 85)"
                  stroke="url(#ariChromeDark)"
                  strokeWidth="3"
                  opacity="0.84"
                />
                <ellipse
                  cx="85"
                  cy="85"
                  rx="71"
                  ry="28"
                  transform="rotate(22 85 85)"
                  stroke="url(#ariChrome)"
                  strokeWidth="1"
                  opacity="1"
                />
                <ellipse
                  cx="137"
                  cy="109"
                  rx="2.2"
                  ry="1.6"
                  transform="rotate(22 137 109)"
                  fill="#ffffff"
                  opacity="0.86"
                />
              </g>

              {/* Vertical orbit */}
              <g className={speaking ? "ari-orbit-fast-vertical" : thinking ? "ari-orbit-medium-vertical" : "ari-orbit-slow-vertical"}>
                <ellipse
                  cx="85"
                  cy="85"
                  rx="27"
                  ry="69"
                  transform="rotate(-8 85 85)"
                  stroke="url(#ariChromeDark)"
                  strokeWidth="3"
                  opacity="0.84"
                />
                <ellipse
                  cx="85"
                  cy="85"
                  rx="27"
                  ry="69"
                  transform="rotate(-8 85 85)"
                  stroke="url(#ariChrome)"
                  strokeWidth="1"
                />
              </g>

              {/* Orb */}
              <circle cx="85" cy="85" r="38" fill="#536268" opacity="0.35" />
              <circle cx="85" cy="85" r="36" fill="url(#ariOrb)" stroke="#7a8a8f" strokeWidth="1.4" />
              <circle cx="85" cy="85" r="28" fill="url(#ariOrbGlow)" opacity="0.7" />
              <circle cx="85" cy="85" r="14" fill="#f8fdff" opacity="0.94" />

              {/* Internal energy rings */}
              <ellipse
                cx="85"
                cy="85"
                rx="25"
                ry="12"
                transform="rotate(-22 85 85)"
                stroke="#ffffff"
                strokeOpacity="0.42"
                strokeWidth="1"
              />
              <ellipse
                cx="85"
                cy="85"
                rx="30"
                ry="15"
                transform="rotate(24 85 85)"
                stroke="#a9e9fa"
                strokeOpacity="0.28"
                strokeWidth="1"
              />

              {/* Bright surface reflection */}
              <ellipse
                cx="69"
                cy="59"
                rx="19"
                ry="7"
                transform="rotate(-28 69 59)"
                fill="#ffffff"
                opacity="0.44"
                filter="url(#ariSoftGlow)"
              />

              {/* Front orbital plane */}
              <g className={speaking ? "ari-orbit-front-fast" : thinking ? "ari-orbit-front-medium" : "ari-orbit-front-slow"}>
                <path
                  d="M20 82 C44 57 126 57 150 82 C126 107 44 107 20 82Z"
                  stroke="url(#ariChromeDark)"
                  strokeWidth="3.2"
                  opacity="0.86"
                />
                <path
                  d="M20 82 C44 57 126 57 150 82 C126 107 44 107 20 82Z"
                  stroke="url(#ariChrome)"
                  strokeWidth="1"
                />
              </g>

              {/* Tiny celestial points */}
              <circle cx="118" cy="27" r="1.6" fill="#d6f7ff" opacity="0.9" />
              <circle cx="46" cy="131" r="1.5" fill="#ffffff" opacity="0.68" />
            </svg>
          </div>

          {/* Reflection */}

          <div className="absolute left-[57px] top-[45px] h-[20px] w-[38px] rotate-[-35deg] rounded-full bg-white/65 blur-[5px]" />
        </div>

        {/* ARI STATUS */}

        <div className="absolute left-1/2 top-[230px] -translate-x-1/2 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.45em] text-[#4b8063]">
            ARI
          </div>

          <div className="mt-2 text-[9px] uppercase tracking-[0.35em] text-black/35">
            {statusLabel}
          </div>
        </div>

        {/* VOICE WAVEFORM */}

        <div className="absolute left-1/2 top-[265px] flex h-[30px] -translate-x-1/2 items-center gap-[2px]">
          {Array.from({ length: 45 }).map((_, index) => {
            const centerDistance = Math.abs(index - 22);

            const height =
              7 +
              Math.max(0, 16 - centerDistance * 0.65) *
                (active ? 1 : 0.45);

            return (
              <span
                key={index}
                className="w-[2px] rounded-full bg-[#67d89b]/70 transition-all duration-500"
              style={{
              height: `${height}px`,
}}
              />
            );
          })}
        </div>

        <div className="absolute left-1/2 top-[305px] -translate-x-1/2 text-[8px] uppercase tracking-[0.4em] text-black/30">
          {status === "recording" ? "Listening..." : "Voice Active"}
        </div>
      </div>

      {/* SUBTLE BOTTOM INPUT */}

      <div className="absolute bottom-5 left-1/2 z-20 flex w-[58%] -translate-x-1/2 items-center rounded-[18px] border border-white/90 bg-white/60 px-5 py-3 shadow-[0_10px_30px_rgba(30,70,50,0.06)] backdrop-blur-xl">
        <span className="text-[11px] tracking-wide text-black/35">
          Ask ARI anything...
        </span>

        <span className="ml-auto text-black/30">↗</span>
      </div>
    </section>
  );
}