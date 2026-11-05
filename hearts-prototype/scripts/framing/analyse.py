"""Vision pass for the live framing analyser.

Reads one temporary clip, samples faces (YuNet), shot cuts and on-screen text,
then writes a JSON analysis. The TypeScript chooser turns this into a track.
The downloaded media is deleted by the caller.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

STEP = 0.5
CROP_W = 608
TEXT_STEP = 2.0


def detect(det, frame):
    h, w = frame.shape[:2]
    s = 640 / w
    sm = cv2.resize(frame, (640, int(h * s)))
    det.setInputSize((sm.shape[1], sm.shape[0]))
    _, faces = det.detect(sm)
    out = []
    if faces is not None:
        for f in faces:
            x, y, fw, fh = [float(v) / s for v in f[:4]]
            if fh < h * 0.06:
                continue
            out.append({
                "x": x, "y": y, "w": fw, "h": fh,
                "cx": x + fw / 2, "cy": y + fh / 2,
                "score": float(f[14]),
            })
    return out


def text_boxes(fr):
    g = cv2.cvtColor(cv2.resize(fr, (960, 540)), cv2.COLOR_BGR2GRAY)
    grad = cv2.morphologyEx(g, cv2.MORPH_GRADIENT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (11, 2)))
    n, _, st, _ = cv2.connectedComponentsWithStats(bw)
    boxes = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if 8 <= h <= 40 and w >= 40 and w / h >= 3 and a / (w * h) > 0.45:
            row = (g[y + h // 2, x:x + w] > g[y:y + h, x:x + w].mean()).astype(np.int8)
            if np.abs(np.diff(row)).sum() / w > 0.12:
                boxes.append((x * 2, y * 2, w * 2, h * 2))
    return boxes


def main():
    if len(sys.argv) < 3:
        print("usage: analyse.py <video> <out.json> [model.onnx] [offset_seconds]", file=sys.stderr)
        sys.exit(2)
    video = Path(sys.argv[1])
    out = Path(sys.argv[2])
    model = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(__file__).with_name("yunet.onnx")
    offset = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0

    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)
    det = cv2.FaceDetectorYN.create(str(model), "", (320, 320), 0.6)
    samples, cuts, text_scores = [], [], []
    prev_hist = None
    every = max(1, int(round(fps * STEP)))
    text_every = max(1, int(round(fps * TEXT_STEP)))
    for i in range(n):
        ok, fr = cap.read()
        if not ok:
            break
        if (W, H) != (1920, 1080):
            fr = cv2.resize(fr, (1920, 1080))
        hsv = cv2.cvtColor(cv2.resize(fr, (160, 90)), cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, [32, 32], [0, 180, 0, 256])
        cv2.normalize(hist, hist)
        t = offset + i / fps
        if prev_hist is not None and cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA) > 0.35:
            cuts.append(round(t, 3))
        prev_hist = hist
        if i % every == 0:
            faces = detect(det, fr)
            samples.append({
                "t": round(t, 3),
                "faces": [
                    {
                        "cx": f["cx"] / 1920, "cy": f["cy"] / 1080,
                        "w": f["w"] / 1920, "h": f["h"] / 1080,
                        "score": f["score"],
                    }
                    for f in faces
                ],
            })
        if i % text_every == 0:
            cx0, cx1 = (1920 - CROP_W) / 2, (1920 + CROP_W) / 2
            boxes = text_boxes(fr)
            outside = sum(w * h - max(0, min(x + w, cx1) - max(x, cx0)) * h for x, y, w, h in boxes)
            text_scores.append({"t": round(t, 3), "score": outside / (1920 * 1080)})
    cap.release()

    bounds = [offset] + cuts + [offset + (n / fps if fps else 0)]
    shots = []
    for a, b in zip(bounds, bounds[1:]):
        if b - a < 0.4:
            continue
        own = [s for s in samples if a <= s["t"] < b]
        if not own:
            own = samples
        counts = [len(s["faces"]) for s in own] or [0]
        singles = sum(1 for c in counts if c == 1)
        multi = [s for s in own if len(s["faces"]) >= 2]
        spreads = []
        for s in multi:
            xs0 = min(f["cx"] - f["w"] / 2 for f in s["faces"])
            xs1 = max(f["cx"] + f["w"] / 2 for f in s["faces"])
            spreads.append(xs1 - xs0)
        heights = [max((f["h"] for f in s["faces"]), default=0) for s in own]
        focus = None
        faces = [f for s in own for f in s["faces"]]
        if faces:
            focus = {
                "x": float(np.median([f["cx"] for f in faces])),
                "y": float(np.median([f["cy"] for f in faces])),
            }
        text = [row["score"] for row in text_scores if a <= row["t"] < b]
        shots.append({
            "start": round(a, 3),
            "end": round(b, 3),
            "faceCountMedian": float(np.median(counts)),
            "singleFaceRatio": singles / max(1, len(own)),
            "faceHeight": float(np.percentile(heights, 75)) if heights else 0.0,
            "focus": focus,
            "textScore": float(np.median(text)) if text else 0.0,
            "twoFar": len(multi) >= 0.4 * max(1, len(own)) and (float(np.median(spreads)) > 0.8 * (CROP_W / 1920) if spreads else False),
            "speakerCount": int(round(float(np.median(counts)))),
        })

    payload = {
        "fps": fps,
        "frames": n,
        "srcSize": [W, H],
        "offset": offset,
        "cuts": cuts,
        "samples": samples,
        "text": text_scores,
        "shots": shots,
    }
    out.write_text(json.dumps(payload), encoding="utf-8")
    print(json.dumps({"shots": len(shots), "cuts": cuts, "samples": len(samples)}))


if __name__ == "__main__":
    main()
