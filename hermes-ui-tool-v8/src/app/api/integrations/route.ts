import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(process.cwd());

type IntegrationStatus =
  | "Connected"
  | "Available"
  | "Not Connected";

type Integration = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  detail: string;
};

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function canConnect(
  host: string,
  port: number,
  timeout = 1000,
) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(
      `http://${host}:${port}`,
      {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      },
    );

    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function getHermesVersion() {
  const command =
    process.platform === "win32"
      ? "hermes.exe"
      : "hermes";

  try {
    const result = await execFileAsync(
      command,
      ["--version"],
      {
        timeout: 3000,
        windowsHide: true,
      },
    );

    return (
      result.stdout.trim() ||
      result.stderr.trim() ||
      null
    );
  } catch {
    return null;
  }
}

async function getGitRemote() {
  try {
    const result = await execFileAsync(
      "git",
      [
        "-C",
        PROJECT_ROOT,
        "remote",
        "get-url",
        "origin",
      ],
      {
        timeout: 3000,
        windowsHide: true,
      },
    );

    return result.stdout.trim();
  } catch {
    return null;
  }
}

async function detectGateway(
  hermesHome: string,
) {
  if (!hermesHome) {
    return {
      installed: false,
      running: false,
    };
  }

  const pidPath = path.join(
    hermesHome,
    "gateway.pid",
  );

  const statePath = path.join(
    hermesHome,
    "gateway_state.json",
  );

  const installed =
    await pathExists(hermesHome);

  const running =
    installed &&
    (await pathExists(pidPath)) &&
    (await pathExists(statePath));

  return {
    installed,
    running,
  };
}

export async function GET() {
  try {
    const hermesHome =
      process.env.HERMES_HOME || "";

    const apiPort = Number(
      process.env.API_SERVER_PORT ||
        8642,
    );

    const hermesVersion =
      await getHermesVersion();

    const hermesApiRunning =
      await canConnect(
        "127.0.0.1",
        apiPort,
      );

    const ollamaRunning =
      await canConnect(
        "127.0.0.1",
        11434,
      );

    const knowledgeExists =
      await pathExists(
        path.join(
          PROJECT_ROOT,
          "knowledge",
        ),
      );

    const missionCodeExists =
      await pathExists(
        path.join(
          PROJECT_ROOT,
          "src",
          "lib",
          "missions.ts",
        ),
      );

    const gitRemote =
      await getGitRemote();

    const gateway =
      await detectGateway(
        hermesHome,
      );

    const emailConfigured =
      Boolean(
        process.env.GMAIL_CLIENT_ID ||
          process.env.EMAIL_API_KEY ||
          process.env.IMAP_HOST,
      );

    const discordConfigured =
      Boolean(
        process.env.DISCORD_BOT_TOKEN,
      );

    const integrations: Integration[] = [
      {
        id: "hermes-agent",
        name: "Hermes Agent",
        description:
          "Core agent runtime powering ARI.",
        category: "Core",
        status: hermesVersion
          ? "Connected"
          : "Not Connected",
        detail:
          hermesVersion ||
          "Hermes Agent was not found on PATH.",
      },

      {
        id: "hermes-api",
        name: "Hermes API",
        description:
          "Local OpenAI-compatible API used by ARI.",
        category: "Core",
        status: hermesApiRunning
          ? "Connected"
          : "Not Connected",
        detail: hermesApiRunning
          ? `API responding on 127.0.0.1:${apiPort}.`
          : `No response from 127.0.0.1:${apiPort}.`,
      },

      {
        id: "ollama",
        name: "Ollama",
        description:
          "Local model inference service.",
        category: "AI",
        status: ollamaRunning
          ? "Connected"
          : "Not Connected",
        detail: ollamaRunning
          ? "Ollama is reachable on port 11434."
          : "Ollama is not reachable.",
      },

      {
        id: "knowledge",
        name: "Knowledge Base",
        description:
          "Project files and imported knowledge sources.",
        category: "Research",
        status: knowledgeExists
          ? "Connected"
          : "Available",
        detail: knowledgeExists
          ? "Knowledge storage is available."
          : "Knowledge storage will be created when needed.",
      },

      {
        id: "missions",
        name: "Mission Store",
        description:
          "Mission execution and persistence layer.",
        category: "Core",
        status: missionCodeExists
          ? "Connected"
          : "Not Connected",
        detail: missionCodeExists
          ? "Mission persistence module detected."
          : "Mission persistence module was not found.",
      },

      {
        id: "github",
        name: "GitHub",
        description:
          "Repository and source-control integration.",
        category: "Development",
        status: gitRemote
          ? "Connected"
          : "Not Connected",
        detail: gitRemote
          ? gitRemote
          : "No Git origin remote is configured.",
      },

      {
        id: "email",
        name: "Email",
        description:
          "Email connectivity for messaging and automation.",
        category: "Communication",
        status: emailConfigured
          ? "Available"
          : "Not Connected",
        detail: emailConfigured
          ? "Email configuration detected."
          : "No email provider configuration detected.",
      },

      {
        id: "discord",
        name: "Discord",
        description:
          "Discord messaging integration.",
        category: "Communication",
        status: discordConfigured
          ? "Available"
          : "Not Connected",
        detail: discordConfigured
          ? "Discord bot configuration detected."
          : "No Discord bot configuration detected.",
      },

      {
        id: "gateway",
        name: "Hermes Gateway",
        description:
          "Messaging gateway and scheduler runtime.",
        category: "Automation",
        status: gateway.running
          ? "Connected"
          : gateway.installed
            ? "Available"
            : "Not Connected",
        detail: gateway.running
          ? "Gateway appears to be running."
          : gateway.installed
            ? "Hermes is installed but the gateway is not running."
            : "Hermes gateway installation was not detected.",
      },
    ];

    const connected =
      integrations.filter(
        (item) =>
          item.status === "Connected",
      ).length;

    const available =
      integrations.filter(
        (item) =>
          item.status === "Available",
      ).length;

    return NextResponse.json({
      integrations,
      connected,
      available,
      total: integrations.length,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Integrations API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to inspect integration status.",
      },
      {
        status: 500,
      },
    );
  }
}