#!/usr/bin/env python3
"""Local speech-to-text for the caption helper. No paid service.

Prints JSON: {"cues":[{"start":0,"end":1.2,"text":"..."}]}.
STT_ENGINE=fixture reads a local audio file and returns a fixed transcript (tests).
STT_ENGINE=faster-whisper uses a local faster-whisper model.
STT_ENGINE=whisper.cpp calls a local whisper.cpp binary.
"""

import json
import os
import shutil
import subprocess
import sys


FIXTURE_CUES = [
    {"start": 0.0, "end": 2.0, "text": "the light enters the heart"},
    {"start": 3.2, "end": 5.5, "text": "sit with that for a moment"},
]


def fixture(path: str) -> None:
    if not os.path.isfile(path) or os.path.getsize(path) < 44:
        print("The audio file is missing or too small to be a wav.", file=sys.stderr)
        sys.exit(2)
    json.dump({"cues": FIXTURE_CUES, "engine": "fixture"}, sys.stdout)


def faster_whisper(path: str) -> None:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper is not installed. Use STT_ENGINE=fixture, or pip install faster-whisper.", file=sys.stderr)
        sys.exit(2)
    model_name = os.environ.get("STT_MODEL") or "tiny"
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, _info = model.transcribe(path, vad_filter=True)
    cues = []
    for row in segments:
        text = (row.text or "").strip()
        if text:
            cues.append({"start": float(row.start), "end": float(row.end), "text": text})
    json.dump({"cues": cues, "engine": "faster-whisper"}, sys.stdout)


def whisper_cpp(path: str) -> None:
    binary = os.environ.get("WHISPER_CPP") or shutil.which("whisper-cli") or shutil.which("main")
    model = os.environ.get("WHISPER_CPP_MODEL") or ""
    if not binary or not model:
        print("Set WHISPER_CPP to the whisper.cpp binary and WHISPER_CPP_MODEL to a local ggml model.", file=sys.stderr)
        sys.exit(2)
    out = path + ".json"
    subprocess.run([binary, "-m", model, "-f", path, "-oj", "-of", path], check=True)
    with open(out, "r", encoding="utf-8") as handle:
        body = json.load(handle)
    cues = []
    for row in body.get("transcription") or body.get("segments") or []:
        text = str(row.get("text") or "").strip()
        if not text:
            continue
        start = float(row.get("offsets", {}).get("from", row.get("start", 0)) or 0)
        end = float(row.get("offsets", {}).get("to", row.get("end", start)) or start)
        if start > 1000:
            start /= 1000
            end /= 1000
        cues.append({"start": start, "end": end, "text": text})
    json.dump({"cues": cues, "engine": "whisper.cpp"}, sys.stdout)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: stt.py <audio-file>", file=sys.stderr)
        sys.exit(2)
    engine = os.environ.get("STT_ENGINE") or "faster-whisper"
    path = sys.argv[1]
    if engine == "fixture":
        fixture(path)
    elif engine == "whisper.cpp":
        whisper_cpp(path)
    elif engine == "faster-whisper":
        faster_whisper(path)
    else:
        print(f"Unknown STT_ENGINE {engine}. Use fixture, faster-whisper, or whisper.cpp.", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
