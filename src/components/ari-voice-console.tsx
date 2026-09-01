"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Loader2,
  Mic,
  Square,
  Volume2,
} from "lucide-react";

type VoiceStatus =
  | "ready"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

type VoiceMessage = {
  role: "user" | "assistant";
  content: string;
};

const VOICE_HISTORY_KEY = "hermes-ari-voice-history";
const MAX_VOICE_HISTORY = 20;

export default function AriVoiceConsole() {
  const [status, setStatus] =
    useState<VoiceStatus>("ready");

  const [transcript, setTranscript] =
    useState("");

  const [response, setResponse] =
    useState("");

  const [history, setHistory] =
    useState<VoiceMessage[]>([]);

  const [error, setError] =
    useState("");

  const [wakeEnabled, setWakeEnabled] =
    useState(false);

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const chunksRef =
    useRef<Blob[]>([]);

  const audioQueueRef =
    useRef<string[]>([]);

  const playingRef =
    useRef(false);

  const responseTextRef =
    useRef("");

  const sentenceBufferRef =
    useRef("");

  const currentAudioRef =
    useRef<HTMLAudioElement | null>(null);

  const ttsChainRef =
    useRef<Promise<void>>(Promise.resolve());

  const wakeRecognitionRef =
    useRef<SpeechRecognitionLike | null>(null);

  const commandRecognitionRef =
    useRef<SpeechRecognitionLike | null>(null);

  const wakeRestartTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const wakeEnabledRef = useRef(false);

  const wakeSupportedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VOICE_HISTORY_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const safe = parsed.filter(
        (message): message is VoiceMessage =>
          message &&
          (message.role === "user" ||
            message.role === "assistant") &&
          typeof message.content === "string",
      );

      setHistory(safe.slice(-MAX_VOICE_HISTORY));
    } catch {
      // Ignore malformed local history.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(
        VOICE_HISTORY_KEY,
        JSON.stringify(history.slice(-MAX_VOICE_HISTORY)),
      );
    } catch {
      // Storage is best-effort.
    }
  }, [history]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognitionCtor =
      (window as Window & {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).SpeechRecognition ||
      (window as Window & {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).webkitSpeechRecognition;

    wakeSupportedRef.current = !!SpeechRecognitionCtor;

    return () => {
      wakeRecognitionRef.current?.abort?.();
      commandRecognitionRef.current?.stop();
      if (wakeRestartTimerRef.current) {
        clearTimeout(wakeRestartTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    wakeEnabledRef.current = wakeEnabled;

    if (!wakeEnabled) {
      wakeRecognitionRef.current?.abort?.();
      commandRecognitionRef.current?.stop();
      if (wakeRestartTimerRef.current) {
        clearTimeout(wakeRestartTimerRef.current);
        wakeRestartTimerRef.current = null;
      }
      return;
    }

    if (!wakeSupportedRef.current) {
      setWakeEnabled(false);
      setError("Background wake listening is not supported by this browser.");
      return;
    }

    startWakeListener();

    return () => {
      wakeRecognitionRef.current?.abort?.();
      commandRecognitionRef.current?.stop();
    };
    // The listener lifecycle is intentionally controlled by wakeEnabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeEnabled]);

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !==
          "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      currentAudioRef.current?.pause();

      for (
        const url of audioQueueRef.current
      ) {
        URL.revokeObjectURL(url);
      }

      audioQueueRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!wakeEnabled || !wakeEnabledRef.current) {
      return;
    }

    if (status === "ready" && !wakeRecognitionRef.current) {
      startWakeListener();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, wakeEnabled]);

  function createSpeechRecognition() {
    const SpeechRecognitionCtor =
      (window as Window & {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).SpeechRecognition ||
      (window as Window & {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).webkitSpeechRecognition;

    return SpeechRecognitionCtor ? new SpeechRecognitionCtor() : null;
  }

  function startWakeListener() {
    if (typeof window === "undefined" || !wakeEnabledRef.current) {
      return;
    }

    if (status !== "ready" && status !== "error") {
      return;
    }

    if (wakeRecognitionRef.current) {
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) {
      return;
    }

    wakeRecognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let heard = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]?.[0];
        if (result?.transcript) {
          heard += `${heard ? " " : ""}${result.transcript}`;
        }
      }

      const normalized = heard.trim();
      if (!normalized) {
        return;
      }

      const wakeMatch = normalized.match(
        /^(?:hey\s+)?ari(?:\b|[,.:;!?])\s*(.*)$/i,
      );

      if (!wakeMatch) {
        return;
      }

      const command = wakeMatch[1]?.trim() || "";

      recognition.stop();
      wakeRecognitionRef.current = null;

      if (command) {
        void runWakeCommand(command);
      } else {
        void startRecordingWithAutoStop();
      }
    };

    recognition.onerror = (event) => {
      wakeRecognitionRef.current = null;

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setWakeEnabled(false);
        setError(
          "Background wake listening needs browser microphone and speech permission.",
        );
      }
    };

    recognition.onend = () => {
      wakeRecognitionRef.current = null;

      if (!wakeEnabledRef.current) {
        return;
      }

      if (status !== "ready" && status !== "error") {
        return;
      }

      if (wakeRestartTimerRef.current) {
        clearTimeout(wakeRestartTimerRef.current);
      }

      wakeRestartTimerRef.current = setTimeout(() => {
        wakeRestartTimerRef.current = null;
        startWakeListener();
      }, 250);
    };

    try {
      recognition.start();
    } catch {
      wakeRecognitionRef.current = null;
      wakeRestartTimerRef.current = setTimeout(() => {
        wakeRestartTimerRef.current = null;
        startWakeListener();
      }, 500);
    }
  }

  async function runWakeCommand(command: string) {
    if (status !== "ready" && status !== "error") {
      return;
    }
    setTranscript(command);
    setResponse("");
    setError("");
    await askAri(command);
  }

  async function startRecordingWithAutoStop() {
    await startRecording();
    window.setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        stopRecording();
      }
    }, 7000);
  }

  async function startRecording() {
    wakeRecognitionRef.current?.stop();

    if (
      status === "transcribing" ||
      status === "thinking" ||
      status === "speaking"
    ) {
      return;
    }

    setError("");
    setTranscript("");
    setResponse("");

    responseTextRef.current = "";
    sentenceBufferRef.current = "";

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          },
        );

      streamRef.current = stream;

      const mimeType =
        getSupportedMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
          })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(
            event.data,
          );
        }
      };

      recorder.onstop = () => {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop(),
          );

        streamRef.current = null;

        void transcribeRecording(
          recorder,
        );
      };

      mediaRecorderRef.current =
        recorder;

      recorder.start();

      setStatus("recording");
    } catch (err) {
      console.error(
        "Microphone error:",
        err,
      );

      setStatus("error");

      setError(
        err instanceof DOMException &&
          err.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : "Unable to access the microphone.",
      );
    }
  }

  function stopRecording() {
    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state !== "inactive"
    ) {
      recorder.stop();
    }
  }

  async function transcribeRecording(
    recorder: MediaRecorder,
  ) {
    setStatus("transcribing");

    try {
      const mimeType =
        recorder.mimeType ||
        "audio/webm";

      const blob = new Blob(
        chunksRef.current,
        {
          type: mimeType,
        },
      );

      if (blob.size === 0) {
        throw new Error(
          "The recording was empty.",
        );
      }

      const extension =
        mimeType.includes("mp4") ||
        mimeType.includes("m4a")
          ? ".m4a"
          : mimeType.includes("ogg")
            ? ".ogg"
            : ".webm";

      const formData =
        new FormData();

      formData.append(
        "audio",
        new File(
          [blob],
          `voice${extension}`,
          {
            type: mimeType,
          },
        ),
      );

      const transcriptionResponse =
        await fetch(
          "/api/audio/transcribe",
          {
            method: "POST",
            body: formData,
          },
        );

      const result =
        (await transcriptionResponse.json()) as {
          success?: boolean;
          transcript?: string;
          error?: string;
        };

      if (
        !transcriptionResponse.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Transcription failed.",
        );
      }

      const text =
        result.transcript?.trim();

      if (!text) {
        throw new Error(
          "No speech was detected.",
        );
      }

      setTranscript(text);

      await askAri(text);
    } catch (err) {
      console.error(
        "Transcription error:",
        err,
      );

      setStatus("error");

      setError(
        err instanceof Error
          ? err.message
          : "Unable to transcribe audio.",
      );
    }
  }

  async function askAri(
    text: string,
  ) {
    setStatus("thinking");
    setResponse("");
    setError("");

    const conversation = [
      ...history,
      { role: "user" as const, content: text },
    ].slice(-MAX_VOICE_HISTORY);

    setHistory(conversation);

    responseTextRef.current = "";
    sentenceBufferRef.current = "";

    clearAudioQueue();

    try {
      const ariResponse =
        await fetch(
          "/api/ari",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              messages: conversation,
              voice: true,
            }),
          },
        );

      if (!ariResponse.ok) {
        throw new Error(
          (await ariResponse.text()) ||
            `ARI returned HTTP ${ariResponse.status}.`,
        );
      }

      if (!ariResponse.body) {
        throw new Error(
          "ARI returned no response body.",
        );
      }

      const reader =
        ariResponse.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const { done, value } =
          await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(
          value,
          { stream: true },
        );

        const lines =
          buffer.split(/\r?\n/);

        buffer =
          lines.pop() ?? "";

        for (
          const rawLine of lines
        ) {
          const line =
            rawLine.trim();

          if (
            !line.startsWith("data:")
          ) {
            continue;
          }

          const payload =
            line.slice(5).trim();

          if (
            !payload ||
            payload === "[DONE]"
          ) {
            continue;
          }

          try {
            const event =
              JSON.parse(payload) as {
                choices?: Array<{
                  delta?: {
                    content?: string;
                  };
                }>;
              };

            const chunk =
              event.choices?.[0]
                ?.delta?.content;

            if (
              typeof chunk !==
              "string"
            ) {
              continue;
            }

            responseTextRef.current +=
              chunk;

            setResponse(
              responseTextRef.current,
            );

            sentenceBufferRef.current +=
              chunk;

            flushCompletedSentences();
          } catch {
            // Ignore malformed SSE chunks.
          }
        }
      }

      const remaining =
        sentenceBufferRef.current.trim();

      if (remaining) {
        await queueSentenceAudio(
          remaining,
        );
        sentenceBufferRef.current =
          "";
      }

      if (
        !responseTextRef.current
      ) {
        throw new Error(
          "ARI returned an empty response.",
        );
      }

      const assistantMessage = {
        role: "assistant" as const,
        content: responseTextRef.current,
      };

      setHistory((current) =>
        [...current, assistantMessage].slice(
          -MAX_VOICE_HISTORY,
        ),
      );

      if (
        audioQueueRef.current.length ===
        0 &&
        !playingRef.current
      ) {
        setStatus("ready");
      } else {
        setStatus("speaking");
        void playNextAudio();
      }
    } catch (err) {
      console.error(
        "ARI voice request failed:",
        err,
      );

      setStatus("error");

      setError(
        err instanceof Error
          ? err.message
          : "ARI could not process the request.",
      );
    }
  }

  async function flushCompletedSentences() {
    const text =
      sentenceBufferRef.current;

    const match =
      text.match(
        /^([\s\S]*?[.!?](?:["']|\)|\])?)(?:\s+|$)/,
      );

    if (!match) {
      return;
    }

    const sentence =
      match[1]?.trim();

    if (!sentence) {
      return;
    }

    sentenceBufferRef.current =
      text.slice(
        match[0].length,
      );

    if (
      !playingRef.current &&
      audioQueueRef.current.length ===
        0
    ) {
      setStatus("speaking");
    }

    void queueSentenceAudio(
      sentence,
    );
  }

  function queueSentenceAudio(sentence: string) {
    const clean = sentence.trim();
    if (!clean) return;

    ttsChainRef.current = ttsChainRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: clean }),
          });

          if (!response.ok) {
            throw new Error(
              (await response.text()) ||
                `TTS returned HTTP ${response.status}.`,
            );
          }

          const blob = await response.blob();
          if (blob.size === 0) throw new Error("TTS returned empty audio.");

          const url = URL.createObjectURL(blob);
          audioQueueRef.current.push(url);
          void playNextAudio();
        } catch (err) {
          console.error("TTS sentence failed:", err);
          setStatus("error");
          setError(
            err instanceof Error
              ? err.message
              : "ARI could not generate speech.",
          );
        }
      });
  }

  async function playNextAudio() {
    if (
      playingRef.current
    ) {
      return;
    }

    const nextUrl =
      audioQueueRef.current.shift();

    if (!nextUrl) {
      return;
    }

    playingRef.current = true;
    setStatus("speaking");

    const audio =
      new Audio(nextUrl);

    currentAudioRef.current =
      audio;

    audio.onended = () => {
      URL.revokeObjectURL(
        nextUrl,
      );

      currentAudioRef.current =
        null;

      playingRef.current = false;

      if (
        audioQueueRef.current.length >
        0
      ) {
        void playNextAudio();
      } else if (
        sentenceBufferRef.current.trim() ===
        ""
      ) {
        setStatus("ready");
      }
    };

    audio.onerror = () => {
      URL.revokeObjectURL(
        nextUrl,
      );

      currentAudioRef.current =
        null;

      playingRef.current = false;

      setStatus("error");

      setError(
        "ARI generated audio, but the browser could not play it.",
      );
    };

    try {
      await audio.play();
    } catch (err) {
      console.error(
        "Audio playback failed:",
        err,
      );

      URL.revokeObjectURL(
        nextUrl,
      );

      currentAudioRef.current =
        null;

      playingRef.current = false;

      setStatus("error");

      setError(
        "The browser blocked ARI audio playback. Click the microphone again and retry.",
      );
    }
  }

  function clearAudioQueue() {
    for (
      const url of audioQueueRef.current
    ) {
      URL.revokeObjectURL(url);
    }

    audioQueueRef.current = [];
    currentAudioRef.current?.pause();
    currentAudioRef.current =
      null;
    playingRef.current = false;
  }

  const busy =
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
              ? "ERROR"
              : "READY";

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#fff000]/15 bg-white/70">

      <div className="border-b border-white/[0.08] px-6 py-5">

        <div className="flex items-center justify-between">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#fff000]">
              ARI Interface
            </p>

            <h2 className="mt-2 text-xl font-bold text-white">
              Voice Console
            </h2>

            <p className="mt-1 text-xs text-black/45">
              Speak naturally. ARI listens locally and begins speaking as soon as its response is ready.
            </p>
          </div>

          <div className="flex items-center gap-2">

            <span
              className={`h-2 w-2 rounded-full ${
                status === "recording"
                  ? "bg-[#ff69b7] shadow-[0_0_10px_#ff69b7]"
                  : status ===
                      "thinking" ||
                    status ===
                      "transcribing" ||
                    status === "speaking"
                    ? "bg-[#fff000] shadow-[0_0_10px_#fff000]"
                    : status === "error"
                      ? "bg-[#ff69b7]"
                      : "bg-[#00e5b0] shadow-[0_0_10px_#00e5b0]"
              }`}
            />

            <span className="text-[10px] font-semibold text-[#a9a3c4]">
              {statusLabel}
            </span>

          </div>

        </div>

      </div>

      <div className="grid grid-cols-[180px_1fr] gap-6 p-6">

        <div className="flex flex-col items-center justify-center">

          <button
            type="button"
            disabled={busy}
            onClick={
              status ===
              "recording"
                ? stopRecording
                : startRecording
            }
            className={`flex h-28 w-28 items-center justify-center rounded-full border transition ${
              status === "recording"
                ? "border-[#ff69b7]/60 bg-[#ff69b7]/10 text-[#ff69b7] shadow-[0_0_45px_rgba(255,105,183,0.18)]"
                : "border-[#fff000]/40 bg-[#fff000]/[0.05] text-[#fff000] hover:bg-[#fff000]/[0.1]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {status === "recording" ? (
              <Square
                size={34}
                fill="currentColor"
              />
            ) : busy ? (
              <Loader2
                size={34}
                className="animate-spin"
              />
            ) : (
              <Mic size={38} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setWakeEnabled((current) => !current)}
            className={`mt-3 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
              wakeEnabled
                ? "border-[#00e5b0]/40 bg-[#00e5b0]/10 text-[#00e5b0]"
                : "border-white/[0.1] bg-white/[0.03] text-[#777099] hover:text-white"
            }`}
          >
            {wakeEnabled ? "Wake listening on" : "Enable wake listening"}
          </button>

          <p className="mt-4 text-xs font-semibold text-white">
            {status === "recording"
              ? "Tap to stop"
              : status === "transcribing"
                ? "Transcribing..."
                : status === "thinking"
                  ? "ARI is thinking..."
                  : status === "speaking"
                    ? "ARI is speaking..."
                    : "Tap to speak"}
          </p>

        </div>

        <div className="min-w-0">

          <div className="min-h-[190px] rounded-xl border border-white/[0.08] bg-white p-5">

            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/45">
              You
            </p>

            <p className="mt-2 min-h-[24px] text-sm leading-6 text-[#d9d5e8]">
              {transcript ||
                "Speak a command to ARI..."}
            </p>

            <div className="my-5 h-px bg-white/[0.06]" />

            <div className="flex items-center gap-2">

              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#fff000]">
                ARI
              </p>

              {response && (
                <Volume2
                  size={12}
                  className="text-[#fff000]"
                />
              )}

            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#d9d5e8]">
              {response ||
                "ARI's response will appear here."}
            </p>

          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-[#ff69b7]/20 bg-[#ff69b7]/[0.04] px-4 py-3 text-xs leading-5 text-[#ff9ad2]">
              {error}
            </div>
          )}

        </div>

      </div>

    </section>
  );
}


type SpeechRecognitionResultLike = {
  [index: number]: {
    [index: number]: { transcript: string };
  };
  length: number;
};

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultLike;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  for (const type of types) {
    if (
      typeof MediaRecorder !==
        "undefined" &&
      MediaRecorder.isTypeSupported(
        type,
      )
    ) {
      return type;
    }
  }

  return "";
}