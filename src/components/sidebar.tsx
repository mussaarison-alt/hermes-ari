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
    <aside className="flex h-screen w-[270px] shrink-0 flex-col border-r border-white/[0.08] bg-[#090329]">

      {/* BRAND */}

      <div className="flex h-[100px] items-center border-b border-white/[0.08] px-6">

        <AriLogo
          variant="full"
          size={120}
        />

      </div>


      {/* NAVIGATION */}

      <nav className="flex-1 px-4 py-7">

        <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#6f688f]">
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
                className={`flex h-11 w-full items-center rounded-xl px-3 text-sm transition ${
                  active
                    ? "border border-[#fff000]/40 bg-[#fff000]/[0.07] text-[#fff000]"
                    : "text-[#a9a3c4] hover:bg-white/[0.04] hover:text-white"
                }`}
              >

                <Icon
                  size={18}
                  className={
                    active
                      ? "text-[#fff000]"
                      : "text-[#6f688f]"
                  }
                />

                <span className="ml-4">
                  {item.label}
                </span>

                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#fff000] shadow-[0_0_8px_#fff000]" />
                )}

              </Link>
            );

          })}

        </div>


        {/* SETTINGS */}

        <div className="mt-6 border-t border-white/[0.08] pt-5">

          <Link
            href="/settings"
            className={`flex h-11 w-full items-center rounded-xl px-3 text-sm transition ${
              pathname.startsWith("/settings")
                ? "text-[#fff000]"
                : "text-[#a9a3c4] hover:bg-white/[0.04] hover:text-white"
            }`}
          >

            <Settings
              size={18}
              className="text-[#6f688f]"
            />

            <span className="ml-4">
              Settings
            </span>

          </Link>

        </div>

      </nav>


      {/* ARI STATUS */}

      <div className="border-t border-white/[0.08] p-5">

        <div className="rounded-2xl border border-[#00e5ff]/20 bg-[#110545] p-4">

          <div className="flex items-center">

            <AriLogo
              variant="symbol"
              size={42}
            />

            <div className="ml-3">

              <p className="text-sm font-semibold text-white">
                ARI
              </p>

              <div className="mt-1 flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#00e5b0] shadow-[0_0_8px_#00e5b0]" />

                <span className="text-[11px] text-[#00e5b0]">
                  Online
                </span>

              </div>

            </div>

          </div>


          <Link
            href="/missions"
            className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#a0025c]/50 bg-[#a0025c]/10 text-xs font-medium text-[#ff69b7] transition hover:bg-[#a0025c]/20"
          >

            <MessageCircle size={14} />

            Chat with ARI

          </Link>

        </div>

      </div>

    </aside>
  );
}