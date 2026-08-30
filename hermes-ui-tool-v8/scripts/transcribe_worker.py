import json
import sys
from faster_whisper import WhisperModel

# Pin voice transcription to a deterministic CPU configuration.
# This avoids Hermes' auto-CUDA probe/fallback path (which was taking ~46s).
MODEL = WhisperModel("tiny.en", device="cpu", compute_type="int8")

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
        audio_path = req["audio_path"]
        segments, info = MODEL.transcribe(
            audio_path,
            language="en",
            beam_size=1,
            best_of=1,
            temperature=0,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        transcript = " ".join(
            seg.text.strip() for seg in segments if seg.text.strip()
        ).strip()
        sys.stdout.write(json.dumps({
            "success": True,
            "transcript": transcript,
            "provider": "local-fast-whisper",
        }, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except Exception as exc:
        sys.stdout.write(json.dumps({
            "success": False,
            "transcript": "",
            "error": str(exc),
        }) + "\n")
        sys.stdout.flush()
