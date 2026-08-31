import Link from "next/link";

import {
    Search,
    Bell,
    Settings,
    Command,
} from "lucide-react";

export default function Topbar() {
    return (
        <header className="flex h-[82px] shrink-0 items-center justify-between border-b border-[#b9d8ea]/65 !bg-[linear-gradient(135deg,rgba(249,253,255,0.94),rgba(214,229,244,0.82))] px-8 !shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_30px_rgba(20,73,120,0.12)] backdrop-blur-xl">

            {/* TITLE */}

            <div>

                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#268cad]">
                    Command Center
                </p>

                <h2 className="mt-1 text-lg font-semibold text-[#1b2e45]">
                    Dashboard
                </h2>

            </div>


            {/* CONTROLS */}

            <div className="flex items-center gap-3">

                {/* SEARCH */}

                <div className="flex h-10 w-[320px] items-center gap-3 rounded-xl border border-[#b9d8ea]/70 bg-white/[0.48] px-3 !shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_5px_14px_rgba(24,88,134,0.08)] backdrop-blur-xl">

                    <Search
                        size={17}
                        className="text-[#60809c]"
                    />

                    <input
                        type="text"
                        placeholder="Search anything..."
                        className="min-w-0 flex-1 bg-transparent text-sm text-[#26394e] outline-none !placeholder:text-[#7890a6]"
                    />

                    <div className="flex items-center gap-1 text-[10px] text-[#66829d]">

                        <Command size={11} />

                        K

                    </div>

                </div>


                {/* NOTIFICATIONS */}

                <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#b9d8ea]/70 bg-white/[0.48] text-[#496a87] !shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_5px_14px_rgba(24,88,134,0.08)] backdrop-blur-xl transition hover:border-[#83dff5]/75 hover:bg-white/[0.64] hover:text-[#247f9d]">

                    <Bell size={17} />

                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#36caef] shadow-[0_0_7px_rgba(54,202,239,0.72)]" />

                </button>


                {/* SETTINGS */}

                <Link
                    href="/settings"
                    aria-label="Open settings"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#b9d8ea]/70 bg-white/[0.48] text-[#496a87] !shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_5px_14px_rgba(24,88,134,0.08)] backdrop-blur-xl transition hover:border-[#83dff5]/75 hover:bg-white/[0.64] hover:text-[#247f9d]"
                  >
                    <Settings size={17} />
                  </Link>


                {/* USER */}

                <div className="ml-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#99dff2]/75 bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(187,217,235,0.78))] text-sm font-bold text-[#1b6684] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_5px_14px_rgba(24,88,134,0.12)]">
                    M
                </div>

            </div>

        </header>
    );
}
