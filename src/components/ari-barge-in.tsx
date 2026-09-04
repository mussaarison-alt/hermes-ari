"use client";

import { useEffect } from "react";

export default function AriBargeIn() {
  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let animation = 0;
    let armed = false;
    let loudFrames = 0;

    async function arm() {
      if (stopped || armed) return;

      const audio = document.querySelector("audio");
      if (!audio || audio.paused || audio.ended) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const AudioContextCtor =
          window.AudioContext ||
          (window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }).webkitAudioContext;

        if (!AudioContextCtor) return;

        context = new AudioContextCtor();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const data = new Uint8Array(analyser.fftSize);
        const startedAt = performance.now();
        armed = true;

        const monitor = () => {
          const currentAudio = document.querySelector("audio");

          if (
            stopped ||
            !armed ||
            !currentAudio ||
            currentAudio.paused ||
            currentAudio.ended
          ) {
            cleanup(false);
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
            const button = document.querySelector<HTMLButtonElement>(
              'button[aria-label="Interrupt ARI and start listening"]',
            );

            if (button) {
              cleanup(true);
              button.click();
              return;
            }
          }

          animation = requestAnimationFrame(monitor);
        };

        animation = requestAnimationFrame(monitor);
      } catch {
        // The manual interrupt button remains available.
      }
    }

    function cleanup(preserveStream: boolean) {
      armed = false;
      loudFrames = 0;

      if (animation) {
        cancelAnimationFrame(animation);
        animation = 0;
      }

      void context?.close();
      context = null;

      if (!preserveStream) {
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
      }
    }

    const timer = window.setInterval(() => {
      const audio = document.querySelector("audio");

      if (audio && !audio.paused && !audio.ended) {
        void arm();
      } else if (armed) {
        cleanup(false);
      }
    }, 200);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      cleanup(false);
    };
  }, []);

  return null;
}
