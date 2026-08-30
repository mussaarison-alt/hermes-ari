import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { getHermesPython, getHermesRoot } from "../../../../lib/hermes-runtime";

const HERMES_ROOT = getHermesRoot();
const HERMES_PYTHON = getHermesPython();
const WORKER_SCRIPT = path.join(process.cwd(), "scripts", "transcribe_worker.py");
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const TRANSCRIPTION_TIMEOUT_MS = 5 * 60 * 1000;

type TranscriptionResult = { success: boolean; transcript?: string; provider?: string; error?: string };
type WorkerState = { child: ChildProcessWithoutNullStreams | null; pending: Promise<TranscriptionResult> | null; resolve: ((value: TranscriptionResult) => void) | null; reject: ((reason?: unknown) => void) | null; buffer: string };

type GlobalWithWorker = typeof globalThis & { __hermesTranscribeWorker?: WorkerState };
const state: WorkerState = (globalThis as GlobalWithWorker).__hermesTranscribeWorker ??= { child: null, pending: null, resolve: null, reject: null, buffer: "" };

function ensureWorker() {
  if (state.child && !state.child.killed) return state.child;
  const child = spawn(HERMES_PYTHON, ["-u", WORKER_SCRIPT], { cwd: HERMES_ROOT, env: { ...process.env, PYTHONUTF8: "1" }, stdio: ["pipe", "pipe", "pipe"] });
  state.child = child;
  state.buffer = "";
  child.stdout.on("data", (chunk) => {
    state.buffer += chunk.toString();
    const lines = state.buffer.split(/\r?\n/);
    state.buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim() || !state.resolve) continue;
      try {
        const result = JSON.parse(line) as TranscriptionResult;
        const resolve = state.resolve;
        state.resolve = null;
        state.reject = null;
        state.pending = null;
        resolve(result);
      } catch {
        // Ignore non-JSON worker output.
      }
    }
  });
  child.stderr.on("data", (chunk) => console.error("Hermes transcription worker:", chunk.toString().trim()));
  child.on("error", (error) => { state.child = null; state.reject?.(error); state.resolve = null; state.reject = null; state.pending = null; });
  child.on("exit", () => { state.child = null; if (state.reject) state.reject(new Error("Transcription worker exited.")); state.resolve = null; state.reject = null; state.pending = null; });
  return child;
}

function runHermesTranscription(audioPath: string): Promise<TranscriptionResult> {
  if (state.pending) return Promise.reject(new Error("A transcription is already in progress."));
  ensureWorker();
  const promise = new Promise<TranscriptionResult>((resolve, reject) => { state.resolve = resolve; state.reject = reject; });
  state.pending = promise;
  state.child!.stdin.write(JSON.stringify({ audio_path: audioPath }) + "\n");
  const timeout = setTimeout(() => { state.child?.kill(); state.child = null; state.resolve = null; state.reject = null; state.pending = null; }, TRANSCRIPTION_TIMEOUT_MS);
  return promise.finally(() => clearTimeout(timeout));
}

export async function POST(request: Request) {
  let tempDir = "";
  try {
    const formData = await request.formData();
    const entry = formData.get("audio");
    if (!(entry instanceof File)) return NextResponse.json({ error: "No audio file was provided." }, { status: 400 });
    if (entry.size === 0) return NextResponse.json({ error: "The recorded audio is empty." }, { status: 400 });
    if (entry.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Voice recording is too large. Keep recordings under 20 MB." }, { status: 413 });

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hermes-ui-voice-"));
    const extension = getAudioExtension(entry.type);
    const audioPath = path.join(tempDir, `${randomUUID()}${extension}`);
    await fs.writeFile(audioPath, Buffer.from(await entry.arrayBuffer()));

    const result = await runHermesTranscription(audioPath);
    if (!result.success) return NextResponse.json({ success: false, transcript: "", provider: result.provider || "local", error: result.error || "Hermes could not transcribe the recording." }, { status: 502 });
    return NextResponse.json({ success: true, transcript: result.transcript || "", provider: result.provider || "local" });
  } catch (error) {
    console.error("Voice transcription API error:", error);
    return NextResponse.json({ success: false, transcript: "", error: error instanceof Error ? error.message : "Unable to transcribe audio." }, { status: 500 });
  } finally {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function getAudioExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mp4") || normalized.includes("m4a")) return ".m4a";
  if (normalized.includes("ogg")) return ".ogg";
  if (normalized.includes("wav")) return ".wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return ".mp3";
  return ".webm";
}
