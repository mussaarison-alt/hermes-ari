import os from "os";
import path from "path";

export function getHermesHome(): string {
  const override = process.env.HERMES_HOME?.trim();
  if (override) return override;

  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "hermes",
    );
  }

  return path.join(os.homedir(), ".hermes");
}

export function getHermesRoot(): string {
  const override = process.env.HERMES_AGENT_ROOT?.trim();
  if (override) return override;

  return path.join(getHermesHome(), "hermes-agent");
}

export function getHermesPython(): string {
  const root = getHermesRoot();

  return process.platform === "win32"
    ? path.join(root, "venv", "Scripts", "python.exe")
    : path.join(root, "venv", "bin", "python");
}

export function getHermesMemoryDirectory(): string {
  return path.join(getHermesHome(), "memories");
}
