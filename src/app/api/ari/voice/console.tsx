"use client";
const ttsChainRef = useRef<Promise<void>>(Promise.resolve());

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
  | "error";

export default function AriVoiceConsole() {
  const [
    status,
    setStatus,
  ] =
    useState<VoiceStatus>(
      "ready",
    );

  const [
    transcript,
    setTranscript,
  ] = useState("");

  const [
    response,
    setResponse,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(
      null,
    );

  const streamRef =
    useRef<MediaStream | null>(
      null,
    );

  const chunksRef =
    useRef<Blob[]>([]);

  const speechQueueRef =
    useRef<string[]>([]);

  const speakingRef =
    useRef(false);

  const spokenTextLengthRef =
    useRef(0);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();

      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        );

      window.speechSynthesis?.cancel();
      speechQueueRef.current = [];
      speakingRef.current = false;
      spokenTextLengthRef.current = 0;
    };
  }, []);

  async function startRecording() {
    if (
      status ===
        "transcribing" ||
      status ===
        "thinking"
    ) {
      return;
    }

    setError("");
    setTranscript("");
    setResponse("");

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setStatus("error");
      setError(
        "This browser does not provide microphone access.",
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              echoCancellation:
                true,
              noiseSuppression:
                true,
              autoGainControl:
                true,
            },
          },
        );

      streamRef.current =
        stream;

      const mimeType =
        getSupportedMimeType();

      const recorder =
        mimeType
          ? new MediaRecorder(
              stream,
              {
                mimeType,
              },
            )
          : new MediaRecorder(
              stream,
            );

      chunksRef.current =
        [];

      recorder.ondataavailable =
        (event) => {
          if (
            event.data.size >
            0
          ) {
            chunksRef.current.push(
              event.data,
            );
          }
        };

      recorder.onstop =
        () => {
          stream
            .getTracks()
            .forEach(
              (
                track,
              ) =>
                track.stop(),
            );

          streamRef.current =
            null;

          void transcribeRecording(
            recorder,
            mimeType ||
              recorder.mimeType ||
              "audio/webm",
          );
        };

      mediaRecorderRef.current =
        recorder;

      recorder.start();

      setStatus(
        "recording",
      );
    } catch (err) {
      console.error(
        "Microphone error:",
        err,
      );

      setStatus("error");

      setError(
        err instanceof DOMException &&
          err.name ===
            "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access for localhost:3000."
          : "Unable to access the microphone.",
      );
    }
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current
        .state !==
        "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  async function transcribeRecording(
    recorder: MediaRecorder,
    mimeType: string,
  ) {
    setStatus(
      "transcribing",
    );

    try {
      const blob =
        new Blob(
          chunksRef.current,
          {
            type:
              mimeType ||
              recorder.mimeType ||
              "audio/webm",
          },
        );

      if (
        blob.size === 0
      ) {
        throw new Error(
          "The recording was empty.",
        );
      }

      const formData =
        new FormData();

      const extension =
        mimeType.includes(
          "mp4",
        ) ||
        mimeType.includes(
          "m4a",
        )
          ? ".m4a"
          : mimeType.includes(
                "ogg",
              )
            ? ".ogg"
            : ".webm";

      formData.append(
        "audio",
        new File(
          [
            blob,
          ],
          `voice${extension}`,
          {
            type:
              mimeType,
          },
        ),
      );

      const response =
        await fetch(
          "/api/audio/transcribe",
          {
            method:
              "POST",
            body: formData,
          },
        );

      const result =
        (await response.json()) as {
          success?: boolean;
          transcript?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            `Transcription failed with HTTP ${response.status}.`,
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
          : "Unable to transcribe the recording.",
      );
    }
  }

  async function askAri(
    text: string,
  ) {
    setStatus(
      "thinking",
    );
    setError("");
    setResponse("");

    try {
      const response =
        await fetch(
          "/api/ari",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              voice: true,
              messages: [
                {
                  role: "user",
                  content:
                    text,
                },
              ],
            }),
          },
        );

      if (
        !response.ok
      ) {
        throw new Error(
          (await response.text()) ||
            `ARI returned HTTP ${response.status}.`,
        );
      }

      if (!response.body) {
        throw new Error(
          "ARI returned no response body.",
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";
      let finalText = "";

      while (true) {
        const {
          done,
          value,
        } =
          await reader.read();

        if (done) {
          break;
        }

        buffer +=
          decoder.decode(
            value,
            {
              stream: true,
            },
          );

        const lines =
          buffer.split(
            /\r?\n/,
          );

        buffer =
          lines.pop() ||
          "";

        for (
          const rawLine of lines
        ) {
          const line =
            rawLine.trim();

          if (
            !line.startsWith(
              "data:",
            )
          ) {
            continue;
          }

          const payload =
            line
              .slice(5)
              .trim();

          if (
            !payload ||
            payload ===
              "[DONE]"
          ) {
            continue;
          }

          try {
            const event =
              JSON.parse(
                payload,
              ) as {
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
              typeof chunk ===
              "string"
            ) {
              finalText +=
                chunk;

              setResponse(
                finalText,
              );

              // Speak each completed sentence as soon as it arrives instead of
              // waiting for the entire model response to finish.
              const completed = finalText.match(/[\s\S]*?[.!?]+(?:\s|$)/g) ?? [];
              let spokenEnd = spokenTextLengthRef.current;

              for (const sentence of completed) {
                const start = finalText.indexOf(sentence, spokenEnd);
                if (start < 0) continue;

                const end = start + sentence.length;
                if (end <= spokenEnd) continue;

                enqueueSpeech(sentence);
                spokenEnd = end;
              }

              spokenTextLengthRef.current = spokenEnd;
            }
          } catch {
            // Ignore malformed SSE chunks.
          }
        }
      }

      if (!finalText) {
        throw new Error(
          "ARI returned an empty response.",
        );
      }

      // Flush anything that did not end with punctuation so short replies still speak.
      const remainder = finalText
        .slice(spokenTextLengthRef.current)
        .trim();

      if (remainder) {
        enqueueSpeech(remainder);
        spokenTextLengthRef.current = finalText.length;
      }

      setStatus(
        "ready",
      );

      flushSpeechQueue();
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

  function enqueueSpeech(text: string) {
    const clean = text.trim();
    if (!clean) return;

    speechQueueRef.current.push(clean);
    flushSpeechQueue();
  }

  function flushSpeechQueue() {
    if (
      typeof window ===
        "undefined" ||
      !window.speechSynthesis ||
      speakingRef.current
    ) {
      return;
    }

    const next = speechQueueRef.current.shift();
    if (!next) return;

    speakingRef.current = true;

    const utterance =
      new SpeechSynthesisUtterance(next);

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      speakingRef.current = false;
      flushSpeechQueue();
    };

    utterance.onerror = () => {
      speakingRef.current = false;
      flushSpeechQueue();
    };

    window.speechSynthesis.speak(utterance);
  }

  const isBusy =
    status ===
      "transcribing" ||
    status ===
      "thinking";

  const statusLabel =
    status ===
    "recording"
      ? "LISTENING"
      : status ===
          "transcribing"
        ? "TRANSCRIBING"
        : status ===
            "thinking"
          ? "THINKING"
          : status ===
              "error"
            ? "ERROR"
            : "READY";

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#fff000]/15 bg-[#0d0730]">

      <div className="border-b border-white/[0.08] px-6 py-5">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#fff000]">
              ARI Interface
            </p>

            <h2 className="mt-2 text-xl font-bold text-white">
              Voice Console
            </h2>

            <p className="mt-1 text-xs text-[#6f688f]">
              Speak naturally. ARI will listen locally, transcribe, and answer aloud.
            </p>

          </div>

          <div className="flex items-center gap-2">

            <span
              className={`h-2 w-2 rounded-full ${
                status ===
                "recording"
                  ? "bg-[#ff69b7] shadow-[0_0_10px_#ff69b7]"
                  : status ===
                        "thinking" ||
                      status ===
                        "transcribing"
                    ? "bg-[#fff000] shadow-[0_0_10px_#fff000]"
                    : status ===
                        "error"
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
            disabled={isBusy}
            onClick={
              status ===
              "recording"
                ? stopRecording
                : startRecording
            }
            className={`flex h-28 w-28 items-center justify-center rounded-full border transition ${
              status ===
              "recording"
                ? "border-[#ff69b7]/60 bg-[#ff69b7]/10 text-[#ff69b7] shadow-[0_0_45px_rgba(255,105,183,0.18)]"
                : "border-[#fff000]/40 bg-[#fff000]/[0.05] text-[#fff000] hover:bg-[#fff000]/[0.1]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {status ===
            "recording" ? (
              <Square
                size={34}
                fill="currentColor"
              />
            ) : isBusy ? (
              <Loader2
                size={34}
                className="animate-spin"
              />
            ) : (
              <Mic
                size={38}
              />
            )}
          </button>

          <p className="mt-4 text-xs font-semibold text-white">
            {status ===
            "recording"
              ? "Tap to stop"
              : status ===
                  "transcribing"
                ? "Transcribing..."
                : status ===
                    "thinking"
                  ? "ARI is thinking..."
                  : "Tap to speak"}
          </p>

        </div>

        <div className="min-w-0">

          <div className="min-h-[190px] rounded-xl border border-white/[0.08] bg-[#07031f] p-5">

            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#6f688f]">
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

function getSupportedMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  for (
    const type of candidates
  ) {
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