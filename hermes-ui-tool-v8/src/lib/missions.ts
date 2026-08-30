export type MissionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type Mission = {
  id: string;
  objective: string;
  status: MissionStatus;
  response: string;
  createdAt: string;
  completedAt?: string;
  tools: string[];
};

const STORAGE_KEY = "hermes-ari-missions";

export function getMissions(): Mission[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as Mission[];
  } catch {
    return [];
  }
}

export function saveMissions(missions: Mission[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(missions)
  );
}

export function createMission(
  objective: string
): Mission {
  return {
    id: crypto.randomUUID(),
    objective,
    status: "queued",
    response: "",
    createdAt: new Date().toISOString(),
    tools: [],
  };
}