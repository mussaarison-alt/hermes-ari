"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  Target,
  ListTodo,
  BookOpen,
  Brain,
  Plug,
  BarChart3,
  Settings,
  MessageCircle,
} from "lucide-react";

import AriLogo from "./ari-logo";

const navigation = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Missions",
    href: "/missions",
    icon: Target,
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: ListTodo,
  },
  {
    label: "Knowledge",
    href: "/knowledge",
    icon: BookOpen,
  },
  {
    label: "Memory",
    href: "/memory",
    icon: Brain,
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: Plug,
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[270px] shrink-0 flex-col border-r border-[#b7d6e9]/65 !bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(219,234,247,0.76))] shadow-[inset_-1px_0_0_rgba(255,255,255,0.88),16px_0_42px_rgba(74,122,164,0.1)] backdrop-blur-2xl">

      {/* BRAND */}

      <div className="flex h-[100px] items-center border-b border-[#b8edff]/12 px-6">

        <AriLogo
          variant="full"
          size={120}
        />

      </div>


      {/* NAVIGATION */}

      <nav className="flex-1 px-4 py-7">

        <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#63809a]">
          Navigation
        </p>

        <div className="space-y-1">

          {navigation.map((item) => {

            const Icon = item.icon;

            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex h-11 w-full items-center rounded-xl border border-transparent px-3 text-sm transition ${
                  active
                    ? "border-[#76e9ff]/35 bg-[#63e3ff]/[0.10] text-[#c5f7ff] shadow-[inset_0_1px_0_rgba(233,252,255,0.14),0_8px_20px_rgba(19,173,255,0.08)]"
                    : "text-[#455f76] hover:border-[#acd7eb]/60 hover:bg-white/[0.46] hover:text-[#1f3a51]"
                }`}
              >

                <Icon
                  size={18}
                  className={
                    active
                      ? "text-[#72eaff]"
                      : "text-[#668198]"
                  }
                />

                <span className="ml-4">
                  {item.label}
                </span>

                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#72eaff] shadow-[0_0_8px_rgba(114,234,255,0.75)]" />
                )}

              </Link>
            );

          })}

        </div>


        {/* SETTINGS */}

        <div className="mt-6 border-t border-[#b8edff]/10 pt-5">

          <Link
            href="/settings"
            className={`flex h-11 w-full items-center rounded-xl border border-transparent px-3 text-sm transition ${
              pathname.startsWith("/settings")
                ? "border-[#76e9ff]/35 bg-[#63e3ff]/[0.10] text-[#c5f7ff] shadow-[inset_0_1px_0_rgba(233,252,255,0.14),0_8px_20px_rgba(19,173,255,0.08)]"
                : "text-[#455f76] hover:border-[#acd7eb]/60 hover:bg-white/[0.46] hover:text-[#1f3a51]"
            }`}
          >

            <Settings
              size={18}
              className={
                pathname.startsWith("/settings")
                  ? "text-[#72eaff]"
                  : "text-[#668198]"
              }
            />

            <span className="ml-4">
              Settings
            </span>

          </Link>

        </div>

      </nav>


      {/* ARI STATUS */}

      <div className="border-t border-[#b8edff]/12 p-5">

        <div className="rounded-2xl border border-[#a9d5e8]/65 bg-[linear-gradient(145deg,rgba(255,255,255,0.76),rgba(210,229,243,0.64))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(74,122,164,0.1)] backdrop-blur-xl">

          <div className="flex items-center">

            <AriLogo
              variant="symbol"
              size={42}
            />

            <div className="ml-3">

              <p className="text-sm font-semibold text-[#263c52]">
                ARI
              </p>

              <div className="mt-1 flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#78f0ff] shadow-[0_0_8px_rgba(120,240,255,0.75)]" />

                <span className="text-[11px] text-[#a9f7ff]">
                  Online
                </span>

              </div>

            </div>

          </div>


          <Link
            href="/missions"
            className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#9aefff]/35 bg-[#75e7ff]/[0.10] text-xs font-medium text-[#c5f7ff] shadow-[inset_0_1px_0_rgba(244,254,255,0.14)] transition hover:border-[#bdf5ff]/55 hover:bg-[#75e7ff]/[0.16]"
          >

            <MessageCircle size={14} />

            Chat with ARI

          </Link>

        </div>

      </div>

    </aside>
  );
}
