import asyncio
import json
import os
import sys
import edge_tts

async def synthesize(text: str, output_path: str, voice: str):
    communicate = edge_tts.Communicate(text, voice, rate="+0%", volume="+0%")
    await communicate.save(output_path)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
        asyncio.run(synthesize(req["text"], req["output_path"], req.get("voice", "en-US-AriaNeural")))
        sys.stdout.write(json.dumps({"success": True}) + "\n")
        sys.stdout.flush()
    except Exception as exc:
        sys.stdout.write(json.dumps({"success": False, "error": str(exc)}) + "\n")
        sys.stdout.flush()
