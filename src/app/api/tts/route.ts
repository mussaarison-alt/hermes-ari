import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { getHermesPython, getHermesRoot } from "../../../lib/hermes-runtime";

const HERMES_ROOT = getHermesRoot();
const HERMES_PYTHON = getHermesPython();
const WORKER_SCRIPT = path.join(process.cwd(), "scripts", "tts_worker.py");
const TTS_TIMEOUT_MS = 120_000;

type WorkerState = { child: ChildProcessWithoutNullStreams | null; busy: boolean; resolve: ((value: void) => void) | null; reject: ((reason?: unknown) => void) | null; buffer: string };
type GlobalWithWorker = typeof globalThis & { __hermesTtsWorker?: WorkerState };
const state: WorkerState = (globalThis as GlobalWithWorker).__hermesTtsWorker ??= { child: null, busy: false, resolve: null, reject: null, buffer: "" };

function ensureWorker() {
  if (state.child && !state.child.killed) return state.child;
  const child = spawn(HERMES_PYTHON, ["-u", WORKER_SCRIPT], { cwd: HERMES_ROOT, env: { ...process.env, PYTHONUTF8: "1" }, stdio: ["pipe", "pipe", "pipe"] });
  state.child = child; state.buffer = "";
  child.stdout.on("data", (chunk) => {
    state.buffer += chunk.toString(); const lines = state.buffer.split(/\r?\n/); state.buffer = lines.pop() ?? "";
    for (const line of lines) { if (!line.trim() || !state.resolve) continue; try { const result = JSON.parse(line) as { success: boolean; error?: string }; const resolve = state.resolve; const reject = state.reject; state.resolve = null; state.reject = null; state.busy = false; if (result.success) resolve(); else reject?.(new Error(result.error || "TTS worker failed.")); } catch {} }
  });
  child.stderr.on("data", (chunk) => console.error("Hermes TTS worker:", chunk.toString().trim()));
  child.on("error", (error) => { state.child = null; state.busy = false; state.reject?.(error); state.resolve = null; state.reject = null; });
  child.on("exit", () => { state.child = null; state.busy = false; state.reject?.(new Error("TTS worker exited.")); state.resolve = null; state.reject = null; });
  return child;
}

function runTTS(text: string, outputPath: string): Promise<void> {
  if (state.busy) return Promise.reject(new Error("TTS worker is busy."));
  ensureWorker(); state.busy = true;
  const promise = new Promise<void>((resolve, reject) => { state.resolve = resolve; state.reject = reject; });
  state.child!.stdin.write(JSON.stringify({ text, output_path: outputPath, voice: "en-US-AriaNeural" }) + "\n");
  const timeout = setTimeout(() => { state.child?.kill(); state.child = null; state.busy = false; state.resolve = null; state.reject = null; }, TTS_TIMEOUT_MS);
  return promise.finally(() => clearTimeout(timeout));
}

export async function POST(request: Request) {
  let tempDir = "";
  try {
    const body = await request.json() as { text?: string };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "No text was provided." }, { status: 400 });
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hermes-ui-tts-"));
    const outputPath = path.join(tempDir, `${randomUUID()}.mp3`);
    await runTTS(text, outputPath);
    const audio = await fs.readFile(outputPath);
    return new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg", "Content-Length": String(audio.length), "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ARI TTS error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate ARI voice." }, { status: 500 });
  } finally { if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }); }
}
