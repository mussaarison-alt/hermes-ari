"use client";

"use client";

import { useState } from "react";

type NewMissionProps = {
  onCreate: (mission: {
    title: string;
    priority: string;
  }) => void;
};
export default function NewMission({ onCreate }: NewMissionProps) {
  const [open, setOpen] = useState(false);
  const [mission, setMission] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [submitted, setSubmitted] = useState(false);

  function handleExecute() {
  if (!mission.trim()) return;

  setSubmitted(true);

  onCreate({
    title: mission.trim(),
    priority,
  });

  setTimeout(() => {
    setOpen(false);
    setSubmitted(false);
    setMission("");
    setPriority("Normal");
  }, 1200);
}

  return (
    <>
      {/* OPEN BUTTON */}

      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[#fff000]/60 bg-[#fff000]/[0.06] px-5 py-2.5 text-sm font-semibold text-[#fff000] transition hover:bg-[#fff000]/[0.12]"
      >
        + New Mission
      </button>


      {/* MODAL */}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">

          {/* BACKDROP */}

          <button
            aria-label="Close mission window"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />


          {/* WINDOW */}

          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-[#00e5ff]/20 bg-white/70 shadow-[0_0_60px_rgba(0,229,255,0.08)]">

            {/* HEADER */}

            <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5">

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#fff000]">
                  Mission Control
                </p>

                <h2 className="mt-2 text-xl font-bold text-white">
                  New Mission
                </h2>

                <p className="mt-1 text-xs text-black/45">
                  Give ARI an objective to execute.
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-[#777099] transition hover:border-white/[0.2] hover:text-white"
              >
                ×
              </button>

            </div>


            {/* BODY */}

            <div className="p-6">

              <label className="text-xs font-semibold uppercase tracking-wider text-[#777099]">
                Mission Objective
              </label>

              <textarea
                value={mission}
                onChange={(event) => setMission(event.target.value)}
                placeholder="Tell ARI what you want accomplished..."
                rows={6}
                className="mt-3 w-full resize-none rounded-xl border border-white/[0.1] bg-white p-4 text-sm text-white outline-none placeholder:text-[#4f496d] transition focus:border-[#00e5ff]/40"
              />


              {/* OPTIONS */}

              <div className="mt-5">

                <label className="text-xs font-semibold uppercase tracking-wider text-[#777099]">
                  Priority
                </label>

                <div className="mt-3 flex gap-2">

                  {["Low", "Normal", "High"].map((level) => (
                    <button
                      key={level}
                      onClick={() => setPriority(level)}
                      className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${
                        priority === level
                          ? "border-[#fff000]/60 bg-[#fff000]/[0.08] text-[#fff000]"
                          : "border-white/[0.08] text-[#777099] hover:border-white/[0.18] hover:text-white"
                      }`}
                    >
                      {level}
                    </button>
                  ))}

                </div>

              </div>


              {/* FOOTER */}

              <div className="mt-7 flex items-center justify-between border-t border-white/[0.08] pt-5">

                <p className="text-xs text-black/45">
                  {mission.length} characters
                </p>

                <div className="flex gap-3">

                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-white/[0.1] px-4 py-2.5 text-xs font-semibold text-[#777099] transition hover:border-white/[0.2] hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleExecute}
                    disabled={!mission.trim() || submitted}
                    className="rounded-lg border border-[#fff000]/60 bg-[#fff000] px-5 py-2.5 text-xs font-bold text-[#110545] transition hover:bg-[#fff000]/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitted ? "MISSION QUEUED..." : "EXECUTE →"}
                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>
      )}
    </>
  );
}