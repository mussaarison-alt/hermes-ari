"use client";

import { useEffect, useState } from "react";

import {
  Bell,
  Brain,
  Check,
  ChevronRight,
  Cpu,
  Database,
  Globe,
  KeyRound,
  Lock,
  Mic,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";

import Sidebar from "../../components/sidebar";
import Topbar from "../../components/topbar";

const sections = [
  {
    title: "General",
    description: "Core ARI behavior and interface preferences.",
    icon: Sparkles,
  },
  {
    title: "Models",
    description: "Choose models and configure provider routing.",
    icon: Brain,
  },
  {
    title: "Voice",
    description: "Configure speech recognition and ARI's voice.",
    icon: Mic,
  },
  {
    title: "Memory",
    description: "Control what ARI remembers and retains.",
    icon: Database,
  },
  {
    title: "Security",
    description: "Credentials, sessions, and access controls.",
    icon: ShieldCheck,
  },
];

type SettingsData = {
  assistantName: string;
  language: "English" | "Danish";
  defaultModel: "Qwen" | "DeepSeek" | "Automatic";
  voiceMode: boolean;
  voiceOutput: boolean;
  notifications: boolean;
  quietMode: boolean;
  requireConfirmation: boolean;
};

const SETTINGS_KEY = "hermes-ari-settings";

const DEFAULT_SETTINGS: SettingsData = {
  assistantName: "ARI",
  language: "English",
  defaultModel: "Qwen",
  voiceMode: true,
  voiceOutput: true,
  notifications: true,
  quietMode: false,
  requireConfirmation: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("General");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SettingsData>;
      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
    } catch {
      // Ignore malformed settings.
    }
  }, []);

  function update<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSavedAt(
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }

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
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#fff000]">
                  System
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  Settings
                </h1>

                <p className="mt-2 text-sm text-black/45">
                  Configure ARI, Hermes, models, voice, and system behavior.
                </p>
              </div>

              <button
                type="button"
                onClick={saveSettings}
                className="flex items-center gap-2 rounded-xl bg-[#fff000] px-5 py-2.5 text-sm font-bold text-[#110545] transition hover:bg-[#fff000]/90"
              >
                <Save size={16} />
                Save Changes
              </button>

            </div>


            {/* SYSTEM STATUS */}

            <div className="mt-7 rounded-2xl border border-[#00e5b0]/15 bg-white/70 p-5">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-4">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#00e5b0]/20 bg-white">

                    <ShieldCheck
                      size={20}
                      className="text-[#00e5b0]"
                    />

                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      Hermes system operational
                    </p>

                    <p className="mt-1 text-xs text-black/45">
                      ARI interface and local configuration are available.
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-2">

                  <span className="h-2 w-2 rounded-full bg-[#00e5b0] shadow-[0_0_10px_#00e5b0]" />

                  <span className="text-xs font-semibold text-[#00e5b0]">
                    ONLINE
                  </span>

                </div>

              </div>

            </div>


            {/* SETTINGS GRID */}

            <div className="mt-6 grid grid-cols-[280px_1fr] gap-5">

              {/* SETTINGS NAV */}

              <aside className="h-fit rounded-2xl border border-white/[0.1] bg-white/70 p-3">

                {sections.map((section, index) => {
                  const Icon = section.icon;

                  return (
                    <button
                      type="button"
                      key={section.title}
                      onClick={() => setActiveSection(section.title)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                        activeSection === section.title
                          ? "bg-[#fff000]/[0.07] text-[#fff000]"
                          : "text-[#a9a3c4] hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <Icon size={17} />

                      <div>
                        <p className="text-xs font-semibold">
                          {section.title}
                        </p>

                        <p className="mt-0.5 text-[9px] text-black/45">
                          {section.description}
                        </p>
                      </div>

                      <ChevronRight
                        size={14}
                        className="ml-auto opacity-50"
                      />
                    </button>
                  );
                })}

              </aside>


              {/* GENERAL SETTINGS */}

              <section className="rounded-2xl border border-white/[0.1] bg-white/70">

                <div className="border-b border-white/[0.08] px-6 py-5">

                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00e5ff]">
                    General
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    ARI Preferences
                  </h2>

                  <p className="mt-1 text-xs text-black/45">
                    Basic behavior and interface settings for your agent.
                  </p>

                </div>


                <div className="divide-y divide-white/[0.06]">

                  <SettingRow
                    icon={Sparkles}
                    title="Assistant name"
                    description="The name shown throughout the ARI interface."
                  >
                    <input
                      value={settings.assistantName}
                      onChange={(event) => update("assistantName", event.target.value)}
                      className="w-40 rounded-lg border border-white/[0.08] bg-white px-3 py-2 text-sm text-white outline-none focus:border-[#00e5ff]/30"
                    />
                  </SettingRow>


                  <SettingRow
                    icon={Globe}
                    title="Language"
                    description="Language used for ARI responses and interface text."
                  >
                    <select
                      value={settings.language}
                      onChange={(event) =>
                        update("language", event.target.value as SettingsData["language"])
                      }
                      className="rounded-lg border border-white/[0.08] bg-white px-3 py-2 text-sm text-white outline-none"
                    >
                      <option>English</option>
                      <option>Danish</option>
                    </select>
                  </SettingRow>


                  <SettingRow
                    icon={Cpu}
                    title="Default model"
                    description="Primary model used for normal ARI requests."
                  >
                    <select
                      value={settings.defaultModel}
                      onChange={(event) =>
                        update("defaultModel", event.target.value as SettingsData["defaultModel"])
                      }
                      className="rounded-lg border border-white/[0.08] bg-white px-3 py-2 text-sm text-white outline-none"
                    >
                      <option>Qwen</option>
                      <option>DeepSeek</option>
                      <option>Automatic</option>
                    </select>
                  </SettingRow>


                  <SettingRow
                    icon={Mic}
                    title="Voice mode"
                    description="Enable voice interaction with ARI."
                  >
                    <Toggle enabled={settings.voiceMode} onChange={(value) => update("voiceMode", value)} />
                  </SettingRow>


                  <SettingRow
                    icon={Volume2}
                    title="Voice output"
                    description="Allow ARI to speak responses aloud."
                  >
                    <Toggle enabled={settings.voiceOutput} onChange={(value) => update("voiceOutput", value)} />
                  </SettingRow>


                  <SettingRow
                    icon={Bell}
                    title="Notifications"
                    description="Receive alerts when missions or tasks change state."
                  >
                    <Toggle enabled={settings.notifications} onChange={(value) => update("notifications", value)} />
                  </SettingRow>


                  <SettingRow
                    icon={Moon}
                    title="Quiet mode"
                    description="Reduce non-essential notifications and activity."
                  >
                    <Toggle enabled={settings.quietMode} onChange={(value) => update("quietMode", value)} />

                  </SettingRow>


                  <SettingRow
                    icon={Lock}
                    title="Require confirmation"
                    description="Ask before ARI performs potentially destructive actions."
                  >
                    <Toggle enabled={settings.requireConfirmation} onChange={(value) => update("requireConfirmation", value)} />
                  </SettingRow>


                  <SettingRow
                    icon={KeyRound}
                    title="API credentials"
                    description="Manage provider credentials securely outside the client."
                  >
                    <button className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold text-[#a9a3c4] transition hover:border-[#00e5ff]/20 hover:text-white">
                      Manage
                    </button>
                  </SettingRow>

                </div>


                {/* FOOTER */}

                <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-4">

                  <p className="text-[10px] text-black/45">
                    Last saved: {savedAt || "not saved"}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-[#00e5b0]">

                    <Check size={13} />

                    {savedAt ? "Settings saved" : "Changes not yet saved"}

                  </div>

                </div>

              </section>

            </div>


            {/* ADVANCED */}

            <div className="mt-6 rounded-2xl border border-white/[0.1] bg-white/70 p-5">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#a0025c]">
                    Advanced
                  </p>

                  <h2 className="mt-2 text-lg font-bold">
                    Agent Configuration
                  </h2>

                  <p className="mt-1 text-xs text-black/45">
                    Advanced Hermes settings will be exposed here once the
                    backend is connected.
                  </p>
                </div>

                <button className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-semibold text-[#777099]">
                  Configure
                </button>

              </div>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}


function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-5">

      <div className="flex min-w-0 items-center gap-4">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white">
          <Icon
            size={17}
            className="text-[#777099]"
          />
        </div>

        <div className="min-w-0">

          <p className="text-sm font-semibold text-white">
            {title}
          </p>

          <p className="mt-1 text-xs text-black/45">
            {description}
          </p>

        </div>

      </div>

      <div className="shrink-0">
        {children}
      </div>

    </div>
  );
}


function Toggle({
  enabled = false,
  onChange,
}: {
  enabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange?.(!enabled)}
      className={`relative h-6 w-11 rounded-full border transition ${
        enabled
          ? "border-[#00e5b0]/40 bg-[#00e5b0]/20"
          : "border-white/[0.1] bg-white"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full transition ${
          enabled
            ? "left-6 bg-[#00e5b0] shadow-[0_0_8px_#00e5b0]"
            : "left-1 bg-[#6f688f]"
        }`}
      />
    </button>
  );
}
