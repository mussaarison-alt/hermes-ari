import Link from "next/link";

import {
    Search,
    Bell,
    Settings,
    Command,
} from "lucide-react";

export default function Topbar() {
    return (
        <header className="flex h-[82px] shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#07031f]/80 px-8 backdrop-blur-xl">

            {/* TITLE */}

            <div>

                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#00e5ff]">
                    Command Center
                </p>

                <h2 className="mt-1 text-lg font-semibold text-white">
                    Dashboard
                </h2>

            </div>


            {/* CONTROLS */}

            <div className="flex items-center gap-3">

                {/* SEARCH */}

                <div className="flex h-10 w-[320px] items-center gap-3 rounded-xl border border-white/[0.09] bg-[#0d0730] px-3">

                    <Search
                        size={17}
                        className="text-[#6f688f]"
                    />

                    <input
                        type="text"
                        placeholder="Search anything..."
                        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f688f]"
                    />

                    <div className="flex items-center gap-1 text-[10px] text-[#6f688f]">

                        <Command size={11} />

                        K

                    </div>

                </div>


                {/* NOTIFICATIONS */}

                <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-[#0d0730] text-[#a9a3c4]">

                    <Bell size={17} />

                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#fff000] shadow-[0_0_7px_#fff000]" />

                </button>


                {/* SETTINGS */}

                <Link
                    href="/settings"
                    aria-label="Open settings"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-[#0d0730] text-[#a9a3c4] transition hover:border-[#00e5ff]/30 hover:text-white"
                  >
                    <Settings size={17} />
                  </Link>


                {/* USER */}

                <div className="ml-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#fff000]/60 bg-[#110545] text-sm font-bold text-[#fff000]">
                    M
                </div>

            </div>

        </header>
    );
}