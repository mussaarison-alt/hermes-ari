"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Square, Volume2 } from "lucide-react";

type VoiceStatus =
  | "ready"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const HISTORY_KEY = "hermes-ari-voice-history";
const MAX_HISTORY = 20;

export default function AriCoreVoice() {
  const [status, setStatus] = useState<VoiceStatus>("ready");
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const responseRef = useRef("");
  const requestControllerRef = useRef<AbortController | null>(null);
  const ttsControllerRef = useRef<AbortController | null>(null);
  const speechResolveRef = useRef<(() => void) | null>(null);
  const bargeAnimationRef = useRef<number | null>(null);
  const bargeStreamRef = useRef<MediaStream | null>(null);
  const bargeActiveRef = useRef(false);
  const interruptedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const safe = parsed.filter(
        (message): message is Message =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string",
      );

      setHistory(safe.slice(-MAX_HISTORY));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history.slice(-MAX_HISTORY)),
      );
    } catch {
      // Best effort only.
    }
  }, [history]);

  useEffect(() => {
    return () => {
      interruptedRef.current = true;
      requestControllerRef.current?.abort();
      ttsControllerRef.current?.abort();
      audioRef.current?.pause();
      speechResolveRef.current?.();
      stopBargeInMonitor();

      if (recorderRef.current?.state !== "inactive") {
        recorderRef.current?.stop();
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const busy =
    status === "recording" ||
    status === "transcribing" ||
    status === "thinking" ||
    status === "speaking";

  const statusLabel =
    status === "recording"
      ? "LISTENING"
      : status === "transcribing"
        ? "TRANSCRIBING"
        : status === "thinking"
          ? "THINKING"
          : status === "speaking"
            ? "SPEAKING"
            : status === "error"
              ? "SIGNAL ERROR"
              : "READY TO ASSIST";

  const active =
    status === "recording" ||
    status === "thinking" ||
    status === "speaking";

  async function submitText(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setTranscript(text);
    await askAri(text);
  }

  async function startRecording(existingStream?: MediaStream) {
    interruptedRef.current = false;
    setError("");
    setTranscript("");
    setResponse("");

    try {
      const stream =
        existingStream ??
        (await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }));

      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        void transcribeRecording(recorder);
      };

      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : "Unable to access the microphone.",
      );
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function transcribeRecording(recorder: MediaRecorder) {
    setStatus("transcribing");

    try {
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });

      if (blob.size === 0) {
        throw new Error("The recording was empty.");
      }

      const extension =
        mimeType.includes("mp4") || mimeType.includes("m4a")
          ? ".m4a"
          : mimeType.includes("ogg")
            ? ".ogg"
            : ".webm";

      const formData = new FormData();
      formData.append(
        "audio",
        new File([blob], `voice${extension}`, { type: mimeType }),
      );

      const transcriptionResponse = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: formData,
      });

      const result = (await transcriptionResponse.json()) as {
        success?: boolean;
        transcript?: string;
        error?: string;
      };

      if (!transcriptionResponse.ok || !result.success) {
        throw new Error(result.error || "Transcription failed.");
      }

      const text = result.transcript?.trim();
      if (!text) {
        throw new Error("No speech was detected.");
      }

      setTranscript(text);
      await askAri(text);
    } catch (err) {
      console.error("Transcription error:", err);
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Unable to transcribe audio.",
      );
    }
  }

  function isLatestNewsRequest(text: string): boolean {
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    const latest = /\b(latest|newest|most recent|recent|today|today's)\b/;
    const news = /\b(news|headlines|updates|stories)\b/;
    return latest.test(normalized) && news.test(normalized);
  }

  async function askAri(text: string) {
    interruptedRef.current = false;
    setStatus("thinking");
    setError("");
    setResponse("");

    const conversation = [
      ...history,
      { role: "user" as const, content: text },
    ].slice(-MAX_HISTORY);

    setHistory(conversation);
    responseRef.current = "";

    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const endpoint = isLatestNewsRequest(text) ? "/api/news" : "/api/ari";
      const body = isLatestNewsRequest(text)
        ? { query: text }
        : { messages: conversation, voice: true };

      const ariResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!ariResponse.ok) {
        throw new Error(
          (await ariResponse.text()) ||
            `ARI returned HTTP ${ariResponse.status}.`,
        );
      }

      if (!ariResponse.body) {
        throw new Error("ARI returned no response body.");
      }

      const reader = ariResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;

          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const chunk = event.choices?.[0]?.delta?.content;
            if (typeof chunk !== "string") continue;

            responseRef.current += chunk;
            setResponse(responseRef.current);
          } catch {
            // Ignore malformed SSE chunks.
          }
        }
      }

      const finalResponse = responseRef.current.trim();
      if (!finalResponse) {
        throw new Error("ARI returned an empty response.");
      }

      setHistory((current) =>
        [
          ...current,
          { role: "assistant" as const, content: finalResponse },
        ].slice(-MAX_HISTORY),
      );

      setStatus("speaking");
      await speak(finalResponse);

      if (!interruptedRef.current) {
        setStatus("ready");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (!interruptedRef.current) {
          setStatus("ready");
        }
        return;
      }

      console.error("ARI request failed:", err);
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "ARI could not process the request.",
      );
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }

  async function speak(text: string) {
    const controller = new AbortController();
    ttsControllerRef.current = controller;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) ||
            `TTS returned HTTP ${response.status}.`,
        );
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("TTS returned empty audio.");
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      startBargeInMonitor();

      await new Promise<void>((resolve, reject) => {
        speechResolveRef.current = resolve;

        audio.onended = () => {
          stopBargeInMonitor();
          speechResolveRef.current = null;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          stopBargeInMonitor();
          speechResolveRef.current = null;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          reject(new Error("The browser could not play ARI audio."));
        };

        void audio.play().catch(reject);
      });
    } catch (err) {
      stopBargeInMonitor();

      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      console.error("TTS error:", err);
    } finally {
      if (ttsControllerRef.current === controller) {
        ttsControllerRef.current = null;
      }
    }
  }

  async function interruptAssistant(startListening: boolean) {
    interruptedRef.current = true;
    requestControllerRef.current?.abort();
    ttsControllerRef.current?.abort();
    stopBargeInMonitor(startListening);

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }

    speechResolveRef.current?.();
    speechResolveRef.current = null;
    setStatus("ready");

    if (startListening) {
      await startRecording(bargeStreamRef.current ?? undefined);
    }
  }

  function stopBargeInMonitor(preserveStream = false) {
    bargeActiveRef.current = false;

    if (bargeAnimationRef.current !== null) {
      cancelAnimationFrame(bargeAnimationRef.current);
      bargeAnimationRef.current = null;
    }

    if (!preserveStream) {
      bargeStreamRef.current?.getTracks().forEach((track) => track.stop());
      bargeStreamRef.current = null;
    }
  }

  async function startBargeInMonitor() {
    if (bargeActiveRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      bargeStreamRef.current = stream;
      bargeActiveRef.current = true;

      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextCtor) {
        return;
      }

      const context = new AudioContextCtor();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      let loudFrames = 0;
      const startedAt = performance.now();

      const monitor = () => {
        if (!bargeActiveRef.current || status !== "speaking") {
          void context.close();
          return;
        }

        analyser.getByteTimeDomainData(data);

        let sum = 0;
        for (const value of data) {
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / data.length);
        const warmedUp = performance.now() - startedAt > 350;

        if (warmedUp && rms > 0.065) {
          loudFrames += 1;
        } else {
          loudFrames = Math.max(0, loudFrames - 1);
        }

        if (loudFrames >= 8) {
          bargeActiveRef.current = false;
          void context.close();
          void interruptAssistant(true);
          return;
        }

        bargeAnimationRef.current = requestAnimationFrame(monitor);
      };

      bargeAnimationRef.current = requestAnimationFrame(monitor);
    } catch {
      // Automatic barge-in is best effort. The interrupt button still works.
    }
  }

  const micButtonLabel =
    status === "recording"
      ? "Stop recording"
      : status === "speaking"
        ? "Interrupt ARI and start listening"
        : status === "thinking" || status === "transcribing"
          ? "Cancel ARI"
          : "Start recording";

  return (
    <section className="relative mt-6 min-h-[610px] overflow-hidden rounded-[30px] border border-sky-100 bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#f4f9fc_35%,#eaf3f8_68%,#e2edf4_100%)] shadow-[0_30px_100px_rgba(63,145,190,0.16)]">
      <div
        className={`pointer-events-none absolute left-1/2 top-[45%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-1000 ${active ? "scale-110 opacity-90" : "scale-100 opacity-75"}`}
        style={{
          background:
            "radial-gradient(circle, rgba(185,235,255,0.95) 0%, rgba(210,243,255,0.65) 28%, rgba(220,246,255,0.28) 52%, transparent 73%)",
          filter: "blur(10px)",
        }}
      />

      <div className="absolute left-7 top-6 z-20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-slate-500">ARI</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Advanced Reasoning Intelligence</p>
      </div>

      <div className="absolute right-7 top-6 z-20 flex items-center gap-2 rounded-full border border-white/90 bg-white/65 px-4 py-2 shadow-[0_8px_25px_rgba(65,120,150,0.08)] backdrop-blur-xl">
        <span
          className={`h-2 w-2 rounded-full ${status === "error" ? "bg-rose-400" : status === "recording" ? "bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.75)]" : "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]"}`}
        />
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500">{statusLabel}</span>
      </div>

      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/70 transition-all duration-700 ${active ? "h-[390px] w-[390px] opacity-100" : "h-[350px] w-[350px] opacity-80"}`} />
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100 transition-all duration-700 ${active ? "h-[320px] w-[320px]" : "h-[290px] w-[290px]"}`} />
        <div className="relative flex h-[240px] w-[240px] items-center justify-center">
          <div className={`absolute inset-0 rounded-full bg-white/75 shadow-[inset_0_0_45px_rgba(255,255,255,1),0_25px_70px_rgba(72,165,205,0.18)] backdrop-blur-sm transition-transform duration-700 ${active ? "scale-110" : "scale-100"}`} />
          <div className="absolute inset-[14px] rounded-full border border-white bg-[radial-gradient(circle_at_38%_30%,#ffffff_0%,#ecfaff_28%,#c7edf9_58%,#8fc9dc_82%,#72aec2_100%)] shadow-[inset_0_0_38px_rgba(255,255,255,0.95),inset_0_-18px_35px_rgba(47,111,138,0.16),0_15px_50px_rgba(71,167,207,0.18)]" />
          <div className={`absolute inset-[26px] rounded-full border-2 border-white/75 ${active ? "animate-[spin_5s_linear_infinite]" : "animate-[spin_18s_linear_infinite]"}`} />
          <div className={`absolute inset-[42px] rounded-full border border-sky-300/55 ${active ? "animate-[spin_4s_linear_infinite_reverse]" : "animate-[spin_15s_linear_infinite_reverse]"}`} />
          <div className="absolute h-[88px] w-[88px] rounded-full bg-white/90 shadow-[0_0_55px_rgba(255,255,255,1),0_0_90px_rgba(120,211,245,0.75)]" />
          <div className="absolute left-[68px] top-[54px] h-[30px] w-[52px] rotate-[-25deg] rounded-full bg-white/70 blur-[6px]" />
          <div className="absolute inset-[70px] rounded-full border border-sky-100/80" />
        </div>
      </div>

      <div className="absolute left-1/2 top-[330px] z-10 -translate-x-1/2 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.5em] text-sky-600">ARI</div>
        <div className="mt-2 text-[9px] uppercase tracking-[0.34em] text-slate-400">{statusLabel}</div>
        <div className="mt-4 flex h-5 items-center justify-center gap-[3px]">
          {Array.from({ length: 31 }).map((_, index) => (
            <span key={index} className={`w-[2px] rounded-full bg-sky-400/60 transition-all duration-300 ${active ? "h-5" : index % 4 === 0 ? "h-3" : "h-1.5"}`} />
          ))}
        </div>
      </div>

      <div className="absolute left-6 top-[105px] z-10 w-[170px] rounded-[22px] border border-white/85 bg-white/65 p-5 shadow-[0_15px_40px_rgba(70,130,160,0.08)] backdrop-blur-xl">
        <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500">SYSTEM</div>
        <div className="mt-5 space-y-4">
          <div><div className="text-[8px] uppercase tracking-[0.2em] text-slate-400">Runtime</div><div className="mt-1 text-[11px] text-sky-600">Hermes</div></div>
          <div><div className="text-[8px] uppercase tracking-[0.2em] text-slate-400">Memory</div><div className="mt-1 text-[11px] text-emerald-500">Active</div></div>
          <div><div className="text-[8px] uppercase tracking-[0.2em] text-slate-400">Interface</div><div className="mt-1 text-[11px] text-sky-600">Voice + Text</div></div>
        </div>
      </div>

      <div className="absolute right-6 top-[105px] z-10 w-[230px] rounded-[22px] border border-white/85 bg-white/65 p-5 shadow-[0_15px_40px_rgba(70,130,160,0.08)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500">ARI OUTPUT</span>
          {response && <Volume2 size={12} className="text-sky-500" />}
        </div>
        <div className="mt-4 max-h-[150px] overflow-y-auto text-[11px] leading-5 text-slate-600">
          {response || transcript || "Awaiting your instruction..."}
        </div>
      </div>

      <form onSubmit={submitText} className="absolute bottom-6 left-1/2 z-20 flex w-[62%] -translate-x-1/2 items-center gap-3 rounded-[20px] border border-white bg-white/75 px-4 py-3 shadow-[0_12px_35px_rgba(60,125,155,0.12)] backdrop-blur-xl">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          placeholder="Ask ARI anything..."
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
        />

        <button
          type="button"
          onClick={() => {
            if (status === "recording") {
              stopRecording();
            } else if (status === "speaking") {
              void interruptAssistant(true);
            } else if (status === "thinking" || status === "transcribing") {
              void interruptAssistant(false);
            } else {
              void startRecording();
            }
          }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${status === "recording" || status === "speaking" ? "border-sky-400 bg-sky-50 text-sky-600 shadow-[0_0_25px_rgba(56,189,248,0.25)]" : "border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-500"}`}
          aria-label={micButtonLabel}
          title={micButtonLabel}
        >
          {status === "recording" || status === "speaking" ? <Square size={15} fill="currentColor" /> : busy ? <Loader2 size={15} className="animate-spin" /> : <Mic size={17} />}
        </button>

        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_5px_18px_rgba(14,165,233,0.28)] transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message to ARI"
        >
          <Send size={15} />
        </button>
      </form>

      {error && (
        <div className="absolute bottom-[78px] left-1/2 z-20 max-w-[60%] -translate-x-1/2 rounded-full border border-rose-200 bg-white/85 px-4 py-2 text-[10px] text-rose-500 shadow-sm backdrop-blur-xl">
          {error}
        </div>
      )}
    </section>
  );
}

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  for (const type of types) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }

  return "";
}
